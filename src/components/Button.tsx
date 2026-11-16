import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Radius, Spacing } from "@/constants/theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = "primary", loading, disabled }: Props) {
  const { colors } = useTheme();

  const bg =
    variant === "primary" ? colors.accent
    : variant === "secondary" ? colors.surface
    : "transparent";
  const fg =
    variant === "primary" ? "#FFFFFF"
    : variant === "secondary" ? colors.text
    : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === "secondary" && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.text, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});