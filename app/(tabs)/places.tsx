import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { usePlaces } from "@/hooks/usePlaces";
import { ItemRepo } from "@/services/database/db";
import { useEffect, useState } from "react";
import { Spacing, Radius } from "@/constants/theme";

export default function Places() {
  const { colors } = useTheme();
  const { places } = usePlaces();
  const router = useRouter();
  const [counts, setCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      const m: Record<number, number> = {};
      for (const p of places) m[p.id] = await ItemRepo.countByPlace(p.id);
      setCounts(m);
    })();
  }, [places]);

  return (
    <Screen>
      <View style={styles.wrap}>
        <FlatList
          data={places}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Card>
              <Text style={[styles.empty, { color: colors.textSecondary }]}>Aún no tienes lugares.</Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/place/${item.id}`)}
              style={[styles.row, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {counts[item.id] ?? 0} elementos · {item.radius} m
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: item.enabled ? colors.success : colors.textMuted }]} />
            </Pressable>
          )}
        />
        <Button title="+ Agregar lugar" onPress={() => router.push("/place/new")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  list: { gap: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { fontSize: 28 },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: Radius.full },
  empty: { textAlign: "center", paddingVertical: 16 },
});