import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { PlaceRepo, ItemRepo } from "@/services/database/db";
import { Spacing, Radius } from "@/constants/theme";
import { Analytics } from "@/services/analytics";
import type { Place, Item } from "@/types";

export default function Checklist() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const id = parseInt(placeId as string, 10);
  const { colors } = useTheme();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    (async () => {
      const p = await PlaceRepo.getById(id);
      const its = await ItemRepo.getByPlace(id);
      setPlace(p ?? null);
      setItems(its);
    })();
  }, [id]);

  const toggle = (itemId: number) => {
    Haptics.selectionAsync().catch(() => {});
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId);
      return n;
    });
  };

  const allDone = items.length > 0 && checked.size === items.length;

  useEffect(() => {
    if (allDone && !done) {
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      scale.value = withSpring(1.1, {}, () => { scale.value = 1; });
      Analytics.track("checklist_completed", { placeId: id });
    }
  }, [allDone]);

  if (!place) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Cargando checklist...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: colors.text }]}>¿Llevas todo?</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>{place.icon} {place.name}</Text>

        <View style={{ gap: 8 }}>
          {items.map((it) => {
            const isOn = checked.has(it.id);
            return (
              <Pressable
                key={it.id}
                onPress={() => toggle(it.id)}
                style={[styles.row, { backgroundColor: isOn ? colors.success + "18" : colors.surfaceElevated, borderColor: isOn ? colors.success : colors.border }]}
              >
                <View style={[styles.box, { borderColor: isOn ? colors.success : colors.border }]}>
                  {isOn && <Text style={{ color: colors.success, fontWeight: "700" }}>✓</Text>}
                </View>
                <Text style={styles.icon}>{it.icon}</Text>
                <Text style={[styles.name, { color: colors.text, opacity: isOn ? 0.6 : 1 }]}>{it.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {allDone ? (
          <Animated.View entering={FadeIn} style={{ alignItems: "center", gap: 12 }}>
            <Animated.Text style={{ fontSize: 48, transform: [{ scale }] }}>🚗</Animated.Text>
            <Text style={[styles.done, { color: colors.success }]}>¡Buen viaje!</Text>
          </Animated.View>
        ) : (
          <Text style={[styles.progress, { color: colors.textMuted }]}>
            {checked.size} de {items.length}
          </Text>
        )}

        <Button title="Ya estoy listo" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 28, fontWeight: "700" },
  sub: { fontSize: 16, marginTop: -8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 22 },
  name: { flex: 1, fontSize: 16, fontWeight: "500" },
  progress: { textAlign: "center", fontSize: 14 },
  done: { fontSize: 20, fontWeight: "700" },
});