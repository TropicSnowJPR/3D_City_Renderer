import type { LatLngExpression } from "leaflet";

// eslint-disable no-console
export class GeoLocationService {

    /**
     * Retrieves the user's current geographic location using the browser's Geolocation API.
     * @returns A promise that resolves to an object containing the latitude and longitude of the user's current location. The object has the shape { lat: number, lng: number }.
     */
    public getLocation(): Promise<LatLngExpression> {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    resolve({
                        lat: coords.latitude,
                        lng: coords.longitude,
                    });
                },
                (error) => {
                    reject(new Error(error.message));
                },
            );
        });
    }

    /**
     * Type guard to check if an object has numeric lat and lng properties.
     * @param obj - The object to check, which can be of any type. The function will return true if the object has numeric lat and lng properties, and false otherwise.
     * @returns A boolean indicating whether the given object has numeric lat and lng properties.
     * @private
     */
    private static isLatLngLiteral(obj: unknown): obj is { lat: number; lng: number } {
        if (typeof obj !== "object" || obj === null) {return false;}
        const o = obj as Record<string, unknown>;
        return typeof o.lat === "number" && typeof o.lng === "number";
    }

    /**
     * Converts a LatLngExpression (which can be a [lat, lng] tuple or an object with lat & lng properties) into a standardized object with numeric lat and lng properties.
     * @param expr - The LatLngExpression to convert, which can be either a [lat, lng] tuple or an object with lat & lng properties.
     * @returns An object with numeric lat and lng properties representing the latitude and longitude of the given expression.
     * @private
     */
    private static toLatLng(expr: LatLngExpression): { lat: number; lng: number } {
        // LatLngExpression can be [lat, lng] tuple or an object with lat & lng
        if (Array.isArray(expr)) {
            // Leaflet LatLngTuple is [lat, lng]
            return { lat: expr[0], lng: expr[1] };
        }

        // Treat as object with lat & lng properties
        if (GeoLocationService.isLatLngLiteral(expr)) {
            return { lat: expr.lat, lng: expr.lng };
        }

        // Fallback: try properties named 0/1 or latitude/longitude
        const anyExpr = expr as unknown as Record<string, unknown>;
        if (typeof anyExpr[0] === "number" && typeof anyExpr[1] === "number") {
            return { lat: anyExpr[0] as number, lng: anyExpr[1] as number };
        }
        if (typeof anyExpr.latitude === "number" && typeof anyExpr.longitude === "number") {
            return { lat: anyExpr.latitude as number, lng: anyExpr.longitude as number };
        }

        throw new Error("Invalid LatLngExpression");
    }


    /**
     * Fetches a route between the given start and end coordinates using the OSRM API.
     * @param start - The starting point of the route, which can be a LatLngExpression (either a [lat, lng] tuple or an object with lat & lng properties)
     * @param end - The ending point of the route, which can be a LatLngExpression (either a [lat, lng] tuple or an object with lat & lng properties)
     * @returns A promise that resolves to an array of LatLngExpression objects representing the coordinates of the route from start to end. Each coordinate is an object with lat and lng properties.
     */
    public async getRoute(start: LatLngExpression, end: LatLngExpression): Promise<LatLngExpression[]> {
        const s = GeoLocationService.toLatLng(start);
        const e = GeoLocationService.toLatLng(end);

        // OSRM expects longitude,latitude order for each coordinate
        const url = `https://router.project-osrm.org/route/v1/driving/${s.lng},${s.lat};${e.lng},${e.lat}?overview=full&geometries=geojson`;

        return await fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.routes && data.routes.length > 0) {
                    const { coordinates } = data.routes[0].geometry;
                    return coordinates.map((cord: [number, number]) => ({ lat: cord[1], lng: cord[0] }));
                }
                throw new Error("No routes found");
            })
            .catch(error => {
                console.error("Error fetching route:", error);
                throw error;
            });
    }
}


