import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

export class MapController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.GEOJSON = null
        this.MAP = null
        this.REUSED_DATA = null
    }

    async onStart() {
        this.MAP = L.map('map').setView([50.952314129741964, 11.088986462334187], 19);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.MAP);


        if (this.MAP.pm) {
            this.MAP.pm.addControls({
                position: 'topleft', drawCircleMarker: false, rotateMode: false, dragMode: false, drawFreehand: false, drawPolygon: false, drawPolyline: false, drawRectangle: false, cutPolygon: false, removalMode: false, editMode: false
            });

            const response = await fetch("http://localhost:3000/api/object/index/")
            const objectJson = await response.json()

            for (const [id, meta] of Object.entries(objectJson.objects)) {
                const res = await fetch("http://localhost:3000/api/object/" + id + "/geo");
                const data = await res.json();
                const circle = L.circle([data.latlng.lat, data.latlng.lng], {
                    color: '#a9ff7c',
                    fillColor: '#85ff54',
                    fillOpacity: 0.3,
                    radius: data.radius,
                    id: id
                }).addTo(this.MAP);
                circle.bindPopup(id).on("click", async (event) => {
                    const data = event.target;
                    this.GEOJSON = {
                        radius: (data._mRadius), latlng: data._latlng
                    };

                    this.CCONFIG.setConfigValue("radius", data._mRadius)
                    this.CCONFIG.setConfigValue("latitude", data._latlng.lat)
                    this.CCONFIG.setConfigValue("longitude", data._latlng.lng)

                    this.REUSED_DATA = await fetch("http://localhost:3000/api/object/" + id + "/data").then(res => res.json());

                    document.getElementById("map").remove();

                    this.MAP = null
                });
            }
        }


        this.MAP.on('pm:remove', async (event) => {
            const layer = event.layer;
            const geo = layer.toGeoJSON();

            if (geo.geometry.type === "Polygon") {
                try {
                    await fetch("http://localhost:3000/api/object/" + geo.id + "/delete");
                } catch (e) {
                    console.error(e);
                }
            } else if (geo.geometry.type === "Point") {
                try {
                    await fetch("http://localhost:3000/api/point/" + geo.id + "/delete");
                } catch (e) {
                    console.error(e);
                }
            }
        })

        this.MAP.on('pm:create', async (event) => {
            console.log(event)
            const data = event.layer;
            this.GEOJSON = {
                radius: (data._mRadius).toFixed(2), latlng: data._latlng
            };

            if (event.shape === "Circle") {

                this.CCONFIG.setConfigValue("radius", (data._mRadius).toFixed(2))
                this.CCONFIG.setConfigValue("latitude", data._latlng.lat)
                this.CCONFIG.setConfigValue("longitude", data._latlng.lng)

                document.getElementById("map").remove();

                this.MAP = null
            } else {}
        });
    }

    haversine(a, b) {
        const R = 6371000; // meters
        const toRad = d => d * Math.PI / 180;

        const dLat = toRad(b[1] - a[1]);
        const dLon = toRad(b[0] - a[0]);

        const lat1 = toRad(a[1]);
        const lat2 = toRad(b[1]);

        const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(h));
    }

    mapActive() {
        return this.MAP !== null;
    }

    getGeoJSON() {
        return this.GEOJSON;
    }
}