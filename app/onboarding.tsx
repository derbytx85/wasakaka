import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/store/SettingsContext";
import { Spacing, Radius } from "@/constants/theme";
import { APP_NAME, TAGLINE } from "@/constants/app";
import { Analytics } from "@/services/analytics";

const slides = [
  { icon: "🎒", title: "Recuerda lo importante", desc: "Configura las cosas que siempre necesitas llevar contigo." },
  { icon: "🚪", title: "Te avisamos cuando salgas", desc: "SALGO detecta cuando sales de tus lugares habituales." },
  { icon: "☔", title: "También puede anticiparse", desc: "Consulta el clima y recibe recordatorios contextuales." },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { colors } = useTheme();
  const { setOnboardingDone } = useSettings();
  const router = useRouter();

  const next = async () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      await setOnboardingDone(true);
      Analytics.track("onboarding_completed");
      router.replace("/(tabs)");
    }
  };

  const s = slides[step];

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <Logo size={56} />
          <Text style={[styles.brand, { color: colors.text }]}>{APP_NAME}</Text>
          <Text style={[styles.tag, { color: colors.textSecondary }]}>{TAGLINE}</Text>
        </View>

        <Animated.View key={step} entering={FadeIn.duration(300)} style={styles.slide}>
          <Text style={styles.icon}>{s.icon}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{s.title}</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{s.desc}</Text>
        </Animated.View>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === step ? colors.accent : colors.border }]} />
          ))}
        </View>

        <Button title={step === slides.length - 1 ? "Comenzar" : "Siguiente"} onPress={next} />
        <Pressable onPress={async () => { await setOnboardingDone(true); router.replace("/(tabs)"); }}>
          <Text style={[styles.skip, { color: colors.textMuted }]}>Saltar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.lg, justifyContent: "space-between", paddingTop: 64 },
  top: { alignItems: "center", gap: 8 },
  brand: { fontSize: 28, fontWeight: "700", letterSpacing: 2 },
  tag: { fontSize: 14 },
  slide: { alignItems: "center", gap: 16, paddingVertical: 32 },
  icon: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  desc: { fontSize: 16, textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  skip: { textAlign: "center", marginTop: 16, fontSize: 14 },
});