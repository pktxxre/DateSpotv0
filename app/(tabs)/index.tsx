import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
import { getAllVisits, Visit, ratingColor } from '@/lib/visits';

const SF_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [tooltip, setTooltip] = useState<Visit | null>(null);
  const mapRef = useRef<MapView>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      setTooltip(null);
    }, [])
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SF_REGION}
        mapType="standard"
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={() => setTooltip(null)}
      >
        {visits.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            onPress={() => setTooltip(v)}
          >
            <View style={[styles.pin, { backgroundColor: ratingColor(v.rating) }]} />
          </Marker>
        ))}
      </MapView>

      {tooltip && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipName} numberOfLines={1}>
            {tooltip.venue_name}
          </Text>
          <View style={[styles.ratingBadge, { backgroundColor: ratingColor(tooltip.rating) }]}>
            <Text style={styles.ratingText}>
              {tooltip.rating === 3 ? 'Great' : tooltip.rating === 2 ? 'OK' : 'Bad'}
            </Text>
          </View>
        </View>
      )}

      {visits.length === 0 && (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={styles.emptyText}>Log your first date spot to see it on the map</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tooltip: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    maxWidth: 280,
  },
  tooltipName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    flex: 1,
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
});
