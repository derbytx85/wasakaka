import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

export function Logo({ size = 48 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="12" y="8" width="32" height="48" rx="3" fill="none"
        stroke={colors.text} strokeWidth="3" />
      <Path
        d="M30 32 L56 32 M48 24 L56 32 L48 40"
        stroke={colors.accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M18 34 L24 40 L34 26"
        stroke={colors.success}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}