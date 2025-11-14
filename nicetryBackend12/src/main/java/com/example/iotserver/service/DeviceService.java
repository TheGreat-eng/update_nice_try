package com.example.iotserver.service;

import com.example.iotserver.dto.DeviceDTO;
import com.example.iotserver.dto.SensorDataDTO;
import com.example.iotserver.enums.DeviceStatus;
import com.example.iotserver.enums.DeviceType;
import com.example.iotserver.entity.Device;
import com.example.iotserver.entity.Farm;
import com.example.iotserver.repository.DeviceRepository;
import com.example.iotserver.repository.FarmRepository;
import com.example.iotserver.repository.ZoneRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.example.iotserver.entity.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.Cacheable; // <-- THÊM IMPORT
import org.springframework.cache.annotation.CacheEvict; // <-- THÊM IMPORT
import java.time.temporal.ChronoUnit; // <<<< 1. THÊM IMPORT

import com.example.iotserver.entity.User; // <<<< THÊM IMPORT
import com.example.iotserver.entity.Zone;
import com.example.iotserver.enums.FarmRole; // <<<< THÊM IMPORT
import com.example.iotserver.exception.ResourceNotFoundException;

@Service
@Slf4j
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final FarmRepository farmRepository;
    private final SensorDataService sensorDataService;
    private final WebSocketService webSocketService; // Thêm dependency này
    // private final EmailService emailService; // <<<< 2. INJECT EMAILSERVICE
    private final NotificationService notificationService; // <<<< THAY BẰNG DÒNG NÀY

    // VVVV--- THÊM DÒNG NÀY ---VVVV
    private final ZoneRepository zoneRepository;
    // ^^^^-----------------------^^^^

    private final AuthenticationService authenticationService; // <<<< THÊM
    private final FarmService farmService; // <<<< THÊM

    // ✅ THÊM: Inject MQTT Gateway
    private final MqttGateway mqttGateway;

    @Transactional
    public DeviceDTO createDevice(Long farmId, DeviceDTO dto) {

        User currentUser = authenticationService.getCurrentAuthenticatedUser();
        farmService.checkUserPermissionForFarm(currentUser.getId(), farmId, FarmRole.OPERATOR); // Yêu cầu quyền
                                                                                                // OPERATOR

        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new RuntimeException("Farm not found"));

        String deviceId = dto.getDeviceId() != null ? dto.getDeviceId() : generateDeviceId();

        if (deviceRepository.existsByDeviceId(deviceId)) {
            throw new RuntimeException("Device ID already exists");
        }

        Device device = new Device();
        device.setDeviceId(deviceId);
        device.setName(dto.getName());
        device.setDescription(dto.getDescription());

        // FIX 1: Thêm dòng này để gán type cho thiết bị
        device.setType(parseDeviceType(dto.getType()));

        // FIX 2: Xóa dòng code lỗi và chỉ giữ lại việc gán status mặc định
        device.setStatus(DeviceStatus.OFFLINE);

        device.setFarm(farm);
        device.setMetadata(dto.getMetadata());

        // VVVV--- THÊM LOGIC GÁN ZONE ---VVVV
        if (dto.getZoneId() != null) {
            Zone zone = zoneRepository.findById(dto.getZoneId())
                    .orElseThrow(() -> new ResourceNotFoundException("Zone", "id", dto.getZoneId()));
            // Kiểm tra zone này có thuộc farm đang xét không
            if (!zone.getFarm().getId().equals(device.getFarm().getId())) {
                throw new IllegalArgumentException("Zone không thuộc về Farm này.");
            }
            device.setZone(zone);
        }

        Device saved = deviceRepository.save(device);
        log.info("Created device: {} for farm: {}", saved.getDeviceId(), farmId);

        return mapToDetailedDTO(saved);
    }

    @Transactional
    @CacheEvict(value = "devices", key = "#deviceId") // <-- THÊM ANNOTATION NÀY
    public DeviceDTO updateDevice(Long deviceId, DeviceDTO dto) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        // <<<< BƯỚC KIỂM TRA QUYỀN >>>>
        User currentUser = authenticationService.getCurrentAuthenticatedUser();
        farmService.checkUserPermissionForFarm(currentUser.getId(), device.getFarm().getId(), FarmRole.OPERATOR);

        if (dto.getName() != null)
            device.setName(dto.getName());
        if (dto.getDescription() != null)
            device.setDescription(dto.getDescription());
        if (dto.getMetadata() != null)
            device.setMetadata(dto.getMetadata());
        if (dto.getStatus() != null) {
            device.setStatus(DeviceStatus.valueOf(dto.getStatus()));
        }

        // VVVV--- THÊM LOGIC GÁN ZONE ---VVVV
        if (dto.getZoneId() != null) {
            Zone zone = zoneRepository.findById(dto.getZoneId())
                    .orElseThrow(() -> new ResourceNotFoundException("Zone", "id", dto.getZoneId()));
            // Kiểm tra zone này có thuộc farm đang xét không
            if (!zone.getFarm().getId().equals(device.getFarm().getId())) {
                throw new IllegalArgumentException("Zone không thuộc về Farm này.");
            }
            device.setZone(zone);
        }

        Device updated = deviceRepository.save(device);
        log.info("Updated device: {}", updated.getDeviceId());

        return mapToDetailedDTO(updated);
    }

    @Transactional
    @CacheEvict(value = "devices", key = "#deviceId") // ✅ SỬA: Đổi thành #deviceId
    public void deleteDevice(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        // <<<< BƯỚC KIỂM TRA QUYỀN >>>>
        User currentUser = authenticationService.getCurrentAuthenticatedUser();
        farmService.checkUserPermissionForFarm(currentUser.getId(), device.getFarm().getId(), FarmRole.OPERATOR);

        deviceRepository.delete(device);
        log.info("Deleted device: {}", device.getDeviceId());
    }

    @Cacheable(value = "devices", key = "#deviceId") // <-- THÊM ANNOTATION NÀY
    public DeviceDTO getDevice(Long deviceId) {
        log.info("DATABASE HIT: Lấy thông tin device với ID: {}", deviceId); // Thêm log để kiểm tra
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));
        return mapToDetailedDTO(device);
    }

    public DeviceDTO getDeviceWithLatestData(String deviceId) {
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        DeviceDTO dto = mapToDetailedDTO(device);

        // Get latest sensor data
        SensorDataDTO latestSensorData = sensorDataService.getLatestSensorData(deviceId);
        dto.setLatestSensorData(latestSensorData);

        return dto;
    }

    public List<DeviceDTO> getDevicesByFarm(Long farmId) {
        return deviceRepository.findByFarmId(farmId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    // ✅ SỬA: Method này để lấy devices với data dạng Map
    public List<DeviceDTO> getDevicesByFarmWithData(Long farmId) {
        List<Device> devices = deviceRepository.findByFarmId(farmId);

        return devices.stream()
                .map(device -> {
                    DeviceDTO dto = mapToDTO(device);

                    // Get latest sensor data for this device
                    try {
                        SensorDataDTO sensorData = sensorDataService.getLatestSensorData(device.getDeviceId());

                        if (sensorData != null) {
                            // Set as SensorDataDTO object
                            dto.setLatestSensorData(sensorData);

                            // Also convert to Map for backward compatibility
                            Map<String, Object> dataMap = convertSensorDataToMap(sensorData);
                            dto.setLatestData(dataMap);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to get sensor data for device {}: {}",
                                device.getDeviceId(), e.getMessage());
                    }

                    return dto;
                })
                .collect(Collectors.toList());
    }

    public List<DeviceDTO> getDevicesByFarmAndType(Long farmId, String type) {
        DeviceType deviceType = DeviceType.valueOf(type);
        return deviceRepository.findByFarmIdAndType(farmId, deviceType)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public List<DeviceDTO> getOnlineDevices(Long farmId) {
        return deviceRepository.findOnlineDevicesByFarmId(farmId)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void controlDevice(String deviceId, String action, Map<String, Object> params) {
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        // <<<< BƯỚC KIỂM TRA QUYỀN >>>>
        User currentUser = authenticationService.getCurrentAuthenticatedUser();
        farmService.checkUserPermissionForFarm(currentUser.getId(), device.getFarm().getId(), FarmRole.OPERATOR);

        if (!isActuator(device.getType())) {
            throw new RuntimeException("Device is not controllable");
        }

        // ✅ GỬI LỆNH QUA MQTT
        String topic = String.format("device/%s/control", deviceId);

        Map<String, Object> command = new HashMap<>();
        command.put("deviceId", deviceId);
        command.put("action", action);
        command.putAll(params);
        command.put("timestamp", LocalDateTime.now().toString());

        try {
            mqttGateway.sendToMqtt(new ObjectMapper().writeValueAsString(command), topic);
            log.info("✅ Đã gửi lệnh MQTT tới device {}: {} with params: {}", deviceId, action, params);
        } catch (Exception e) {
            log.error("❌ Lỗi khi gửi lệnh MQTT: {}", e.getMessage());
            throw new RuntimeException("Failed to send control command", e);
        }
    }

    // SỬA LẠI HÀM NÀY
    @Transactional
    public void checkStaleDevices() {
        // Giả sử 5 phút không có tín hiệu là offline
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<Device> staleDevices = deviceRepository.findStaleDevices(threshold);

        for (Device device : staleDevices) {
            if (device.getStatus() == DeviceStatus.ONLINE) {
                device.setStatus(DeviceStatus.OFFLINE);
                deviceRepository.save(device);
                log.warn("Device {} marked as offline due to inactivity", device.getDeviceId());

                // ===> THÊM DÒNG NÀY ĐỂ GỬI WEBSOCKET <===
                webSocketService.sendDeviceStatus(device.getFarm().getId(), device.getDeviceId(), "OFFLINE");
            }
            // VVVV--- THAY THẾ VIỆC GỌI EMAILSERVICE BẰNG NOTIFICATIONSERVICE ---VVVV
            User owner = device.getFarm().getOwner();
            String title = String.format("Thiết bị '%s' đã offline", device.getName());
            String message = String.format("Thiết bị '%s' (ID: %s) tại nông trại '%s' đã mất kết nối.",
                    device.getName(), device.getDeviceId(), device.getFarm().getName());
            String link = "/devices"; // Hoặc link chi tiết tới thiết bị

            notificationService.createAndSendNotification(
                    owner,
                    title,
                    message,
                    Notification.NotificationType.DEVICE_STATUS,
                    link,
                    true // Gửi email);
            );
            // ^^^^-------------------------------------------------------------------^^^^
        }
    }

    // Helper methods
    private String generateDeviceId() {
        return "DEV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private boolean isActuator(DeviceType type) {
        return type == DeviceType.ACTUATOR_PUMP ||
                type == DeviceType.ACTUATOR_FAN ||
                type == DeviceType.ACTUATOR_LIGHT;
    }

    // ✅ THÊM: Helper method to convert SensorDataDTO to Map
    private Map<String, Object> convertSensorDataToMap(SensorDataDTO sensorData) {
        Map<String, Object> map = new HashMap<>();

        if (sensorData.getDeviceId() != null) {
            map.put("deviceId", sensorData.getDeviceId());
        }
        if (sensorData.getSensorType() != null) {
            map.put("sensorType", sensorData.getSensorType());
        }
        if (sensorData.getTemperature() != null) {
            map.put("temperature", sensorData.getTemperature());
        }
        if (sensorData.getHumidity() != null) {
            map.put("humidity", sensorData.getHumidity());
        }
        if (sensorData.getSoilMoisture() != null) {
            map.put("soilMoisture", sensorData.getSoilMoisture());
        }
        if (sensorData.getLightIntensity() != null) {
            map.put("lightIntensity", sensorData.getLightIntensity());
        }
        if (sensorData.getSoilPH() != null) {
            map.put("soilPH", sensorData.getSoilPH());
        }
        if (sensorData.getTimestamp() != null) {
            map.put("timestamp", sensorData.getTimestamp().toString());
        }

        return map;
    }

    private DeviceDTO mapToDTO(Device device) {

        DeviceDTO.DeviceDTOBuilder builder = DeviceDTO.builder()
                .id(device.getId())
                .deviceId(device.getDeviceId())
                .name(device.getName())
                .description(device.getDescription())
                .type(device.getType().name())
                .status(device.getStatus().name())
                .farmId(device.getFarm().getId())
                .farmName(device.getFarm().getName())
                .farmLocation(device.getFarm().getLocation())
                .lastSeen(device.getLastSeen())
                .metadata(device.getMetadata())
                .createdAt(device.getCreatedAt())
                .updatedAt(device.getUpdatedAt());

        if (device.getZone() != null) {
            builder.zoneId(device.getZone().getId());
            builder.zoneName(device.getZone().getName());
        }
        // ^^^^-----------------------^^^^

        DeviceDTO dto = builder.build();
        dto.calculateDerivedFields();
        return dto;
    }

    private DeviceDTO mapToDetailedDTO(Device device) {
        DeviceDTO dto = mapToDTO(device);

        if (device.getMetadata() != null && !device.getMetadata().isEmpty()) {
            Map<String, Object> config = new HashMap<>();
            config.put("metadata", device.getMetadata());
            dto.setConfig(config);
        }

        return dto;
    }

    // ✅ THÊM: Helper method để map type linh hoạt
    private DeviceType parseDeviceType(String typeStr) {
        // Map các tên ngắn gọn sang tên đầy đủ
        Map<String, DeviceType> typeMapping = Map.of(
                "DHT22", DeviceType.SENSOR_DHT22,
                "SOIL_MOISTURE", DeviceType.SENSOR_SOIL_MOISTURE,
                "LIGHT", DeviceType.SENSOR_LIGHT,
                "PH", DeviceType.SENSOR_PH,
                "PUMP", DeviceType.ACTUATOR_PUMP,
                "FAN", DeviceType.ACTUATOR_FAN,
                "LIGHT_ACTUATOR", DeviceType.ACTUATOR_LIGHT);

        // Thử tìm trong map trước
        if (typeMapping.containsKey(typeStr)) {
            return typeMapping.get(typeStr);
        }

        // Nếu không có trong map, parse trực tiếp từ enum
        try {
            return DeviceType.valueOf(typeStr);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid device type: " + typeStr +
                    ". Valid types: "
                    + String.join(", ", Arrays.stream(DeviceType.values()).map(Enum::name).toArray(String[]::new)));
        }
    }
}
