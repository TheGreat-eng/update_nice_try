// File: src/main/java/com/example/iotserver/service/AIService.java

package com.example.iotserver.service;

import com.example.iotserver.dto.AIPredictionResponse;
import com.example.iotserver.dto.SensorDataDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AIService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final SensorDataService sensorDataService;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public AIPredictionResponse getPredictions(Long farmId) {
        try {
            // Bước 1: Lấy dữ liệu gần nhất có thể.
            SensorDataDTO latestData = sensorDataService.getLatestSensorDataForFarmDevices(farmId);

            if (latestData == null) {
                log.warn("Không có dữ liệu cảm biến cho farm {} để gửi tới AI.", farmId);
                return null; // Dừng lại nếu không có bất kỳ dữ liệu nào
            }
            log.info("Dữ liệu gần nhất lấy được cho AI: {}", latestData);

            // Bước 2: Sử dụng latestData cho cả "current" và "historical"
            // Đây là cách xử lý an toàn khi hệ thống mới khởi động.
            SensorDataDTO currentData = latestData;
            SensorDataDTO historicalData = latestData; // Dùng chính nó làm dữ liệu lịch sử

            // Bước 3: Xây dựng request body một cách an toàn
            Map<String, Object> requestBody = new HashMap<>();

            Map<String, Object> currentDataMap = new HashMap<>();
            currentDataMap.put("temperature", Optional.ofNullable(currentData.getTemperature()).orElse(0.0));
            currentDataMap.put("humidity", Optional.ofNullable(currentData.getHumidity()).orElse(0.0));
            currentDataMap.put("lightIntensity", Optional.ofNullable(currentData.getLightIntensity()).orElse(0.0));
            requestBody.put("current_data", currentDataMap);

            Map<String, Object> historicalDataMap = new HashMap<>();
            historicalDataMap.put("soilMoisture_lag_60",
                    Optional.ofNullable(historicalData.getSoilMoisture()).orElse(0.0));
            historicalDataMap.put("temperature_lag_60",
                    Optional.ofNullable(historicalData.getTemperature()).orElse(0.0));
            historicalDataMap.put("soilMoisture_rolling_mean_60m",
                    Optional.ofNullable(historicalData.getSoilMoisture()).orElse(0.0));
            historicalDataMap.put("temperature_rolling_mean_60m",
                    Optional.ofNullable(historicalData.getTemperature()).orElse(0.0));
            historicalDataMap.put("lightIntensity_rolling_mean_60m",
                    Optional.ofNullable(historicalData.getLightIntensity()).orElse(0.0));
            requestBody.put("historical_data", historicalDataMap);

            // Bước 4: Gọi API
            String predictionUrl = aiServiceUrl + "/predict/soil_moisture";
            log.info("Đang gửi request tới AI Service: {}", predictionUrl);
            log.debug("Request body: {}", requestBody); // Thêm log để xem body

            AIPredictionResponse response = restTemplate.postForObject(
                    predictionUrl,
                    requestBody,
                    AIPredictionResponse.class);

            log.info("✅ Nhận được phản hồi từ AI Service");
            return response;

        } catch (Exception e) {
            log.error("❌ Lỗi khi gọi AI Service: {}", e.getMessage(), e);
            return null;
        }
    }

    public Map<String, Object> diagnosePlantDisease(MultipartFile imageFile) {
        try {
            // String diagnoseUrl = aiServiceUrl.replace("/predict", "/diagnose");

            String diagnoseUrl = aiServiceUrl + "/diagnose";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new ByteArrayResource(imageFile.getBytes()) {
                @Override
                public String getFilename() {
                    return imageFile.getOriginalFilename();
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            log.info("Đang gửi ảnh tới AI Service để chẩn đoán: {}", diagnoseUrl);
            Map<String, Object> response = restTemplate.postForObject(diagnoseUrl, requestEntity, Map.class);
            log.info("✅ Nhận được kết quả chẩn đoán từ AI Service");
            return response;

        } catch (IOException e) {
            log.error("❌ Lỗi đọc file ảnh: {}", e.getMessage());
            return Map.of("error", "Lỗi đọc file ảnh");
        } catch (Exception e) {
            log.error("❌ Lỗi khi gọi AI Service chẩn đoán: {}", e.getMessage());
            return Map.of("error", "Lỗi dịch vụ AI không khả dụng");
        }
    }
}