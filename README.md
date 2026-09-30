# LoboStats Web

Interfaz Angular de LoboStats, laboratorio estadistico abierto para estudiantes de la UAdeC.

## Desarrollo

Requisitos: Node.js 20.19+ y la API en `http://localhost:8000`.

```bash
npm install
npm start
```

La aplicacion queda disponible en `http://localhost:4200`. El proxy de desarrollo dirige `/api` al backend.

## Funcionalidad de Fase 1

- Hoja editable construida con AG Grid Community.
- Importacion CSV, TXT tabulado y XLSX.
- Pegado desde el portapapeles.
- Previsualizacion no destructiva con seleccion de hoja, encabezados, delimitador, codificacion y separador decimal.
- Deteccion inicial de variables numericas y de texto.
- Persistencia local y guardado mediante el API de datasets.
- Layout adaptable a escritorio, tableta y movil.
- Recorrido guiado de la hoja de trabajo, disponible desde el boton Ayuda.

## Recorrido guiado

Los recorridos usan Driver.js y se inician manualmente desde Ayuda. Los pasos
de cada modulo viven en un archivo `*-tour.ts` junto a la funcionalidad. Al
incorporar o cambiar una accion visible, se deben actualizar sus pasos, la
revision del recorrido y las pruebas asociadas. Los selectores del tour usan
atributos `data-tour` y no clases de presentacion.

## Agente local web

El agente local se desarrolla y publica desde un repositorio independiente:

`/Users/gerardo/Source/Repos/Frontend/lobostats-agent`

La aplicacion Angular se comunica con el agente mediante el protocolo HTTP
local versionado, pero no comparte codigo ni dependencias mediante rutas
relativas. Durante el desarrollo el agente escucha exclusivamente en
`http://127.0.0.1:43127`.

## Produccion

Los dos contenedores utilizan una red Docker externa compartida:

```bash
docker network create lobostats
docker compose up -d --build
```

El frontend se publica por defecto en el puerto `8080`. nginx sirve la SPA y reenvia `/api` al contenedor `lobostats-api`.
