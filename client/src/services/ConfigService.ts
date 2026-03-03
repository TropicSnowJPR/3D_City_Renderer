import { APP_VERSION } from "../core/version.js";

export class ConfigService {
    private CONFIG_DEFAULTS: {
        version: string;
        latitude: number;
        longitude: number;
        radius: number;
        aspect: number;
        fov: number;
        near: number;
        far: number;
        xpos: number;
        ypos: number;
        zpos: number;
        yaw: number;
        pitch: number;
        movespeed: number;
        mousesensitivity: number;
        debug: boolean;
        colorMode: number
    };
    constructor() {
        this.CONFIG_DEFAULTS = {
            version: APP_VERSION,
            latitude: 50.9786,
            longitude: 11.0328,
            radius: 500,
            aspect: window.innerWidth / window.innerHeight,
            fov: 60,
            near: 0.1,
            far: 10000,
            xpos: 0,
            ypos: 50,
            zpos: 0,
            yaw: 0,
            pitch: 0,
            movespeed: 1,
            mousesensitivity: 0.005,
            debug: false,
            colorMode: 0
        }
    }

    initConfig() {
        for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
            if (typeof value === "string") {
                localStorage.setItem(key.toLowerCase(), value);
            }
        }
    }

    getConfigValue(key: string) {
        if (Number.isInteger(localStorage.getItem(key))) {
            return parseInt(<string>localStorage.getItem(key));
        }

        if (localStorage.getItem(key.toLowerCase()) === "nan") {
            localStorage.setItem(key.toLowerCase(), "0");
            return 0
        }

        if (localStorage.getItem(key.toLowerCase()) === "true") {
            return 1;
        } else if (localStorage.getItem(key.toLowerCase()) === "false") {
            return 0;
        }

        return parseFloat(<string>localStorage.getItem(key))
    }

    setConfigValue(key: string, value: number) {
        localStorage.setItem(key.toLowerCase(), String(value));
    }

    validateConfig() {
        for (const key of Object.keys(this.CONFIG_DEFAULTS) as (keyof typeof this.CONFIG_DEFAULTS)[]) {

            const stored = localStorage.getItem(key);

            if (stored === null) {
                this.initConfig();
                continue;
            }

            const defaultValue = this.CONFIG_DEFAULTS[key];

            if (
                (typeof defaultValue === "number" && isNaN(parseFloat(stored))) ||
                (typeof defaultValue === "boolean" && stored !== "true" && stored !== "false")
            ) {
                localStorage.setItem(key, String(defaultValue));
            }
        }
    }
}