import { computed, DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';

const EXPECTED_PROTOCOL_VERSION = '2';
const REQUEST_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 2_000;
const MAX_PAIR_DURATION_MS = 15 * 60 * 1000;
const MAX_SESSION_DURATION_MS = 30 * 60 * 1000;

type AgentFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const AGENT_BASE_URL = new InjectionToken<string>('AGENT_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://127.0.0.1:43127',
});

export const AGENT_FETCH = new InjectionToken<AgentFetch>('AGENT_FETCH', {
  providedIn: 'root',
  factory: () => globalThis.fetch.bind(globalThis),
});

export type AgentConnectionPhase =
  | 'idle'
  | 'checking'
  | 'creating-session'
  | 'waiting-for-agent'
  | 'verified'
  | 'cancelled'
  | 'unavailable'
  | 'incompatible'
  | 'error';

export interface AgentConnectionState {
  phase: AgentConnectionPhase;
  message: string;
  agentVersion?: string;
}

interface AgentStatusResponse {
  status: 'ok';
  service: 'LoboStats Agent';
  version: string;
  protocolVersion: string;
}

interface AgentSessionView {
  id: string;
  requestId: string;
  origin: string;
  status:
    | 'waiting_for_agent_ui'
    | 'agent_ui_claimed'
    | 'mysql_connecting'
    | 'mysql_objects_ready'
    | 'agent_ui_complete';
  createdAt: string;
  expiresAt: string;
}

interface AgentSessionResponse extends AgentSessionView {
  token: string;
  uiUrl: string;
}

interface ActiveSession {
  id: string;
  token: string;
}

interface PairingOperation {
  id: number;
  controller: AbortController;
  cancelRequested: boolean;
  session?: ActiveSession;
}

class AgentClientError extends Error {
  constructor(
    readonly phase: Extract<
      AgentConnectionPhase,
      'cancelled' | 'unavailable' | 'incompatible' | 'error'
    >,
    message: string,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class AgentApiService {
  private readonly baseUrl = inject(AGENT_BASE_URL);
  private readonly fetchAgent = inject(AGENT_FETCH);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stateSignal = signal<AgentConnectionState>({
    phase: 'idle',
    message: 'Agente local sin comprobar',
  });
  private currentOperation?: PairingOperation;
  private nextOperationId = 0;

  readonly state = this.stateSignal.asReadonly();
  readonly busy = computed(() =>
    ['checking', 'creating-session', 'waiting-for-agent'].includes(this.stateSignal().phase),
  );

  constructor() {
    this.destroyRef.onDestroy(() => void this.cancel(false));
  }

  async pair(openAgentUi: (url: string) => void): Promise<void> {
    if (this.busy()) return;

    const operation: PairingOperation = {
      id: (this.nextOperationId += 1),
      controller: new AbortController(),
      cancelRequested: false,
    };
    this.currentOperation = operation;
    try {
      this.setState('checking', 'Buscando LoboStats Agent en este equipo...');
      const status = await this.readStatus(operation.controller.signal);
      if (status.protocolVersion !== EXPECTED_PROTOCOL_VERSION) {
        throw new AgentClientError(
          'incompatible',
          `El agente usa el protocolo ${status.protocolVersion}; LoboStats requiere la versión ${EXPECTED_PROTOCOL_VERSION}`,
        );
      }

      this.setState('creating-session', 'Creando una sesión local segura...', status.version);
      const session = await this.createSession(operation.controller.signal);
      operation.session = { id: session.id, token: session.token };
      openAgentUi(session.uiUrl);

      this.setState(
        'waiting-for-agent',
        'Completa la verificación en la ventana del agente local',
        status.version,
      );
      await this.waitUntilClaimed(session, operation.controller.signal);
      await this.releaseSession(operation, 'complete');
      if (this.currentOperation === operation) {
        this.setState('verified', 'LoboStats Agent fue verificado correctamente', status.version);
      }
    } catch (error) {
      const normalized = this.normalizeError(error, operation.cancelRequested);
      await this.releaseSession(operation, 'cancel');
      if (this.currentOperation === operation) {
        this.setState(normalized.phase, normalized.message);
      }
      throw normalized;
    } finally {
      if (this.currentOperation === operation) this.currentOperation = undefined;
    }
  }

  async cancel(announce = true): Promise<void> {
    const operation = this.currentOperation;
    if (!operation) return;
    operation.cancelRequested = true;
    operation.controller.abort();
    await this.releaseSession(operation, 'cancel');
    if (this.currentOperation === operation) {
      this.currentOperation = undefined;
      if (announce) this.setState('cancelled', 'Se canceló la conexión con el agente local');
    }
  }

  private async readStatus(signal: AbortSignal): Promise<AgentStatusResponse> {
    const response = await this.request('/v1/status', { method: 'GET' }, signal);
    if (!response.ok) throw new AgentClientError('unavailable', 'LoboStats Agent no respondió');
    const payload: unknown = await response.json();
    if (!isAgentStatus(payload)) {
      throw new AgentClientError('incompatible', 'La respuesta del agente no es compatible');
    }
    return payload;
  }

  private async createSession(signal: AbortSignal): Promise<AgentSessionResponse> {
    const response = await this.request(
      '/v1/import-sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      },
      signal,
    );
    if (!response.ok) {
      throw new AgentClientError('error', 'El agente no pudo crear una sesión segura');
    }
    const payload: unknown = await response.json();
    if (!isAgentSession(payload, this.baseUrl)) {
      throw new AgentClientError('incompatible', 'La sesión devuelta por el agente no es válida');
    }
    const expiresAt = Date.parse(payload.expiresAt);
    const now = Date.now();
    if (expiresAt <= now || expiresAt > now + MAX_SESSION_DURATION_MS) {
      throw new AgentClientError('incompatible', 'La expiración de la sesión no es compatible');
    }
    return payload;
  }

  private async waitUntilClaimed(
    session: AgentSessionResponse,
    signal: AbortSignal,
  ): Promise<void> {
    const deadline = Math.min(Date.parse(session.expiresAt), Date.now() + MAX_PAIR_DURATION_MS);
    while (Date.now() < deadline) {
      if (signal.aborted) {
        throw new AgentClientError('cancelled', 'Se canceló la conexión con el agente local');
      }

      const response = await this.request(
        `/v1/import-sessions/${encodeURIComponent(session.id)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.token}` },
        },
        signal,
      );
      if (response.status === 410) {
        throw new AgentClientError('error', 'La sesión del agente expiró. Inténtalo de nuevo');
      }
      if (response.status === 429) {
        await wait(retryDelay(response), signal);
        continue;
      }
      if (!response.ok) {
        throw new AgentClientError('error', 'No se pudo consultar el estado del agente');
      }

      const payload: unknown = await response.json();
      if (!isAgentSessionState(payload, session.id)) {
        throw new AgentClientError('incompatible', 'El estado devuelto por el agente no es válido');
      }
      if (payload.status === 'agent_ui_complete') return;
      if (payload.status === 'agent_ui_claimed') {
        this.setState(
          'waiting-for-agent',
          'Configura la conexión MySQL en la ventana del agente',
          this.stateSignal().agentVersion,
        );
      } else if (payload.status === 'mysql_connecting') {
        this.setState(
          'waiting-for-agent',
          'El agente está consultando tablas y vistas de MySQL...',
          this.stateSignal().agentVersion,
        );
      } else if (payload.status === 'mysql_objects_ready') {
        this.setState(
          'waiting-for-agent',
          'Revisa los objetos disponibles y finaliza la comprobación',
          this.stateSignal().agentVersion,
        );
      }
      await wait(POLL_INTERVAL_MS, signal);
    }
    throw new AgentClientError('error', 'La verificación tardó demasiado. Inténtalo de nuevo');
  }

