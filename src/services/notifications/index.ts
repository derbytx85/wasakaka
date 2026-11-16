import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

export const NOTIFICATION_CHANNEL = "salgo-reminders";

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: "Recordatorios SALGO",
      description: "Avisos al salir de tus lugares",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

export async function sendExitReminder(params: {
  placeId: number;
  placeName: string;
  items: string[];
  weatherTip?: string;
}) {
  const body = params.items.length
    ? params.items.join(", ")
    : "Revisa que llevas todo lo importante.";

  const content: Notifications.NotificationContentInput = {
    title: "🚪 Antes de salir...",
    body: params.weatherTip ? `${body}\n\n${params.weatherTip}` : body,
    data: { screen: "checklist", placeId: params.placeId },
    sound: "default",
  };

  if (Platform.OS === "android") {
    (content as any).channelId = NOTIFICATION_CHANNEL;
  }

  await Notifications.scheduleNotificationAsync({ content, trigger: null });
}