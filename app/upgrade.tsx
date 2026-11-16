import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { SubscriptionService } from "@/services/subscription";
import { Spacing, Radius } from "@/constants/theme";
import { Analytics } from "@/services/analytics";
import type { PurchasesPackage } from "react-native-purchases";

export default function Upgrade() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  useEffect(() => { loadOfferings(); }, []);

  const loadOfferings = async () => {
    setLoading(true);
    const offerings = await SubscriptionService.getOfferings();
    if (offerings?.current?.availablePackages) {
      setPackages(offerings.current.availablePackages);
    }
    setLoading(false);
  };

  const purchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    const result = await SubscriptionService.purchase(pkg);
    setPurchasing(false);

    if (result.success) {
      Alert.alert("¡Bienvenido a SALGO Pro!", "Ahora tienes acceso ilimitado a todas las funciones.");
      Analytics.track("subscription_purchased");
      router.back();
    } else if (result.error?.code === "1") {
      return;
    } else {
      Alert.alert("Error", "No se pudo completar la compra. Intenta de nuevo.");
    }
  };

  const restore = async () => {
    setPurchasing(true);
    const result = await SubscriptionService.restorePurchases();
    setPurchasing(false);

    if (result.success) {
      const isPro = await SubscriptionService.isPro();
      if (isPro) {
        Alert.alert("¡Restaurado!", "Tu suscripción Pro ha sido restaurada.");
        router.back();
      } else {
        Alert.alert("Sin compras", "No se encontraron compras anteriores.");
      }
    } else {
      Alert.alert("Error", "No se pudieron restaurar las compras.");
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={[styles.title, { color: colors.text }]}>SALGO Pro</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Desbloquea todo el potencial de SALGO
          </Text>
        </View>

        <Card>
          <View style={styles.features}>
            <Feature icon="📍" text="Lugares ilimitados" colors={colors} />
            <Feature icon="📦" text="Elementos ilimitados" colors={colors} />
            <Feature icon="☔" text="Clima contextual" colors={colors} />
            <Feature icon="📅" text="Reglas avanzadas" colors={colors} />
            <Feature icon="📊" text="Historial completo" colors={colors} />
            <Feature icon="🎨" text="Personalización" colors={colors} />
          </View>
        </Card>

        {packages.length > 0 ? (
          <View style={styles.packages}>
            {packages.map((pkg) => (
              <Pressable
                key={pkg.identifier}
                onPress={() => purchase(pkg)}
                disabled={purchasing}
                style={[styles.package, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.packageName, { color: colors.text }]}>{pkg.product.title}</Text>
                  <Text style={[styles.packageDesc, { color: colors.textSecondary }]}>{pkg.product.description}</Text>
                </View>
                <Text style={[styles.price, { color: colors.accent }]}>{pkg.product.priceString}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <Text style={[styles.noOffers, { color: colors.textSecondary }]}>
              No hay ofertas disponibles en este momento.
            </Text>
          </Card>
        )}

        <Button title="Restaurar compras" onPress={restore} variant="secondary" loading={purchasing} />

        <Pressable onPress={() => router.back()}>
          <Text style={[styles.skip, { color: colors.textMuted }]}>Continuar con plan gratuito</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Feature({ icon, text, colors }: any) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 48 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", gap: 8, paddingTop: 24 },
  emoji: { fontSize: 48 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 16, textAlign: "center" },
  features: { gap: 12 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { fontSize: 24 },
  featureText: { fontSize: 16, fontWeight: "500" },
  packages: { gap: 12 },
  package: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  packageName: { fontSize: 16, fontWeight: "600" },
  packageDesc: { fontSize: 13, marginTop: 2 },
  price: { fontSize: 18, fontWeight: "700" },
  noOffers: { textAlign: "center", paddingVertical: 16 },
  skip: { textAlign: "center", marginTop: 8, fontSize: 14 },
});