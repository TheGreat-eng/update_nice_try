// src/types/farm.ts

export interface Farm {
    id: number;
    name: string;
    description?: string;
    location?: string;
    totalDevices?: number;
    onlineDevices?: number;

    // <<<< BỔ SUNG CÁC TRƯỜNG CÒN THIẾU DƯỚI ĐÂY >>>>
    ownerId: number;
    ownerEmail: string;
    createdAt: string; // Backend trả về chuỗi ISO date
}

export interface FarmFormData {
    name: string;
    location?: string;
    description?: string;
}

export interface FarmMemberDTO {
    userId: number;
    fullName: string;
    email: string;
    role: 'VIEWER' | 'OPERATOR';
}