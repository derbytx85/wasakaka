import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Alert, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { PlaceRepo, ItemRepo } from "@/services/database/db";
import { registerGeofences } from "@/services/geofencing";
import { Spacing, Radius } from "@/constants/theme";
import type { Place, Item } from "@/types";

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const placeId = parseInt(id as string, 10);
  const { colors } = useTheme();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const load = async () => {
    const p = await PlaceRepo.getById(placeId);
    const its = await ItemRepo.getByPlace(placeId);
    setPlace(p ?? null);
    setItems(its);
  };
  useEffect(() => { load(); }, [placeId]);

  const toggleEnabled = async (v: boolean) => {
    if (!place) return;
    try {
      await PlaceRepo.update(place.id, { enabled: v });
      try { await registerGeofences(); } catch {}
      await load();
    } catch (err) {
      console.warn("Error toggling place:", err);
    }
  };

  const remove = async () => {
    Alert.alert("Eliminar lugar", "¿Seguro que deseas eliminar este lugar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await PlaceRepo.remove(placeId);
            try { await registerGeofences(); } catch {}
            router.back();
          } catch (err) {
            Alert.alert("Error", "No se pudo eliminar el lugar");
          }
        },
      },
    ]);
  };

  if (!place) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Cargando lugar...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <Card>
          <View style={styles.head}>
            <Text style={styles.icon}>{place.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{place.name}</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>Radio {place.radius} m</Text>
            </View>
            <Switch value={place.enabled} onValueChange={toggleEnabled} />
          </View>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>Cuando salgas de este lugar, te recordaré:</Text>
        </Card>

        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ gap: 8 }}
          ListEmptyComponent={
            <Card>
              <Text style={[styles.empty, { color: colors.textSecondary }]}>
                Aún no hay elementos. Agrega lo que no quieres olvidar.
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={async () => {
                await ItemRepo.update(item.id, { enabled: !item.enabled });
                load();
              }}
              style={[styles.item, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            >
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <Text style={[styles.itemName, { color: colors.text, opacity: item.enabled ? 1 : 0.5 }]}>{item.name}</Text>
              <Text style={[styles.prio, { color: item.priority === "important" ? colors.warning : colors.textMuted }]}>
                {item.priority === "important" ? "Importante" : "Normal"}
              </Text>
            </Pressable>
          )}
        />

        <Button
          title="+ Agregar elemento"
          onPress={() => router.push({ pathname: "/item/new", params: { placeId: String(placeId) } })}
        />
        <Button title="Eliminar lugar" onPress={remove} variant="ghost" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  icon: { fontSize: 36 },
  name: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 2 },
  desc: { fontSize: 14, lineHeight: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  itemIcon: { fontSize: 22 },
  itemName: { flex: 1, fontSize: 16, fontWeight: "500" },
  prio: { fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", paddingVertical: 16 },
});