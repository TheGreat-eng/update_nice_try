export interface SensorDataMessage {
    deviceId: string;
    timestamp: string;
    temperature?: number;
    humidity?: number;
    soilMoisture?: number;
    soilPH?: number;
    lightIntensity?: number;
}

export interface DeviceStatusMessage {
    deviceId: string;
    status: 'ONLINE' | 'OFFLINE';
    timestamp: string;
}