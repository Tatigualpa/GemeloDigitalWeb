# Plan de Implementación — Bimestre 2

Gemelo Digital G6 · MQTT + Docker + Node-RED · trabajo conjunto (usuario + Claude), sin hardware disponible por ahora.

Ver también [REQUISITOS_BIMESTRE2.md](REQUISITOS_BIMESTRE2.md) para la lista completa y textual de lo que exige la rúbrica.

## Principio de orden

Las fases están ordenadas de menor a mayor dependencia del hardware físico (ESP32 + sensores + servo). Todo lo que se puede construir y **probar de verdad** sin el hardware va primero. Lo que solo se puede validar con el ESP32 en la mano queda aislado al final, en una sola fase, con su propio checklist y un plan de reversión.

Regla dura en todas las fases: **nada de lo que ya funciona se modifica en el lugar**. Se agregan archivos nuevos al lado de los existentes. Si algo existente debe tocarse, se hace de forma aditiva (se agrega una sección, no se borra una), y se explica exactamente qué cambia antes de tocarlo.

## Estado actual verificado del repositorio

Antes de proponer nada, esto es lo que hay hoy en el proyecto (verificado leyendo los archivos, no asumido):

- `firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino` — sketch original, solo serial, funcional.
- `scripts/serial-bridge.js` y `scripts/list-ports.js` — puente serial → WebSocket, funcional.
- `src/` — app React + Three.js completa, funcional, escucha `ws://localhost:8081`.
- `package.json` — dependencias actuales: `@react-three/drei`, `@react-three/fiber`, `lucide-react`, `react`, `react-dom`, `serialport`, `three`, `ws`. Scripts: `dev`, `serial`, `serial:9600`, `serial:debug`, `serial:9600:debug`, `ports`, `build`, `preview`.
- `.gitignore` existe (ignora `node_modules/`, `dist/`, logs, `.env`) **pero no hay carpeta `.git`** — es decir, el proyecto nunca se inicializó como repositorio git. No hay red de seguridad de versiones todavía.
- No existe ningún `docker-compose.yml`, carpeta `mosquitto/`, ni nada de Node-RED en el repo.

---

## Fase 0 — Red de seguridad (recomendada antes de tocar cualquier cosa)

**Por qué:** no existe control de versiones. Si algo sale mal en una edición, hoy no hay forma de volver atrás salvo rehacer a mano. Esto es lo primero que resuelve tu preocupación de "no romper nada de lo que ya funcionaba".

**Qué propongo (pendiente de tu confirmación, no lo ejecuto solo):**
1. `git init` en la raíz del proyecto.
2. Un primer commit con el estado actual tal cual está, como fotografía de "todo lo que ya funciona".

Esto no cambia el comportamiento de nada — ningún archivo se mueve ni se edita. Es puramente una red de seguridad para poder comparar o revertir en cualquier momento posterior.

**Si prefieres no usar git:** alternativa manual — copiar estos tres archivos a una carpeta `backup/` antes de tocarlos: `firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino`, `scripts/serial-bridge.js`, `package.json`. Es más débil que git (no cubre todo el árbol) pero cubre lo más sensible.

---

## Fase 1 — Infraestructura Docker (nueva, cero contacto con lo existente) ✅ completada 2026-07-13

**Nota de la ejecución real:** al levantar por primera vez este `docker-compose.yml` apareció un choque de nombres/puertos con otro contenedor tuyo — el laboratorio `mqtt_lab` de la guía de clase (`PruebaIIBIM\mqtt_lab`), que ya tenía corriendo sus propios contenedores `mosquitto` y `nodered` en los puertos `1883`/`1880`. Se resolvió deteniendo y eliminando esos contenedores (con tu confirmación explícita) — **sus datos no se tocaron**, viven en `PruebaIIBIM\mqtt_lab\mosquitto\` y `PruebaIIBIM\mqtt_lab\nodered_data\` en disco, y ese laboratorio se puede recrear en cualquier momento con `docker compose up -d` desde su propia carpeta. Si vuelves a trabajar en ese laboratorio mientras este proyecto también necesita los puertos 1883/1880, va a repetirse el mismo choque — hay que detener uno de los dos primero.

Verificado: `docker ps` muestra `mosquitto` y `nodered` de **GemeloDigitalWeb** corriendo (mounts apuntando a esta carpeta, no a `mqtt_lab`). Prueba de mensajería real con `mosquitto_sub`/`mosquitto_pub` dentro del contenedor: un mensaje simulado en `g6/brazo/sensores/hombro` se recibió íntegro. Node-RED responde `HTTP 200` en `http://localhost:1880`.


