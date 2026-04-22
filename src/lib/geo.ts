/* Geo utilities — client-safe (no node imports). */

/** AWG / JMO base location (Boston, MA). */
export const BOSTON = { lat: 42.3601, lng: -71.0589 };

const EARTH_RADIUS_MILES = 3958.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in miles between two coordinates. */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/**
 * Initial bearing in radians from point 1 to point 2.
 * 0 = north, π/2 = east, π = south, -π/2 = west.
 * Useful for SVG projections (sin/cos of the bearing give x/y direction).
 */
export function bearingRad(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

/** Distance + bearing from the Boston hub to a target. */
export function distanceAndBearingFromBoston(lat: number, lng: number): {
  miles: number;
  bearing: number; // radians
} {
  return {
    miles: haversineMiles(BOSTON.lat, BOSTON.lng, lat, lng),
    bearing: bearingRad(BOSTON.lat, BOSTON.lng, lat, lng),
  };
}

/**
 * Project a real lat/lng to SVG coordinates using an azimuthal projection
 * centered on Boston. Works at the same scale as the bid markers
 * (~1.8 px / mile), so state borders line up with bid positions.
 *
 * - Bearing 0 (north) → -y (up).
 * - Bearing π/2 (east) → +x (right).
 */
export function projectFromBoston(
  lat: number,
  lng: number,
  hub: { x: number; y: number },
  pxPerMile = 1.8
): { x: number; y: number } {
  const { miles, bearing } = distanceAndBearingFromBoston(lat, lng);
  return {
    x: hub.x + miles * pxPerMile * Math.sin(bearing),
    y: hub.y - miles * pxPerMile * Math.cos(bearing),
  };
}
