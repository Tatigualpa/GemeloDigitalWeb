# Insumos para el Informe — Bimestre 2

Este documento reúne toda la información técnica generada durante la implementación del Bimestre 2 (MQTT + Docker + Node-RED), organizada según una estructura sugerida de informe. La idea es que quien escriba el informe use esto como fuente de datos y los convierta en prosa — no es el informe en sí, es el material de base.

Fuentes de este documento: [PLAN_BIMESTRE2.md](PLAN_BIMESTRE2.md) (bitácora completa de implementación), [REQUISITOS_BIMESTRE2.md](REQUISITOS_BIMESTRE2.md) (rúbrica), y el código real del repositorio.

---

## Estructura sugerida del informe

Sigue la misma lógica académica que `Informe_Proyecto_G6.pdf` (bimestre 1), pero enfocada en lo que se agregó. No hace falta repetir todo el bimestre 1 en detalle — basta con referenciarlo como línea base y dedicar el cuerpo del informe a lo nuevo.

1. Resumen Ejecutivo
2. Introducción
3. Objetivos (General y Específicos)
4. Marco Teórico (conceptos nuevos: MQTT, Mosquitto, Docker, Node-RED, servomotores)
5. Diseño del Sistema (arquitectura actualizada + diagrama — **entregable obligatorio**)
6. Implementación del Hardware (conexión del servo + tabla de conexiones completa)
7. Implementación del Software (firmware, Docker, Node-RED, puente MQTT-WebSocket)
8. Tópicos MQTT
9. Metodología de Funcionamiento (arranque del sistema completo, paso a paso)
10. Pruebas Realizadas
11. Resultados Obtenidos
12. Análisis y Discusión (incluye incidentes técnicos resueltos — es contenido legítimo y valioso para esta sección)
13. Conclusiones
14. Recomendaciones
15. Bibliografía
16. Anexos (los 4 obligatorios + otros)

---

## 1. Resumen Ejecutivo — insumos

- El proyecto evoluciona de un enlace punto a punto (USB serial) a una arquitectura de red completa: el ESP32 se conecta a un hotspot WiFi y publica los datos de los 3 sensores (hombro, codo, muñeca) por MQTT a un broker Mosquitto, contenerizado en Docker.
- Se agrega un dashboard Node-RED (también en Docker) que visualiza los sensores en tiempo real, persiste su último estado, y controla remotamente un **actuador nuevo**: un servomotor que representa la mano del gemelo digital.
- La aplicación web 3D del bimestre 1 se conserva funcionando, ahora alimentada por MQTT en vez de serial, gracias a un puente adicional que no requirió modificar ni un componente de React existente.
- Todo el software (Docker, Node-RED, el puente MQTT, y la compilación del firmware) fue construido y **verificado con pruebas reales** antes de tener el hardware físico disponible, simulando al ESP32 con mensajes MQTT de prueba.

## 2. Introducción — insumos

- Contexto: continuación directa del proyecto del bimestre 1 (gemelo digital de brazo con 3 sensores MPU6050).
- Motivación del cambio: el enunciado del bimestre 2 exige que la comunicación entre el ESP32 y la interfaz de usuario sea obligatoriamente por MQTT, con Mosquitto y Node-RED corriendo en contenedores Docker separados, y que el ESP32 se conecte por WiFi a un hotspot creado por el computador que ejecuta los contenedores.
- Cita textual del enunciado (`SISEMB-B2-PROY.pdf`) útil para esta sección:
  > "Ahora la comunicación entre el ESP32 y la interfaz de usuario deberá realizarse de forma obligatoria mediante el protocolo MQTT, utilizando un broker Mosquitto y un dashboard desarrollado en Node-RED, ambos ejecutándose en contenedores Docker (1 docker por cada uno)."

## 3. Objetivos — insumos

