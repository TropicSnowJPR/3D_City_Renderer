import type { OverpassJsonOutput} from "overpass-ql-ts";
import {DefaultOverpassApi} from "overpass-ql-ts";

export class ApiService {
  private readonly CORDS_API_URL: string = "https://api.opencagedata.com/geocode/v1/json";
  private readonly CORDS_API_KEY: string = 'cd9a2c21832e44468c189b65928a722d';

  async queryAreaData(lat: number, lng: number, radius: number): Promise<OverpassJsonOutput | string> {
    const boundingBox = this.getMaxMinCoordsOfArea(
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

  getMaxMinCoordsOfArea(lon: number, lat: number, radius: number, exact = false): string | undefined {
    const center = this.toMetricCoords(lat, lon);
    if (!center || !center[0] || !center[1]) {
      return;
    }
    const maxX = center[0] + radius;
    const minX = center[0] - radius;
    const maxY = center[1] + radius;
    const minY = center[1] - radius;

    const maxLatLon = this.toLatLon(maxX, maxY);
    const minLatLon = this.toLatLon(minX, minY);

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

  toLatLon(x: number, y: number): number[] {
    const lat = x / 111_139;
    const lon = y / (111_139 * Math.cos((lat * Math.PI) / 180));
    return [lat, lon];
  }

  toMetricCoords(lat: number, lon: number): number[] {
    if (lat === undefined || lon === undefined || Number.isNaN(lat) || Number.isNaN(lon)) {
      return [0, 0];
    }
    const latInMeters = lat * 111_139;
    const lonInMeters = lon * 111_139 * Math.cos((lat * Math.PI) / 180);
    return [latInMeters, lonInMeters];
  }
}
