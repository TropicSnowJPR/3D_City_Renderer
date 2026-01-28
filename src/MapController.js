import ml from "maplibre-gl";
import {Geoman} from "@geoman-io/maplibre-geoman-free";

export class MapController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.GEOMAN = null
        this.GEOJSON = null
        this.MAP = null
        this.REUSED_DATA = null
        this.GM_OPTIONS = {
            settings: {
                controlsPosition: "bottom-left",
                controlsUiEnabledByDefault: false
            },

            controls: {
                draw: {
                    circle: {
                        uiEnabled: true,
                        active: false
                    },
                    marker: { uiEnabled: true },
                    circle_marker: { uiEnabled: false },
                    ellipse: { uiEnabled: false },
                    text_marker: { uiEnabled: false },
                    line: { uiEnabled: false },
                    rectangle: { uiEnabled: false },
                    polygon: { uiEnabled: false },
                    freehand: { uiEnabled: false },
                    custom_shape: { uiEnabled: false }
                },

                edit: {
                    drag: {uiEnabled: true},
                    change: { uiEnabled: false },
                    rotate: { uiEnabled: false },
                    scale: { uiEnabled: false },
                    copy: { uiEnabled: false },
                    cut: { uiEnabled: false },
                    split: { uiEnabled: false },
                    union: { uiEnabled: false },
                    difference: { uiEnabled: false },
                    line_simplification: { uiEnabled: false },
                    lasso: { uiEnabled: false },
                    delete: { uiEnabled: true }
                },

                helper: {
                    shape_markers: { uiEnabled: false },
                    pin: { uiEnabled: false },
                    snapping: { uiEnabled: false, active: true },
                    snap_guides: { uiEnabled: false },
                    measurements: { uiEnabled: false },
                    auto_trace: { uiEnabled: false },
                    geofencing: { uiEnabled: false },
                    zoom_to_features: { uiEnabled: false },
                    click_to_edit: { uiEnabled: false }
                }
            }
        }
    }

    onStart() {
        try {
            fetch("http://localhost:3000/api/object/index")
                .then(r => r.json())
                .then(console.log);

            fetch("http://localhost:3000/api/point/index")
                .then(r => r.json())
                .then(console.log);
        } catch (e) {
            console.warn(e);
        }

        this.MAP = new ml.Map({
            container: 'map',
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            renderWorldCopies: false,
            zoom: 18,
            center: [11.088986462334187, 50.952314129741964],
        });

        this.MAP.on("load", () => {

            this.MAP.addSource("geojson-extra-source", {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features: []
                }
            });

            this.GEOMAN = new Geoman(this.MAP, this.GM_OPTIONS);

            this.MAP.on("gm:loaded", async () => {

                // try {
                //     const homeGeo = await JSON.parse(this.CCONFIG.getConfigValue("home_geo"));
                //     console.log(await JSON.parse(this.CCONFIG.getConfigValue("home_geo")));
                //     this.MAP.gm.features.addGeoJsonFeature({ shapeGeoJson: homeGeo, defaultSource: true}); //, sourceName: "home" });
                // } catch (e) { console.error(e); }
                //
                // try {
                //     const workGeo = await JSON.parse(this.CCONFIG.getConfigValue("work_geo"));
                //     console.log(await JSON.parse(this.CCONFIG.getConfigValue("work_geo")));
                //     this.MAP.gm.features.addGeoJsonFeature({ shapeGeoJson: workGeo, defaultSource: true}); //, sourceName: "work" });
                // } catch (e) { console.error(e); }


                try {
                    const point_index = await fetch("http://localhost:3000/api/point/index").then(r => r.json());
                    console.log(point_index);

                    for (const key in point_index.objects) {
                        const geoJsonTemp = await fetch(`http://localhost:3000/api/point/${key}/geo`).then(r => r.json());
                        const result = this.MAP.gm.features.importGeoJson(geoJsonTemp);
                        this.MAP.gm.features.addGeoJsonFeature({ result });
                    }
                } catch (e) { console.error(e); }

                try {
                    const object_index = await fetch("http://localhost:3000/api/object/index").then(r => r.json());
                    console.log(object_index);

                    for (const key in object_index.objects) {
                        const geoJsonTemp = await fetch(`http://localhost:3000/api/object/${key}/geo`).then(r => r.json());
                        const result = this.MAP.gm.features.importGeoJson(geoJsonTemp);
                        this.MAP.gm.features.addGeoJsonFeature({ result });
                    }
                } catch (e) { console.error(e); }

            })
        });

        this.MAP.on("gm:remove", async (event) => {
            const geo = event.feature._geoJson;

            if (geo.geometry.type === "Polygon") {
                try {
                    await fetch("http://localhost:3000/api/object/" + geo.id + "/delete");
                } catch (e) { console.error(e); }
            } else if (geo.geometry.type === "Point") {
                try {
                    await fetch("http://localhost:3000/api/point/" + geo.id + "/delete");
                } catch (e) { console.error(e); }
            }
        })

        this.MAP.on("gm:dragstart", async (event) => {
            const geo = event.feature._geoJson;

            this.GEOJSON = geo;

            if (geo.geometry.type === "Polygon") {

                // unwrap linear ring
                let points = geo.geometry.coordinates[0];

                // remove duplicated closing point
                if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) {
                    points = points.slice(0, -1);
                }

                const center = geo.properties.__gm_center; // [lon, lat]

                let radiusSum = 0;
                for (const p of points) {
                    radiusSum += this.haversine(center, p);
                }

                const radius = radiusSum / points.length;
                const diameter = radius * 2;

                this.CCONFIG.setConfigValue("radius", radius.toFixed(0))
                this.CCONFIG.setConfigValue("latitude", center[1])
                this.CCONFIG.setConfigValue("longitude", center[0])

                try {
                    const resp = await fetch("http://localhost:3000/api/object/" + geo.id + "/data");
                    if (!resp.ok) {
                        // handle not found or other HTTP errors
                        this.REUSED_DATA = null; // or handle as needed
                    } else {
                        this.REUSED_DATA = await resp.json();
                    }
                } catch (err) {
                    // network error
                    this.REUSED_DATA = null;
                    console.error("Fetch failed:", err);
                }

                document.getElementById("map").remove();

                this.MAP = null
            } else if (geo.geometry.type === "Point") {
            }
        })


        this.MAP.on('gm:create',  async (event) => {
            console.log(event)
            const geo = event.feature._geoJson;

            this.GEOJSON = geo;

            if (geo.geometry.type === "Polygon") {

                // unwrap linear ring
                let points = geo.geometry.coordinates[0];

                // remove duplicated closing point
                if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) {
                    points = points.slice(0, -1);
                }

                const center = geo.properties.__gm_center; // [lon, lat]

                let radiusSum = 0;
                for (const p of points) {
                    radiusSum += this.haversine(center, p);
                }

                const radius = radiusSum / points.length;
                const diameter = radius * 2;

                this.CCONFIG.setConfigValue("radius", radius.toFixed(0))
                this.CCONFIG.setConfigValue("latitude", center[1])
                this.CCONFIG.setConfigValue("longitude", center[0])

                document.getElementById("map").remove();

                this.MAP = null
            } else if (geo.geometry.type === "Point") {
                const GEOJSON = geo;
                await fetch("http://localhost:3000/api/point", {
                    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ GEOJSON })
                });
            }
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