**Objetivo general:** extender el gemelo digital de brazo del bimestre 1 con una arquitectura de comunicación inalámbrica basada en MQTT, un sistema de monitoreo y control remoto mediante Node-RED, y un actuador físico controlable a distancia.

**Objetivos específicos sugeridos:**
- Migrar la transmisión de datos de los sensores de un enlace serial cableado a un enlace inalámbrico WiFi + MQTT.
- Desplegar un broker MQTT (Mosquitto) y un dashboard de monitoreo/control (Node-RED) en contenedores Docker independientes.
- Diseñar e integrar un actuador (servomotor) que represente la mano del gemelo digital, controlable desde el dashboard con confirmación de estado.
- Definir una jerarquía de tópicos MQTT organizada para separar sensores, comandos y confirmaciones.
- Implementar persistencia del estado de los sensores sin depender de una base de datos externa.
- Conservar la visualización 3D desarrollada en el bimestre 1 como parte de la solución final.

## 4. Marco Teórico — insumos (conceptos nuevos respecto al bimestre 1)

El bimestre 1 ya cubre: gemelos digitales, MPU6050, ESP32, I2C, TCA9548A, WebSockets, React, Three.js. Para el bimestre 2 hace falta agregar:

- **MQTT (Message Queuing Telemetry Transport):** protocolo de mensajería ligero basado en el modelo Publicador/Suscriptor/Broker, diseñado para dispositivos con recursos limitados y redes inestables. Desarrollado en 1999 por IBM.
- **Broker MQTT / Mosquitto:** servidor que enruta los mensajes entre publicadores y suscriptores sin que estos se conozcan entre sí. Mosquitto es una implementación open-source ampliamente usada.
- **Docker / Docker Compose:** tecnología de contenedores que permite ejecutar Mosquitto y Node-RED de forma aislada y reproducible, orquestados juntos mediante un único archivo `docker-compose.yml`.
- **Node-RED:** plataforma de programación visual basada en flujos (flow-based programming), originalmente de IBM, usada aquí como dashboard de monitoreo y como lógica de control del actuador.
- **Servomotores (SG90 o equivalente):** actuadores que giran a un ángulo específico mediante una señal PWM, usados aquí para representar la mano del gemelo digital (abrir/cerrar).

## 5. Diseño del Sistema — insumos

### Arquitectura general (para el diagrama obligatorio)

```
ESP32 + 3× MPU6050 (TCA9548A)
   │  WiFi → hotspot del computador
   ▼
MQTT publish (sensores) ──► Mosquitto (Docker, puerto 1883) ◄── MQTT publish/subscribe
   │                                    │
   │                          Node-RED (Docker, puerto 1880)
   │                          - Dashboard (gauges por articulación)
   │                          - Persistencia del último estado
   │                          - Switch → publica comando del actuador
   │                                    │
   └────── MQTT subscribe (comando actuador) ──────┘
   ▼
Servo ("mano" del gemelo digital)

Rama paralela (conserva el bimestre 1):
MQTT (sensores) → puente mqtt-ws-bridge.js → WebSocket local (mismo puerto que usaba el
puente serial) → App React + Three.js (brazo 3D, sin ningún cambio de código)
```

**Nota para quien dibuje el diagrama formal:** esto describe 2 flujos que comparten el mismo origen de datos (MQTT) pero llegan a 2 destinos distintos (dashboard Node-RED y app 3D), sin que uno dependa del otro. Vale la pena mostrar ambos caminos para que se entienda que la app 3D del bimestre 1 no se perdió, se conservó.

### Decisiones de diseño y su justificación

