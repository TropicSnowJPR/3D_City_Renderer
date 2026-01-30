import { APP_VERSION } from "./Version.js";

export class ConfigManager {
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
            follyFeverMode: false
        }
    }

    initConfig() {
        for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
            localStorage.setItem(key.toLowerCase(), value);
        }
    }

    getConfigValue(value) {
        if (localStorage.getItem(value.toLowerCase()) === "true" || localStorage.getItem(value.toLowerCase()) === "false") {
            return localStorage.getItem(value.toLowerCase()) === "true";
        }

        if (!isNaN(parseFloat(localStorage.getItem(value)))) {
            return parseFloat(localStorage.getItem(value));
        }

        return localStorage.getItem(value)
    }

    setConfigValue(value, data) {
        localStorage.setItem(value.toLowerCase(), data);
    }

    getConfigVersion() {
        return localStorage.getItem("version")
    }
}