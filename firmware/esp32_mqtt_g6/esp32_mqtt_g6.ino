// ============================================================================
// Gemelo Digital de Brazo -- ESP32 + 3x MPU6050 (TCA9548A) + MQTT + Servo
//
// Bimestre 2: agrega WiFi + MQTT + un actuador (servo, hace de "mano" del
// gemelo digital) sobre la MISMA lectura de sensores de
// firmware/esp32_mpu_tca9548a/esp32_mpu_tca9548a.ino -- ese sketch original
// no se modifica, este es un sketch nuevo y separado (queda como respaldo
// funcional si algo sale mal con este).
//
// Los 3 sensores (hombro/codo/muneca) solo OBSERVAN el movimiento del brazo.
// El servo es la unica pieza que ACTUA: representa la mano, y se abre/cierra
// segun la orden que llega por MQTT desde el switch del dashboard de
// Node-RED (topico g6/brazo/actuador/cmd). Confirma lo que hizo publicando
// en g6/brazo/actuador/estado, que es lo que el dashboard muestra como
// "estado confirmado".
//
// IMPORTANTE: completar WIFI_SSID / WIFI_PASSWORD / MQTT_HOST (mas abajo,
// marcados con TODO) recien cuando exista el hotspot real -- ver
// PLAN_BIMESTRE2.md, Fase 6.3. Mientras tanto este archivo se puede
// compilar (Sketch -> Verificar) sin el ESP32 conectado.
//
// Librerias necesarias (Library Manager del IDE de Arduino):
//   - PubSubClient (Nick O'Leary)
//   - ESP32Servo (Kevin Harrington / madhephaestus)
// No se usa ArduinoJson a proposito: el payload de cada sensor es siempre
// el mismo shape fijo (ax,ay,az,gx,gy,gz), asi que se arma a mano con
// snprintf en vez de agregar una libreria mas para tan poco.
// ============================================================================

#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>

// ---------------------------------------------------------------------------
// I2C / TCA9548A / MPU6050 -- IDENTICO al sketch original (mismos registros,
// mismos pines, mismo orden de canales). No se le cambia la logica de
// lectura, solo se le agrega a donde mandar el resultado (MQTT ademas de
// Serial).
// ---------------------------------------------------------------------------
#define SDA_PIN 21
#define SCL_PIN 22
#define TCA_ADDR 0x70
#define MPU_ADDR 0x68

struct SensorConfig {
  byte numero;
  byte canal;
};

const SensorConfig SENSORES[] = {
  {1, 0},  // Canal 0 -> hombro
  {2, 1},  // Canal 1 -> codo
  {3, 3},  // Canal 3 -> muneca
};
const byte TOTAL_SENSORES = sizeof(SENSORES) / sizeof(SENSORES[0]);

// Mismo orden que SENSORES[] de arriba: el topico MQTT de cada sensor segun
// su articulacion (ver README.md, seccion "Mapeo de Sensores").
const char* TOPICS_SENSORES[] = {
  "g6/brazo/sensores/hombro",
  "g6/brazo/sensores/codo",
  "g6/brazo/sensores/muneca",
};

bool seleccionarCanalTCA(byte canal) {
  if (canal > 7) {
    return false;
  }

  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << canal);
  byte error = Wire.endTransmission();
  delay(5);

  return error == 0;
}

byte leerRegistro(byte canal, byte registro) {
  if (!seleccionarCanalTCA(canal)) {
    return 0xFF;
  }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(registro);
  byte error = Wire.endTransmission(false);

  if (error != 0) {
    return 0xFF;
  }

  Wire.requestFrom(MPU_ADDR, (uint8_t)1, (uint8_t)true);

  if (Wire.available()) {
    return Wire.read();
  }

  return 0xFE;
}

bool escribirRegistro(byte canal, byte registro, byte valor) {
  if (!seleccionarCanalTCA(canal)) {
    return false;
  }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(registro);
  Wire.write(valor);
  byte error = Wire.endTransmission(true);

  return error == 0;
}

bool inicializarMPU(byte canal) {
  if (leerRegistro(canal, 0x75) != 0x68) {
    return false;
  }

  escribirRegistro(canal, 0x6B, 0x80);
  delay(100);

  if (!escribirRegistro(canal, 0x6B, 0x00)) {
    return false;
  }
  delay(100);

  escribirRegistro(canal, 0x1A, 0x03);
  escribirRegistro(canal, 0x1B, 0x00);
  escribirRegistro(canal, 0x1C, 0x00);

  return true;
}

bool leerMPU(byte canal, int16_t &ax, int16_t &ay, int16_t &az,
             int16_t &gx, int16_t &gy, int16_t &gz) {
  if (!seleccionarCanalTCA(canal)) {
    return false;
  }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  byte error = Wire.endTransmission(false);

  if (error != 0) {
    return false;
  }

  int n = Wire.requestFrom(MPU_ADDR, (uint8_t)14, (uint8_t)true);

  if (n != 14) {
    return false;
  }

  ax = (int16_t)((Wire.read() << 8) | Wire.read());
  ay = (int16_t)((Wire.read() << 8) | Wire.read());
  az = (int16_t)((Wire.read() << 8) | Wire.read());

  Wire.read();
  Wire.read();

  gx = (int16_t)((Wire.read() << 8) | Wire.read());
  gy = (int16_t)((Wire.read() << 8) | Wire.read());
  gz = (int16_t)((Wire.read() << 8) | Wire.read());

  return true;
}

