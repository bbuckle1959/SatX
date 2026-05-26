import { useEffect, useState } from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Permission denied or unavailable — keep default globe orientation.
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 600_000,
      },
    );
  }, []);

  return location;
}
