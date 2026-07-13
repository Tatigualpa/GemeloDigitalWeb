#include <Wire.h>

#define SDA_PIN 21
#define SCL_PIN 22

#define TCA_ADDR 0x70
#define MPU_ADDR 0x68

struct SensorConfig {
  byte numero;
  byte canal;
};

const SensorConfig SENSORES[] = {
  {1, 0},
  {2, 1},
  {3, 3},
};

const byte TOTAL_SENSORES = sizeof(SENSORES) / sizeof(SENSORES[0]);

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

void imprimirLectura(byte numeroSensor, byte canal) {
  int16_t ax, ay, az, gx, gy, gz;

  if (!leerMPU(canal, ax, ay, az, gx, gy, gz)) {
    Serial.print("Error leyendo MPU");
    Serial.print(numeroSensor);
    Serial.print(" Canal ");
    Serial.println(canal);
    return;
  }

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
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(50000);

  Serial.println();
  Serial.println("Lectura continua 3 MPU6050 + TCA9548A");
  Serial.println("MPU1 en canal 0");
  Serial.println("MPU2 en canal 1");
  Serial.println("MPU3 en canal 3");

  Wire.beginTransmission(TCA_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("ERROR: TCA9548A no detectado.");
    return;
  }

  Serial.println("TCA9548A detectado en 0x70.");

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
}

void loop() {
  for (byte i = 0; i < TOTAL_SENSORES; i++) {
    imprimirLectura(SENSORES[i].numero, SENSORES[i].canal);
  }

  delay(40);
}
