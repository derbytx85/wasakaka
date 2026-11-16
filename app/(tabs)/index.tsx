import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/hooks/useTheme";
import { usePlaces } from "@/hooks/usePlaces";
import { Spacing, Radius } from "@/constants/theme";
import { APP_NAME, FREE_PLAN_LIMITS } from "@/constants/app";
import { SubscriptionService } from "@/services/subscription";
import { ItemRepo } from "@/services/database/db";
import { useEffect, useState } from "react";

export default function Home() {
  const { colors } = useTheme();
  const { places } = usePlaces();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    (async () => {
      const m: Record<number, number> = {};
      for (const p of places) m[p.id] = await ItemRepo.countByPlace(p.id);
      setCounts(m);
      setIsPro(await SubscriptionService.isPro());
    })();
  }, [places]);

  const next = places[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Logo size={40} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: colors.text }]}>{APP_NAME}</Text>
          </View>
          {!isPro && (
            <Pressable onPress={() => router.push("/upgrade")}>
              <View style={[styles.proBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </Pressable>
          )}
        </View>

        <Card>
          <Text style={[styles.heroTitle, { color: colors.text }]}>¿Estás listo para salir?</Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Te avisaremos automáticamente cuando salgas de tus lugares.
          </Text>
        </Card>

        <View style={styles.statsRow}>
          <StatCard label="Lugares configurados" value={`${places.length}${!isPro ? `/${FREE_PLAN_LIMITS.places}` : ""}`} colors={colors} />
          <StatCard label="Próximo recordatorio" value={next ? `${next.icon} ${next.name}` : "—"} sub={next ? `${counts[next.id] ?? 0} elementos` : undefined} colors={colors} />
        </View>

        <Button title="+ Agregar lugar" onPress={() => router.push("/place/new")} />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis lugares</Text>
          <Pressable onPress={() => router.push("/(tabs)/places")}>
            <Text style={[styles.seeAll, { color: colors.accent }]}>Ver todos</Text>
          </Pressable>
        </View>

        {places.length === 0 ? (
          <Card>
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              Aún no tienes lugares. Agrega tu primer lugar para comenzar.
            </Text>
          </Card>
        ) : (
          places.slice(0, 3).map((p) => (
            <PlaceRow key={p.id} place={p} count={counts[p.id] ?? 0} colors={colors} onPress={() => router.push(`/place/${p.id}`)} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value, sub, colors }: any) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      {sub && <Text style={[styles.statSub, { color: colors.textMuted }]}>{sub}</Text>}
    </View>
  );
}

function PlaceRow({ place, count, colors, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.placeRow,
      { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
    ]}>
      <Text style={styles.placeIcon}>{place.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>
        <Text style={[styles.placeCount, { color: colors.textSecondary }]}>{count} elementos</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: place.enabled ? colors.success : colors.textMuted }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  brand: { fontSize: 22, fontWeight: "700", letterSpacing: 2 },
  heroTitle: { fontSize: 24, fontWeight: "700" },
  heroSub: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  stat: { flex: 1, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  statLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  statSub: { fontSize: 12, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  seeAll: { fontSize: 14, fontWeight: "600" },
  empty: { textAlign: "center", paddingVertical: 16 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  placeIcon: { fontSize: 28 },
  placeName: { fontSize: 16, fontWeight: "600" },
  placeCount: { fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: Radius.full },
  proBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  proBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
});