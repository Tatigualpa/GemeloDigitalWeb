# Requisitos — Bimestre 2

Gemelo Digital G6 · lista exhaustiva de lo que hay que cumplir, tomada directamente de las fuentes del proyecto — sin interpretar de más. Ver también [PLAN_BIMESTRE2.md](PLAN_BIMESTRE2.md) para el cómo y el orden de trabajo.

## Fuentes usadas

- `SISEMB-B2-PROY.pdf` — enunciado oficial del bimestre 2 (2 páginas). Es la fuente normativa: todo lo marcado como "obligatorio" abajo es cita textual o casi textual de este documento.
- `SISEMB-B2-Semana14-ParaProyecto.pdf` — clase de apoyo sobre MQTT, Docker y Node-RED. No agrega requisitos nuevos, es guía técnica de cómo implementar lo que pide el enunciado.
- `Informe_Proyecto_G6.pdf` — informe entregado en el bimestre 1. Es la línea base: lo que ya está hecho y sobre lo que hay que construir.

---

## 1. Requisitos obligatorios (cita textual del enunciado)

Cada uno con su criterio de cumplimiento — cómo se sabe, en concreto, que está satisfecho — y el estado real hoy.

### 1.1 Sensor + actuador
> "Diseñar e implementar un sistema embebido basado en un ESP32 capaz de adquirir información de uno o más sensores y controlar al menos un actuador."

- **Sensores:** ya cumplido desde el bimestre 1 — 3× MPU6050.
- **Actuador:** **no cumplido todavía.** El bimestre 1 no tiene ningún actuador (verificado contra la tabla de componentes del informe, sección 7 — no aparece ninguno). Hace falta agregar uno físicamente controlable desde el sistema.
- **Criterio de cumplimiento:** debe existir un componente que reciba una orden desde el dashboard y produzca un efecto físico observable (moverse, encenderse, sonar).

### 1.2 Mejorar el proyecto del bimestre 1
> "Tomar como referencia el proyecto presentado en el primer Bimestre." / "Cada grupo deberá implementar y mejorar la versión del proyecto presentado en el 1er bimestre."

- No es aceptable presentar un proyecto nuevo desconectado del anterior — debe ser una evolución del gemelo digital ya construido.

### 1.3 MQTT obligatorio entre ESP32 e interfaz de usuario
> "Ahora la comunicación entre el ESP32 y la interfaz de usuario deberá realizarse de forma obligatoria mediante el protocolo MQTT, utilizando un broker Mosquitto y un dashboard desarrollado en Node-RED, ambos ejecutándose en contenedores Docker (1 docker por cada uno)."

- **No cumplido todavía.** Hoy la comunicación es 100% serial/USB.
- **Criterio de cumplimiento:** el ESP32 debe publicar/suscribirse a tópicos MQTT reales contra un broker Mosquitto; el dashboard de control debe ser Node-RED; Mosquitto y Node-RED deben correr en **dos contenedores Docker separados** (no vale un solo contenedor con todo adentro).

### 1.4 WiFi vía hotspot del computador
> "El ESP32 deberá conectarse a una red WiFi creada mediante un punto de acceso (Hotspot) de un computador, donde también estarán ejecutándose los contenedores Docker. De esta manera, el computador actuará como servidor local para todo el sistema."

- **No cumplido todavía.** El ESP32 no tiene código WiFi hoy.
- **Criterio de cumplimiento explícito:** el punto de acceso debe ser un **hotspot creado por un computador** (no un router doméstico externo), y ese mismo computador debe ser el que corre Docker. No usar `localhost` como dirección del broker desde el ESP32 — debe ser la IP real del computador dentro de la red del hotspot.

### 1.5 Funcionalidades obligatorias
> "El sistema deberá permitir: visualizar las variables medidas en tiempo real; almacenar el estado actual de los sensores; controlar todos los actuadores desde Node-RED; reflejar inmediatamente el cambio de estado del actuador en el dashboard; utilizar tópicos MQTT correctamente organizados."

