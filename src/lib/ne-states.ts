/* Simplified outlines of New England states (and a slice of NY).
   Each polygon is an array of [lat, lng] pairs forming the boundary.
   Coordinates are approximate (~5–15 km accuracy) — enough to clearly
   show "this bid is in NH, not MA" on the dashboard map.
   Project them via `projectFromBoston` (azimuthal from Boston). */

export type StatePolygon = {
  code: string;
  name: string;
  /** lat/lng pairs (closed ring not required — we'll render with Z) */
  ring: ReadonlyArray<readonly [number, number]>;
  /** label position (lat, lng) for the state name in the map */
  labelAt: readonly [number, number];
};

export const NE_STATES: ReadonlyArray<StatePolygon> = [
  {
    code: 'ME',
    name: 'MAINE',
    ring: [
      [47.46, -69.05],
      [47.36, -68.30],
      [46.71, -68.16],
      [45.93, -67.78],
      [45.18, -67.30],
      [44.92, -66.95],
      [44.36, -68.05],
      [43.94, -69.10],
      [43.85, -69.65],
      [43.27, -70.49],
      [43.08, -70.74],
      [44.05, -70.81],
      [45.30, -71.07],
      [45.30, -70.50],
      [46.20, -70.05],
      [46.70, -69.20],
    ],
    labelAt: [45.4, -69.0],
  },
  {
    code: 'NH',
    name: 'NEW HAMPSHIRE',
    ring: [
      [45.30, -71.55],
      [45.30, -71.07],
      [44.05, -70.81],
      [43.05, -70.71],
      [42.86, -70.82],
      [42.70, -70.93],
      [42.70, -72.55],
      [43.20, -72.45],
      [44.05, -72.10],
      [45.05, -71.62],
    ],
    labelAt: [43.7, -71.6],
  },
  {
    code: 'VT',
    name: 'VERMONT',
    ring: [
      [45.01, -73.36],
      [45.01, -71.50],
      [44.05, -72.10],
      [43.20, -72.45],
      [42.73, -72.55],
      [42.73, -73.27],
      [43.55, -73.27],
      [44.51, -73.43],
    ],
    labelAt: [44.0, -72.7],
  },
  {
    code: 'MA',
    name: 'MASSACHUSETTS',
    ring: [
      [42.74, -73.50],
      [42.74, -72.55],
      [42.70, -71.30],
      [42.86, -70.82],
      [42.43, -70.84],
      [42.04, -70.65],
      [42.07, -70.00],
      [41.65, -70.00],
      [41.55, -69.96],
      [41.42, -70.43],
      [41.55, -70.62],
      [41.55, -71.13],
      [42.02, -71.38],
      [42.02, -71.80],
      [42.04, -73.50],
    ],
    labelAt: [42.30, -72.10],
  },
  {
    code: 'RI',
    name: 'RI',
    ring: [
      [42.02, -71.80],
      [42.02, -71.38],
      [41.55, -71.13],
      [41.30, -71.30],
      [41.34, -71.80],
    ],
    labelAt: [41.65, -71.5],
  },
  {
    code: 'CT',
    name: 'CONNECTICUT',
    ring: [
      [42.05, -73.50],
      [42.05, -71.80],
      [41.42, -71.85],
      [41.32, -72.10],
      [41.05, -72.86],
      [41.05, -73.50],
      [41.10, -73.73],
    ],
    labelAt: [41.6, -72.6],
  },
];