- **Actuador elegido — servomotor, no LED:** se evaluaron ambas opciones explícitamente. Un LED era la alternativa más simple (coincide con el ejemplo de la guía de clase, no requiere piezas nuevas), pero no tiene ninguna relación física con el concepto de "brazo". El servo, en cambio, se definió como la **mano** del gemelo digital: los 3 sensores solo observan el movimiento (hombro, codo, muñeca), mientras que el servo es la única pieza que actúa — abre o cierra según la orden del dashboard. Esto le da una narrativa coherente al proyecto: de un sistema que solo mide a uno que también actúa.
- **Se conserva la app React 3D:** en vez de que el dashboard de Node-RED reemplace la interfaz del bimestre 1, se agregó un puente adicional (`mqtt-ws-bridge.js`) que traduce MQTT al mismo formato WebSocket que la app ya esperaba. Cero líneas de la app React se modificaron.
- **Tópicos organizados jerárquicamente** (`g6/brazo/...`) en vez de un único tópico plano — cumple explícitamente el requisito de "tópicos MQTT correctamente organizados".
- **Persistencia del estado de los sensores** vía el mecanismo de *context storage* nativo de Node-RED (con backend de archivo en disco), en vez de agregar una base de datos aparte — cumple el requisito sin sumar otro contenedor ni otra tecnología.

## 6. Implementación del Hardware — insumos

### Componentes agregados respecto al bimestre 1

| Componente | Modelo | Cantidad | Función |
|---|---|---|---|
| Servomotor | SG90 (o equivalente 5V) | 1 | Actuador — representa la mano del gemelo digital |

### Tabla de conexiones completa (I2C + servo)

| Pin ESP32 | Señal | Destino |
|---|---|---|
| 3V3 | VCC | VCC del TCA9548A y de los 3 MPU6050 |
| GND | GND | GND del TCA9548A, de los 3 MPU6050 y del servo |
| GPIO 21 | SDA | SDA del TCA9548A |
| GPIO 22 | SCL | SCL del TCA9548A |
| GPIO 18 | PWM | Señal de control del servo |
| 5V | Alimentación | Alimentación del servo (vía el propio cable USB) |

| Canal del TCA9548A | Sensor | Articulación |
|---|---|---|
| Canal 0 | MPU6050 #1 | Hombro |
| Canal 1 | MPU6050 #2 | Codo |
| Canal 3 | MPU6050 #3 | Muñeca |

**Nota de calidad de datos, útil para "Análisis y Discusión":** al preparar este bimestre se detectó que la tabla de conexiones del informe del bimestre 1 (sección 7) indicaba erróneamente "Canal 2" para la muñeca, mientras que el firmware real y el `README.md` usan "Canal 3". Se dejó documentado que el código es la fuente de verdad y se corrigió el criterio antes de volver a cablear el sistema.

**Ángulos del servo:** 0° = mano abierta (estado `OFF`), 90° = mano cerrada (estado `ON`).

## 7. Implementación del Software — insumos

### 7.1 Firmware ESP32

- Se creó un sketch **nuevo y separado**: `firmware/esp32_mqtt_g6/esp32_mqtt_g6.ino`. El sketch original del bimestre 1 (`firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino`) se conservó sin ninguna modificación, como respaldo funcional garantizado.
- La lógica de lectura I2C de los MPU6050 a través del TCA9548A (selección de canal, lectura/escritura de registros, inicialización del sensor) se mantuvo **exactamente igual** a la del bimestre 1 — no se reescribió, se reutilizó tal cual.
- Se agregaron tres capas nuevas: conexión WiFi (`WiFi.h`), cliente MQTT (`PubSubClient`), y control del servo (`ESP32Servo`).
- **Decisión técnica:** se descartó la librería `ArduinoJson` para construir los mensajes MQTT. Como el payload de cada sensor tiene siempre la misma forma fija (`ax, ay, az, gx, gy, gz`), se optó por construir el JSON manualmente con `snprintf`, evitando una dependencia externa y el riesgo de incompatibilidad entre las versiones 6 y 7 de esa librería (tienen APIs distintas).
- El firmware confirma el estado real del actuador (no solo el comando recibido) publicando en un tópico de confirmación con la bandera *retain* activada, para que el dashboard siempre muestre el último estado real aunque se recargue la página.

### 7.2 Infraestructura Docker

