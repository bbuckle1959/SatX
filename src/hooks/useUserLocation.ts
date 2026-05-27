import { useEffect, useState } from 'react';

import { useIsMobileViewport } from './useMediaQuery';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'pending' | 'ready' | 'denied' | 'unsupported';

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>('pending');
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    const onSuccess = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setStatus('ready');
    };

    const onError = () => {
      setStatus('denied');
    };

    const options: PositionOptions = {
      enableHighAccuracy: isMobile,
      timeout: isMobile ? 20_000 : 12_000,
      maximumAge: isMobile ? 60_000 : 600_000,
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

    const watchId = navigator.geolocation.watchPosition(
      onSuccess,
      undefined,
      options,
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isMobile]);

  return { location, status };
}
