import {sleep} from "./helper.js";

const API_KEY = "cd9a2c21832e44468c189b65928a722d"; // OpenCage API-Key

export async function getCoordinates(city, CCONFIG) {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(city)}&key=${API_KEY}&limit=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Netzwerkfehler");
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const { lat, lng } = data.results[0].geometry;
            CCONFIG.setConfigValue("latitude", lat);
            CCONFIG.setConfigValue("longitude", lng);
            CCONFIG.setConfigValue("location", city);
            console.log(`Koordinaten für ${city} gefunden: (${lat}, ${lng})`);
            await sleep(100);
            location.reload()
        } else {
            throw new Error("Keine Ergebnisse gefunden");
        }
    } catch (err) {
        console.error("Fehler:", err.message);
        return null;
    }
}
