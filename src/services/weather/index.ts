import type { WeatherData } from "@/types";
import { WEATHER_CACHE_TTL_MS } from "@/constants/app";
import { WeatherCacheRepo } from "@/services/database/db";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const cached = await WeatherCacheRepo.getNearest(lat, lon);
  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < WEATHER_CACHE_TTL_MS) {
      return {
        temperature: cached.temperature,
        rainProbability: cached.rainProbability,
        condition: cached.condition,
        windSpeed: cached.windSpeed,
      };
    }
  }

  try {
    const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return cached ? toWeather(cached) : null;
    const data = await res.json();
    const current = data.current;

    const weather: WeatherData = {
      temperature: current.temperature_2m,
      rainProbability: current.precipitation_probability ?? 0,
      condition: decodeWmo(current.weather_code),
      windSpeed: current.wind_speed_10m,
    };

    await WeatherCacheRepo.upsert({
      latitude: lat, longitude: lon,
      temperature: weather.temperature,
      rainProbability: weather.rainProbability,
      condition: weather.condition,
      windSpeed: weather.windSpeed,
    });

    return weather;
  } catch {
    return cached ? toWeather(cached) : null;
  }
}

function toWeather(c: any): WeatherData {
  return {
    temperature: c.temperature,
    rainProbability: c.rainProbability,
    condition: c.condition,
    windSpeed: c.windSpeed,
  };
}

export function buildWeatherTip(w: WeatherData): string | undefined {
  if (w.rainProbability > 50) return "☔ Puede llover hoy. Lleva paraguas.";
  if (w.temperature < 10) return "🧥 Hace frío. Recuerda llevar abrigo.";
  if (w.temperature > 30) return "🧴 Hace calor. Lleva agua y protector solar.";
  return undefined;
}

function decodeWmo(code: number): string {
  if (code === 0) return "Despejado";
  if (code <= 3) return "Nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 82) return "Chubascos";
  if (code <= 86) return "Nieve intensa";
  return "Tormenta";
}