- `docker-compose.yml` en la raíz del proyecto, con 2 servicios independientes: `mosquitto` (imagen `eclipse-mosquitto`, puerto `1883`) y `nodered` (imagen `nodered/node-red`, puerto `1880`) — cumple el requisito de "1 docker por cada uno".
- `mosquitto/config/mosquitto.conf`: listener en el puerto 1883, conexiones anónimas permitidas (apropiado para una red local de hotspot cerrada), persistencia habilitada a disco.

### 7.3 Dashboard Node-RED

- Se instaló el palette `node-red-dashboard`.
- El flujo se construyó con 18 nodos en total: un nodo de configuración del broker MQTT, 3 nodos de entrada MQTT (uno por sensor, con parseo automático de JSON), un nodo `function` centralizado que persiste el último estado de cada sensor, plantillas visuales personalizadas para cada articulación, un switch de dashboard para el actuador, un nodo de salida MQTT para el comando, un nodo de entrada MQTT para la confirmación, y una plantilla visual (badge) que muestra el estado confirmado con color semántico (verde = encendido, gris = apagado).
- **Diseño visual (UX):** el dashboard se organizó en 2 filas — la primera con el encabezado (título, descripción, instrucciones de uso) y el panel de control del actuador; la segunda con las 3 tarjetas de sensores, cada una con un color de acento distinto (azul para hombro, verde-azulado para codo, ámbar para muñeca) y los valores de acelerómetro/giroscopio alineados en una grilla.
- **Persistencia:** habilitada mediante la configuración `contextStorage` de Node-RED (backend de sistema de archivos), que escribe el estado a disco cada 30 segundos — satisface el requisito de "almacenar el estado actual de los sensores" sin necesitar una base de datos adicional.

### 7.4 Puente MQTT → WebSocket (preservación de la app 3D)

- Script nuevo `scripts/mqtt-ws-bridge.js`, que coexiste con el puente serial original sin reemplazarlo.
- Antes de escribirlo se analizó en detalle el contrato que la app React ya esperaba: no bastaba con reenviar los valores crudos de los sensores, la aplicación también necesita los ángulos de orientación (`roll`, `pitch`, `yaw`) ya calculados, porque el sistema de calibración opera sobre esos ángulos. El cálculo (un filtro complementario que combina acelerómetro y giroscopio) se replicó fielmente desde el puente original.
- El puente también atiende el comando de recalibración que la aplicación envía al presionar el botón "Calibrar".

## 8. Tópicos MQTT — insumos (tabla completa)

| Tópico | Publica | Payload | Retain |
|---|---|---|---|
| `g6/brazo/sensores/hombro` | ESP32 | `{"ax":N,"ay":N,"az":N,"gx":N,"gy":N,"gz":N}` | No |
| `g6/brazo/sensores/codo` | ESP32 | ídem | No |
| `g6/brazo/sensores/muneca` | ESP32 | ídem | No |
| `g6/brazo/actuador/cmd` | Node-RED (dashboard) | `ON` / `OFF` | No |
| `g6/brazo/actuador/estado` | ESP32 (confirmación) | `ON` / `OFF` | **Sí** |

## 9. Metodología de Funcionamiento — insumos (arranque paso a paso)

1. Se activa el hotspot WiFi del computador que ejecutará los contenedores Docker.
2. Se obtiene la IP de ese computador dentro de la red del hotspot (no se usa `localhost`, porque el ESP32 es un dispositivo distinto en la red).
3. Se levantan los contenedores: `docker compose up -d`.
4. Se sube el firmware al ESP32 con las credenciales del hotspot y la IP del broker ya configuradas.
5. El ESP32 se conecta al WiFi, luego al broker MQTT, y comienza a publicar los 3 sensores cada ciclo de lectura.
6. El dashboard de Node-RED (`http://localhost:1880/ui`) muestra los valores en tiempo real.
7. El usuario acciona el switch del dashboard; el comando viaja por MQTT hasta el ESP32, que mueve el servo y confirma el nuevo estado, reflejado en el dashboard en cuestión de segundos.
8. Opcionalmente, se levanta el puente MQTT-WebSocket y la app React para ver también el brazo 3D reaccionando a los datos reales.