// ---------------------------------------------------------------------------
// WiFi + MQTT
// ---------------------------------------------------------------------------
// TODO: completar con los datos reales del hotspot cuando exista (ver
// PLAN_BIMESTRE2.md, Fase 6.3 -- IP del computador con "ipconfig", buscar el
// adaptador del hotspot, normalmente 192.168.137.1 en Windows). NO usar
// "localhost": el ESP32 es otro dispositivo en la red, no el mismo compu.
const char* WIFI_SSID = "TODO_NOMBRE_DEL_HOTSPOT";
const char* WIFI_PASSWORD = "TODO_CONTRASENA_DEL_HOTSPOT";
const char* MQTT_HOST = "192.168.137.1";  // TODO: IP real del computador
const int MQTT_PORT = 1883;

const char* TOPIC_ACTUADOR_CMD = "g6/brazo/actuador/cmd";
const char* TOPIC_ACTUADOR_ESTADO = "g6/brazo/actuador/estado";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// ---------------------------------------------------------------------------
// Actuador: servo que hace de "mano". Un solo GPIO, no PWM compartido con
// nada del I2C (SDA=21, SCL=22 quedan intactos).
// ---------------------------------------------------------------------------
#define SERVO_PIN 18
#define SERVO_ANGULO_ABIERTO 0
#define SERVO_ANGULO_CERRADO 90

Servo servoMano;
bool manoActualmenteCerrada = false;

void moverMano(bool cerrar) {
  servoMano.write(cerrar ? SERVO_ANGULO_CERRADO : SERVO_ANGULO_ABIERTO);
  manoActualmenteCerrada = cerrar;

  // Publica el estado REAL (no solo el comando recibido) con retain=true,
  // para que el broker recuerde el ultimo estado aunque el dashboard se
  // abra despues de este cambio. Esto es lo que el badge de Node-RED
  // muestra como "estado confirmado" -- confirma que el servo de verdad
  // se movio, no solo que se envio la orden.
  mqttClient.publish(TOPIC_ACTUADOR_ESTADO, cerrar ? "ON" : "OFF", true);

  Serial.print("[actuador] Mano ");
  Serial.println(cerrar ? "CERRADA" : "ABIERTA");
}

void alRecibirMensajeMqtt(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, TOPIC_ACTUADOR_CMD) != 0) {
    return;
  }

  String mensaje;
  for (unsigned int i = 0; i < length; i++) {
    mensaje += (char)payload[i];
  }

  if (mensaje == "ON") {
    moverMano(true);
  } else if (mensaje == "OFF") {
    moverMano(false);
  }
}

void conectarWifi() {
  Serial.print("[wifi] Conectando a ");
  Serial.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println(" conectado");
  Serial.print("[wifi] IP asignada: ");
  Serial.println(WiFi.localIP());
}

void reconectarMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[mqtt] Conectando a ");
    Serial.print(MQTT_HOST);
    Serial.print("... ");

    if (mqttClient.connect("ESP32-GemeloDigitalG6")) {
      Serial.println("conectado");
      mqttClient.subscribe(TOPIC_ACTUADOR_CMD);
      // Re-publica el estado actual de la mano al (re)conectar, para que el
      // dashboard no se quede con un estado viejo si el ESP32 se reinicio
      // o perdio la conexion un momento.
      mqttClient.publish(TOPIC_ACTUADOR_ESTADO, manoActualmenteCerrada ? "ON" : "OFF", true);
    } else {
      Serial.print("fallo, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" reintentando en 2s");
      delay(2000);
    }
  }
}

// ---------------------------------------------------------------------------
// Lectura + publicacion de cada sensor
// ---------------------------------------------------------------------------
void publicarLectura(byte indice, byte numeroSensor, byte canal) {
  int16_t ax, ay, az, gx, gy, gz;

  if (!leerMPU(canal, ax, ay, az, gx, gy, gz)) {
    Serial.print("Error leyendo MPU");
    Serial.print(numeroSensor);
    Serial.print(" Canal ");
    Serial.println(canal);
    return;
  }

  // Se conserva el log por Serial para depuracion local -- no interfiere
  // con la publicacion MQTT, solo ayuda a diagnosticar sin necesitar
  // Wireshark ni el navegador.
  Serial.print("MPU");
  Serial.print(numeroSensor);
  Serial.print(" Canal ");
  Serial.print(canal);
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

  char payload[96];
  int longitud = snprintf(payload, sizeof(payload),
    "{\"ax\":%d,\"ay\":%d,\"az\":%d,\"gx\":%d,\"gy\":%d,\"gz\":%d}",
    ax, ay, az, gx, gy, gz);

  mqttClient.publish(TOPICS_SENSORES[indice], payload, longitud);
}

// ---------------------------------------------------------------------------
// setup() / loop()
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(50000);

  Serial.println();
  Serial.println("Gemelo Digital G6 -- Bimestre 2 (MQTT + servo)");

  Wire.beginTransmission(TCA_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("ERROR: TCA9548A no detectado.");
  } else {
    Serial.println("TCA9548A detectado en 0x70.");
  }

  for (byte i = 0; i < TOTAL_SENSORES; i++) {
    byte numero = SENSORES[i].numero;
    byte canal = SENSORES[i].canal;

    Serial.print("Inicializando MPU");
    Serial.print(numero);
    Serial.print(" Canal ");
    Serial.print(canal);
    Serial.print(": ");

    if (inicializarMPU(canal)) {
      Serial.println("OK");
    } else {
      Serial.println("ERROR");
    }
  }

  servoMano.attach(SERVO_PIN);
  moverMano(false);  // arranca con la mano abierta

  conectarWifi();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(alRecibirMensajeMqtt);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWifi();
  }

  if (!mqttClient.connected()) {
    reconectarMqtt();
  }
  mqttClient.loop();

  for (byte i = 0; i < TOTAL_SENSORES; i++) {
    publicarLectura(i, SENSORES[i].numero, SENSORES[i].canal);
  }

  delay(40);
}