  private async releaseSession(
    operation: PairingOperation,
    action: 'cancel' | 'complete',
  ): Promise<void> {
    const session = operation.session;
    operation.session = undefined;
    if (!session) return;

    try {
      await this.request(
        `/v1/import-sessions/${encodeURIComponent(session.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.token}`,
            'X-LoboStats-Session-Action': action,
          },
        },
        undefined,
      );
    } catch {
      // The agent expires abandoned sessions even if local cleanup cannot reach it.
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    flowSignal: AbortSignal | undefined,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abort = (): void => controller.abort();
    flowSignal?.addEventListener('abort', abort, { once: true });
    if (flowSignal?.aborted) controller.abort();

    try {
      return await this.fetchAgent(new URL(path, this.baseUrl), {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      flowSignal?.removeEventListener('abort', abort);
    }
  }

  private normalizeError(error: unknown, cancelRequested: boolean): AgentClientError {
    if (error instanceof AgentClientError) return error;
    if (cancelRequested) {
      return new AgentClientError('cancelled', 'Se canceló la conexión con el agente local');
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new AgentClientError('unavailable', 'No se pudo acceder al agente local');
    }
    return new AgentClientError(
      'unavailable',
      'No se encontró LoboStats Agent. Inícialo y concede acceso a la red local',
    );
  }

  private setState(phase: AgentConnectionPhase, message: string, agentVersion?: string): void {
    this.stateSignal.set(agentVersion ? { phase, message, agentVersion } : { phase, message });
  }
}

function isAgentStatus(value: unknown): value is AgentStatusResponse {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<AgentStatusResponse>;
  return (
    status.status === 'ok' &&
    status.service === 'LoboStats Agent' &&
    typeof status.version === 'string' &&
    typeof status.protocolVersion === 'string'
  );
}

function isAgentSession(value: unknown, baseUrl: string): value is AgentSessionResponse {
  if (!isAgentSessionState(value)) return false;
  const session = value as Partial<AgentSessionResponse>;
  if (
    typeof session.token === 'string' &&
    session.token.length >= 32 &&
    session.token.length <= 256 &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(Date.parse(session.expiresAt)) &&
    typeof session.uiUrl === 'string'
  ) {
    try {
      const url = new URL(session.uiUrl);
      const expectedOrigin = new URL(baseUrl).origin;
      const fragment = new URLSearchParams(url.hash.slice(1));
      return (
        url.origin === expectedOrigin &&
        url.pathname === '/ui/' &&
        fragment.get('session') === session.id &&
        (fragment.get('claim')?.length ?? 0) >= 32 &&
        session.status === 'waiting_for_agent_ui'
      );
    } catch {
      return false;
    }
  }
  return false;
}

function isAgentSessionState(value: unknown, expectedId?: string): value is AgentSessionView {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AgentSessionView>;
  return (
    typeof session.id === 'string' &&
    isUuid(session.id) &&
    (!expectedId || session.id === expectedId) &&
    typeof session.requestId === 'string' &&
    isUuid(session.requestId) &&
    typeof session.origin === 'string' &&
    isHttpOrigin(session.origin) &&
    typeof session.createdAt === 'string' &&
    Number.isFinite(Date.parse(session.createdAt)) &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(Date.parse(session.expiresAt)) &&
    (session.status === 'waiting_for_agent_ui' ||
      session.status === 'agent_ui_claimed' ||
      session.status === 'mysql_connecting' ||
      session.status === 'mysql_objects_ready' ||
      session.status === 'agent_ui_complete')
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

function retryDelay(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, 10_000)
    : POLL_INTERVAL_MS;
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