## 10. Pruebas Realizadas — insumos

Todas las pruebas de software se hicieron **sin depender del hardware físico**, simulando al ESP32 con mensajes MQTT publicados manualmente, y fueron verificadas con evidencia concreta, no asumidas:

- **Broker Mosquitto:** prueba de publicación/suscripción real dentro del contenedor — un mensaje de prueba se publicó en un tópico de sensor y se recibió íntegro en un suscriptor independiente.
- **Dashboard Node-RED:** se confirmó la conexión real al broker en los logs del contenedor, que el dashboard responde correctamente por HTTP, y que el archivo de persistencia en disco contiene exactamente los valores publicados durante la prueba, con su marca de tiempo.
- **Puente MQTT-WebSocket:** se construyó un cliente de prueba que se conecta como lo haría la app React real. Se verificó que el formato del mensaje recibido coincide exactamente con lo que la aplicación espera (incluyendo los ángulos de orientación calculados), que las actualizaciones parciales de un solo sensor funcionan correctamente, y que el comando de recalibración se procesa.
- **Firmware:** se compiló el sketch completo con la herramienta oficial de línea de comandos de Arduino (`arduino-cli`), no solo se revisó visualmente. Resultado: compilación sin errores, uso de memoria de programa 72% (946.879 de 1.310.720 bytes), uso de memoria dinámica 14% (48.476 de 327.680 bytes).
- **Pendiente de hardware real** (a completar cuando se conecte el ESP32 físico): lectura real de los 3 sensores, conexión real al WiFi del hotspot, conexión real al broker desde el dispositivo, y movimiento real del servo.

## 11. Resultados Obtenidos — insumos

- Sugerencia: incluir una captura de pantalla del dashboard de Node-RED (`http://localhost:1880/ui`) mostrando las 3 tarjetas de sensores y el panel del actuador.
- Sugerencia: incluir una captura del log de compilación del firmware mostrando el resultado sin errores y el uso de memoria.
- Sugerencia: incluir una captura del log de verificación del broker MQTT (mensaje publicado/recibido).
- Cuando el hardware esté integrado: capturas del brazo real moviéndose junto con el dashboard actualizándose, y del servo respondiendo al switch.

## 12. Análisis y Discusión — insumos

Esta sección se presta especialmente bien para documentar los problemas técnicos reales que se resolvieron durante el desarrollo — demuestra proceso de depuración genuino, no solo el resultado final:

- **Distribución del dashboard en Node-RED:** un primer intento de organizar el layout en filas usando varios grupos independientes no funcionó como se esperaba, porque Node-RED no garantiza cómo se acomodan varios grupos entre sí (depende del ancho disponible en píxeles, no de una regla fija de unidades por fila). La solución fue usar un único grupo por fila, con todo su contenido como widgets internos — el acomodo de widgets dentro de un mismo grupo sí es un comportamiento predecible. También se corrigió un parámetro de tamaño de columna mal configurado que hacía ver todo el dashboard anormalmente angosto.
- **Condición de carrera entre el editor de Node-RED y los cambios desplegados por API:** al iterar el diseño del dashboard mediante la API de administración de Node-RED (en vez de la interfaz gráfica), se detectó que tener el editor abierto en una pestaña del navegador desde antes puede revertir cambios recientes, porque el editor mantiene su propia copia del flujo en memoria. Se identificó la causa exacta y se evitó recurrencias.
- **Gestión de espacio en disco durante la instalación de herramientas de compilación:** al instalar el conjunto de herramientas de compilación para ESP32 (~2 GB), la unidad de sistema del computador de desarrollo se quedó sin espacio suficiente. Se resolvió reubicando los datos de la instalación a una unidad con más espacio disponible, sin perder el trabajo de descarga ya realizado.
- **Verificación cruzada de la documentación existente:** se detectó una inconsistencia entre la tabla de conexiones del informe del bimestre 1 y el comportamiento real del firmware (canal del TCA9548A asignado a la muñeca). Se resolvió tratando el código fuente como fuente de verdad sobre la documentación.
- **Diseño no disruptivo:** en ningún momento del desarrollo se modificó el firmware original, el puente serial original, ni ningún componente de la aplicación React del bimestre 1 — toda la funcionalidad nueva se construyó en archivos adicionales, de modo que el sistema del bimestre 1 sigue siendo un respaldo funcional completo en caso de que algo del bimestre 2 falle durante la demostración.

