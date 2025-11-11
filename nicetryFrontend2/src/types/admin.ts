// src/types/admin.ts
export interface AdminUser {
    id: number;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'FARMER' | 'VIEWER';
    enabled: boolean;
    deleted: boolean;
    createdAt: string;
    lastLogin: string;
}

export interface AdminStats {
    totalUsers: number;
    totalFarms: number;
    totalDevices: number;
    onlineDevices: number;
    totalRules: number;
}