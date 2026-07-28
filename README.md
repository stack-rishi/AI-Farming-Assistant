🌾 AgriMind – AI Farming Assistant

An AI-powered Smart Agriculture Platform integrating IoT, Machine Learning, and Real-Time Analytics to help farmers make intelligent decisions.










📖 Overview

AgriMind is an AI-powered farming assistant designed to improve agricultural productivity through real-time monitoring, predictive analytics, and intelligent automation.

The platform combines IoT sensors, AI models, weather intelligence, and a modern web dashboard to assist farmers in making data-driven decisions for irrigation, crop health, and farm management.

✨ Features
🌱 Smart Crop Monitoring
Real-time soil moisture monitoring
Temperature & humidity tracking
Light intensity monitoring
Water level monitoring (optional)
🤖 AI Assistant
AI chatbot for farming guidance
Crop recommendations
Fertilizer suggestions
Disease diagnosis support
Smart irrigation recommendations
💧 Smart Irrigation
Automatic pump control
AI-based irrigation scheduling
Soil moisture threshold monitoring
Water usage optimization
📊 Dashboard
Live sensor data
Historical analytics
Interactive charts
Farm health overview
Weather insights
☁ Cloud Integration
Real-time data synchronization
Secure cloud database
Remote monitoring
Multi-device accessibility
🏗️ System Architecture
                  Farmer
                     │
                     ▼
          React Web Dashboard
                     │
                     ▼
              FastAPI Backend
                     │
      ┌──────────────┴──────────────┐
      │                             │
      ▼                             ▼
 AI Prediction Engine         Database
      │
      ▼
ESP32 IoT Controller
      │
 ┌────┼────┬─────┬─────┐
 │    │    │     │     │
 ▼    ▼    ▼     ▼     ▼
Soil Temp Humid Light Pump
⚙️ Tech Stack
Frontend
React.js
Tailwind CSS
Vite
Chart.js / Recharts
Backend
FastAPI
Python
REST API
Database
PostgreSQL
MongoDB (Optional)
AI/ML
Scikit-learn
TensorFlow
OpenCV
IoT
ESP32
Soil Moisture Sensor
DHT22
LDR
Relay Module
Water Pump
📂 Project Structure
AgriMind/

├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── assets/
│
├── backend/
│   ├── app/
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── database/
│
├── hardware/
│   ├── esp32/
│   ├── circuit/
│   └── sensors/
│
├── ai/
│   ├── irrigation_model/
│   ├── disease_detection/
│   └── crop_prediction/
│
├── docs/
│
└── README.md
🔌 Hardware Components
Component	Purpose
ESP32	IoT Controller
DHT22	Temperature & Humidity
Soil Moisture Sensor	Soil Monitoring
LDR	Light Detection
Relay Module	Pump Control
Water Pump	Smart Irrigation
Power Supply	Hardware Power
🚀 Installation
Clone Repository
git clone https://github.com/yourusername/AgriMind.git
cd AgriMind
Backend
cd backend

python -m venv venv

source venv/bin/activate

Windows

venv\Scripts\activate

Install dependencies

pip install -r requirements.txt

Run

uvicorn main:app --reload
Frontend
cd frontend

npm install

npm run dev
ESP32
Install Arduino IDE
Install ESP32 Board Package
Install required libraries:
WiFi
HTTPClient
DHT Sensor Library
Upload the firmware to the ESP32.
📡 IoT Workflow
Sensors
      │
      ▼
ESP32 Controller
      │
 Wi-Fi
      │
      ▼
FastAPI API
      │
      ▼
Database
      │
      ▼
React Dashboard
      │
      ▼
AI Recommendation Engine
🧠 AI Modules
🌾 Crop Recommendation
💧 Smart Irrigation Prediction
🍃 Plant Disease Detection
🌤 Weather Analysis
🌱 Fertilizer Recommendation
📈 Future Enhancements
Drone Integration
Satellite Monitoring
Voice Assistant
Mobile App
SMS Alerts
Weather Forecast Integration
Computer Vision for Crop Health
Multi-language Support
🤝 Contributors
Anshika Roy
Rishi
Rohit
📜 License

This project is licensed under the MIT License.

❤️ Acknowledgements
ESP32 Community
FastAPI
React
OpenCV
TensorFlow
Scikit-learn
Open Source Community
🌟 If you like this project, consider giving it a ⭐ Star on GitHub!
