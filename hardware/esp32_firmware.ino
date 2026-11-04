/*
 * =====================================================================
 * EcoNova - Smart Waste Management System
 * ESP32 IoT Node Firmware (BIN-001)
 * Hardware: ESP32 DevKit V1, HC-SR04 Ultrasonic Sensor, DHT11 Sensor
 * =====================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// --- WiFi Credentials ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// --- Firebase Realtime Database Config ---
const char* FIREBASE_HOST = "https://econovasmartbin-e45d7-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* BIN_ID        = "BIN-001";

// --- Pin Definitions ---
#define TRIG_PIN 5
#define ECHO_PIN 18
#define DHT_PIN  4
#define DHT_TYPE DHT11

#define LED_GREEN 2    // Status OK
#define LED_RED   15   // Bin Full Warning (> 90%)

// --- Physical Bin Dimensions ---
const float BIN_HEIGHT_CM = 100.0; // Total height of the bin container
const float SENSOR_OFFSET = 5.0;   // Distance from sensor to bin top rim

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n🌿 [EcoNova IoT Node] Initializing system...");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Read Ultrasonic Sensor (HC-SR04)
  float distanceCm = measureDistance();
  float fillPercent = 0.0;

  if (distanceCm > 0 && distanceCm <= (BIN_HEIGHT_CM + SENSOR_OFFSET)) {
    float wasteDepth = BIN_HEIGHT_CM - (distanceCm - SENSOR_OFFSET);
    if (wasteDepth < 0) wasteDepth = 0;
    fillPercent = (wasteDepth / BIN_HEIGHT_CM) * 100.0;
    if (fillPercent > 100.0) fillPercent = 100.0;
  }

  // 2. Read DHT11 Temperature & Humidity
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temperature)) temperature = 26.5; // Fallback defaults if sensor reading fails
  if (isnan(humidity)) humidity = 58.0;

  // 3. LED Indicators
  if (fillPercent >= 90.0) {
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
  } else {
    digitalWrite(LED_RED, LOW);
    digitalWrite(LED_GREEN, HIGH);
  }

  // 4. Determine status label
  String statusLabel = "empty";
  if (fillPercent >= 90.0) {
    statusLabel = "full";
  } else if (fillPercent >= 50.0) {
    statusLabel = "medium";
  }

  // 5. Send telemetry payload to Firebase Realtime Database
  sendTelemetry(fillPercent, temperature, humidity, statusLabel);

  // Sample interval (every 10 seconds)
  delay(10000);
}

// --- Measure Distance using HC-SR04 ---
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  if (duration == 0) return -1.0;

  return (duration * 0.0343) / 2.0; // Distance in cm
}

// --- WiFi Connection ---
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi Connection failed. Will retry...");
  }
}

// --- Push Data via Firebase RTDB REST API ---
void sendTelemetry(float fill, float temp, float hum, String status) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/bins/" + BIN_ID + ".json";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON Payload
  String payload = "{";
  payload += "\"fillLevel\":" + String(fill, 1) + ",";
  payload += "\"temp\":" + String(temp, 1) + ",";
  payload += "\"hum\":" + String(hum, 1) + ",";
  payload += "\"status\":\"" + status + "\",";
  payload += "\"lastUpdated\":\"Just now\",";
  payload += "\"isIoT\":true";
  payload += "}";

  Serial.println("📡 Uploading telemetry: " + payload);

  int httpCode = http.PUT(payload);
  if (httpCode > 0) {
    Serial.printf("✅ Firebase Updated! (HTTP %d)\n", httpCode);
  } else {
    Serial.printf("❌ HTTP Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
