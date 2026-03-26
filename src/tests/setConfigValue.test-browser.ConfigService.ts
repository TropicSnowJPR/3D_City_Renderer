import { test, expect } from "vitest";
import { ConfigService } from "../services/ConfigService.js";

test('setConfigValue', () => {
    const configService = new ConfigService();

    const key = "SomeKey";
    const value = 1020;

    configService.setConfigValue(key, value)
    expect(localStorage.getItem(key.toLowerCase())).toEqual(String(value));
})