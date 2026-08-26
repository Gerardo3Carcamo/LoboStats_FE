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

La aplicación abre en `http://localhost:4200` y consume la API publicada en `https://lobostats-api.arechsolutions.com/api`. La URL está centralizada en `src/app/core/config/api.config.ts`.

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
- Registro institucional, verificación por código e inicio/cierre de sesión con rutas privadas.
- Sesión mediante cookies HttpOnly y protección CSRF; el frontend no almacena tokens.

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

El frontend usa `https://lobostats-api.arechsolutions.com/api`. Autenticación consume `/auth/register`, `verify`, `resend-code`, `login`, `refresh`, `refresh-csrf`, `logout` y `me`. Todas las solicitudes incluyen credenciales. Los JWT permanecen en cookies HttpOnly; únicamente los valores CSRF, que no conceden acceso por sí solos, se conservan en `sessionStorage` y se envían en `X-CSRF-TOKEN` para métodos mutables.

Las rutas públicas son `/login`, `/registro` y `/verificar`. El resto requiere una sesión válida y conserva la URL solicitada para continuar después del acceso.
