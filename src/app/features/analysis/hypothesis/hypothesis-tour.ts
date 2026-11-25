import type { DriveStep } from 'driver.js';

export const HYPOTHESIS_TOUR_REVISION = '2026.11.1';

export const HYPOTHESIS_TOUR_TARGETS = {
  introduction: 'hypothesis-introduction',
  test: 'hypothesis-test',
  data: 'hypothesis-data',
  options: 'hypothesis-options',
  run: 'hypothesis-run',
  results: 'hypothesis-results',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const HYPOTHESIS_TOUR_STEPS: DriveStep[] = [
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.introduction),
    popover: {
      title: 'Formula una pregunta verificable',
      description:
        'Una prueba contrasta una afirmación sobre medias, proporciones, dispersión, asociación o forma de la distribución.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.test),
    popover: {
      title: 'Elige la prueba por diseño',
      description:
        'Distingue una muestra, grupos independientes, mediciones pareadas y bloques. La pregunta y el diseño determinan el contraste.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.data),
    popover: {
      title: 'Asigna las variables',
      description:
        'Selecciona la respuesta, el grupo y, cuando corresponda, la segunda medición o el bloque experimental.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.options),
    popover: {
      title: 'Define H₁ antes de mirar el resultado',
      description:
        'Fija la dirección, la confianza y el método antes de ejecutar. Cambiar estas opciones después puede sesgar la conclusión.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.run),
    popover: {
      title: 'Guarda y ejecuta',
      description:
        'LoboStats guarda la revisión de la hoja, los parámetros, el método y la versión del motor para reproducir el contraste.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(HYPOTHESIS_TOUR_TARGETS.results),
    popover: {
      title: 'Interpreta evidencia y magnitud',
      description:
        'Lee juntos el p-value, el intervalo, la estimación, las advertencias y el tamaño del efecto. No rechazar H₀ no la demuestra.',
      side: 'left',
      align: 'start',
    },
  },
];
