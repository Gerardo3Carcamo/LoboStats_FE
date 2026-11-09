import type { DriveStep } from 'driver.js';

export const DESCRIPTIVE_TOUR_REVISION = '2026.11.1';

export const DESCRIPTIVE_TOUR_TARGETS = {
  introduction: 'descriptive-introduction',
  dataset: 'descriptive-dataset',
  variables: 'descriptive-variables',
  grouping: 'descriptive-grouping',
  options: 'descriptive-options',
  run: 'descriptive-run',
  results: 'descriptive-results',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const DESCRIPTIVE_TOUR_STEPS: DriveStep[] = [
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.introduction),
    popover: {
      title: 'Empieza con una pregunta',
      description:
        'Descubre valores típicos, variación, faltantes y posibles valores atípicos. Ejemplo: ¿cuál es el puntaje habitual y cuánto cambia entre estudiantes?',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.dataset),
    popover: {
      title: 'Comprueba la hoja activa',
      description:
        'Verifica el nombre, las observaciones y las variables antes de calcular. Una hoja con 20 observaciones representa 20 casos que se resumirán.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.variables),
    popover: {
      title: 'Elige qué deseas resumir',
      description:
        'Marca una o varias variables. Las numéricas producen medidas y gráficas; el texto, frecuencias; y las fechas, rangos. Ejemplo: edad, altura y puntaje.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.grouping),
    popover: {
      title: 'Compara grupos',
      description:
        'Separa el resultado por una variable categórica cuando necesites comparar poblaciones. Ejemplo: selecciona grupo para obtener resúmenes independientes de A, B y C.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.options),
    popover: {
      title: 'Ajusta solo si lo necesitas',
      description:
        'Para comenzar, conserva 95 % de confianza y 10 intervalos. Más intervalos muestran mayor detalle; menos intervalos facilitan ver la forma general.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.run),
    popover: {
      title: 'Calcula sin alterar la hoja',
      description:
        'LoboStats guarda una revisión y después calcula. Los valores faltantes se excluyen de cada medida, pero su cantidad permanece visible en el resultado.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(DESCRIPTIVE_TOUR_TARGETS.results),
    popover: {
      title: 'Lee el resultado por capas',
      description:
        'Revisa primero centro y dispersión; después usa histograma, caja y Q-Q. Ejemplo: una media alejada de la mediana puede indicar asimetría o valores atípicos.',
      side: 'left',
      align: 'start',
    },
  },
];
