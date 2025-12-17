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
    return await API.execQuery(q);

}