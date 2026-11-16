# SALGO

> "No olvides nada al salir."

Aplicación móvil (Android / iOS) que te recuerda qué llevar contigo cuando sales de tus lugares habituales.

## Stack

- React Native + Expo SDK 52
- TypeScript + Expo Router
- Expo Location + Task Manager (geofencing)
- Expo SQLite
- RevenueCat (suscripciones)
- Open-Meteo (clima)

## Instalación

\`\`\`bash
npm install
cp .env.example .env
npx expo prebuild
npx expo run:android  # o run:ios
\`\`\`

## Permisos

- Ubicación (siempre)
- Notificaciones

## RevenueCat

Configura tus API keys en `.env`:
\`\`\`
REVENUECAT_API_KEY_ANDROID=goog_xxx
REVENUECAT_API_KEY_IOS=appl_xxx
\`\`\`
