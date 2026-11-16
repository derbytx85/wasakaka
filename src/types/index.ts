export type Priority = "normal" | "important";

export interface Place {
  id: number;
  name: string;
  icon: string;
  latitude: number;
  longitude: number;
  radius: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: number;
  placeId: number;
  name: string;
  icon: string;
  priority: Priority;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: number;
  placeId: number;
  enabled: boolean;
  weekdays: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
}

export interface EventLog {
  id: number;
  placeId: number;
  eventType: string;
  createdAt: string;
}

export interface WeatherCache {
  id: number;
  latitude: number;
  longitude: number;
  temperature: number;
  rainProbability: number;
  condition: string;
  windSpeed: number;
  updatedAt: string;
}

export type ThemeMode = "light" | "dark" | "system";
export type PlanType = "free" | "pro";

export interface Subscription {
  plan: PlanType;
  expiresAt?: string;
}

export interface WeatherData {
  temperature: number;
  rainProbability: number;
  condition: string;
  windSpeed: number;
}

export type Coords = { latitude: number; longitude: number };