Desglosado, con criterio de cumplimiento por ítem:

| # | Funcionalidad | Criterio de cumplimiento |
|---|---|---|
| a | Visualizar variables medidas en tiempo real | El dashboard de Node-RED muestra los valores de los 3 sensores actualizándose sin recargar la página |
| b | Almacenar el estado actual de los sensores | El último valor de cada sensor debe sobrevivir aunque se cierre y reabra el dashboard (persistencia, no solo memoria volátil) |
| c | Controlar **todos** los actuadores desde Node-RED | El actuador (o actuadores, si se agrega más de uno) se comanda exclusivamente desde el dashboard — no basta con controlarlo por otro medio |
| d | Reflejar inmediatamente el cambio de estado del actuador | Tras accionar el control, el dashboard debe mostrar el nuevo estado confirmado (no solo el comando enviado, sino la confirmación de que el actuador lo ejecutó) en cuestión de segundo(s) |
| e | Tópicos MQTT correctamente organizados | Jerarquía de tópicos consistente y legible (ver sección 4) — no vale publicar todo en un solo tópico plano |

### 1.6 Tecnologías obligatorias
> "ESP32 · Arduino IDE o PlatformIO · MQTT · Mosquitto · Docker · Docker Compose · Node-RED · WiFi"

Todas deben estar presentes en la entrega final. Ninguna es opcional ni sustituible (por ejemplo, no vale reemplazar Mosquitto por otro broker, ni Node-RED por otro dashboard).

### 1.7 Entregables como anexos al informe
> "Cada grupo deberá entregar como anexos al Informe: 1. Código fuente del ESP32. 2. Archivo docker-compose.yml. 3. Flujo exportado de Node-RED (flows.json). 4. Diagrama de arquitectura del sistema."

| # | Entregable | Formato esperado |
|---|---|---|
| 1 | Código fuente del ESP32 | archivo(s) `.ino` |
| 2 | `docker-compose.yml` | archivo YAML, funcional con `docker compose up -d` |
| 3 | `flows.json` | exportado desde el menú de Node-RED (Export → all flows) |
| 4 | Diagrama de arquitectura | imagen o diagrama que muestre ESP32 → WiFi → Mosquitto → Node-RED → actuador/dashboard |

No se piden explícitamente el `mosquitto.conf` ni el reporte en sí en esta lista, pero son necesarios para que `docker-compose.yml` funcione y para documentar el trabajo — se incluyen igual.

---

## 2. Extra / opcional (no es obligatorio, suma puntaje)

### 2.1 Impresión 3D
> "Se tomará en cuenta para puntos extras aquellos proyectos cuyo prototipado inicial se lo implemente/construya/mejore usando tecnologías de impresión 3D."

- No obligatorio. Aplicaría por ejemplo a un soporte impreso para el servo o para los sensores.

### 2.2 Reto — notificaciones automáticas por umbral
> "Implementar un sistema de notificaciones automáticas utilizando Node-RED cuando alguna variable supere un umbral establecido. La notificación puede enviarse mediante Telegram, correo electrónico, Discord, WhatsApp o similar."

- No obligatorio. Decisión ya tomada contigo: se documenta el cómo (ver `PLAN_BIMESTRE2.md`, sección de reto) pero se implementa solo si sobra tiempo después de cumplir lo obligatorio.

---

## 3. Decisiones de diseño — propuestas mías, ninguna es requisito textual

Estas son elecciones que hice para poder plantear un plan concreto. Ninguna viene impuesta por el enunciado — están abiertas a que las cambies.

