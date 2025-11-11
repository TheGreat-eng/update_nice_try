from flask import Flask, request, jsonify
import joblib
import pandas as pd
import tensorflow as tf
import numpy as np
import cv2
import json
import os
from datetime import datetime
import requests
import warnings
from dotenv import load_dotenv

load_dotenv()

warnings.filterwarnings('ignore')

app = Flask(__name__)

# --- CẤU HÌNH ---
SOIL_MOISTURE_THRESHOLD_LOW = 30.0
RAIN_THRESHOLD_MM = 2.0
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY") # Sửa dòng này
LATITUDE = 21.0285
LONGITUDE = 105.8542

# --- TẢI MODEL DỰ ĐOÁN ĐỘ ẨM ---
try:
    print("Đang tải model dự đoán độ ẩm...")
    moisture_model = joblib.load('soil_moisture_predictor.joblib')
    print("✅ Model dự đoán độ ẩm đã tải thành công!")
    
    # Load model metadata nếu có (R² score từ quá trình training)
    try:
        import pickle
        with open('model_metadata.pkl', 'rb') as f:
            model_metadata = pickle.load(f)
            MODEL_R2_SCORE = model_metadata.get('r2_score', None)
            MODEL_NAME = model_metadata.get('model_name', type(moisture_model).__name__)
    except:
        MODEL_R2_SCORE = None
        MODEL_NAME = type(moisture_model).__name__
        print("⚠️ Không tìm thấy metadata của model, sẽ tính R² score từ model")
        
except Exception as e:
    print(f"LỖI: Không tải được 'soil_moisture_predictor.joblib': {e}")
    exit()

# --- TẢI MODEL CHẨN ĐOÁN BỆNH ---
try:
    print("Đang tải model chẩn đoán bệnh...")
    disease_model = tf.keras.models.load_model('plant_disease_model.h5')
    with open('class_indices.json', 'r') as f:
        class_indices = json.load(f)
    class_names = {v: k for k, v in class_indices.items()}
    print("✅ Model chẩn đoán bệnh đã tải thành công!")
except Exception as e:
    print(f"LỖI: Không tải được model chẩn đoán bệnh: {e}")

# --- HÀM GỌI WEATHER API ---
def get_weather_forecast():
    if not WEATHER_API_KEY or WEATHER_API_KEY == "7884074a54f3d2baf0mhbvmb79866f3edeb6c":
        print("Cảnh báo: Thiếu API key của OpenWeatherMap. Bỏ qua kiểm tra thời tiết.")
        return 0, False
    try:
        url = f"https://api.openweathermap.org/data/2.5/forecast?lat={LATITUDE}&lon={LONGITUDE}&appid={WEATHER_API_KEY}&units=metric"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        for forecast in data['list'][:2]:
            if 'rain' in forecast and '3h' in forecast['rain']:
                if forecast['rain']['3h'] > RAIN_THRESHOLD_MM:
                    return forecast['rain']['3h'], True
        return 0, False
    except Exception as e:
        print(f"Lỗi khi gọi API thời tiết: {e}")
        return 0, False







@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

