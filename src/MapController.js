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
        this.MARKER_OVERLAY = null
    }

    async onStart() {
        this.MAP = L.map('map').setView([50.97871971335171, 11.030949354171755], 18);

        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
            maxZoom: 19, attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', ext: 'png'
        }).addTo(this.MAP);

        if (this.MAP.pm) {
            this.MAP.pm.addControls({
                position: 'topleft',
                //removalMode: false,
                drawCircleMarker: false,
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
                const data = await res.json();
                const circle = L.circle([data.latlng.lat, data.latlng.lng], {
                    color: '#a9ff7c',
                    fillColor: '#85ff54',
                    fillOpacity: 0.3,
                    radius: data.radius,
                    id: id
                }).addTo(this.MAP);
                circle.bindPopup("Press ENTER to select " + id).on("click", async (event) => {
                    this.MAP.on("keypress", async (e) => {
                        if (e.originalEvent.key === "Enter") {
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
                        }
                    });
                });
            }

            const response_points = await fetch("http://localhost:3000/api/point/index/")
            const pointJson = await response_points.json()

            const MarkerOverlay = [];

            for (const [id] of Object.entries(pointJson.objects)) {
                const res = await fetch("http://localhost:3000/api/point/" + id + "/geo");
                const data = await res.json();
                const marker = L.marker([data.lat, data.lng], { id: id }).addTo(this.MAP)
                marker.bindPopup(data.name);
                MarkerOverlay.push(marker)
            }
            this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
            this.MAP.addLayer(this.MARKER_OVERLAY);
        }

        async function removeElementHandler(event) {
            console.log(event)
            this.REMOVE_LOCK = true
            if (event.shape === "Circle") {
                const res = await fetch("http://localhost:3000/api/object/" + event.layer.options.id + "/delete");
                this.MAP.removeLayer(event.target)
            } else if (event.shape === "Marker") {
                const res = await fetch("http://localhost:3000/api/point/" + event.layer.options.id + "/delete");
            }
            this.REMOVE_LOCK = false
        }

        this.MAP.on("popupclose", (event) => {
            this.MAP.off("keypress")
        })

        this.MAP.on("pm:remove", removeElementHandler)
        // this.MAP.on("pm:create", createElementHandler)

        // this.MAP.on("pm:cut", (event) => {console.log("CUT Event: ", event)})
        // this.MAP.on("pm:split", (event) => {console.log("SPLIT Event: ", event)})
        // this.MAP.on("pm:rotateenable", (event) => {console.log("ROTATE ENABLE Event: ", event)})
        // this.MAP.on("pm:rotatedisable ", (event) => {console.log("ROTATE DISABLE Event: ", event)})
        // this.MAP.on("pm:scalestart", (event) => {console.log("SCALE START Event: ", event)})
        // this.MAP.on("pm:scale", (event) => {console.log("SCALE Event: ", event)})
        // this.MAP.on("pm:scaleend", (event) => {console.log("SCALE END Event: ", event)})
        // this.MAP.on('pm:snapdrag', (e) => { console.log('pm:snapdrag', e); });
        // this.MAP.on('pm:snap', (e) => { console.log('pm:snap', e); });
        // this.MAP.on('pm:unsnap', (e) => { console.log('pm:unsnap', e); });
        // this.MAP.on('pm:centerplaced', (e) => { console.log('pm:centerplaced', e); });
        //
        // this.MAP.on('pm:edit', (e) => { console.log('pm:edit', e); });
        // this.MAP.on('pm:update', (e) => { console.log('pm:update', e); });
        // this.MAP.on('pm:enable', (e) => { console.log('pm:enable', e); });
        // this.MAP.on('pm:disable', (e) => { console.log('pm:disable', e); });
        // this.MAP.on('pm:vertexadded', (e) => { console.log('pm:vertexadded', e); });
        // this.MAP.on('pm:vertexremoved', (e) => { console.log('pm:vertexremoved', e); });
        // this.MAP.on('pm:vertexclick', (e) => { console.log('pm:vertexclick', e); });
        // this.MAP.on('pm:markerdragstart', (e) => { console.log('pm:markerdragstart', e); });
        // this.MAP.on('pm:markerdrag', (e) => { console.log('pm:markerdrag', e); });
        // this.MAP.on('pm:markerdragend', (e) => { console.log('pm:markerdragend', e); });
        // this.MAP.on('pm:layerreset', (e) => { console.log('pm:layerreset', e); });
        // this.MAP.on('pm:intersect', (e) => { console.log('pm:intersect', e); });
        // this.MAP.on('pm:change', (e) => { console.log('pm:change', e); });
        // this.MAP.on('pm:textchange', (e) => { console.log('pm:textchange', e); });
        // this.MAP.on('pm:textfocus', (e) => { console.log('pm:textfocus', e); });
        // this.MAP.on('pm:textblur', (e) => { console.log('pm:textblur', e); });
        // this.MAP.on('pm:containmentviolation', (e) => { console.log('pm:containmentviolation', e); });
        // this.MAP.on('pm:intersectionviolation', (e) => { console.log('pm:intersectionviolation', e); });
        // this.MAP.on('pm:cancel', (e) => { console.log('pm:cancel', e); });
        // this.MAP.on('pm:undoremove', (e) => { console.log('pm:undoremove', e); });
        //
        // this.MAP.on('pm:globaldrawmodetoggled', (e) => { console.log('pm:globaldrawmodetoggled', e); });
        // this.MAP.on('pm:drawstart', (e) => { console.log('pm:drawstart', e); });
        // this.MAP.on('pm:drawend', (e) => { console.log('pm:drawend', e); });
        // // pm:create already handled below; still safe to listen again
        // this.MAP.on('pm:create', (e) => { console.log('pm:create (extra listener)', e); });
        // this.MAP.on('pm:vertexadded', (e) => { console.log('pm:vertexadded (draw)', e); });
        //
        // this.MAP.on('pm:globaleditmodetoggled', (e) => { console.log('pm:globaleditmodetoggled', e); });
        // this.MAP.on('pm:globaldragmodetoggled', (e) => { console.log('pm:globaldragmodetoggled', e); });
        // this.MAP.on('pm:globalremovalmodetoggled', (e) => { console.log('pm:globalremovalmodetoggled', e); });
        // this.MAP.on('pm:globalcutmodetoggled', (e) => { console.log('pm:globalcutmodetoggled', e); });
        // this.MAP.on('pm:globalrotatemodetoggled', (e) => { console.log('pm:globalrotatemodetoggled', e); });
        // this.MAP.on('pm:globalunionmodetoggled', (e) => { console.log('pm:globalunionmodetoggled', e); });
        // this.MAP.on('pm:globaldifferencemodetoggled', (e) => { console.log('pm:globaldifferencemodetoggled', e); });
        // this.MAP.on('pm:globalbringtobackmodetoggled', (e) => { console.log('pm:globalbringtobackmodetoggled', e); });
        // this.MAP.on('pm:globalbringtofrontmodetoggled', (e) => { console.log('pm:globalbringtofrontmodetoggled', e); });
        // this.MAP.on('pm:globalcopylayermodetoggled', (e) => { console.log('pm:globalcopylayermodetoggled', e); });
        // this.MAP.on('pm:globallinesimplificationmodetoggled', (e) => { console.log('pm:globallinesimplificationmodetoggled', e); });
        // this.MAP.on('pm:globallassomodetoggled', (e) => { console.log('pm:globallassomodetoggled', e); });
        // this.MAP.on('pm:globalsplitmodetoggled', (e) => { console.log('pm:globalsplitmodetoggled', e); });
        // this.MAP.on('pm:globalscalemodetoggled', (e) => { console.log('pm:globalscalemodetoggled', e); });
        // this.MAP.on('pm:globalcancel', (e) => { console.log('pm:globalcancel', e); });
        //
        // this.MAP.on('pm:dragstart', (e) => { console.log('pm:dragstart', e); });
        // this.MAP.on('pm:drag', (e) => { console.log('pm:drag', e); });
        // this.MAP.on('pm:dragend', (e) => { console.log('pm:dragend', e); });
        // this.MAP.on('pm:dragenable', (e) => { console.log('pm:dragenable', e); });
        // this.MAP.on('pm:dragdisable', (e) => { console.log('pm:dragdisable', e); });
        //
        // this.MAP.on('pm:union', (e) => { console.log('pm:union', e); });
        // this.MAP.on('pm:difference', (e) => { console.log('pm:difference', e); });
        // this.MAP.on('pm:copylayer', (e) => { console.log('pm:copylayer', e); });
        //
        // this.MAP.on('pm:selectionadd', (e) => { console.log('pm:selectionadd', e); });
        // this.MAP.on('pm:selectionremove', (e) => { console.log('pm:selectionremove', e); });
        // this.MAP.on('pm:lasso-select', (e) => { console.log('pm:lasso-select', e); });
        //
        // this.MAP.on('pm:langchange', (e) => { console.log('pm:langchange', e); });
        // this.MAP.on('pm:buttonclick', (e) => { console.log('pm:buttonclick', e); });
        // this.MAP.on('pm:actionclick', (e) => { console.log('pm:actionclick', e); });
        // this.MAP.on('baselayerchange', (e) => { console.log('baselayerchange', e); });
        // this.MAP.on('overlayadd', (e) => { console.log('overlayadd', e); });
        // this.MAP.on('overlayremove', (e) => { console.log('overlayremove', e); });
        // this.MAP.on('layeradd', (e) => { console.log('layeradd', e); });
        // this.MAP.on('layerremove', (e) => { console.log('layerremove', e); });
        //
        // this.MAP.on('zoomlevelschange', (e) => { console.log('zoomlevelschange', e); });
        // this.MAP.on('resize', (e) => { console.log('resize', e); });
        // this.MAP.on('unload', (e) => { console.log('unload', e); });
        // this.MAP.on('viewreset', (e) => { console.log('viewreset', e); });
        // this.MAP.on('load', (e) => { console.log('load', e); });
        // this.MAP.on('zoomstart', (e) => { console.log('zoomstart', e); });
        // this.MAP.on('movestart', (e) => { console.log('movestart', e); });
        // this.MAP.on('zoom', (e) => { console.log('zoom', e); });
        // // this.MAP.on('move', (e) => { console.log('move', e); });
        // this.MAP.on('zoomend', (e) => { console.log('zoomend', e); });
        // this.MAP.on('moveend', (e) => { console.log('moveend', e); });
        //
        // this.MAP.on('popupopen', (e) => { console.log('popupopen', e); });
        // this.MAP.on('popupclose', (e) => { console.log('popupclose', e); });
        // this.MAP.on('autopanstart', (e) => { console.log('autopanstart', e); });
        //
        // this.MAP.on('tooltipopen', (e) => { console.log('tooltipopen', e); });
        // this.MAP.on('tooltipclose', (e) => { console.log('tooltipclose', e); });
        //
        // this.MAP.on('locationerror', (e) => { console.log('locationerror', e); });
        // this.MAP.on('locationfound', (e) => { console.log('locationfound', e); });
        //
        // this.MAP.on('click', (e) => { console.log('click', e); });
        //this.MAP.on('dblclick', (e) => { console.log('dblclick', e); });
        // this.MAP.on('mousedown', (e) => { console.log('mousedown', e); });
        // this.MAP.on('mouseup', (e) => { console.log('mouseup', e); });
        // this.MAP.on('keypress', (e) => { console.log('keypress', e); });
        // this.MAP.on('keydown', (e) => { console.log('keydown', e); });
        // this.MAP.on('keyup', (e) => { console.log('keyup', e); });


        this.MAP.on('pm:create', async (event) => {
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

                document.getElementById("map").remove();

                this.MAP = null
            } else if (event.shape === "Text") {
                try {
                    this.MAP.once('click', async (event_2) => {
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

                        await sleep(500);
                        const response_points = await fetch("http://localhost:3000/api/point/index/")
                        const pointJson = await response_points.json()

                        this.MAP.removeLayer(event.layer)
                        this.MAP.removeLayer(this.MARKER_OVERLAY);
                        const MarkerOverlay = [];

                        for (const [id] of Object.entries(pointJson.objects)) {
                            const res = await fetch("http://localhost:3000/api/point/" + id + "/geo");
                            const data = await res.json();
                            const marker = L.marker([data.lat, data.lng], { id: id }).addTo(this.MAP)
                            marker.bindPopup(data.name);
                            MarkerOverlay.push(marker)
                        }
                        this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
                        this.MAP.addLayer(this.MARKER_OVERLAY);
                    })
                } catch (e) {
                    console.warn(e);
                }
            }
        });

        function contextMenuDisabled(e) {
            e.originalEvent.preventDefault();
        }

        function customContextMenu(e) {
            e.originalEvent.preventDefault();
        }

        this.MAP.on('contextmenu', contextMenuDisabled);

        async function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }


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