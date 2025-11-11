// src/types/device.ts
import type { SensorDataMessage } from "./websocket"; // Import kiểu dữ liệu từ websocket

export interface Device {
    id: number;
    deviceId: string;
    name: string;
    type: string;
    status: 'ONLINE' | 'OFFLINE' | 'ERROR';
    lastSeen: string;
    farmId: number;
    // VVVV--- THÊM DÒNG NÀY ---VVVV
    latestSensorData?: SensorDataMessage; // Lưu dữ liệu cảm biến mới nhất từ WebSocket
    // ^^^^-----------------------^^^^
    currentState?: 'ON' | 'OFF' | null; // <-- THÊM DÒNG NÀY
}