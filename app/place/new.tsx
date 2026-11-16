import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Svg, { Circle as SvgCircle, Line, Rect } from "react-native-svg";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { PlaceRepo } from "@/services/database/db";
import { registerGeofences } from "@/services/geofencing";
import { Spacing, Radius } from "@/constants/theme";
import { DEFAULT_RADIUS, RADIUS_OPTIONS, PLACE_ICONS } from "@/constants/app";
import { Analytics } from "@/services/analytics";
import { SubscriptionService } from "@/services/subscription";
import { OpenStreetMap } from "@/components/OpenStreetMap";

export default function NewPlace() {
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PLACE_ICONS[0]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [customRadiusText, setCustomRadiusText] = useState<string>(String(DEFAULT_RADIUS));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [mapMode, setMapMode] = useState<"osm" | "radar">("osm");

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const fetchCurrentLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Permiso de ubicación no concedido.");
        if (!coords) {
          // Coordenadas iniciales por defecto si no hay permiso
          const fallback = { latitude: -34.6037, longitude: -58.3816 };
          setCoords(fallback);
          setManualLat(String(fallback.latitude));
          setManualLon(String(fallback.longitude));
        }
        return;
      }

      // Intentar primero obtener la última ubicación conocida (inmediata)
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          setCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude });
          setManualLat(last.coords.latitude.toFixed(6));
          setManualLon(last.coords.longitude.toFixed(6));
        }
      } catch {}

      // Luego obtener la ubicación precisa
      const cur = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cur?.coords) {
        setCoords({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
        setManualLat(cur.coords.latitude.toFixed(6));
        setManualLon(cur.coords.longitude.toFixed(6));
        setLocationError(null);
      }
    } catch (err: any) {
      console.warn("[location] Error al obtener GPS:", err);
      setLocationError("No se pudo obtener el GPS. Puedes ingresar coordenadas o reintentar.");
      if (!coords) {
        const fallback = { latitude: -34.6037, longitude: -58.3816 };
        setCoords(fallback);
        setManualLat(String(fallback.latitude));
        setManualLon(String(fallback.longitude));
      }
    } finally {
      setLocating(false);
    }
  };

  const handleSelectRadius = (r: number) => {
    setRadius(r);
    setCustomRadiusText(String(r));
  };

  const handleCustomRadiusChange = (text: string) => {
    setCustomRadiusText(text);
    const parsed = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setRadius(parsed);
    }
  };

  const applyManualCoords = () => {
    const lat = parseFloat(manualLat.replace(",", "."));
    const lon = parseFloat(manualLon.replace(",", "."));
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert("Coordenadas inválidas", "Ingresa números válidos para latitud y longitud.");
      return;
    }
    setCoords({ latitude: lat, longitude: lon });
    setLocationError(null);
    Alert.alert("Ubicación actualizada", `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`);
  };

  const openInExternalMaps = () => {
    if (!coords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("No se pudo abrir el mapa externo");
    });
  };

  const getDistanceDescription = (dist: number) => {
    if (dist <= 60) return "Muy cercano (~media cuadra) · Ideal para departamentos o tiendas";
    if (dist <= 110) return "Cercano (~1 cuadra) · Ideal para casas";
    if (dist <= 160) return "Estándar (~1.5 cuadras) · Recomendado para la mayoría";
    if (dist <= 260) return "Amplio (~2 cuadras) · Para oficinas, colegios o gimnasios";
    if (dist <= 360) return "Muy amplio (~3 cuadras) · Para predios o campus";
    return `Extenso (${dist} m) · Para parques o zonas abiertas`;
  };

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Falta el nombre", "Por favor ingresa un nombre para el lugar (ej: Casa, Trabajo).");
      return;
    }
    if (!coords) {
      Alert.alert("Falta la ubicación", "Espera a que se detecte tu ubicación o ingresa las coordenadas.");
      return;
    }

    const validRadius = Math.max(10, radius || DEFAULT_RADIUS);

    setSaving(true);
    try {
      const currentCount = await PlaceRepo.count();
      const canCreate = await SubscriptionService.canCreatePlace(currentCount);
      if (!canCreate) {
        Alert.alert(
          "Límite alcanzado",
          "El plan gratuito permite máximo 2 lugares. Actualiza a SALGO Pro para lugares ilimitados.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Actualizar a Pro", onPress: () => router.push("/upgrade") },
          ]
        );
        setSaving(false);
        return;
      }

      await PlaceRepo.create({
        name: trimmedName,
        icon,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: validRadius,
        enabled: true,
      });

      // Registrar geocercas en segundo plano de manera segura
      try {
        await registerGeofences();
      } catch (geoErr) {
        console.warn("[geofences] Aviso al registrar geocercas:", geoErr);
      }

      Analytics.track("place_created");
      router.back();
    } catch (err: any) {
      console.error("[save] Error al guardar lugar:", err);
      Alert.alert("Error al guardar", err?.message || "Ocurrió un error inesperado al guardar el lugar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Nombre del lugar */}
        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Nombre del lugar</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Casa, Trabajo, Gimnasio..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </Card>

        {/* Icono del lugar */}
        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Icono</Text>
          <View style={styles.iconRow}>
            {PLACE_ICONS.map((i) => (
              <Pressable
                key={i}
                onPress={() => setIcon(i)}
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: i === icon ? colors.accent : colors.surface,
                    borderColor: i === icon ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={styles.iconText}>{i}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Radar Visual del Perímetro de Detección */}
        <Card>
          <View style={styles.radarHeader}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Radar de detección ({radius} m)
            </Text>
            {coords && (
              <Pressable onPress={openInExternalMaps}>
                <Text style={[styles.linkText, { color: colors.accent }]}>🗺️ Ver en Maps</Text>
              </Pressable>
            )}
          </View>

          {/* Visualizador gráfico de radar (SVG) */}
          <View style={[styles.radarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Svg width="100%" height={180} viewBox="0 0 300 180">
              {/* Cuadrícula de fondo */}
              <Line x1="0" y1="90" x2="300" y2="90" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
              <Line x1="150" y1="0" x2="150" y2="180" stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />

              {/* Anillos de referencia */}
              <SvgCircle cx="150" cy="90" r="75" stroke={colors.border} strokeWidth="1" fill="none" opacity={0.6} />
              <SvgCircle cx="150" cy="90" r="45" stroke={colors.border} strokeWidth="1" fill="none" opacity={0.4} />

              {/* Círculo de radio dinámico */}
              <SvgCircle
                cx="150"
                cy="90"
                r={Math.min(78, Math.max(25, (radius / 500) * 75 + 15))}
                fill="rgba(0, 102, 255, 0.15)"
                stroke={colors.accent}
                strokeWidth="2"
              />

              {/* Punto central del lugar */}
              <SvgCircle cx="150" cy="90" r="6" fill={colors.accent} />
            </Svg>

            <View style={styles.radarCenterBadge}>
              <Text style={{ fontSize: 24 }}>{icon}</Text>
            </View>

            <View style={[styles.radarInfoBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.radarInfoText, { color: colors.text }]}>
                Perímetro de salida: <Text style={{ color: colors.accent, fontWeight: "700" }}>{radius} m</Text>
              </Text>
            </View>
          </View>

          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            {getDistanceDescription(radius)}
          </Text>
        </Card>

        {/* Coordenadas GPS */}
        <Card>
          <View style={styles.gpsHeader}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Ubicación GPS</Text>
            {locating && <ActivityIndicator size="small" color={colors.accent} />}
          </View>

          {coords ? (
            <View style={[styles.coordsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.coordsText, { color: colors.text }]}>
                📍 Lat: {coords.latitude.toFixed(5)}  ·  Lon: {coords.longitude.toFixed(5)}
              </Text>
              <Text style={[styles.coordsSub, { color: colors.success }]}>
                ✓ Ubicación fijada correctamente
              </Text>
            </View>
          ) : (
            <View style={[styles.coordsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.coordsText, { color: colors.textSecondary }]}>
                Buscando señal GPS...
              </Text>
            </View>
          )}

          {locationError && (
            <Text style={[styles.errorText, { color: colors.warning }]}>{locationError}</Text>
          )}

          <View style={{ gap: 8, marginTop: 12 }}>
            <Button
              title={locating ? "Obteniendo GPS..." : "📍 Actualizar ubicación actual"}
              onPress={fetchCurrentLocation}
              variant="secondary"
              loading={locating}
            />

            <Pressable
              onPress={() => setShowManualCoords(!showManualCoords)}
              style={styles.toggleManualBtn}
            >
              <Text style={[styles.toggleManualText, { color: colors.accent }]}>
                {showManualCoords ? "Ocultar ajuste manual" : "⚙️ Ajustar coordenadas manualmente"}
              </Text>
            </Pressable>

            {showManualCoords && (
              <View style={[styles.manualBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.manualLabel, { color: colors.textSecondary }]}>Latitud:</Text>
                <TextInput
                  value={manualLat}
                  onChangeText={setManualLat}
                  keyboardType="numeric"
                  placeholder="-34.6037"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                <Text style={[styles.manualLabel, { color: colors.textSecondary, marginTop: 8 }]}>Longitud:</Text>
                <TextInput
                  value={manualLon}
                  onChangeText={setManualLon}
                  keyboardType="numeric"
                  placeholder="-58.3816"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                <View style={{ marginTop: 8 }}>
                  <Button title="Aplicar coordenadas" onPress={applyManualCoords} variant="secondary" />
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Distancia aproximada / Radio */}
        <Card>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Distancia aproximada (Radio del área)
          </Text>

          {/* Botones de distancias predeterminadas */}
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((r) => {
              const isSelected = r === radius;
              return (
                <Pressable
                  key={r}
                  onPress={() => handleSelectRadius(r)}
                  style={[
                    styles.radiusBtn,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSelected ? "#FFFFFF" : colors.text,
                      fontWeight: isSelected ? "700" : "500",
                    }}
                  >
                    {r} m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Entrada de distancia personalizada */}
          <View style={styles.customRadiusRow}>
            <Text style={[styles.customRadiusLabel, { color: colors.textSecondary }]}>
              O ingresa distancia exacta:
            </Text>
            <View style={styles.customInputWrap}>
              <TextInput
                value={customRadiusText}
                onChangeText={handleCustomRadiusChange}
                keyboardType="number-pad"
                placeholder="150"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.customInput,
                  { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                maxLength={4}
              />
              <Text style={[styles.metersUnit, { color: colors.textSecondary }]}>metros</Text>
            </View>
          </View>
        </Card>

        {/* Botón Guardar */}
        <Button title="Guardar lugar" onPress={save} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
  label: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: Radius.md, padding: 14, fontSize: 16 },
  iconRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconText: { fontSize: 22 },
  radarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  linkText: { fontSize: 13, fontWeight: "600" },
  radarContainer: {
    height: 180,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  radarCenterBadge: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  radarInfoBadge: {
    position: "absolute",
    bottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  radarInfoText: { fontSize: 12 },
  hintText: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  gpsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coordsBox: { padding: 12, borderRadius: Radius.md, borderWidth: 1, gap: 4 },
  coordsText: { fontSize: 14, fontWeight: "600" },
  coordsSub: { fontSize: 12, fontWeight: "500" },
  errorText: { fontSize: 13, marginTop: 4 },
  toggleManualBtn: { paddingVertical: 6, alignItems: "center" },
  toggleManualText: { fontSize: 13, fontWeight: "600" },
  manualBox: { padding: 12, borderRadius: Radius.md, borderWidth: 1, marginTop: 4 },
  manualLabel: { fontSize: 12, marginBottom: 4 },
  radiusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  radiusBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  customRadiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  customRadiusLabel: { fontSize: 13 },
  customInputWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  customInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "600",
    width: 80,
    textAlign: "center",
  },
  metersUnit: { fontSize: 14, fontWeight: "500" },
});