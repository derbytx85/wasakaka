import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/store/SettingsContext";
import { Spacing, Radius } from "@/constants/theme";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useState } from "react";
import type { ThemeMode } from "@/types";

export default function Settings() {
  const { colors } = useTheme();
  const { theme, setTheme, weatherTipsEnabled, setWeatherTipsEnabled } = useSettings();
  const [perms, setPerms] = useState({ location: false, notifications: false });

  const load = async () => {
    const loc = await Location.getForegroundPermissionsAsync();
    const n = await Notifications.getPermissionsAsync();
    setPerms({ location: loc.status === "granted", notifications: n.status === "granted" });
  };
  useState(() => { load(); });

  const openAppSettings = () => Linking.openSettings();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Tema">
          <ThemePill label="Claro" value="light" current={theme} onChange={setTheme} colors={colors} />
          <ThemePill label="Oscuro" value="dark" current={theme} onChange={setTheme} colors={colors} />
          <ThemePill label="Sistema" value="system" current={theme} onChange={setTheme} colors={colors} />
        </Section>

        <Section title="Clima">
          <ToggleRow label="Consejos contextuales" value={weatherTipsEnabled} onChange={setWeatherTipsEnabled} colors={colors} />
        </Section>

        <Section title="Permisos">
          <PermissionRow label="Ubicación" granted={perms.location} onActivate={openAppSettings} colors={colors} />
          <PermissionRow label="Notificaciones" granted={perms.notifications} onActivate={openAppSettings} colors={colors} />
        </Section>

        <Section title="Privacidad">
          <Card>
            <Text style={[styles.privacy, { color: colors.textSecondary }]}>
              SALGO utiliza la ubicación exclusivamente para activar recordatorios relacionados con los lugares configurados por el usuario. La información de ubicación no se vende ni se comparte.
            </Text>
            <Text style={[styles.privacy, { color: colors.textMuted, marginTop: 8 }]}>
              Ubicación almacenada únicamente en tu dispositivo.
            </Text>
          </Card>
        </Section>

        <Section title="Acerca de SALGO">
          <Card>
            <Text style={[styles.about, { color: colors.textSecondary }]}>Versión 1.0.0 · Hecho con foco.</Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: any) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function ThemePill({ label, value, current, onChange, colors }: any) {
  const active = current === value;
  return (
    <Pressable
      onPress={() => onChange(value as ThemeMode)}
      style={[styles.pill, { backgroundColor: active ? colors.accent : colors.surface, borderColor: colors.border }]}
    >
      <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange, colors }: any) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
    >
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.toggle, { backgroundColor: value ? colors.accent : colors.border }]}>
        <View style={[styles.knob, { transform: [{ translateX: value ? 20 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

function PermissionRow({ label, granted, onActivate, colors }: any) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>
        {granted ? "✅" : "⚠️"} {label}
      </Text>
      {granted ? (
        <Text style={{ color: colors.success, fontWeight: "600" }}>Permitida</Text>
      ) : (
        <Pressable onPress={onActivate}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>Activar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  pill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1, alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  privacy: { fontSize: 14, lineHeight: 20 },
  about: { fontSize: 14 },
});