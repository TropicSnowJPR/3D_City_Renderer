export function getClosestPointOnCircle(circleCenter, radius, point) {
    const dx = point.x - circleCenter.x;
    const dy = point.y - circleCenter.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
        return { x: circleCenter.x + radius, y: circleCenter.y };
    }

    const unitVector = { x: dx / distance, y: dy / distance };

    return {
        x: circleCenter.x + unitVector.x * radius, y: circleCenter.y + unitVector.y * radius
    };
}

export function toMetricCoords(lat, lon) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        return null;
    }
    // Convert degrees to meters (approximation)
    const latInMeters = lat * 111_139; // latitude meters
    const lonInMeters = lon * 111_139 * Math.cos(lat * Math.PI / 180); // longitude meters
    return [latInMeters, lonInMeters];
}

export function getMaxMinCoordsOfArea(lon, lat, radius, exact = false) {
    const center = toMetricCoords(lat, lon);
    const maxX = center[0] + radius;
    const minX = center[0] - radius;
    const maxY = center[1] + radius;
    const minY = center[1] - radius;

    const maxLatLon = toLatLon(maxX, maxY);
    const minLatLon = toLatLon(minX, minY);

    if (exact) {
        return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
    }
    return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
}

function toLatLon(x, y) {
    const lat = x / 111_139; // meters to degrees latitude
    const lon = y / (111_139 * Math.cos(lat * Math.PI / 180)); // meters to degrees longitude
    return [lat, lon];
}



export function isPointInsideRadius(x, y, cx, cy, r) {
    const dx = x - cx;
    const dy = y - cy;
    return (dx*dx + dy*dy) < r*r;
}



export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
