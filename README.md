# LoboStats frontend

SPA Angular 21 para explorar datasets y ejecutar análisis estadísticos contra la API local de LoboStats.

## Requisitos

- Node.js compatible con Angular 21
- Backend disponible en `http://localhost:5000`

## Desarrollo

```bash
npm install
npm start
```

La aplicación abre en `http://localhost:4200`. El servidor de desarrollo redirige `/api` hacia `http://localhost:5000` mediante `proxy.conf.json`.

## Funcionalidad

- Carga CSV con drag and drop o selector de archivo.
- Creación de datasets mediante una tabla editable.
- Metadatos y vista previa paginada.
- Estadística básica y avanzada: descriptiva, pruebas t y Z, intervalos, matrices, normalidad, homogeneidad de varianzas, pruebas no paramétricas, proporciones, correlaciones y potencia.
- ANOVA one-way, two-way, medidas repetidas, post-hoc, efectos principales e interacción.
- Calculadora de 17 distribuciones con PDF/PMF, CDF, cola, cuantiles, intervalos, simulación y curvas Plotly; identificación por ranking y gráficos de probabilidad.
- Dieciséis gráficos organizados por categoría. Chart.js cubre vistas simples y Plotly se carga bajo demanda para boxplot, Q-Q, violín, pairplot, mapa de calor, burbujas y 3D.
- Resultados genéricos adaptados desde `{ results, interpretation, alpha? }`, con tablas jerárquicas, p-value, supuestos y estados de carga/error.
- Estado del dataset en un servicio basado en signals.
- Tutorial guiado y responsive con Driver.js, disponible desde **Ver tutorial** en la barra superior.

## Verificación

```bash
npm test -- --watch=false
npm run build
npm audit
```

Los tests usan Vitest y `HttpTestingController`. El build de producción se genera en `dist/lobostats`.

## Docker

La imagen compila Angular y lo sirve con Nginx. Dentro de una red Docker, el proxy espera que la API se llame `backend` y escuche en el puerto `5000`.

```bash
docker build -t lobostats-web .
docker run --rm -p 4200:80 lobostats-web
```

## API

El frontend usa rutas relativas con base `/api`. Los módulos consumen `basic-stats`, `variance`, `nonparametric`, `proportion`, `correlation`, `power`, `anova`, `charts` y `distributions`. Los datasets cargados se mantienen en memoria durante la sesión del navegador; no se implementa autenticación ni persistencia local.