No requiere hardware. Se puede probar por completo desde la misma computadora.

**Prerrequisito:** Docker Desktop instalado y corriendo en Windows.

**Archivos nuevos a crear** (ninguno existe hoy, ninguno choca con nada):
```
docker-compose.yml
mosquitto/config/mosquitto.conf
mosquitto/data/          (carpeta vacía)
mosquitto/log/           (carpeta vacía)
nodered_data/            (carpeta vacía, la usa el contenedor de Node-RED)
```

`docker-compose.yml`:
```yaml
version: "3"
services:
  mosquitto:
    image: eclipse-mosquitto
    container_name: mosquitto
    restart: always
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log

  nodered:
    image: nodered/node-red
    container_name: nodered
    restart: always
    ports:
      - "1880:1880"
    volumes:
      - ./nodered_data:/data
    depends_on:
      - mosquitto
```

`mosquitto/config/mosquitto.conf`:
```
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
```

**Cómo probarlo sin ESP32:**
```bash
docker compose up -d
docker ps          # deben aparecer "mosquitto" y "nodered"
```
Prueba de mensajería real, sin ningún hardware, en dos terminales:
```bash
# Terminal 1 — queda escuchando
docker exec -it mosquitto sh
mosquitto_sub -h localhost -t g6/brazo/sensores/hombro

# Terminal 2 — publica un mensaje de prueba
docker exec -it mosquitto sh
mosquitto_pub -h localhost -t g6/brazo/sensores/hombro -m "{\"ax\":100,\"ay\":0,\"az\":0}"
```
Si el mensaje aparece en la Terminal 1, el broker funciona de punta a punta. Esto valida el corazón de toda la arquitectura sin haber tocado el ESP32.

**Riesgo de romper algo existente: ninguno.** Ningún archivo del proyecto React/Node se toca.

---

## Fase 2 — Dashboard en Node-RED (nueva, cero contacto con lo existente)

No requiere hardware — se simulan los sensores publicando mensajes MQTT manualmente o con un pequeño script.

1. Abrir `http://localhost:1880`.
2. Menú → *Manage palette* → *Install* → buscar `node-red-dashboard` → instalar.
3. Construir el flujo:
   - 3 nodos `mqtt in` suscritos a `g6/brazo/sensores/hombro`, `.../codo`, `.../muneca` (o uno con wildcard `g6/brazo/sensores/+`).
   - Nodo `json` para parsear el payload.
   - Un gauge o chart del dashboard por articulación.
   - Un `switch` del dashboard → nodo `mqtt out` → tópico `g6/brazo/actuador/cmd`.
   - Un `mqtt in` suscrito a `g6/brazo/actuador/estado` → texto/indicador del dashboard.
   - Un nodo `function` que guarda cada lectura en `flow.set('estado_sensores', msg.payload)` para cumplir "almacenar el estado actual de los sensores".
4. *Deploy*.
5. Exportar el flujo: Menú → *Export* → *all flows* → guardar como `nodered/flows.json` en el proyecto. **Este es uno de los 4 entregables obligatorios y ya se puede tener listo ahora.**