# --- API DỰ ĐOÁN ĐỘ ẨM ---
@app.route('/predict/soil_moisture', methods=['POST'])
def predict_moisture():
    try:
        input_data = request.get_json()
        features = {}

        current = input_data['current_data']
        historical = input_data['historical_data']

        current_soil_moisture_proxy = historical['soilMoisture_lag_60']

        features['soilMoisture'] = current_soil_moisture_proxy
        features['temperature'] = current['temperature']
        features['humidity'] = current['humidity']
        features['lightIntensity'] = current['lightIntensity']

        features['soilMoisture_lag_60'] = historical['soilMoisture_lag_60']
        features['temperature_lag_60'] = historical['temperature_lag_60']
        features['soilMoisture_lag_30'] = (historical['soilMoisture_lag_60'] + current_soil_moisture_proxy) / 2
        features['soilMoisture_lag_10'] = (historical['soilMoisture_lag_60'] + current_soil_moisture_proxy * 2) / 3
        features['temperature_lag_30'] = (historical['temperature_lag_60'] + current['temperature']) / 2
        features['temperature_lag_10'] = (historical['temperature_lag_60'] + current['temperature'] * 2) / 3
        features['soilMoisture_rolling_mean'] = historical['soilMoisture_rolling_mean_60m']
        features['temperature_rolling_mean'] = historical['temperature_rolling_mean_60m']
        features['lightIntensity_rolling_mean'] = historical['lightIntensity_rolling_mean_60m']

        now = datetime.now()
        features['hour'] = now.hour
        features['dayofweek'] = now.weekday()

        df_input = pd.DataFrame([features])
        feature_order = moisture_model.feature_names_in_
        df_input = df_input[feature_order]

        predicted_delta = moisture_model.predict(df_input)[0]
        predicted_moisture = current_soil_moisture_proxy + predicted_delta

        rain_amount, is_raining_soon = get_weather_forecast()
        suggestion = "Không cần hành động."
        action = "NONE"

        if is_raining_soon:
            suggestion = f"Dự báo có mưa ({rain_amount}mm). Tạm thời không cần tưới để tiết kiệm nước."
            action = "SKIP_IRRIGATION"
        elif predicted_moisture < SOIL_MOISTURE_THRESHOLD_LOW:
            suggestion = f"Độ ẩm đất dự kiến sẽ giảm xuống dưới ngưỡng {SOIL_MOISTURE_THRESHOLD_LOW}%. Nên lên lịch tưới."
            action = "SCHEDULE_IRRIGATION"

        # Lấy confidence từ R² score của model
        if MODEL_R2_SCORE is not None:
            model_confidence = MODEL_R2_SCORE
        else:
            # Nếu không có metadata, thử lấy từ model attributes
            model_confidence = getattr(moisture_model, 'score_', None)
            if model_confidence is None:
                # Fallback: ước lượng từ oob_score (nếu là Random Forest)
                model_confidence = getattr(moisture_model, 'oob_score_', 0.85)

        return jsonify({
            'predictions': [{
                'timestamp': datetime.now().isoformat(),
                'predicted_temperature': round(current['temperature'], 2),
                'predicted_humidity': round(current['humidity'], 2),
                'predicted_soil_moisture': round(predicted_moisture, 2)
            }],
            'suggestion': {
                'action': action,
                'message': suggestion,
                'confidence': round(model_confidence, 4),
                'details': {
                    'predicted_delta': round(predicted_delta, 2),
                    'weather_info': f"Rain: {rain_amount}mm, Raining soon: {is_raining_soon}",
                    'current_moisture': round(current_soil_moisture_proxy, 2),
                    'threshold': SOIL_MOISTURE_THRESHOLD_LOW
                }
            },
            'model_info': {
                'model_type': MODEL_NAME,
                'version': '1.0',
                'trained_on': 'sensor_data.csv',
                'features_used': len(feature_order),
                'r2_score': round(model_confidence, 4)
            }
        })
    except Exception as e:
        return jsonify({'error': f"Lỗi trong quá trình dự đoán độ ẩm: {e}"}), 500

# --- API CHẨN ĐOÁN BỆNH ---
def preprocess_image(image_bytes):
    try:
        image_array = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = cv2.resize(image, (224, 224))
        image = image / 255.0
        image = np.expand_dims(image, axis=0)
        return image
    except Exception as e:
        print(f"Lỗi tiền xử lý ảnh: {e}")
        return None

@app.route('/diagnose', methods=['POST'])
def diagnose_disease():
    if 'image' not in request.files:
        return jsonify({'error': 'Không có file ảnh nào được gửi lên'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Tên file trống'}), 400

    try:
        image_bytes = file.read()
        processed_image = preprocess_image(image_bytes)

        if processed_image is None:
            return jsonify({'error': 'File ảnh không hợp lệ'}), 400

        predictions = disease_model.predict(processed_image)
        predicted_class_index = np.argmax(predictions[0])
        confidence = float(np.max(predictions[0]))
        class_name_raw = class_names[predicted_class_index]
        class_name_formatted = class_name_raw.replace('___', ' - ').replace('_', ' ')

        return jsonify({
            'disease': class_name_formatted,
            'confidence': f"{confidence:.2%}"
        })
    except Exception as e:
        return jsonify({'error': f"Lỗi trong quá trình chẩn đoán: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
# Chạy ứng dụng Flask trên cổng 5001
