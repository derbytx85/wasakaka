import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SettingsProvider, useSettings } from "@/store/SettingsContext";
import { useTheme } from "@/hooks/useTheme";
import { getDb } from "@/services/database/db";
import { setupNotifications } from "@/services/notifications";
import { registerGeofences, requestLocationPermissions } from "@/services/geofencing";
import { requestNotificationPermission } from "@/services/notifications";
import { initRevenueCat } from "@/services/subscription";
import { View, ActivityIndicator, StyleSheet } from "react-native";

function RootInner() {
  const { colors } = useTheme();
  const { onboardingDone } = useSettings();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await getDb();
        await setupNotifications();
        await initRevenueCat();
        const locOk = await requestLocationPermissions();
        await requestNotificationPermission();
        if (locOk) await registerGeofences();
      } catch (e) {
        console.warn("[init] Error inicializando servicios:", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!onboardingDone ? (
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      )}
      <Stack.Screen name="place/new" options={{ title: "Nuevo lugar", presentation: "modal" }} />
      <Stack.Screen name="place/[id]" options={{ title: "Lugar" }} />
      <Stack.Screen name="item/new" options={{ title: "Nuevo elemento", presentation: "modal" }} />
      <Stack.Screen name="checklist/[placeId]" options={{ title: "Checklist de salida", presentation: "modal" }} />
      <Stack.Screen name="upgrade" options={{ title: "SALGO Pro", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <RootInner />
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});