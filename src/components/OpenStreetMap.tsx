import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { Radius } from "@/constants/theme";

interface OpenStreetMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  onLocationSelect?: (coords: { latitude: number; longitude: number }) => void;
  style?: any;
}

export function OpenStreetMap({
  latitude,
  longitude,
  radius,
  onLocationSelect,
  style,
}: OpenStreetMapProps) {
  const webViewRef = useRef<WebView>(null);

  // Generamos el HTML con Leaflet y los tiles oficiales de OpenStreetMap
  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0A0F1E; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.7) !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${latitude}, ${longitude}], 16);

    // Tiles oficiales y 100% abiertos de OpenStreetMap
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var marker = L.marker([${latitude}, ${longitude}]).addTo(map);

    var circle = L.circle([${latitude}, ${longitude}], {
      color: '#0066FF',
      fillColor: '#0066FF',
      fillOpacity: 0.22,
      weight: 2,
      radius: ${radius}
    }).addTo(map);

    // Permitir al usuario tocar en el mapa abierto para reubicar el punto
    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
      }
    });

    // Función llamada desde React Native para actualizar dinámicamente sin recargar
    window.updatePositionAndRadius = function(lat, lng, rad) {
      if (map && marker && circle) {
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        circle.setRadius(rad);
        map.panTo([lat, lng]);
      }
    };
  </script>
</body>
</html>
`;

  // Actualizar Leaflet cuando cambien las coordenadas o el radio
  useEffect(() => {
    if (webViewRef.current) {
      const script = `if (window.updatePositionAndRadius) { window.updatePositionAndRadius(${latitude}, ${longitude}, ${radius}); } true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [latitude, longitude, radius]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && typeof data.latitude === "number" && typeof data.longitude === "number") {
        if (onLocationSelect) {
          onLocationSelect({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch (e) {
      console.warn("[OpenStreetMap] Error al recibir mensaje:", e);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: leafletHtml }}
        onMessage={handleMessage}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0066FF" />
            <Text style={styles.loadingText}>Cargando OpenStreetMap...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    width: "100%",
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.2)",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0A0F1E",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0F1E",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#9AA3B2",
  },
});
