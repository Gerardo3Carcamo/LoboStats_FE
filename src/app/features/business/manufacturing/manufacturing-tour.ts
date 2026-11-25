import type { DriveStep } from 'driver.js';

export const MANUFACTURING_TOUR_REVISION = '2026.11.1';

export const MANUFACTURING_TOUR_TARGETS = {
  introduction: 'manufacturing-introduction',
  source: 'manufacturing-source',
  mapping: 'manufacturing-mapping',
  targets: 'manufacturing-targets',
  run: 'manufacturing-run',
  ledger: 'manufacturing-ledger',
  results: 'manufacturing-results',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const MANUFACTURING_TOUR_STEPS: DriveStep[] = [
  {
    element: target(MANUFACTURING_TOUR_TARGETS.introduction),
    popover: {
      title: 'Convierte registros en pérdidas visibles',
      description:
        'Analiza ciclos, paros y calidad sin ocultar qué datos faltan para calcular OEE o capacidad.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.source),
    popover: {
      title: 'Identifica cómo registra la planta',
      description:
        'Usa resumen por turno, bitácora de eventos o ciclos individuales. Cada formato habilita métricas diferentes.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.mapping),
    popover: {
      title: 'Asigna columnas con significado operativo',
      description:
        'Indica dónde están tiempos, estados y conteos. LoboStats no adivina unidades ni interpreta columnas ambiguas.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.targets),
    popover: {
      title: 'Declara estándares de planta',
      description:
        'Ciclo ideal, ciclo estándar, demanda y especificaciones deben venir del proceso, no del resultado observado.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.run),
    popover: {
      title: 'Calcula el pulso de producción',
      description:
        'El análisis conserva el mapeo, unidades, objetivos, filtros y revisión de la hoja para poder reproducirlo.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.ledger),
    popover: {
      title: 'Sigue la contabilidad del tiempo',
      description:
        'Parte del tiempo programado y resta paros, velocidad y calidad hasta llegar al tiempo productivo equivalente.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: target(MANUFACTURING_TOUR_TARGETS.results),
    popover: {
      title: 'Prioriza la pérdida dominante',
      description:
        'Compara ciclo, MTBF, MTTR, Pareto, rendimiento y capacidad antes de elegir una acción de mejora.',
      side: 'left',
      align: 'start',
    },
  },
];