| Decisión | Qué propongo | Estado |
|---|---|---|
| Actuador a usar | Servo SG90 en una articulación (ej. codo) | **Propuesto, pendiente de tu confirmación** — el enunciado no dice qué actuador usar, solo que exista uno |
| Conservar la app React 3D del bimestre 1 | Sí, alimentada por un puente MQTT→WebSocket nuevo | **Confirmado por ti** en la conversación anterior |
| Nombres de los tópicos MQTT | `g6/brazo/sensores/{hombro,codo,muneca}`, `g6/brazo/actuador/{cmd,estado}` | Propuesto — el enunciado solo exige que estén "correctamente organizados", no da nombres |
| Cómo se "almacena el estado" de los sensores | Context store de Node-RED con persistencia a archivo (sin agregar una base de datos aparte) | Propuesto — el enunciado no especifica el mecanismo de almacenamiento |
| Canal del reto de notificaciones si se implementa | Correo electrónico (nodo `node-red-node-email`) en vez de Telegram, por ser más simple de configurar | Propuesto, no aplica todavía porque el reto quedó diferido |

---

## 4. Tópicos MQTT propuestos

| Tópico | Publica | Payload | Retain |
|---|---|---|---|
| `g6/brazo/sensores/hombro` | ESP32 | `{"ax":..,"ay":..,"az":..,"gx":..,"gy":..,"gz":..}` | No |
| `g6/brazo/sensores/codo` | ESP32 | ídem | No |
| `g6/brazo/sensores/muneca` | ESP32 | ídem | No |
| `g6/brazo/actuador/cmd` | Node-RED | `ON` / `OFF` | No |
| `g6/brazo/actuador/estado` | ESP32 (confirmación) | `ON` / `OFF` | **Sí** — así el dashboard muestra el último estado real aunque se recargue la página |

---

## 5. Checklist final de verificación

Usar esta lista al terminar la Fase 6 del plan, con el hardware ya integrado, para confirmar que "todo salió bien" antes de dar el proyecto por cerrado.

- [ ] `docker ps` muestra `mosquitto` y `nodered` corriendo simultáneamente (dos contenedores separados).
- [ ] Prueba manual con `mosquitto_pub` / `mosquitto_sub` confirma que el broker enruta mensajes.
- [ ] El ESP32 se conecta al hotspot del computador (no a un router externo) y al broker usando la IP real del computador (no `localhost`).
- [ ] El dashboard de Node-RED en `http://localhost:1880/ui` muestra los 3 sensores actualizándose en tiempo real con el brazo físico.
- [ ] El estado de los sensores persiste si se reinicia el contenedor de Node-RED (no se pierde al recargar la página).
- [ ] El switch/control del actuador en el dashboard mueve el actuador físico.
- [ ] El dashboard refleja el nuevo estado del actuador en pocos segundos tras accionarlo (confirmación real, no solo el comando enviado).
- [ ] Los tópicos MQTT siguen una jerarquía organizada y documentada.
- [ ] `docker-compose.yml` entregado y funcional con `docker compose up -d` desde cero.
- [ ] `flows.json` exportado y actualizado con el flujo final.
- [ ] Diagrama de arquitectura entregado.
- [ ] Código fuente del ESP32 entregado.
- [ ] (Si se implementó) la notificación por umbral se dispara con un valor forzado y llega al canal elegido.

---

## 6. Riesgos identificados para no romper lo que ya funciona

| Riesgo | Cómo se evita |
|---|---|
| Puerto `8081` usado a la vez por `serial-bridge.js` y por el nuevo `mqtt-ws-bridge.js` | Correr solo uno de los dos scripts a la vez, nunca simultáneamente |
| Sobreescribir el `.ino` original al agregar MQTT | El firmware nuevo vive en una carpeta de sketch separada (`firmware/esp32_mqtt_g6/`); el original no se toca |
| `npm install` rompiendo versiones ya instaladas | Instalar únicamente paquetes nuevos (`npm install mqtt`), nunca reinstalar todo ni forzar upgrades de lo existente |
| No hay forma de revertir un cambio que sale mal | Fase 0 del plan: inicializar git con un commit inicial antes de tocar nada |
| Confundir la IP del hotspot con `localhost` | El ESP32 es un dispositivo de red aparte — siempre debe apuntar a la IP real del computador en la red del hotspot (ver Fase 6.3 del plan) |
