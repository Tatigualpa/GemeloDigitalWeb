# Gemelo Digital de Brazo

Aplicación web para visualizar en tiempo real un gemelo digital de brazo usando tres sensores inerciales conectados a un ESP32. El sistema representa hombro, codo, muñeca y mano en una escena 3D hecha con React, Three.js y Tailwind CSS.

## Descripción General

El flujo de datos del proyecto es:

```text
Sensores MPU6050 -> Multiplexor I2C -> ESP32 -> Puerto serial COM3 -> Puente Node.js -> WebSocket local -> App React
```

La app no abre directamente el puerto serial desde el navegador. El ESP32 manda datos por `Serial`, un script local de Node.js lee `COM3`, convierte las lecturas al formato que necesita la interfaz y las publica en:

```text
ws://localhost:8081
```

La app React escucha ese WebSocket local y actualiza el brazo 3D.

## Mapeo de Sensores

Los sensores se leen desde los canales del multiplexor I2C:

```text
Canal 0 -> hombro
Canal 1 -> codo
Canal 3 -> muñeca
```

Internamente la app usa estos nombres:

```text
sensor3 -> hombro
sensor2 -> codo
sensor1 -> muñeca
```

El puente local hace esta conversión automáticamente.

## Formato Que Envía El ESP32

El ESP32 imprime líneas por serial con este formato:

```text
MPU1 Canal 0 -> AX: -13112 AY: -2436 AZ: 9836 | GX: -708 GY: 19 GZ: -174
MPU2 Canal 1 -> AX: -11476 AY: -704 AZ: 12052 | GX: -659 GY: 51 GZ: 58
MPU3 Canal 3 -> AX: 16460 AY: -5128 AZ: -14132 | GX: 4951 GY: 5159 GZ: -6880
```

El script `scripts/serial-bridge.js` detecta `Canal 0`, `Canal 1` y `Canal 3`, extrae `AX`, `AY`, `AZ`, `GX`, `GY`, `GZ`, y construye paquetes completos para la app.

## Sistema Embebido En ESP32

El sistema embebido usa un ESP32 conectado a tres sensores MPU6050 mediante un multiplexor I2C TCA9548A. Cada sensor mantiene la misma dirección I2C del MPU6050, normalmente `0x68`, y el multiplexor permite seleccionar qué sensor se lee en cada momento.

### Conexiones

Conexión general recomendada:

```text
ESP32 3V3  -> VCC del TCA9548A y VCC de los MPU6050
ESP32 GND  -> GND del TCA9548A y GND de los MPU6050
ESP32 GPIO21 -> SDA del TCA9548A
ESP32 GPIO22 -> SCL del TCA9548A
```

Conexión de sensores al TCA9548A:

```text
Canal 0 del TCA9548A -> sensor del hombro
Canal 1 del TCA9548A -> sensor del codo
Canal 3 del TCA9548A -> sensor de la muñeca
```

Mapeo usado por la app:

```text
Canal 0 -> hombro -> sensor3
Canal 1 -> codo   -> sensor2
Canal 3 -> muñeca -> sensor1
```

### Librerías De Arduino

Instala estas librerías desde el Library Manager del IDE de Arduino:

```text
Adafruit MPU6050
Adafruit Unified Sensor
Adafruit BusIO
```

### Código Base Para El ESP32

Este sketch lee los tres sensores por medio del TCA9548A e imprime el formato que entiende el puente local del proyecto.
La versión lista para cargar en el IDE de Arduino está en `firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino`.

```cpp
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#define TCA_ADDR 0x70

Adafruit_MPU6050 mpu;

void selectTcaChannel(uint8_t channel) {
  if (channel > 7) return;

  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

bool beginMpuOnChannel(uint8_t channel) {
  selectTcaChannel(channel);
  delay(20);

  if (!mpu.begin(0x68)) {
    Serial.print("No se detecta MPU en Canal ");
    Serial.println(channel);
    return false;
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(21, 22);

  beginMpuOnChannel(0);
  beginMpuOnChannel(1);
  beginMpuOnChannel(3);
}

void readAndPrintMpu(uint8_t sensorNumber, uint8_t channel) {
  selectTcaChannel(channel);
  delay(5);

  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;

  mpu.getEvent(&accel, &gyro, &temp);

  long ax = accel.acceleration.x * 16384.0 / 9.80665;
  long ay = accel.acceleration.y * 16384.0 / 9.80665;
  long az = accel.acceleration.z * 16384.0 / 9.80665;

  long gx = gyro.gyro.x * 131.0;
  long gy = gyro.gyro.y * 131.0;
  long gz = gyro.gyro.z * 131.0;

  Serial.print("MPU");
  Serial.print(sensorNumber);
  Serial.print(" Canal ");
  Serial.print(channel);
  Serial.print(" -> AX: ");
  Serial.print(ax);
  Serial.print(" AY: ");
  Serial.print(ay);
  Serial.print(" AZ: ");
  Serial.print(az);
  Serial.print(" | GX: ");
  Serial.print(gx);
  Serial.print(" GY: ");
  Serial.print(gy);
  Serial.print(" GZ: ");
  Serial.println(gz);
}

void loop() {
  readAndPrintMpu(1, 0);
  readAndPrintMpu(2, 1);
  readAndPrintMpu(3, 3);

  delay(40);
}
```

