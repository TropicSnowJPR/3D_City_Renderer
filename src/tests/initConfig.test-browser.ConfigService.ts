import { test, expect } from "vitest";
import { ConfigService } from "../services/ConfigService.js";

test('initConfig', () => {
    const configService = new ConfigService();

    configService.initConfig();

    for (const key in configService.CONFIG_DEFAULTS) {
        const value = configService.CONFIG_DEFAULTS[key as keyof typeof configService.CONFIG_DEFAULTS];
        expect(value).toBeDefined();
        expect(localStorage.getItem(key.toLowerCase())).toEqual(String(value));
    }
})