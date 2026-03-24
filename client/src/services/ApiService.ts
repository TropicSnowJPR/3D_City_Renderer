import {DefaultOverpassApi, type OverpassJsonOutput} from "overpass-ql-ts";

const toLatLon =  function toLatLon(x: number, y: number): number[] {
  const lat = x / 111_139;
  const lon = y / (111_139 * Math.cos((lat * Math.PI) / 180));
  return [lat, lon];
}

export const toMetricCoords = function toMetricCoords(lat: number, lon: number): number[] {
  if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
    return [0, 0];
  }
  const latInMeters = lat * 111_139;
  const lonInMeters = lon * 111_139 * Math.cos((lat * Math.PI) / 180);
  return [latInMeters, lonInMeters];
}

const getMaxMinCoordsOfArea = function getMaxMinCoordsOfArea(lon: number, lat: number, radius: number, exact = false): string | undefined {
  const center = toMetricCoords(lat, lon);
  if (!center || !center[0] || !center[1]) {
    return;
  }
  const maxX = center[0] + radius;
  const minX = center[0] - radius;
  const maxY = center[1] + radius;
  const minY = center[1] - radius;

  const maxLatLon = toLatLon(maxX, maxY);
  const minLatLon = toLatLon(minX, minY);

  if (!maxLatLon || !minLatLon) {
    return;
  }
  if (exact) {
    return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
  }
  if (!maxLatLon[0] || !maxLatLon[1] || !minLatLon[0] || !minLatLon[1]) {
    return;
  }
  return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
}

export const queryAreaData = async function queryAreaData(lat: number, lng: number, radius: number): Promise<OverpassJsonOutput | string> {
  const boundingBox = getMaxMinCoordsOfArea(
      lng,
      lat,
      radius
  );
  const q = `
            [out:json][timeout:180];
            (
              way(${boundingBox});
              relation(${boundingBox});
            );
            out body geom;
        `;

  // oxlint-disable-next-line new-cap
  return await DefaultOverpassApi().execQuery(q);
}
