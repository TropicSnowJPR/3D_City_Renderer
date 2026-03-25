import { expect, test } from 'vitest'
import { getMaxMinCoordsOfArea } from "../services/ApiService.js";

test('getMaxMinCoordsOfArea returns correct bounding box (formatted)', () => {
    const lat = 50;
    const lon = 10;
    const radius = 1000; // 1 km

    const result = getMaxMinCoordsOfArea(lat, lon, radius);

    expect(result).toBeDefined();

    const parts = result?.split(',')?.map(Number) ?? [];
    expect(parts.length).toBe(4);

    const [minLat, minLon, maxLat, maxLon] = parts;

    if (!maxLat || !maxLon || !minLat || !minLon) {
        return;
    }

    expect(minLat).toBeLessThan(maxLat);
    expect(minLon).toBeLessThan(maxLon);

    // Symmetry check (center should be roughly in the middle)
    expect((minLat + maxLat) / 2).toBeCloseTo(lat, 4);
    expect((minLon + maxLon) / 2).toBeCloseTo(lon, 4);
});

test('getMaxMinCoordsOfArea returns exact values when exact=true', () => {
    const lat = 50;
    const lon = 10;
    const radius = 1000;

    const result = getMaxMinCoordsOfArea(lat, lon, radius, true);

    const parts = result?.split(',')?.map(Number) ?? [];

    const [minLat, minLon, maxLat, maxLon] = parts;

    if (!maxLat || !maxLon || !minLat || !minLon) {
        return;
    }

    expect(minLat).toBeLessThan(maxLat);
    expect(minLon).toBeLessThan(maxLon);

    expect((minLat + maxLat) / 2).toBeCloseTo(lat, 6);
    expect((minLon + maxLon) / 2).toBeCloseTo(lon, 6);
});