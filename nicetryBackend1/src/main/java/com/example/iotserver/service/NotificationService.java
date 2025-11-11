// src/main/java/com/example/iotserver/service/NotificationService.java
package com.example.iotserver.service;

import com.example.iotserver.dto.SensorDataDTO;
import com.example.iotserver.entity.Device;
import com.example.iotserver.entity.Farm;
import com.example.iotserver.entity.PlantHealthAlert;
import com.example.iotserver.entity.Rule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final EmailService emailService;
    private final StringRedisTemplate redisTemplate; // Dùng để quản lý cooldown

    // <<<< THÊM CÁC HẰNG SỐ NGƯỠNG VÀO ĐÂY >>>>
    private static final double HIGH_TEMP_THRESHOLD = 38.0;
    private static final double LOW_SOIL_MOISTURE_THRESHOLD = 20.0;
    private static final double HIGH_HUMIDITY_THRESHOLD = 90.0;

    // Thời gian chờ trước khi gửi lại cùng một loại cảnh báo (giờ)
    private static final int COOLDOWN_HOURS = 4;

    /**
     * Gửi cảnh báo về thiết bị offline
     */
    public void notifyDeviceOffline(Device device) {
        String alertType = "DEVICE_OFFLINE";
        String redisKey = createRedisKey(device.getFarm().getId(), alertType, device.getDeviceId());

        if (canSend(redisKey)) {
            Farm farm = device.getFarm();
            String ownerEmail = farm.getOwner().getEmail();

            String subject = String.format("[SmartFarm Cảnh Báo] Thiết bị '%s' đã offline", device.getName());
            String text = String.format(
                    "Thiết bị '%s' (ID: %s) tại nông trại '%s' đã mất kết nối.\n\n" +
                            "Vui lòng kiểm tra nguồn điện và kết nối mạng của thiết bị.",
                    device.getName(), device.getDeviceId(), farm.getName());

            emailService.sendSimpleMessage(ownerEmail, subject, text);
            setCooldown(redisKey);
            log.info("Đã gửi email cảnh báo OFFLINE cho thiết bị {} tới {}", device.getDeviceId(), ownerEmail);
        } else {
            log.debug("Bỏ qua gửi email OFFLINE cho {}, vẫn trong thời gian cooldown.", device.getDeviceId());
        }
    }

    /**
     * Gửi cảnh báo về sức khỏe cây trồng
     */
    public void notifyPlantHealthAlert(Farm farm, PlantHealthAlert alert) {
        // Chỉ gửi email cho các cảnh báo từ mức độ MEDIUM trở lên
        if (alert.getSeverity() == PlantHealthAlert.Severity.LOW) {
            return;
        }

        String alertType = "PLANT_HEALTH_" + alert.getAlertType().name();
        String redisKey = createRedisKey(farm.getId(), alertType, null);

        if (canSend(redisKey)) {
            String ownerEmail = farm.getOwner().getEmail();
            String subject = String.format("[SmartFarm Cảnh Báo - %s] %s tại %s",
                    alert.getSeverity().getDisplayName().toUpperCase(),
                    alert.getAlertType().getDisplayName(),
                    farm.getName());
            String text = String.format(
                    "Hệ thống vừa phát hiện một cảnh báo sức khỏe cây trồng tại nông trại '%s'.\n\n" +
                            "Loại cảnh báo: %s\n" +
                            "Mức độ: %s\n" +
                            "Mô tả: %s\n" +
                            "Gợi ý: %s\n\n" +
                            "Vui lòng đăng nhập vào hệ thống để xem chi tiết.",
                    farm.getName(), alert.getAlertType().getDisplayName(),
                    alert.getSeverity().getDisplayName(), alert.getDescription(), alert.getSuggestion());

            emailService.sendSimpleMessage(ownerEmail, subject, text);
            setCooldown(redisKey);
            log.info("Đã gửi email cảnh báo sức khỏe ({}) tới {}", alert.getAlertType(), ownerEmail);
        } else {
            log.debug("Bỏ qua gửi email sức khỏe {}, vẫn trong thời gian cooldown.", alert.getAlertType());
        }
    }

    /**
     * Gửi cảnh báo từ một Rule do người dùng định nghĩa
     */
    public void notifyForRule(Rule rule, Rule.RuleAction action) {
        // Cảnh báo từ Rule do người dùng tạo thì luôn gửi, không cần cooldown
        String ownerEmail = rule.getFarm().getOwner().getEmail();
        String subject = "[SmartFarm] Quy tắc tự động đã kích hoạt: " + rule.getName();
        String text = "Quy tắc '" + rule.getName() + "' tại nông trại '" + rule.getFarm().getName()
                + "' đã được kích hoạt.\n\n"
                + "Thông điệp: " + action.getMessage();

        emailService.sendSimpleMessage(ownerEmail, subject, text);
        log.info("Đã gửi email từ quy tắc {} tới {}", rule.getName(), ownerEmail);
    }

    // === Helper Methods ===

    private String createRedisKey(Long farmId, String alertType, String objectId) {
        String key = "notification_cooldown:" + farmId + ":" + alertType;
        if (objectId != null) {
            key += ":" + objectId;
        }
        return key;
    }

    private boolean canSend(String redisKey) {
        // Nếu key không tồn tại trong Redis -> có thể gửi
        return !Boolean.TRUE.equals(redisTemplate.hasKey(redisKey));
    }

    private void setCooldown(String redisKey) {
        // Đặt key vào Redis với thời gian sống (TTL)
        redisTemplate.opsForValue().set(redisKey, "sent", Duration.ofHours(COOLDOWN_HOURS));
    }

    // <<<< THÊM PHƯƠNG THỨC MỚI NÀY >>>>
    /**
     * Kiểm tra và gửi cảnh báo tức thời từ dữ liệu cảm biến.
     */
    public void notifyForSensorAnomalies(Farm farm, Device device, SensorDataDTO data) {
        String ownerEmail = farm.getOwner().getEmail();
        if (ownerEmail == null || ownerEmail.isEmpty()) {
            return; // Không có email để gửi
        }

        // 1. Kiểm tra nhiệt độ cao
        if (data.getTemperature() != null && data.getTemperature() > HIGH_TEMP_THRESHOLD) {
            String alertType = "SENSOR_HIGH_TEMP";
            String redisKey = createRedisKey(farm.getId(), alertType, device.getDeviceId());
            if (canSend(redisKey)) {
                String subject = String.format("[SmartFarm Cảnh Báo] Nhiệt độ cao tại %s", farm.getName());
                String text = createSensorEmailText(farm, device, "Nhiệt độ", data.getTemperature(), "°C",
                        "cao bất thường", "Hãy kiểm tra hệ thống làm mát hoặc lưới che nắng.");
                emailService.sendSimpleMessage(ownerEmail, subject, text);
                setCooldown(redisKey);
                log.info("Đã gửi email cảnh báo nhiệt độ cao (tức thời) cho farm {}", farm.getId());
            }
        }

        // 2. Kiểm tra độ ẩm đất thấp
        if (data.getSoilMoisture() != null && data.getSoilMoisture() < LOW_SOIL_MOISTURE_THRESHOLD) {
            String alertType = "SENSOR_LOW_SOIL";
            String redisKey = createRedisKey(farm.getId(), alertType, device.getDeviceId());
            if (canSend(redisKey)) {
                String subject = String.format("[SmartFarm Cảnh Báo] Độ ẩm đất thấp tại %s", farm.getName());
                String text = createSensorEmailText(farm, device, "Độ ẩm đất", data.getSoilMoisture(), "%",
                        "thấp đến mức báo động", "Hãy kiểm tra hệ thống tưới nước ngay lập tức.");
                emailService.sendSimpleMessage(ownerEmail, subject, text);
                setCooldown(redisKey);
                log.info("Đã gửi email cảnh báo độ ẩm đất thấp (tức thời) cho farm {}", farm.getId());
            }
        }

        // 3. Kiểm tra độ ẩm không khí cao
        if (data.getHumidity() != null && data.getHumidity() > HIGH_HUMIDITY_THRESHOLD) {
            String alertType = "SENSOR_HIGH_HUMIDITY";
            String redisKey = createRedisKey(farm.getId(), alertType, device.getDeviceId());
            if (canSend(redisKey)) {
                String subject = String.format("[SmartFarm Cảnh Báo] Độ ẩm không khí cao tại %s", farm.getName());
                String text = createSensorEmailText(farm, device, "Độ ẩm không khí", data.getHumidity(), "%",
                        "cao, có nguy cơ phát sinh nấm bệnh", "Hãy tăng cường thông gió và kiểm tra hệ thống quạt.");
                emailService.sendSimpleMessage(ownerEmail, subject, text);
                setCooldown(redisKey);
                log.info("Đã gửi email cảnh báo độ ẩm không khí cao (tức thời) cho farm {}", farm.getId());
            }
        }
    }

    // <<<< THÊM HELPER METHOD NÀY >>>>
    /**
     * Helper method để tạo nội dung email cho cảnh báo cảm biến.
     */
    private String createSensorEmailText(Farm farm, Device device, String metricName, Double value, String unit,
            String issue, String suggestion) {
        return String.format(
                "Xin chào,\n\n" +
                        "Hệ thống SmartFarm vừa ghi nhận một thông số bất thường từ cảm biến tại nông trại '%s'.\n\n" +
                        "--- CHI TIẾT CẢNH BÁO ---\n" +
                        "Thiết bị: %s (ID: %s)\n" +
                        "Chỉ số: %s\n" +
                        "Giá trị đo được: %.1f %s\n" +
                        "Vấn đề: %s.\n" +
                        "Gợi ý: %s\n\n" +
                        "Vui lòng đăng nhập vào hệ thống để theo dõi chi tiết.\n\n" +
                        "Trân trọng,\n" +
                        "Đội ngũ SmartFarm.",
                farm.getName(),
                device.getName(), device.getDeviceId(),
                metricName, value, unit,
                issue, suggestion);
    }

}