## 13. Conclusiones — insumos (ideas, no texto final)

- La migración de un enlace serial cableado a una arquitectura MQTT/WiFi no requirió descartar el trabajo del bimestre 1, sino extenderlo con una capa adicional — validando el valor de una arquitectura modular por capas.
- El uso de Docker para Mosquitto y Node-RED permitió aislar la infraestructura de mensajería del resto del proyecto y probarla de forma completamente independiente del hardware físico, acelerando el desarrollo.
- El diseño del actuador como una extensión conceptual del brazo (la "mano") demuestra una integración más completa entre la parte de sensado y la parte de actuación que un simple indicador desconectado del dominio del problema.

## 14. Recomendaciones — insumos

- Antes de instalar entornos de compilación pesados (como el core de ESP32), verificar el espacio disponible en disco.
- Mantener siempre una copia de respaldo funcional del firmware anterior antes de experimentar con uno nuevo, tal como se hizo en este proyecto.
- Al iterar un dashboard de Node-RED por la API de administración, evitar tener el editor gráfico abierto simultáneamente para prevenir que sobreescriba los cambios.

## 15. Bibliografía — referencias nuevas a agregar

Siguiendo el mismo estilo de citas que el informe del bimestre 1:

- OASIS, "MQTT Version 5.0," OASIS Standard, mar. 2019. [En línea]. Disponible en: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html
- Eclipse Foundation, "Eclipse Mosquitto — An open source MQTT broker," 2023. [En línea]. Disponible en: https://mosquitto.org/
- OpenJS Foundation, "Node-RED documentation," 2023. [En línea]. Disponible en: https://nodered.org/docs/
- Docker Inc., "Docker Compose overview," 2023. [En línea]. Disponible en: https://docs.docker.com/compose/
- N. O'Leary, "PubSubClient: A client library for MQTT messaging," GitHub, 2023. [En línea]. Disponible en: https://github.com/knolleary/pubsubclient
- K. Harrington (madhephaestus), "ESP32Servo library," GitHub, 2023. [En línea]. Disponible en: https://github.com/madhephaestus/ESP32Servo

## 16. Anexos — estado de cada entregable obligatorio

| # | Entregable | Ubicación en el repositorio | Estado |
|---|---|---|---|
| 1 | Código fuente del ESP32 | `firmware/esp32_mqtt_g6/esp32_mqtt_g6.ino` | ✅ Listo, compilado sin errores |
| 2 | `docker-compose.yml` | raíz del proyecto | ✅ Listo, probado con `docker compose up -d` |
| 3 | `flows.json` de Node-RED | `nodered/flows.json` | ✅ Listo, exportado del flujo real desplegado |
| 4 | Diagrama de arquitectura | — | ⚠️ **Pendiente** — usar el esquema de la sección 5 de este documento como base para dibujarlo formalmente (por ejemplo en draw.io o similar) |

---

*Este documento se generó a partir del trabajo real registrado en `PLAN_BIMESTRE2.md`. Si se agregan más fases (integración con hardware real, reto de notificaciones), conviene actualizar las secciones 9, 10 y 11 con los resultados finales.*
