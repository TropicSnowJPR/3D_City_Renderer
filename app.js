import * as mod from "overpass-ql-ts";
import fs from 'fs';

const { DefaultOverpassApi, OverpassApi, OverpassFormat, OverpassOutputVerbosity, OverpassOutputGeoInfo } = mod;

const api = new DefaultOverpassApi();


// const lat = 55.67594
// const lon = 12.56553
const radius = 1000; // in meters

const lat_max = 50.796594
const lon_max = 11.102865
const lat_min = 50.747615
const lon_min = 11.048420

const bbox = `${lat_min},${lon_min},${lat_max},${lon_max}`;


async function query() {
    const q = `
        [out:json][timeout:180];
        (
           way["building"](${bbox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

const result = await query();
if (!result) {
    console.error("No result from Overpass query.");
    process.exit(1);
}

//console.log("Query: " + JSON.stringify(result));

fs.writeFileSync('buildings.json', JSON.stringify(result), null, 2);
console.log('Saved buildings.json');



















// function toMetricCoords(lat, lon) {
//     if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
//         return null;
//     }
//     // UTM is not defined for extreme polar latitudes (approx beyond 84N or 80S)
//     if (lat >= 84 || lat <= -80) {
//         return null;
//     }
//     const zone = Math.floor((lon + 180) / 6) + 1;
//     // Northern hemisphere EPSG: 32601..32660, southern: 32701..32760
//     const epsg = (lat >= 0) ? 32600 + zone : 32700 + zone;
//     return epsg;
// }






// FOR LATER USE
// const col_bld_low = "#c88a1e"
// const col_bld_mid = "#b7720e"
// const col_bld_high ="#98590a"
// const col_landuse = "#b89c3a"
// const col_park = "#66A61E"
// const col_road = "#7e8792"
// const col_road_hi = "#e6ebf1"
// const col_water = "#3E8fe0"
// const col_base_hi = "#FBFCFE"
// const col_base_lo = "#D8DDE3"