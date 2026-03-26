import { test, expect } from "vitest";
import { ConfigService } from "../services/ConfigService.js";

test('getConfigValue', () => {
    const configService = new ConfigService();

    configService.initConfig();

    for (const key in configService.CONFIG_DEFAULTS) {
        const value = configService.CONFIG_DEFAULTS[key as keyof typeof configService.CONFIG_DEFAULTS];
        expect(value).toBeDefined();
        expect(localStorage.getItem(key.toLowerCase())).toEqual(String(value));
    }

    for (const key in configService.CONFIG_DEFAULTS) {
        let value = configService.CONFIG_DEFAULTS[key as keyof typeof configService.CONFIG_DEFAULTS];
        expect(value).toBeDefined();
        if (value === false) {
            value = 0;
        } else if (value === true) {
            value = 1;
        }
        expect(configService.getConfigValue(key)).toEqual(value);
    }
})