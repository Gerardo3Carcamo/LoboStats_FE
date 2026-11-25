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
- Datasets remotos revisionados y actualizados después del primer guardado.
- Estadística descriptiva para variables numéricas, categóricas y fechas.
- Agrupación de resultados, intervalos de confianza, histogramas, cajas y gráficas Q-Q.
- Resultados persistidos y exportables como JSON reproducible.
- Historial de análisis con aviso cuando el dataset tiene una revisión posterior.
- Pruebas de hipótesis para medias, proporciones, tasas, varianzas, asociación,
  normalidad, ajuste, aleatoriedad y métodos no paramétricos de Minitab 15.
- Formulación visible de H₀ y H₁, intervalos de confianza, advertencias y
  resultados exportables y reproducibles.
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

La hoja de trabajo permite comprobar y emparejar el agente local. El bearer
token vive solo en memoria y se elimina al completar, cancelar o fallar la
sesion. La UI local permite probar MySQL, seleccionar tablas, vistas y columnas,
configurar filtros y revisar hasta 100 filas. Con el protocolo 4, la hoja recibe
la selección confirmada como un snapshot acotado de hasta 100 000 filas y
1 000 000 de celdas sin recibir las credenciales MySQL.

## Produccion

Los dos contenedores utilizan una red Docker externa compartida:

```bash
docker network create lobostats
docker compose up -d --build
```

El frontend se publica por defecto en el puerto `8080`. nginx sirve la SPA y reenvia `/api` al contenedor `lobostats-api`.
