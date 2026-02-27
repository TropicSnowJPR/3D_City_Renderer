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
            localStorage.setItem(key.toLowerCase(), value);
        }
    }

    getConfigValue(key) {
        if (localStorage.getItem(key.toLowerCase()) === "NaN") {
            localStorage.setItem(key.toLowerCase()) === 0;
            return 0
        }

        if (localStorage.getItem(key.toLowerCase()) === "true" || localStorage.getItem(key.toLowerCase()) === "false") {
            return localStorage.getItem(key.toLowerCase()) === "true";
        }

        if (!isNaN(parseFloat(localStorage.getItem(key)))) {
            return parseFloat(localStorage.getItem(key));
        }

        return localStorage.getItem(key)
    }

    setConfigValue(key, value) {
        localStorage.setItem(key.toLowerCase(), value);
    }

    validateConfig () {
        for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
            if (localStorage.getItem(key) !== null) {
                this.initConfig()
            }
            if (isNaN(parseFloat(localStorage.getItem(key))) || localStorage.getItem(key) !== "true" || localStorage.getItem(key) !== "false") {
                localStorage.setItem(value, this.CONFIG_DEFAULTS[value]);
            }
        }
    }
}