/**
 * =====================================================================
 * EcoNova - Smart Waste Management System
 * IoT Sensor Telemetry Simulator
 * =====================================================================
 * This script simulates realistic real-time telemetry from multiple IoT
 * waste bins, including fill percentages, temperature spikes, humidity,
 * and automated threshold notifications.
 */

const https = require('https');

const FIREBASE_HOST = 'econovasmartbin-e45d7-default-rtdb.asia-southeast1.firebasedatabase.app';
const TARGET_BIN = 'BIN-001';

console.log('🚀 [EcoNova Simulator] Starting IoT sensor simulation daemon...');
console.log(`📡 Target endpoint: https://${FIREBASE_HOST}/bins/${TARGET_BIN}.json`);
console.log('⏰ Telemetry push interval: Every 5 seconds\n');

let currentFill = 20; // Starting at 20%
let temperature = 27.2;
let humidity = 54.0;

function getRandomDelta(min, max) {
    return Math.random() * (max - min) + min;
}

function updateTelemetry() {
    // Increment fill level gradually, reset when reaching 100%
    currentFill += getRandomDelta(3, 8);
    if (currentFill > 100) {
        console.log('\n🧹 [Collection Event] Bin emptied! Resetting fill level to 5%.\n');
        currentFill = 5;
    }

    temperature += getRandomDelta(-0.4, 0.4);
    humidity += getRandomDelta(-1.0, 1.0);

    let status = 'empty';
    if (currentFill >= 90) status = 'full';
    else if (currentFill >= 50) status = 'medium';

    const payload = JSON.stringify({
        fillLevel: parseFloat(currentFill.toFixed(1)),
        temp: parseFloat(temperature.toFixed(1)),
        hum: parseFloat(humidity.toFixed(1)),
        status: status,
        lastUpdated: new Date().toLocaleTimeString(),
        isIoT: true
    });

    const options = {
        hostname: FIREBASE_HOST,
        port: 443,
        path: `/bins/${TARGET_BIN}.json`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
            const time = new Date().toLocaleTimeString();
            console.log(`[${time}] 📊 ${TARGET_BIN} -> Fill: ${currentFill.toFixed(1)}% | Status: ${status.toUpperCase()} | Temp: ${temperature.toFixed(1)}°C | HTTP ${res.statusCode}`);
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Telemetry upload error: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

// Run initial update immediately, then every 5 seconds
updateTelemetry();
setInterval(updateTelemetry, 5000);
