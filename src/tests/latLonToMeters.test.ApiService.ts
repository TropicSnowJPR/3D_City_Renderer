import { expect, test } from 'vitest'
import { latLonToMeters } from "../services/ApiService.js";

test('latLonToMeters converts lat/lon to meters correctly', () => {
    const lat0 = 50;
    const latRad = lat0 * Math.PI / 180;

    const metersPerDegLat =
        111_132.92 -
        559.82 * Math.cos(2 * latRad) +
        1.175 * Math.cos(4 * latRad) -
        0.0023 * Math.cos(6 * latRad);

    const metersPerDegLon =
        111_412.84 * Math.cos(latRad) -
        93.5 * Math.cos(3 * latRad) +
        0.118 * Math.cos(5 * latRad);

    // Test 1
    let dLat = 1;
    let dLon = 0;
    let result = latLonToMeters(dLat, dLon, lat0);

    expect(result[0]).toBeCloseTo(metersPerDegLat, 3);
    expect(result[1]).toBeCloseTo(0, 5);

    // Test 2
    dLat = 1;
    dLon = 1;
    result = latLonToMeters(dLat, dLon, lat0);

    expect(result[0]).toBeCloseTo(metersPerDegLat, 3);
    expect(result[1]).toBeCloseTo(metersPerDegLon, 3);

    // Test 3
    dLat = -1;
    dLon = -1;
    result = latLonToMeters(dLat, dLon, lat0);

    expect(result[0]).toBeCloseTo(-metersPerDegLat, 3);
    expect(result[1]).toBeCloseTo(-metersPerDegLon, 3);

    // Test 4
    result = latLonToMeters(0, 0, lat0);
    expect(result).toEqual([0, 0]);

    // Test 5
    dLat = 10;
    dLon = 10;
    result = latLonToMeters(dLat, dLon, lat0);

    expect(result[0]).toBeCloseTo(10 * metersPerDegLat, 2);
    expect(result[1]).toBeCloseTo(10 * metersPerDegLon, 2);
});