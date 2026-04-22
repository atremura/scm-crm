/* Geocoding via Nominatim (OpenStreetMap).
   Free, no API key, but rate-limited to ~1 req/sec.
   See https://operations.osmfoundation.org/policies/nominatim/
*/

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

const USER_AGENT = 'JMO-CRM/1.0 (contact: andre.tremura@jmogroup.com)';

/**
 * Geocode a free-form address into lat/lng using Nominatim.
 * Returns null if no result or on network failure.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Bias the search to the US so partial addresses don't match foreign streets.
  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: 'us',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      // Avoid keeping a hung Nominatim connection forever
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: data[0].display_name };
  } catch {
    return null;
  }
}
