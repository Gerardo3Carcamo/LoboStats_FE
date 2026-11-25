import type { DriveStep } from 'driver.js';

export const REGRESSION_TOUR_REVISION = '2026.11.1';

export const REGRESSION_TOUR_TARGETS = {
  introduction: 'regression-introduction',
  equation: 'regression-equation',
  model: 'regression-model',
  variables: 'regression-variables',
  options: 'regression-options',
  run: 'regression-run',
  results: 'regression-results',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const REGRESSION_TOUR_STEPS: DriveStep[] = [
  {
    element: target(REGRESSION_TOUR_TARGETS.introduction),
    popover: {
      title: 'Construye una relación verificable',
      description:
        'Define qué deseas explicar y qué variables podrían aportar información. El modelo describe asociación, no causalidad.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.equation),
    popover: {
      title: 'Lee la espina de la ecuación',
      description:
        'La respuesta entra por la izquierda, los términos forman la ecuación y el residuo muestra lo que el modelo no explica.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.model),
    popover: {
      title: 'Elige el modelo por respuesta',
      description:
        'Usa regresión lineal para respuestas continuas y logística para categorías binarias, ordinales o nominales.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.variables),
    popover: {
      title: 'Asigna respuesta y predictores',
      description:
        'Selecciona una respuesta y uno o más predictores. Marca como categórico aquello que representa grupos, no cantidades.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.options),
    popover: {
      title: 'Fija la complejidad',
      description:
        'Configura grado, selección, componentes y categorías antes de ajustar. Más términos no garantizan mejores predicciones.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.run),
    popover: {
      title: 'Ajusta y conserva el modelo',
      description:
        'La ejecución guarda datos, especificación, coeficientes, diagnósticos y versión del motor para reproducir el análisis.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(REGRESSION_TOUR_TARGETS.results),
    popover: {
      title: 'Diagnostica antes de predecir',
      description:
        'Examina residuos, VIF, influencia y capacidad predictiva antes de interpretar coeficientes o usar el modelo.',
      side: 'left',
      align: 'start',
    },
  },
];
