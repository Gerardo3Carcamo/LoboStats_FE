import { TestBed } from '@angular/core/testing';

import { AGENT_FETCH, AgentApiService } from './agent-api';

const BASE_URL = 'http://127.0.0.1:43127';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_TOKEN = 's'.repeat(43);
const CLAIM_TOKEN = 'c'.repeat(43);

describe('AgentApiService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pairs, verifies and releases a local agent session', async () => {
    const fetchAgent = jasmine
      .createSpy('fetchAgent')
      .and.callFake(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/v1/status')) {
          return jsonResponse({
            status: 'ok',
            service: 'LoboStats Agent',
            version: '0.3.0',
            protocolVersion: '3',
          });
        }
        if (url.endsWith('/v1/import-sessions') && init?.method === 'POST') {
          return jsonResponse(
            {
              id: SESSION_ID,
              requestId: REQUEST_ID,
              origin: 'http://localhost:4200',
              token: SESSION_TOKEN,
              status: 'waiting_for_agent_ui',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              uiUrl: `${BASE_URL}/ui/#session=${SESSION_ID}&claim=${CLAIM_TOKEN}`,
            },
            201,
          );
        }
        if (url.endsWith(`/v1/import-sessions/${SESSION_ID}`) && init?.method === 'GET') {
          return jsonResponse({
            id: SESSION_ID,
            requestId: REQUEST_ID,
            origin: 'http://localhost:4200',
            status: 'agent_ui_complete',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          });
        }
        if (url.endsWith(`/v1/import-sessions/${SESSION_ID}`) && init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      });
    TestBed.configureTestingModule({ providers: [{ provide: AGENT_FETCH, useValue: fetchAgent }] });
    const service = TestBed.inject(AgentApiService);
    const opened: string[] = [];

    await service.pair((url) => opened.push(url));

    expect(opened).toEqual([`${BASE_URL}/ui/#session=${SESSION_ID}&claim=${CLAIM_TOKEN}`]);
    expect(service.state()).toEqual({
      phase: 'verified',
      message: 'LoboStats Agent fue verificado correctamente',
      agentVersion: '0.3.0',
    });
    const deleteCall = fetchAgent.calls.allArgs().find(([, init]) => init?.method === 'DELETE');
    const deleteHeaders = deleteCall?.[1]?.headers as Record<string, string>;
    expect(deleteHeaders['Authorization']).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(deleteHeaders['X-LoboStats-Session-Action']).toBe('complete');
    expect(JSON.stringify(service.state())).not.toContain(SESSION_TOKEN);
  });

  it('rejects an incompatible protocol before creating a session', async () => {
    const fetchAgent = jasmine.createSpy('fetchAgent').and.resolveTo(
      jsonResponse({
        status: 'ok',
        service: 'LoboStats Agent',
        version: '0.1.0',
        protocolVersion: '1',
      }),
    );
    TestBed.configureTestingModule({ providers: [{ provide: AGENT_FETCH, useValue: fetchAgent }] });
    const service = TestBed.inject(AgentApiService);

    await expectAsync(service.pair(() => undefined)).toBeRejected();

    expect(service.state().phase).toBe('incompatible');
    expect(fetchAgent).toHaveBeenCalledTimes(1);
  });

  it('reports an unavailable local agent without exposing technical errors', async () => {
    const fetchAgent = jasmine
      .createSpy('fetchAgent')
      .and.rejectWith(new TypeError('Failed to fetch'));
    TestBed.configureTestingModule({ providers: [{ provide: AGENT_FETCH, useValue: fetchAgent }] });
    const service = TestBed.inject(AgentApiService);

    await expectAsync(service.pair(() => undefined)).toBeRejected();

    expect(service.state().phase).toBe('unavailable');
    expect(service.state().message).toContain('No se encontró LoboStats Agent');
    expect(service.state().message).not.toContain('Failed to fetch');
  });

  it('rejects protocol 3 states reported by a protocol 2 agent', async () => {
    const fetchAgent = jasmine
      .createSpy('fetchAgent')
      .and.callFake(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/v1/status')) {
          return jsonResponse({
            status: 'ok',
            service: 'LoboStats Agent',
            version: '0.2.0',
            protocolVersion: '2',
          });
        }
        if (url.endsWith('/v1/import-sessions') && init?.method === 'POST') {
          return jsonResponse(
            {
              id: SESSION_ID,
              requestId: REQUEST_ID,
              origin: 'http://localhost:4200',
              token: SESSION_TOKEN,
              status: 'waiting_for_agent_ui',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              uiUrl: `${BASE_URL}/ui/#session=${SESSION_ID}&claim=${CLAIM_TOKEN}`,
            },
            201,
          );
        }
        if (url.endsWith(`/v1/import-sessions/${SESSION_ID}`) && init?.method === 'GET') {
          return jsonResponse({
            id: SESSION_ID,
            requestId: REQUEST_ID,
            origin: 'http://localhost:4200',
            status: 'mysql_columns_ready',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          });
        }
        return new Response(null, { status: 204 });
      });
    TestBed.configureTestingModule({ providers: [{ provide: AGENT_FETCH, useValue: fetchAgent }] });
    const service = TestBed.inject(AgentApiService);

    await expectAsync(service.pair(() => undefined)).toBeRejected();

    expect(service.state().phase).toBe('incompatible');
  });

  it('keeps cancellation final and deletes a session created with protocol 2', async () => {
    const fetchAgent = jasmine
      .createSpy('fetchAgent')
      .and.callFake(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/v1/status')) {
          return jsonResponse({
            status: 'ok',
            service: 'LoboStats Agent',
            version: '0.2.0',
            protocolVersion: '2',
          });
        }
        if (url.endsWith('/v1/import-sessions') && init?.method === 'POST') {
          return jsonResponse(
            {
              id: SESSION_ID,
              requestId: REQUEST_ID,
              origin: 'http://localhost:4200',
              token: SESSION_TOKEN,
              status: 'waiting_for_agent_ui',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
              uiUrl: `${BASE_URL}/ui/#session=${SESSION_ID}&claim=${CLAIM_TOKEN}`,
            },
            201,
          );
        }
        if (url.endsWith(`/v1/import-sessions/${SESSION_ID}`) && init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });
    TestBed.configureTestingModule({ providers: [{ provide: AGENT_FETCH, useValue: fetchAgent }] });
    const service = TestBed.inject(AgentApiService);
    let cancellation: Promise<void> | undefined;

    const pairing = service.pair(() => {
      cancellation = service.cancel();
    });
    await expectAsync(pairing).toBeRejected();
    await cancellation;

    expect(service.state().phase).toBe('cancelled');
    const deleteCall = fetchAgent.calls.allArgs().find(([, init]) => init?.method === 'DELETE');
    const deleteHeaders = deleteCall?.[1]?.headers as Record<string, string>;
    expect(deleteHeaders['X-LoboStats-Session-Action']).toBe('cancel');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
