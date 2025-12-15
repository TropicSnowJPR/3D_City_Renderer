import * as MOD from "overpass-ql-ts";

const { DefaultOverpassApi } = MOD;
const API = new DefaultOverpassApi();

export async function queryAreaData(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
          way(${boundingBox});
          relation(${boundingBox});
        );
        out body geom;
    `;
    console.log(q)
    try {
        return await API.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return JSON.parse('{"elements":[{"type":"way","id":123456789,"geometry":[{"lat":123457,"lon":123656},{"lat":1235656,"lon":12357456},{"lat":1273456,"lon":1234564},{"lat":12344656,"lon":12345646}],"tags":{"building":"yes","height":"10"}}]}');
    }
}