**Cómo probar el dashboard completo sin ESP32:**
```bash
docker exec -it mosquitto sh
mosquitto_pub -h localhost -t g6/brazo/sensores/codo -m "{\"ax\":500,\"ay\":10,\"az\":-200,\"gx\":0,\"gy\":0,\"gz\":0}"
```
El gauge del codo debe reaccionar. Para probar el actuador: mover el switch del dashboard, confirmar en un `mosquitto_sub -t g6/brazo/actuador/cmd` que llegó el comando, y publicar manualmente `mosquitto_pub -t g6/brazo/actuador/estado -m "ON" -r` para ver que el indicador del dashboard se actualiza. Esto valida el requisito de "reflejar inmediatamente el cambio de estado" en software, antes de tener el servo físico.

**Riesgo de romper algo existente: ninguno.** Todo vive dentro del volumen `nodered_data/` y del contenedor.

---

## Fase 2 — Dashboard en Node-RED ✅ completada 2026-07-13

**Cómo se construyó:** en vez de armar el flujo a mano en el navegador, se escribió directamente el `nodered/flows.json` (19 nodos: broker MQTT, 3× `mqtt in` de sensores con parseo JSON automático, un `function` que centraliza el guardado de estado, 3× `ui_template` para lectura en tiempo real, `ui_switch` + `mqtt out` para el actuador, y `mqtt in` + `ui_text` para la confirmación de estado) y se desplegó directo contra la API de administración de Node-RED (`POST /flows`). El palette `node-red-dashboard` se instaló por línea de comandos (`npm install` dentro del contenedor) en vez de por el menú *Manage Palette* — mismo resultado.

**Verificado, no asumido:**
- Log del contenedor confirma la conexión real al broker: `[mqtt-broker] Connected to broker: mqtt://mosquitto:1883`.
- `http://localhost:1880/ui/` responde `200`.
- Se publicaron con `mosquitto_pub` los 3 sensores (con los mismos valores de ejemplo del README) y una confirmación de actuador — cero errores en los logs.
- El archivo `nodered_data/context/g6_flow/flow.json` (persistencia a disco, `contextStorage` habilitado en `settings.js`) contiene exactamente los tres sensores publicados con su timestamp — el requisito de "almacenar el estado actual de los sensores" queda demostrado, no solo declarado.

**Nota sobre `.gitignore`:** al instalar el palette del dashboard, `nodered_data/.npm/` (caché de instalación) casi se cuela al repositorio — no estaba contemplado en la regla original. Se agregó a `.gitignore` antes de comitear nada. Lección para las próximas fases: siempre revisar `git add -A -n` (dry run) antes de un `git add -A` real cuando se instala algo nuevo dentro de un volumen de Docker.

**Rediseño UX (2026-07-13, mismo día):** layout reorganizado a pedido — cabecera a todo el ancho, Hombro/Codo/Muñeca en una sola fila (2+2+2 columnas), panel de Actuador abajo a todo el ancho con el switch y un badge de confirmación de color semántico (verde=ON, gris=OFF) lado a lado. Cada tarjeta de sensor tiene un acento de color propio (hombro azul, codo verde-azulado, muñeca ámbar) y una grilla de 3 columnas para acelerómetro/giroscopio con números alineados (`tabular-nums`). Redesplegado y reverificado sin errores — ver explicación del mecanismo de guardado y del flujo del switch en la conversación / README.

**Lo único que falta de esta fase** es que tú abras el navegador y confirmes que se ve bien — desde este lado ya está probado que la mecánica de datos funciona de punta a punta, pero el render visual final (spacing exacto, si el badge se ve bien en pantallas angostas, etc.) solo se puede juzgar mirándolo.

## Fase 3 — Puente MQTT → WebSocket para conservar la app React (archivo nuevo, no toca `serial-bridge.js`)

Objetivo: la app 3D (`src/`) siga funcionando exactamente igual, pero alimentada por MQTT en vez del puerto serial, sin tocar `DigitalArm.jsx`, `ArmScene.jsx`, `SensorCard.jsx` ni `useSensorStream.js` — todos siguen esperando el mismo formato JSON en `ws://localhost:8081`.

**Archivo nuevo:** `scripts/mqtt-ws-bridge.js` (no reemplaza `scripts/serial-bridge.js`, coexiste con él).

