import { ConfigService } from "./ConfigService.js";
import { DefaultOverpassApi } from "overpass-ql-ts";


export class ApiService {
  private CCONFIG: ConfigService;
  private CORDS_API_URL: string;
  private CORDS_API_KEY: string;
  constructor() {
    this.CCONFIG = new ConfigService();
    this.CORDS_API_URL = "https://api.opencagedata.com/geocode/v1/json";
    this.CORDS_API_KEY = "cd9a2c21832e44468c189b65928a722d";
  }

  async queryAreaData() {
    const boundingBox = this.getMaxMinCoordsOfArea(
      this.CCONFIG.getConfigValue("longitude"),
      this.CCONFIG.getConfigValue("latitude"),
      Number.parseFloat(String(this.CCONFIG.getConfigValue("radius"))),
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

  getMaxMinCoordsOfArea(
    lon: number,
    lat: number,
    radius: number,
    exact: boolean = false,
  ) {
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

  toLatLon(x: number, y: number) {
    const lat = x / 111_139; // Meters to degrees latitude
    const lon = y / (111_139 * Math.cos((lat * Math.PI) / 180)); // Meters to degrees longitude
    return [lat, lon];
  }

  toMetricCoords(lat: number, lon: number) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
      return null;
    }
    const latInMeters = lat * 111_139; // Latitude meters
    const lonInMeters = lon * 111_139 * Math.cos((lat * Math.PI) / 180); // Longitude meters
    return [latInMeters, lonInMeters];
  }
}
