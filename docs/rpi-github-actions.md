# CI/CD del frontend en Raspberry Pi 5

El workflow `.github/workflows/frontend-ci-cd.yml` divide el proceso en dos trabajos:

1. **Test and build** se ejecuta en GitHub con Node.js 20, instala con `npm ci`, corre las
   pruebas en Chrome Headless y genera el bundle de producción.
2. **Deploy to Raspberry Pi 5** se ejecuta únicamente para `develop-tesis`, después de que
   el CI termina correctamente, y llama al script local de despliegue.

Los valores de Cloudflare permanecen en `/opt/devops-scripts/.env`. No se deben copiar al
repositorio ni a las variables del workflow.

## 1. Registrar el runner

En GitHub abre **Settings → Actions → Runners → New self-hosted runner**, selecciona Linux y
ARM64 y ejecuta en la RPi los comandos que GitHub genere. Conviene instalar el runner con el
usuario que ya ejecuta correctamente `deploy-lobostats.sh`.

Agrega la etiqueta personalizada:

```text
lobostats-rpi
```

El runner debe terminar con estas etiquetas:

```text
self-hosted, Linux, ARM64, lobostats-rpi
```

Instálalo como servicio siguiendo las instrucciones que GitHub muestra después de
`./config.sh`. No ejecutes el servicio como `root`: `npm ci` ejecuta scripts del repositorio.
La RPi debe tener Node.js 20.19 o posterior, además de las herramientas que ya valida el script.

## 2. Acceso al repositorio privado

No es necesario instalar una deploy key permanente. `actions/checkout` utiliza el token efímero
del workflow y no lo conserva en la configuración Git.

El job crea después un repositorio bare local que contiene exactamente `${GITHUB_SHA}` y se lo
entrega al script mediante una URL `file://`. El script sigue ejecutando
`git clone --branch develop-tesis`, pero ya no depende del estado más reciente de la rama ni de
credenciales persistentes. El repositorio temporal se elimina incluso si falla el despliegue.

## 3. Preparar el script local

Comprueba que el mismo usuario del runner pueda ejecutar sin interacción:

```bash
bash /opt/devops-scripts/Angular/deploy-lobostats.sh \
  lobostats \
  /ruta/a/un/clone-local-de-LoboStats_FE \
  6100 \
  develop-tesis
```

El servicio de Actions no puede escribir una contraseña de `sudo`. Conserva la ejecución de
Node y Git como usuario sin privilegios y concede únicamente los permisos administrativos que
el script necesita. Evita ejecutar todo el runner como `root` o habilitar `NOPASSWD: ALL`.

Protege los archivos locales:

```bash
chmod 750 /opt/devops-scripts/Angular/deploy-lobostats.sh
chmod 600 /opt/devops-scripts/.env
```

El usuario del runner debe poder leer ambos archivos.

## 4. Proteger producción

Crea el environment **production** en **Settings → Environments**. Opcionalmente configura un
revisor requerido para aprobar cada despliegue.

En la protección de `develop-tesis`, exige el check **Test and build** antes de integrar cambios.

## Activación

- Un pull request hacia `develop-tesis` ejecuta solamente CI.
- Un push a `develop-tesis` ejecuta CI y, si pasa, despliega en la RPi.
- **Actions → Frontend CI/CD → Run workflow** permite ejecutar el proceso manualmente y elegir
  si debe desplegar.

Los despliegues se serializan para impedir que dos procesos modifiquen Nginx, releases o
Cloudflare simultáneamente. El smoke test público hace fallar el job si el sitio no responde.
