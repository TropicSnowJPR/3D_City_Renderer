import { DefaultOverpassApi, type OverpassJsonOutput } from "overpass-ql-ts";

// Minimal interface for any Overpass API implementation used by queryAreaData
interface OverpassApiLike {
  execQuery: (query: string) => Promise<OverpassJsonOutput | string>;
}


/**
 * Converts a distance in meters to a change in latitude and longitude degrees at a given latitude.
 * @param dx - The distance in meters to convert to a change in latitude degrees
 * @param dy - The distance in meters to convert to a change in longitude degrees
 * @param lat - The latitude at which to calculate the conversion, as the length of a degree of longitude varies with latitude
 * @returns An array containing the change in latitude and longitude degrees corresponding to the given distances in meters at the specified latitude.
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
 * Converts a change in latitude and longitude degrees to a distance in meters at a given latitude.
 * @param latitude - The change in latitude degrees to convert to a distance in meters
 * @param longitude - The change in longitude degrees to convert to a distance in meters
 * @param currentLatitude - The latitude at which to calculate the conversion, as the length of a degree of longitude varies with latitude
 * @returns An array containing the distance in meters corresponding to the given changes in latitude and longitude degrees at the specified latitude.
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
 * Calculates the minimum and maximum latitude and longitude coordinates that define a bounding box around a central point, given a radius in meters.
 * @param latitude - The latitude of the central point around which to calculate the bounding box
 * @param longitude - The longitude of the central point around which to calculate the bounding box
 * @param radius - The radius in meters that defines the size of the bounding box around the central point
 * @param exact - A boolean flag that determines whether to return the coordinates with full precision (if true) or rounded to 7 decimal places (if false). The default value is false.
 * @returns A string containing the minimum and maximum latitude and longitude coordinates of the bounding box in the format "minLat,minLon,maxLat,maxLon", or undefined if the input parameters are invalid or if the coordinate calculations fail.
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
 * Queries an Overpass API for map data within a specified area defined by a central latitude and longitude and a radius in meters.
 * @param lat - The latitude of the central point around which to query for map data
 * @param lon - The longitude of the central point around which to query for map data
 * @param radius - The radius in meters that defines the size of the area around the central point to query for map data
 * @param api - An optional parameter that allows specifying a custom Overpass API implementation to use for executing the query. If not provided, a default implementation is used.
 * @returns A promise that resolves to the JSON output from the Overpass API query, or a string if the query fails. The JSON output contains the map data for the specified area, including nodes, ways, and relations with their geometries.
 * @throws Error - An error if the bounding box calculation fails, which can occur if the input parameters are invalid or if the coordinate calculations fail.
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