**Dependencia nueva** (aditiva, no quita ni cambia versión de nada existente):
```bash
npm install mqtt
```
Esto solo agrega una línea a `dependencies` en `package.json`; ninguna dependencia existente cambia.

**Importante — no correr los dos puentes a la vez:** tanto `serial-bridge.js` como `mqtt-ws-bridge.js` intentan usar el puerto `ws://localhost:8081`. Se usa uno u otro según la fuente de datos disponible en ese momento (serial real hoy, MQTT cuando el ESP32 hable MQTT). No hace falta borrar ni modificar `serial-bridge.js` para esto — simplemente no se ejecutan ambos scripts al mismo tiempo.

**Cómo probarlo sin ESP32 (pipeline completo simulado):**
```bash
# Terminal 1
node scripts/mqtt-ws-bridge.js

# Terminal 2 — simula al ESP32 publicando los 3 sensores
docker exec -it mosquitto sh
mosquitto_pub -h localhost -t g6/brazo/sensores/hombro -m "{\"ax\":100,\"ay\":0,\"az\":16000,\"gx\":0,\"gy\":0,\"gz\":0}"
mosquitto_pub -h localhost -t g6/brazo/sensores/codo   -m "{\"ax\":100,\"ay\":0,\"az\":16000,\"gx\":0,\"gy\":0,\"gz\":0}"
mosquitto_pub -h localhost -t g6/brazo/sensores/muneca -m "{\"ax\":100,\"ay\":0,\"az\":16000,\"gx\":0,\"gy\":0,\"gz\":0}"

# Terminal 3
npm run dev -- --force
```
Si el brazo 3D en `http://localhost:5173` reacciona a estos mensajes simulados, **todo el pipeline de software está validado de punta a punta** — lo único que falta es el ESP32 real leyendo sensores reales y publicando por WiFi real.

**Riesgo de romper algo existente: ninguno.** `serial-bridge.js` queda intacto y sigue siendo la opción de respaldo funcional del bimestre 1.

---

## Fase 4 — Firmware ESP32 (se escribe y se compila, no se sube todavía)

**Archivo nuevo:** `firmware/esp32_mqtt_g6/esp32_mqtt_g6.ino` — sketch **separado** del original. `firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino` no se toca ni se borra; queda como respaldo funcional garantizado.

**Librerías a instalar ahora en el IDE de Arduino** (esto no requiere el ESP32 conectado):
- `PubSubClient` (cliente MQTT)
- `ESP32Servo` (control del servo — no usar `Servo.h` clásico, es para AVR)
- `ArduinoJson` (armar el payload de cada sensor)

**Qué se puede verificar ahora sin el ESP32 conectado:** en el IDE de Arduino, *Sketch → Verificar/Compilar* (Ctrl+R) con la placa "ESP32 Dev Module" seleccionada. Esto compila el código y detecta errores de sintaxis o de librerías faltantes **sin necesidad de que la placa esté físicamente conectada** — solo *Subir* requiere el puerto real.

**Qué NO se puede verificar todavía (queda pendiente de la Fase 5):**
- Lectura real de los tres MPU6050 vía TCA9548A.
- Conexión real al WiFi del hotspot.
- Conexión real al broker MQTT desde el ESP32.
- Movimiento real del servo.

El contenido exacto del sketch (WiFi + MQTT + publicación de los 3 sensores + suscripción al comando del actuador) se escribe en esta fase; te lo entrego con placeholders claramente marcados para `ssid`, `password` y `mqtt_host`, que se completan recién en la Fase 5 cuando tengas la red del hotspot armada.

---

## Fase 5 — Documentación (se agrega, no se borra nada del README actual)

Se agrega al final de `README.md` una sección nueva "## Bimestre 2 — MQTT, Docker y Node-RED" con las instrucciones de arranque de esta arquitectura. Todo lo que ya está documentado (flujo serial, calibración, troubleshooting) se queda exactamente igual — sigue siendo válido porque `serial-bridge.js` y el sketch original no se tocaron.

