import * as MOD from "overpass-ql-ts";

export class APIController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.API = null
        this.CORDS_API_URL = "https://api.opencagedata.com/geocode/v1/json";
        this.CORDS_API_KEY = "cd9a2c21832e44468c189b65928a722d"; // Example API key (PS: you can create one for free)
    }

    async queryCoordinates(city) {
        const url = `${this.CORDS_API_URL}?q=${encodeURIComponent(city)}&key=${this.CORDS_API_KEY}&limit=1`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Netzwerkfehler");
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const {lat, lng} = data.results[0].geometry;
                this.CCONFIG.setConfigValue("latitude", lat);
                this.CCONFIG.setConfigValue("longitude", lng);
                this.CCONFIG.setConfigValue("location", city);
                console.log(`Koordinaten für ${city} gefunden: (${lat}, ${lng})`);
            } else {
                throw new Error("Keine Ergebnisse gefunden");
            }
        } catch (err) {
            console.error("Fehler:", err.message);
            return null;
        }
    }

    async queryAreaData() {
        this.API = new MOD.DefaultOverpassApi();
        const boundingBox = this.getMaxMinCoordsOfArea(
            this.CCONFIG.getConfigValue("longitude"),
            this.CCONFIG.getConfigValue("latitude"),
            parseFloat(this.CCONFIG.getConfigValue("radius"))
        );
        const q = `
            [out:json][timeout:180];
            (
              way(${boundingBox});
            );
            out body geom;
        `;
        return await this.API.execQuery(q);
    }

    getMaxMinCoordsOfArea(lon, lat, radius, exact = false) {
        const center = this.toMetricCoords(lat, lon);
        const maxX = center[0] + radius;
        const minX = center[0] - radius;
        const maxY = center[1] + radius;
        const minY = center[1] - radius;

        const maxLatLon = this.toLatLon(maxX, maxY);
        const minLatLon = this.toLatLon(minX, minY);

        if (exact) {
            return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
        }
        return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
    }

    toLatLon(x, y) {
        const lat = x / 111_139; // meters to degrees latitude
        const lon = y / (111_139 * Math.cos(lat * Math.PI / 180)); // meters to degrees longitude
        return [lat, lon];
    }

    toMetricCoords(lat, lon) {
        if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
            return null;
        }
        const latInMeters = lat * 111_139; // latitude meters
        const lonInMeters = lon * 111_139 * Math.cos(lat * Math.PI / 180); // longitude meters
        return [latInMeters, lonInMeters];
    }
}