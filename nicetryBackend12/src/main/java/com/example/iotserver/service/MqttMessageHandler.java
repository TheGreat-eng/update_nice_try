// src/main/java/com/example/iotserver/service/MqttMessageHandler.java

package com.example.iotserver.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.iotserver.dto.SensorDataDTO;
import com.example.iotserver.entity.Device;
import com.example.iotserver.entity.Farm;
import com.example.iotserver.repository.DeviceRepository;
import com.example.iotserver.repository.FarmRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.iotserver.enums.DeviceStatus;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class MqttMessageHandler {

    private final DeviceRepository deviceRepository;
    private final SensorDataService sensorDataService;
    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;
    private final PlantHealthService plantHealthService;
    // private final EmailService emailService; // <<<< Thêm vào
    // private final FarmRepository farmRepository; // <<<< Thêm vào
    private final NotificationService notificationService; // <<<< THÊM DÒNG NÀY

    // <<<< THÊM CÁC HẰNG SỐ NÀY VÀO >>>>
    // private static final double HIGH_TEMP_THRESHOLD = 38.0;
    // private static final double LOW_SOIL_MOISTURE_THRESHOLD = 20.0;
    // private static final double HIGH_HUMIDITY_THRESHOLD = 90.0;
    // private static final int SENSOR_NOTIFICATION_COOLDOWN_HOURS = 4; // Gửi lại
    // sau 4 giờ

    @ServiceActivator(inputChannel = "mqttInputChannel")
    public void handleMessage(Message<?> message) {
        try {
            MessageHeaders headers = message.getHeaders();
            String topic = (String) headers.get("mqtt_receivedTopic");
            String payload = message.getPayload().toString();

            log.info("Received MQTT message - Topic: {}, Payload: {}", topic, payload);

            if (topic.startsWith("sensor/")) {
                handleSensorData(topic, payload);
            } else if (topic.startsWith("device/")) {
                handleDeviceStatus(topic, payload);
            }

        } catch (Exception e) {
            log.error("Error handling MQTT message: {}", e.getMessage(), e);
        }
    }

    @Transactional
    private void handleSensorData(String topic, String payload) {
        try {
            String deviceId = topic.split("/")[1];
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);
            SensorDataDTO sensorData = SensorDataDTO.fromMqttPayload(deviceId, data);

            // VVVV--- ĐÂY LÀ PHẦN SỬA LỖI QUAN TRỌNG NHẤT ---VVVV

            // 1. Tìm thiết bị trong database để lấy thông tin Farm
            Device device = deviceRepository.findByDeviceIdWithFarmAndOwner(deviceId)
                    .orElse(null); // Sử dụng phương thức đã có sẵn để lấy cả farm

            if (device == null) {
                log.warn("Nhận được dữ liệu từ thiết bị lạ chưa được đăng ký: {}", deviceId);
                return; // Dừng xử lý nếu không biết thiết bị này
            }

            // 2. Lấy farmId từ đối tượng Device và gán vào DTO
            Long farmId = device.getFarm().getId();
            sensorData.setFarmId(farmId);

            log.info(">>>> [MQTT PROCESS] Đã xác định FarmID: {} cho DeviceID: {}", farmId, deviceId);

            // 3. Bây giờ mới lưu dữ liệu vào InfluxDB (với farmId chính xác)
            sensorDataService.saveSensorData(sensorData);

            // 4. Cập nhật trạng thái và lastSeen cho device trong MySQL
            device.setLastSeen(LocalDateTime.now());
            if (device.getStatus() != DeviceStatus.ONLINE) { // Chỉ cập nhật và gửi thông báo nếu trạng thái thay đổi
                device.setStatus(DeviceStatus.ONLINE);
                deviceRepository.save(device);
                // Gửi thông báo WebSocket về trạng thái ONLINE
                webSocketService.sendDeviceStatus(farmId, deviceId, "ONLINE");
            } else {
                deviceRepository.save(device); // Vẫn save để cập nhật lastSeen
            }

            // 5. Gửi dữ liệu cảm biến qua WebSocket
            webSocketService.sendSensorData(farmId, sensorData);

            // 6. Kích hoạt phân tích sức khỏe (nếu cần)
            plantHealthService.analyzeHealth(farmId);

            // <<<< SỬA BƯỚC 7 >>>>
            // 7. Kích hoạt kiểm tra cảnh báo tức thời
            notificationService.notifyForSensorAnomalies(device.getFarm(), device, sensorData);

            log.info("Xử lý thành công dữ liệu cảm biến từ thiết bị: {}", deviceId);

        } catch (Exception e) {
            log.error("Lỗi khi xử lý dữ liệu cảm biến: {}", e.getMessage(), e);
        }
    }

    @Transactional // Thêm @Transactional để đảm bảo lưu DB thành công
    private void handleDeviceStatus(String topic, String payload) {
        try {
            String deviceId = topic.split("/")[1];
            Map<String, Object> statusMap = objectMapper.readValue(payload, Map.class);

            deviceRepository.findByDeviceId(deviceId).ifPresent(device -> {
                // Lấy dữ liệu từ payload
                String statusStr = (String) statusMap.get("status");
                String stateStr = (String) statusMap.get("state"); // <-- Lấy state

                // Cập nhật trạng thái kết nối (ONLINE/OFFLINE)
                if (statusStr != null) {
                    device.setStatus(DeviceStatus.valueOf(statusStr.toUpperCase()));
                }

                // Cập nhật trạng thái hoạt động (ON/OFF)
                if (stateStr != null) {
                    device.setCurrentState(stateStr.toUpperCase()); // <-- Lưu state
                }

                device.setLastSeen(LocalDateTime.now());
                Device updatedDevice = deviceRepository.save(device); // Lưu lại

                log.info("Updated device status: {} - Status: {}, State: {}",
                        deviceId, updatedDevice.getStatus(), updatedDevice.getCurrentState());

                // VVVV--- GỬI THÔNG BÁO WEBSOCKET (BƯỚC BỊ THIẾU) ---VVVV
                // webSocketService.sendDeviceStatus(
                // updatedDevice.getFarm().getId(),
                // updatedDevice.getDeviceId(),
                // updatedDevice.getStatus().name()
                // // có thể mở rộng WebSocketService để gửi cả currentState nếu cần
                // );

                // VVVV--- SỬA LẠI HOÀN TOÀN LOGIC GỬI WEBSOCKET ---VVVV
                Map<String, Object> wsPayload = new HashMap<>();
                wsPayload.put("deviceId", updatedDevice.getDeviceId());
                wsPayload.put("status", updatedDevice.getStatus().name());
                wsPayload.put("currentState", updatedDevice.getCurrentState());
                wsPayload.put("lastSeen", updatedDevice.getLastSeen().toString());
                wsPayload.put("timestamp", System.currentTimeMillis());

                webSocketService.sendDeviceStatus(updatedDevice.getFarm().getId(), wsPayload);
                // ^^^^-------------------------------------------------^^^^
                // ^^^^-------------------------------------------------^^^^
            });
        } catch (Exception e) {
            log.error("Error processing device status: {}", e.getMessage(), e);
        }
    }

}