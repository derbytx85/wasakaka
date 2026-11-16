import { View, Text } from "react-native";
import { Screen } from "@/components/Screen";
export default function NotFound() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Pantalla no encontrada</Text>
      </View>
    </Screen>
  );
}