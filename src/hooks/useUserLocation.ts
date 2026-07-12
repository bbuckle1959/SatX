import { useEffect, useState } from 'react';

/**
 * Reject network / IP-style fixes. Wi‑Fi and GPS are typically well under this;
 * coarse IP geolocation is often tens of km or more.
 */
const MAX_ACCEPTABLE_ACCURACY_M = 5_000;

export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy radius in metres (from Geolocation API). */
  accuracyMeters: number;
}

export type LocationStatus = 'pending' | 'ready' | 'denied' | 'unsupported';

function isPreciseDeviceFix(coords: GeolocationCoordinates): boolean {
  const { accuracy } = coords;
  if (accuracy == null || !Number.isFinite(accuracy)) return false;
  return accuracy <= MAX_ACCEPTABLE_ACCURACY_M;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30_000,
};

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('pending');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      if (!isPreciseDeviceFix(position.coords)) return;

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy!,
      });
      setStatus('ready');
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setStatus('denied');
      }
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_OPTIONS);

    const watchId = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      GEO_OPTIONS,
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return { location, status };
}
