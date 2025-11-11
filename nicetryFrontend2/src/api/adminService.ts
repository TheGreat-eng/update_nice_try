// src/api/adminService.ts
import api from './axiosConfig';
import type { AdminUser, AdminStats } from '../types/admin';
import type { Page } from '../types/common'; // Sẽ tạo type này

export const getSystemStats = () => {
    return api.get<{ data: AdminStats }>('/admin/stats');
};

// SỬA LẠI HÀM NÀY
export const getAllUsers = (page = 0, size = 10, search = '') => {
    return api.get<{ data: Page<AdminUser> }>(`/admin/users?page=${page}&size=${size}&search=${search}`);
};

export const lockUser = (userId: number) => {
    return api.post(`/admin/users/${userId}/lock`);
};

export const unlockUser = (userId: number) => {
    return api.post(`/admin/users/${userId}/unlock`);
};

export const softDeleteUser = (userId: number) => {
    return api.delete(`/admin/users/${userId}`);
};