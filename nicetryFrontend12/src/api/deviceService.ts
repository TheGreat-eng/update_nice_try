// src/api/deviceService.ts
import api from './axiosConfig';
import type { Device } from '../types/device';

// Định nghĩa kiểu dữ liệu cho việc tạo/cập nhật
export interface DeviceFormData {
    name: string;
    deviceId: string;
    type: string;
    description?: string;
}

export const getDevicesByFarm = (farmId: number) => {
    return api.get<{ success: boolean; data: Device[] }>(`/devices?farmId=${farmId}&withData=true`);
};

export const controlDevice = (deviceId: string, action: 'turn_on' | 'turn_off', duration?: number) => {
    const command: { action: string; duration?: number } = { action };
    if (duration) {
        command.duration = duration;
    }
    return api.post(`/devices/${deviceId}/control`, command);
};



// THÊM CÁC HÀM MỚI
export const createDevice = (farmId: number, data: DeviceFormData) => {
    return api.post<Device>(`/devices?farmId=${farmId}`, data);
};

export const updateDevice = (id: number, data: Partial<DeviceFormData>) => {
    return api.put<Device>(`/devices/${id}`, data);
};

export const deleteDevice = (id: number) => {
    return api.delete(`/devices/${id}`);
};