### Carga Del Programa

1. Conecta el ESP32 por USB.
2. En el IDE de Arduino selecciona la placa ESP32 correspondiente.
3. Selecciona el puerto del ESP32, normalmente `COM3`.
4. Carga el sketch.
5. Cierra el Monitor Serial antes de ejecutar el puente local del proyecto.

La velocidad serial debe coincidir con el puente:

```text
Serial.begin(115200)
npm run serial
```

Si cambias el sketch a `Serial.begin(9600)`, usa:

```bash
npm run serial:9600
```

## Instalación

Instala las dependencias:

```bash
npm install
```

## Ejecución

Primero cierra cualquier programa que pueda usar el puerto serial, especialmente:

- Monitor Serial del IDE de Arduino.
- Plotter Serial.
- Otra terminal con el puente corriendo.
- Pestañas del navegador que hayan intentado abrir el puerto serial.

Luego abre dos terminales en la carpeta del proyecto.

Terminal 1: puente serial.

```bash
npm run serial
```

Esto abre:

```text
COM3 a 115200 baudios
```

Terminal 2: app web.

```bash
npm run dev -- --force
```

Abre:

```text
http://localhost:5173/
```

Si el ESP32 usa otra velocidad, por ejemplo `9600`, ejecuta:

```bash
npm run serial:9600
```

## Verificar Puertos

Para listar los puertos seriales detectados:

```bash
npm run ports
```

Si `COM3` aparece con `Access denied`, Windows tiene el puerto ocupado. Cierra el Monitor Serial, desconecta y conecta de nuevo el ESP32, y vuelve a ejecutar el puente.

## Depuración Serial

Para ver las líneas crudas que llegan desde el ESP32:

```bash
npm run serial:debug
```

La terminal debe mostrar detección de canales:

```text
[serial] Canal 0 detectado como sensor3
[serial] Canal 1 detectado como sensor2
[serial] Canal 3 detectado como sensor1
```

Y luego lecturas enviadas:

```text
[serial] Lecturas recibidas: 25 | enviadas: 25 | clientes: 1
```

Si no sube `recibidas`, el ESP32 no está enviando datos con el formato esperado. Si no sube `enviadas`, la app no está conectada al WebSocket local.

## Calibración

La calibración fija la posición actual del brazo como posición neutral.

Pasos:

1. Coloca los sensores en el brazo.
2. Deja hombro, codo y muñeca en la posición neutral deseada.
3. No muevas el brazo.
4. Presiona `Calibrar`.
5. Mantén el brazo quieto durante los segundos que aparece `Calibrando...`.
6. Cuando cambie a `Calibrado`, empieza a mover el brazo.

Cada vez que cambies la posición física de los sensores, retires el sistema o reinicies la postura base, vuelve a calibrar.

## Movimiento 3D

La escena 3D está implementada en:

```text
src/components/DigitalArm.jsx
src/components/ArmScene.jsx
```

El brazo usa:

- Hombro: datos del canal 0.
- Codo: datos del canal 1.
- Muñeca: datos del canal 3.

La app aplica una calibración neutral y filtra ruido pequeño para evitar que el brazo tiemble cuando los sensores están quietos.

## Estructura Principal Del Código

```text
scripts/serial-bridge.js       Lee COM3 y publica datos por WebSocket local.
scripts/list-ports.js          Lista los puertos seriales disponibles.
src/hooks/useSensorStream.js   Recibe datos desde ws://localhost:8081 y maneja calibración.
src/components/ArmScene.jsx    Contenedor de la escena 3D y modo pantalla completa.
src/components/DigitalArm.jsx  Modelo 3D del brazo y movimiento articular.
src/components/SensorCard.jsx  Tarjetas con valores AX, AY, AZ, GX, GY, GZ.
src/utils/sensors.js           Utilidades de validación, normalización y calibración.
```

## Scripts Disponibles

```bash
npm run dev
```

Levanta la app web con Vite.

```bash
npm run serial
```

Abre `COM3` a `115200` baudios y publica datos en `ws://localhost:8081`.

```bash
npm run serial:9600
```

Abre `COM3` a `9600` baudios.

```bash
npm run serial:debug
```

Muestra las líneas crudas recibidas desde el ESP32.

```bash
npm run ports
```

Lista los puertos seriales detectados.

```bash
npm run build
```

Genera la versión de producción.

## Problemas Comunes

`Access denied` al abrir COM3:

El puerto está ocupado. Cierra el Monitor Serial, Plotter Serial u otra app que use el puerto.

La app conecta pero no se mueve:

Revisa la terminal de `npm run serial:debug`. Debe detectar los tres canales y aumentar `Lecturas recibidas`.

El brazo se mueve al revés en algún eje:

El eje físico del sensor está montado en sentido contrario. Se corrige en el mapeo visual de `DigitalArm.jsx`.

El brazo tiembla quieto:

Presiona `Calibrar` con el brazo completamente quieto. Si persiste, se debe aumentar la zona muerta del eje que produce ruido.
