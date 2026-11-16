import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🚪</Text> }} />
      <Tabs.Screen name="places" options={{ title: "Lugares", tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📍</Text> }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes", tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text> }} />
    </Tabs>
  );
}