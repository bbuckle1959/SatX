import type { UserLocation } from '../hooks/useUserLocation';
import type { GeodeticObserver } from './starlinkPointing';

/** Observer site for dish boresight — device GPS/Wi‑Fi only (never IP geolocation). */
export type DishSite = GeodeticObserver;

/** Dish boresight math uses browser geolocation only (red ground marker). */
export function dishObserverSite(
  userLocation: UserLocation | null,
): DishSite | null {
  if (!userLocation) return null;
  return {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
  };
}
