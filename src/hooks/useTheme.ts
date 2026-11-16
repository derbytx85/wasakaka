import { useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";
import { useSettings } from "@/store/SettingsContext";

export function useTheme() {
  const systemScheme = useColorScheme();
  const { theme } = useSettings();
  const mode = theme === "system" ? (systemScheme ?? "light") : theme;
  return { mode, colors: Colors[mode] };
}