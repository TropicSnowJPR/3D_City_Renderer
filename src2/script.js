import ml from "maplibre-gl";
import {Geoman} from "@geoman-io/maplibre-geoman-free";

import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";

const map = new ml.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    renderWorldCopies: false,
    zoom: 18,
    center: [11.088986462334187, 50.952314129741964],
});


const gmOptions = {
    settings: {
        controlsPosition: "top-right",
        controlsUiEnabledByDefault: false
    },

    controls: {
        draw: {
            circle: {
                title: "Draw Circle",
                icon: "circle-icon", // REQUIRED: icon id
                uiEnabled: true,
                active: false
            },

            // everything else disabled
            marker: { uiEnabled: false },
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
            drag: {
                title: "Drag Features",
                icon: "drag-icon",
                uiEnabled: true,
                active: false
            },

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
            delete: { uiEnabled: false }
        },

        helper: {
            // no helpers at all
            shape_markers: { uiEnabled: false },
            pin: { uiEnabled: false },
            snapping: { uiEnabled: false },
            snap_guides: { uiEnabled: false },
            measurements: { uiEnabled: false },
            auto_trace: { uiEnabled: false },
            geofencing: { uiEnabled: false },
            zoom_to_features: { uiEnabled: false },
            click_to_edit: { uiEnabled: false }
        }
    }
};




const geoman = new Geoman(map, gmOptions);

map.on("gm:loaded", () => {
    console.log("Geoman fully loaded");

    // Here you can add your geojson shapes for example
    const shapeGeoJson = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 51] },
    };
    map.gm.features.addGeoJsonFeature({ shapeGeoJson });
});

map.on('gm:create',  (event) => {
    const geo = event.feature._geoJson;

    if (geo.geometry.type !== "Polygon") return;

    // unwrap linear ring
    let points = geo.geometry.coordinates[0];

    // remove duplicated closing point
    if (
        points.length > 1 &&
        points[0][0] === points.at(-1)[0] &&
        points[0][1] === points.at(-1)[1]
    ) {
        points = points.slice(0, -1);
    }

    const center = geo.properties.__gm_center; // [lon, lat]

    let radiusSum = 0;
    for (const p of points) {
        radiusSum += haversine(center, p);
    }

    const radius = radiusSum / points.length;
    const diameter = radius * 2;

    console.log({
        radius_m: radius,
        diameter_m: diameter
    });

    document.getElementById("map").remove();
});


function haversine(a, b) {
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
