import type { DriveStep } from 'driver.js';

export const PROBABILITY_TOUR_REVISION = '2026.11.2';

export const PROBABILITY_TOUR_TARGETS = {
  introduction: 'probability-introduction',
  distribution: 'probability-distribution',
  mode: 'probability-mode',
  parameters: 'probability-parameters',
  event: 'probability-event',
  run: 'probability-run',
  results: 'probability-results',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const PROBABILITY_TOUR_STEPS: DriveStep[] = [
  {
    element: target(PROBABILITY_TOUR_TARGETS.introduction),
    popover: {
      title: 'Convierte una situación en un modelo',
      description:
        'Define primero qué cuenta la variable aleatoria. Ejemplo: número de estudiantes aprobados, llamadas por hora o estaturas alrededor de una media.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.distribution),
    popover: {
      title: 'Elige la distribución adecuada',
      description:
        'Usa binomial para éxitos en ensayos, Poisson para eventos por intervalo y normal para mediciones continuas aproximadamente simétricas.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.mode),
    popover: {
      title: 'Define qué deseas obtener',
      description:
        'Usa PDF o PMF para valores puntuales, CDF para acumulados, inversa para cuantiles y Evento para combinar límites de forma guiada.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.parameters),
    popover: {
      title: 'Describe el comportamiento esperado',
      description:
        'Cada modelo solicita solo lo necesario. Ejemplo binomial: 10 ensayos con probabilidad de éxito 0.30; normal: media 100 y desviación 15.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.event),
    popover: {
      title: 'Formula la pregunta',
      description:
        'Ingresa un valor o procesa una columna completa. Los resultados por columna pueden almacenarse en la hoja con un nombre nuevo.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.run),
    popover: {
      title: 'Calcula y conserva evidencia',
      description:
        'El cálculo se guarda en el historial del espacio activo con sus parámetros, resultado y versión del motor para poder reproducirlo.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(PROBABILITY_TOUR_TARGETS.results),
    popover: {
      title: 'Interpreta el área resaltada',
      description:
        'El porcentaje responde la pregunta y la gráfica muestra qué valores incluye. Revisa también media, dispersión y supuestos antes de concluir.',
      side: 'left',
      align: 'start',
    },
  },
];
