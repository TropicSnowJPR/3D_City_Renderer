import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import {ConfigService} from "../services/ConfigService.js";

export class MapController {
    REUSED_DATA: string;
    private CCONFIG: ConfigService;
    GEOJSON: { radius: number; latlng: any; };
    private MAP: L.Map
    private MARKER_OVERLAY: null;
    private REMOVE_LOCK: boolean;
    constructor() {
        this.CCONFIG = new ConfigService();
        this.GEOJSON = { radius: 0, latlng: null }
        this.MAP = L.map('map')
        this.REUSED_DATA = ""
        this.MARKER_OVERLAY = null
        this.REMOVE_LOCK = false;
    }

    async onStart() {
        this.MAP.setView([50.97871971335171, 11.030949354171755], 18);

        // @ts-ignore
        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', { // @ts-ignore
            maxZoom: 19, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', ext: 'png'
        }).addTo(this.MAP);

        if (this.MAP.pm) {
            this.MAP.pm.addControls({
                position: 'topleft',
                removalMode: true,
                drawCircle: true,
                drawCircleMarker: false,
                drawText: false,
                rotateMode: false,
                dragMode: false,
                drawFreehand: false,
                drawPolygon: false,
                drawPolyline: false,
                drawRectangle: false,
                cutPolygon: false,
                editMode: false,
                drawMarker: false
            });

            const response = await fetch("http://localhost:3000/api/object/index/")
            const objectJson = await response.json()

            for (const [id] of Object.entries(objectJson.objects)) {
                const res = await fetch("http://localhost:3000/api/object/" + id + "/geo");
                const data = await res.json(); // @ts-ignore
                const circle = L.circle([data.latlng.lat, data.latlng.lng], {
                    color: '#FFA31B',
                    fillColor: '#FAA31B',
                    fillOpacity: 0.3,
                    radius: data.radius,
                    id: id
                }).addTo(this.MAP);
                circle.bindPopup("Press ENTER to select [" + id + "] or Press R to rename.").on("click", async (event: any) => {
                    this.onPopUp(event, id)
                });
            }

            const response_points = await fetch("http://localhost:3000/api/point/index/")
            const pointJson = await response_points.json()

            const MarkerOverlay = [];

            for (const [id] of Object.entries(pointJson.objects)) {
                const res = await fetch("http://localhost:3000/api/point/" + id + "/geo");
                const data = await res.json();
                // @ts-ignore
                const marker = L.marker([data.lat, data.lng], { id: id }).addTo(this.MAP)
                marker.bindPopup(data.name);
                MarkerOverlay.push(marker)
            }
            // @ts-ignore
            this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
            // @ts-ignore
            this.MAP.addLayer(this.MARKER_OVERLAY);

            this.MAP.on("popupclose", () => {
                this.MAP.off("keypress")
            });

            this.MAP.on("pm:remove", async (event: any) => {
                this.REMOVE_LOCK = true
                if (event.shape === "Circle") {
                    const res = await fetch("http://localhost:3000/api/object/" + event.layer.options.id + "/delete");
                    this.MAP.removeLayer(event.target)
                } else if (event.shape === "Marker") {
                    const res = await fetch("http://localhost:3000/api/point/" + event.layer.options.id + "/delete");
                }
                this.REMOVE_LOCK = false
            })

            this.MAP.on('pm:create', async (event: any) => {
                const data = event.layer;
                if (data._mRadius && data._latlng) {
                    this.GEOJSON = {
                        radius: (data._mRadius).toFixed(2), latlng: data._latlng
                    };
                }

                if (event.shape === "Circle") {

                    this.CCONFIG.setConfigValue("radius", (data._mRadius).toFixed(2))
                    this.CCONFIG.setConfigValue("latitude", data._latlng.lat)
                    this.CCONFIG.setConfigValue("longitude", data._latlng.lng)

                    const el = document.getElementById("map")
                    if (el) {
                        el.remove();
                    }
                    // @ts-ignore
                    this.MAP = null
                } else if (event.shape === "Text") {
                    try {
                        this.MAP.once('click', async (event_2: any) => {
                            const geoJson = {
                                type: "Point",
                                lat: event_2.latlng.lat,
                                lng: event_2.latlng.lng,
                                name: event.layer.options.text
                            }
                            fetch("http://localhost:3000/api/point/", {
                                method: "POST", headers: {
                                    "Content-Type": "application/json"
                                }, body: JSON.stringify({
                                    type: "Point", GEOJSON: geoJson
                                })
                            }).then(res => res.json()).then(data => {
                            });

                            await this.sleep(500);
                            const response_points = await fetch("http://localhost:3000/api/point/index/")
                            const pointJson = await response_points.json()

                            this.MAP.removeLayer(event.layer)
                            // @ts-ignore
                            this.MAP.removeLayer(this.MARKER_OVERLAY);
                            const MarkerOverlay = [];

                            for (const [id] of Object.entries(pointJson.objects)) {
                                const res = await fetch("http://localhost:3000/api/point/" + id + "/geo");
                                const data = await res.json();
                                // @ts-ignore
                                const marker = L.marker([data.lat, data.lng], { id: id }).addTo(this.MAP)
                                marker.bindPopup(data.name);
                                MarkerOverlay.push(marker)
                            }
                            // @ts-ignore
                            this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
                            // @ts-ignore
                            this.MAP.addLayer(this.MARKER_OVERLAY);
                        })
                    } catch (e) {
                        console.warn(e);
                    }
                }
            });
        }

        this.MAP.on('contextmenu', this.contextMenuDisabled);
    }

    contextMenuDisabled(e: L.LeafletMouseEvent) {
        e.originalEvent.preventDefault();
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private haversine(a: number[], b: number[]) {
        if (a.length !== 2 || b.length !== 2) {
            throw new Error("Invalid input: expected two coordinate pairs");
        }
        if (a[0] === undefined || a[1] === undefined || b[0] === undefined || b[1] === undefined) {
            throw new Error("Invalid input: coordinates must be defined");
        }
        const R = 6371000; // meters
        const toRad = (d: number) => d * Math.PI / 180;

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

    onPopUp(event: any, id: any = undefined) {
        if (id === undefined) {
            event.target.o
        }
        this.MAP.on("keypress", async (e: any) => {
            if (e.originalEvent.key === "Enter") {
                const data = event.target;
                this.GEOJSON = {
                    radius: (data._mRadius), latlng: data._latlng
                };

                this.CCONFIG.setConfigValue("radius", data._mRadius)
                this.CCONFIG.setConfigValue("latitude", data._latlng.lat)
                this.CCONFIG.setConfigValue("longitude", data._latlng.lng)

                this.REUSED_DATA = await fetch("http://localhost:3000/api/object/" + id + "/data").then(res => res.json());

                const el = document.getElementById("map")
                if (el) {
                    el.remove();
                }

                // @ts-ignore
                this.MAP = null
            } else if (e.originalEvent.key === "r") {
                const overlay = document.getElementById("input-overlay");
                const input = document.getElementById("name-input");
                const button = document.getElementById("button-input");

                if (!input || !button || !overlay) {
                    console.warn("Input elements not found");
                    return;
                }
                if (overlay) {
                    overlay.style.display = "block";
                }
                if (input) {
                    // @ts-ignore
                    input.value = "";
                    input.focus();
                }

                // @ts-ignore
                if (button._renameHandler) button.removeEventListener("click", button._renameHandler);
                // @ts-ignore
                if (input._keyHandler) input.removeEventListener("keydown", input._keyHandler);

                const renameHandler = async () => {
                    // @ts-ignore
                    const newId = input.value.trim();
                    if (!newId) return;
                    const circle = event.target;
                    console.log(circle.options.id);
                    const id = circle.options.id;

                    try {
                        const res = await fetch(`http://localhost:3000/api/object/${encodeURIComponent(id)}/rename?newid=${encodeURIComponent(newId)}`, {
                            method: "POST"
                        });
                        if (!res.ok) {
                            console.log(res.ok)
                            console.log(res)
                            overlay.style.display = "none";
                            const errText = await res.text();
                            console.warn("Rename failed:", res.status, errText);
                            return;
                        }
                    } catch (err) {
                        console.warn(err);
                        return;
                    }

                    // update client-side circle metadata and popup
                    circle.options.id = newId;
                    circle.bindPopup("Press ENTER to select [" + newId + "] or Press R to rename.").on("click", async (event: any) => {
                        this.onPopUp(event)
                    });

                    overlay.style.display = "none";
                };

                // @ts-ignore
                button._renameHandler = renameHandler;
                button.addEventListener("click", renameHandler);

                const keyHandler = (ke: { key: string; }) => {
                    if (ke.key === "Enter") renameHandler();
                    if (ke.key === "Escape") overlay.style.display = "none";
                };

                // @ts-ignore
                input._keyHandler = keyHandler;
                input.addEventListener("keydown", keyHandler);
            }
        });
    }

    mapActive() {
        return this.MAP !== null;
    }

    getGeoJSON() {
        return this.GEOJSON;
    }
}