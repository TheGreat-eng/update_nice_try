// src/api/farmService.ts

import api from './axiosConfig';
// ✅ ĐÚNG - Chỉ import type
import type { Farm, FarmFormData } from '../types/farm';

export const getFarms = () => {
    return api.get<{ data: Farm[] }>('/farms');
};

export const createFarm = (data: FarmFormData) => {
    return api.post<Farm>('/farms', data);
};

export const updateFarm = (id: number, data: FarmFormData) => {
    return api.put<Farm>(`/farms/${id}`, data);
};

export const deleteFarm = (id: number) => {
    return api.delete(`/farms/${id}`);
};