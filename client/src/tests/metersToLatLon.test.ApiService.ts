import { expect, test } from 'vitest'
import { metersToLatLon } from "../services/ApiService.js";

test('metersToLatLon converts metric coordinates correctly', () => {
  const lat = 50;
  const latRad = lat * Math.PI / 180;

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
  let x = 111_139;
  let y = 0;
  let result = metersToLatLon(x, y, lat);

  expect(result[0]).toBeCloseTo(x / metersPerDegLat, 5);
  expect(result[1]).toBeCloseTo(0, 5);

  // Test 2
  x = 111_139;
  y = 111_139;
  result = metersToLatLon(x, y, lat);

  expect(result[0]).toBeCloseTo(x / metersPerDegLat, 5);
  expect(result[1]).toBeCloseTo(y / metersPerDegLon, 5);

  // Test 3
  x = -111_139;
  y = -111_139;
  result = metersToLatLon(x, y, lat);

  expect(result[0]).toBeCloseTo(x / metersPerDegLat, 5);
  expect(result[1]).toBeCloseTo(y / metersPerDegLon, 5);

  // Test 4
  result = metersToLatLon(0, 0, lat);
  expect(result).toEqual([0, 0]);

  // Test 5
  x = 1_111_390;
  y = 1_111_390;
  result = metersToLatLon(x, y, lat);

  expect(result[0]).toBeCloseTo(x / metersPerDegLat, 5);
  expect(result[1]).toBeCloseTo(y / metersPerDegLon, 5);
});