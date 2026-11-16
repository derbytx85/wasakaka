import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SALGO",
  slug: "salgo",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "salgo",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0A0F1E",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.salgo.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "SALGO necesita tu ubicación para detectar cuándo sales de tus lugares configurados.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "SALGO necesita acceso constante a tu ubicación para avisarte cuando sales de un lugar, incluso con la app cerrada.",
      NSLocationAlwaysUsageDescription:
        "SALGO necesita acceso constante a tu ubicación para recordarte qué llevar al salir.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0F1E",
    },
    package: "com.salgo.app",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "INTERNET",
      "ACCESS_BACKGROUND_LOCATION",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "SALGO necesita acceso constante a tu ubicación para recordarte qué llevar al salir.",
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#0066FF",
      },
    ],
    "expo-secure-store",
    "react-native-webview",
  ],
  extra: {
    revenueCatApiKeyAndroid: process.env.REVENUECAT_API_KEY_ANDROID,
    revenueCatApiKeyIOS: process.env.REVENUECAT_API_KEY_IOS,
    eas: {
      projectId: "tu-project-id-aqui",
    },
  },
  experiments: {
    typedRoutes: true,
  },
});