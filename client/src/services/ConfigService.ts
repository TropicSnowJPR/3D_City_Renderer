import { APP_VERSION } from "../core/version.js";

export class ConfigService {
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

    validateConfig () {
        for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
            if (localStorage.getItem(key) !== null) {
                this.initConfig()
            }
            if (isNaN(parseFloat(<string>localStorage.getItem(key))) || localStorage.getItem(key) !== "true" || localStorage.getItem(key) !== "false") {
                localStorage.setItem(value, this.CONFIG_DEFAULTS[value]);
            }
        }
    }
}