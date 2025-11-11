// src/types/farm.ts

export interface Farm {
    id: number;
    name: string;
    description?: string;
    location?: string;
    totalDevices?: number;
    onlineDevices?: number;
}

export interface FarmFormData {
    name: string;
    location?: string;
    description?: string;
}