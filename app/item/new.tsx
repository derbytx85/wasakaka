import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { ItemRepo } from "@/services/database/db";
import { Spacing, Radius } from "@/constants/theme";
import { ITEM_ICONS } from "@/constants/app";
import { Analytics } from "@/services/analytics";
import { SubscriptionService } from "@/services/subscription";
import type { Priority } from "@/types";

export default function NewItem() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ITEM_ICONS[0]);
  const [priority, setPriority] = useState<Priority>("normal");

  const save = async () => {
    if (!name.trim()) { Alert.alert("Falta el nombre"); return; }

    const currentCount = await ItemRepo.countByPlace(parseInt(placeId as string, 10));
    const canCreate = await SubscriptionService.canCreateItem(currentCount);
    if (!canCreate) {
      Alert.alert(
        "Límite alcanzado",
        "El plan gratuito permite máximo 5 elementos por lugar. Actualiza a SALGO Pro para elementos ilimitados.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Actualizar", onPress: () => router.push("/upgrade") },
        ]
      );
      return;
    }

    await ItemRepo.create({
      placeId: parseInt(placeId as string, 10),
      name: name.trim(), icon, priority, enabled: true,
    });
    Analytics.track("item_created");
    router.back();
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Llaves, billetera..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
        </Card>

        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Icono</Text>
          <View style={styles.row}>
            {ITEM_ICONS.map((i) => (
              <Pressable
                key={i}
                onPress={() => setIcon(i)}
                style={[styles.iconBtn, { backgroundColor: i === icon ? colors.accent : colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 22 }}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Prioridad</Text>
          <View style={styles.row}>
            {(["normal", "important"] as Priority[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                style={[styles.prioBtn, { backgroundColor: p === priority ? colors.accent : colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ color: p === priority ? "#fff" : colors.text, fontWeight: "600" }}>
                  {p === "normal" ? "Normal" : "Importante"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Button title="Guardar" onPress={save} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  label: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: 14, fontSize: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: { width: 48, height: 48, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  prioBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, alignItems: "center" },
});