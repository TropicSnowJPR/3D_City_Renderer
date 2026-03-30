import { DefaultOverpassApi, type OverpassJsonOutput } from "overpass-ql-ts";

// Minimal interface for any Overpass API implementation used by queryAreaData
interface OverpassApiLike {
  execQuery: (query: string) => Promise<OverpassJsonOutput | string>;
}


/**
 *
 * @param dx
 * @param dy
 * @param lat
 */
export const metersToLatLon = function metersToLatLon(
    dx: number,
    dy: number,
    lat: number
): number[] {

  const latRad = lat * Math.PI / 180;

  const metersPerDegLat =
      111_132.92 -
      559.82 * Math.cos(2 * latRad) +
      1.175 * Math.cos(4 * latRad) -
      0.0023 * Math.cos(6 * latRad);

  const metersPerDegLon =
      111_412.84 * Math.cos(latRad) -
      93.5 * Math.cos(3 * latRad) +
      0.118 * Math.cos(5 * latRad);

  const dLat = dx / metersPerDegLat;
  const dLon = dy / metersPerDegLon;

  if (Number.isNaN(dLat) || Number.isNaN(dLon)) {
    return [0, 0]
  }

  return [dLat, dLon];
}


/**
 *
 * @param latitude
 * @param longitude
 * @param currentLatitude
 */
export const latLonToMeters = function latLonToMeters (
    latitude: number,
    longitude: number,
    currentLatitude: number
): number[] {

  if (
      latitude === undefined ||
      longitude === undefined ||
      currentLatitude === undefined ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      Number.isNaN(currentLatitude)
  ) {
    return [0, 0];
  }

  const latRad = currentLatitude * Math.PI / 180;

  const metersPerDegLat =
      111_132.92 -
      559.82 * Math.cos(2 * latRad) +
      1.175 * Math.cos(4 * latRad) -
      0.0023 * Math.cos(6 * latRad);

  const metersPerDegLon =
      111_412.84 * Math.cos(latRad) -
      93.5 * Math.cos(3 * latRad) +
      0.118 * Math.cos(5 * latRad);

  const dx = latitude * metersPerDegLat;
  const dy = longitude * metersPerDegLon;

  if (Number.isNaN(dx) || Number.isNaN(dy)) {
    return [0, 0];
  }

  return [dx, dy];
};


/**
 *
 * @param latitude
 * @param longitude
 * @param radius
 * @param exact
 */
export const getMaxMinCoordsOfArea = function getMaxMinCoordsOfArea(
    latitude: number,
    longitude: number,
    radius: number,
    exact = false
): string | undefined {

  if (
      latitude === undefined ||
      longitude === undefined ||
      radius === undefined ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      Number.isNaN(radius)
  ) {
    return;
  }

  const center = latLonToMeters(latitude, longitude, latitude);

  if (!center || !center[0] || !center[1]) {
    return;
  }

  const maxX = center[0] + radius;
  const minX = center[0] - radius;
  const maxY = center[1] + radius;
  const minY = center[1] - radius;

  const maxLatLon = metersToLatLon(maxX, maxY, latitude);
  const minLatLon = metersToLatLon(minX, minY, latitude);

  if (!maxLatLon || !minLatLon || !maxLatLon[0] || !minLatLon[0] || !maxLatLon[1] || !minLatLon[1]) {
    return;
  }

  if (exact) {
    return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
  }

  return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
};


/**
 *
 * @param lat
 * @param lon
 * @param radius
 * @param api
 */
export const queryAreaData = async function  queryAreaData(
    lat: number,
    lon: number,
    radius: number,
    api: OverpassApiLike = DefaultOverpassApi()
): Promise<OverpassJsonOutput | string> {

  const boundingBox = getMaxMinCoordsOfArea(lat, lon, radius);

  if (!boundingBox) {
    throw new Error("Bounding box calculation failed");
  }

  const q = `
    [out:json][timeout:180];
    (
      way(${boundingBox});
      relation(${boundingBox});
    );
    out body geom;
  `;

  return await api.execQuery(q);
};
