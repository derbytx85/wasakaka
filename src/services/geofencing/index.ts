import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  PlaceRepo, ItemRepo, CooldownRepo, EventLogRepo, ReminderRepo,
} from "@/services/database/db";
import { sendExitReminder } from "@/services/notifications";
import { fetchWeather, buildWeatherTip } from "@/services/weather";
import { GEOFENCE_COOLDOWN_MS } from "@/constants/app";
import { Analytics } from "@/services/analytics";
import { SubscriptionService } from "@/services/subscription";

export const GEOFENCE_TASK = "SALGO_GEOFENCE_TASK";

export async function requestLocationPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  if (Platform.OS === "android") {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }
  const always = await Location.requestForegroundPermissionsAsync();
  return always.status === "granted";
}

export async function registerGeofences(): Promise<void> {
  try {
    const places = await PlaceRepo.getAll();
    const enabled = places.filter((p) => p.enabled);

    try {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    } catch {}

    if (enabled.length === 0) return;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[geofencing] Permiso de ubicación no concedido para registrar geocercas.");
      return;
    }

    const regions: Location.LocationRegion[] = enabled.map((p) => ({
      identifier: `place_${p.id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: Math.max(50, p.radius || 150),
      notifyOnEntry: false,
      notifyOnExit: true,
    }));

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  } catch (err) {
    console.warn("[geofencing] Error al registrar geocercas:", err);
  }
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  try {
    if (error) {
      console.warn("[geofence] error", error);
      return;
    }
    if (!data || !data.region) return;
    const { eventType, region } = data;
    if (eventType !== Location.GeofencingEventType.Exit) return;

    const idMatch = /place_(\d+)/.exec(region.identifier);
    if (!idMatch) return;
    const placeId = parseInt(idMatch[1], 10);

    await handleExit(placeId);
  } catch (taskErr) {
    console.error("[geofence] Error en tarea en segundo plano:", taskErr);
  }
});

async function handleExit(placeId: number) {
  const place = await PlaceRepo.getById(placeId);
  if (!place || !place.enabled) return;

  const last = await CooldownRepo.getLastTriggered(placeId);
  if (last && Date.now() - last.getTime() < GEOFENCE_COOLDOWN_MS) return;

  const reminder = await ReminderRepo.getByPlace(placeId);
  if (reminder && !reminder.enabled) return;
  if (reminder && !isWithinSchedule(reminder)) return;

  const items = (await ItemRepo.getByPlace(placeId)).filter((i) => i.enabled);
  const itemNames = items.map((i) => `${i.icon} ${i.name}`);

  const isPro = await SubscriptionService.isPro();
  let weatherTip: string | undefined;
  if (isPro) {
    const w = await fetchWeather(place.latitude, place.longitude);
    if (w) weatherTip = buildWeatherTip(w);
  }

  await sendExitReminder({
    placeId,
    placeName: place.name,
    items: itemNames,
    weatherTip,
  });

  await CooldownRepo.setTriggered(placeId);
  await EventLogRepo.log(placeId, "geofence_triggered");
  Analytics.track("geofence_triggered", { placeId });
}

function isWithinSchedule(r: { weekdays: string; startTime: string; endTime: string }): boolean {
  const now = new Date();
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (r.weekdays === "weekday" && (day === 0 || day === 6)) return false;
  if (r.weekdays === "weekend" && day !== 0 && day !== 6) return false;
  if (r.weekdays !== "all" && r.weekdays !== "weekday" && r.weekdays !== "weekend") {
    const list = r.weekdays.split(",").map(Number);
    if (!list.includes(day)) return false;
  }
  if (hhmm < r.startTime || hhmm > r.endTime) return false;
  return true;
}

export async function stopGeofences(): Promise<void> {
  try { await Location.stopGeofencingAsync(GEOFENCE_TASK); } catch {}
}