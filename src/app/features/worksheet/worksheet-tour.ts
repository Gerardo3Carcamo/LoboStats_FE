import type { DriveStep } from 'driver.js';

export const WORKSHEET_TOUR_REVISION = '2026.11.1';

export const WORKSHEET_TOUR_TARGETS = {
  datasetName: 'dataset-name',
  importData: 'import-data',
  rowActions: 'row-actions',
  localAgent: 'local-agent',
  dataGrid: 'data-grid',
  saveData: 'save-data',
  status: 'workspace-status',
  context: 'workspace-context',
} as const;

const target = (name: string): string => `[data-tour="${name}"]`;

export const WORKSHEET_TOUR_STEPS: DriveStep[] = [
  {
    element: target(WORKSHEET_TOUR_TARGETS.datasetName),
    popover: {
      title: 'Identifica tu conjunto',
      description:
        'Asigna un nombre claro para reconocer los datos cuando los guardes o vuelvas a utilizarlos.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.importData),
    popover: {
      title: 'Importa tus datos',
      description:
        'Carga un archivo CSV, TXT o XLSX. Antes de reemplazar la hoja podrás revisar filas, tipos, faltantes y opciones de lectura.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.rowActions),
    popover: {
      title: 'Pega una tabla',
      description:
        'Copia filas y columnas desde otra aplicación para revisarlas antes de reemplazar la hoja actual.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.localAgent),
    popover: {
      title: 'Importa desde MySQL',
      description:
        'Conecta LoboStats Agent para elegir datos MySQL, revisar una vista previa e importarlos sin guardar tus credenciales.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.dataGrid),
    popover: {
      title: 'Revisa y edita',
      description:
        'Cada fila representa una observación y cada columna una variable. Selecciona una celda para editarla.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.saveData),
    popover: {
      title: 'Guarda en LoboStats',
      description:
        'Envía el conjunto de datos al servidor. Los mensajes inferiores confirman el resultado del guardado.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.status),
    popover: {
      title: 'Consulta el estado',
      description:
        'Aquí se muestran importaciones, cambios pendientes, confirmaciones y errores que requieren atención.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: target(WORKSHEET_TOUR_TARGETS.context),
    popover: {
      title: 'Prepara datos analizables',
      description:
        'Esta guía contextual resume cómo organizar la hoja y cuál será el siguiente módulo disponible.',
      side: 'left',
      align: 'start',
    },
  },
];