---

## Fase 6 — Cuando tengas el hardware

Bloqueada hasta que exista: ESP32, los 3 MPU6050 + TCA9548A (ya los tienes del bimestre 1), y un servo SG90 nuevo.

### 6.1 Hardware adicional a conseguir
- Servo SG90 (o equivalente de 5V, un solo servo).

### 6.2 Conexión física del servo
| Pin ESP32 | Señal | Nota |
|---|---|---|
| GPIO 21 / 22 | I2C (SDA/SCL) | **no tocar** — ya en uso por el TCA9548A, es lo que ya funciona |
| GPIO 18 | Señal PWM del servo | libre, no usado por el sketch original |
| 5V | Alimentación del servo | un solo SG90 puede alimentarse desde el 5V del propio cable USB |
| GND | Tierra del servo | común con el ESP32 |

### 6.3 Configurar el hotspot
1. Activar el punto de acceso móvil (hotspot) del computador que va a correr Docker.
2. Anotar el SSID y la contraseña del hotspot.
3. Con el hotspot activo, en el mismo computador ejecutar `ipconfig` y buscar la IP del adaptador del hotspot (en Windows suele ser `192.168.137.1`). Esa es la IP que el ESP32 usará como `mqtt_host` — **nunca** `localhost`, porque el ESP32 es otro dispositivo en la red.

### 6.4 Completar y subir el firmware
1. Abrir `firmware/esp32_mqtt_g6/esp32_mqtt_g6.ino`.
2. Reemplazar únicamente los placeholders `ssid`, `password` y `mqtt_host` con los datos reales del paso 6.3.
3. Conectar el ESP32 por USB, cerrar el Monitor Serial de cualquier otra instancia abierta.
4. Seleccionar placa "ESP32 Dev Module" y el puerto COM correspondiente.
5. Subir.
6. Abrir el Monitor Serial a 115200 baudios y confirmar en el log: conexión WiFi exitosa → conexión MQTT exitosa → publicación de los tres sensores.

### 6.5 Verificación end-to-end
1. `docker compose up -d` (si no estaba ya corriendo).
2. Abrir `http://localhost:1880/ui` — las tarjetas de los tres sensores deben moverse con el brazo real.
3. Mover el switch del dashboard — el servo físico debe moverse.
4. Confirmar que el indicador de estado del dashboard cambia en menos de 1 segundo tras mover el switch.
5. (Opcional, para conservar la app 3D) en dos terminales aparte: `node scripts/mqtt-ws-bridge.js` y `npm run dev -- --force`, confirmar que el brazo 3D también reacciona a los datos reales.
6. Exportar `flows.json` actualizado si se hicieron cambios al flujo durante la integración.

### 6.6 Plan de reversión (rollback)
Si el nuevo firmware falla, se comporta de forma inestable, o el WiFi/MQTT no conecta y hace falta demostrar el proyecto ya:
1. Volver a subir `firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino` (nunca se modificó).
2. Volver a usar `npm run serial` + `npm run dev -- --force` tal como está documentado en el README original.
3. El sistema vuelve exactamente al estado 100% funcional del bimestre 1, sin pasos adicionales, porque nada de esa ruta fue modificado en ningún momento.

---

## Resumen — qué se hace hoy vs qué espera al hardware

| Fase | Necesita el ESP32/servo físico | Se prueba hoy |
|---|---|---|
| 0 — Red de seguridad (git) | No | Sí |
| 1 — Docker (Mosquitto + Node-RED) | No | Sí, con `mosquitto_pub`/`sub` |
| 2 — Dashboard Node-RED | No | Sí, con mensajes MQTT simulados |
| 3 — Puente MQTT→WebSocket + app 3D | No | Sí, pipeline completo simulado |
| 4 — Firmware (escritura + compilación) | No para compilar, sí para subir/probar | Compilación sí, ejecución no |
| 5 — Documentación | No | Sí |
| 6 — Integración física, WiFi real, servo real | Sí | Solo cuando llegue el hardware |
