import { EventLogRepo } from "@/services/database/db";

export const Analytics = {
  async track(event: string, payload: Record<string, any> = {}) {
    if (event === "geofence_triggered" && payload.placeId) {
      await EventLogRepo.log(payload.placeId, event);
    }
    if (__DEV__) {
      console.log("[analytics]", event, payload);
    }
  },
};