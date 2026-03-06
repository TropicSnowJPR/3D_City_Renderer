import { APP_VERSION } from "../core/version.js";

export class ConfigService {
  private readonly CONFIG_DEFAULTS: {
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
    colorMode: number;
  };
  constructor() {
    this.CONFIG_DEFAULTS = {
      aspect: 16 / 9,
      colorMode: 0,
      debug: false,
      far: 10_000,
      fov: 60,
      latitude: 50.9786,
      longitude: 11.0328,
      mousesensitivity: 0.005,
      movespeed: 1,
      near: 0.1,
      pitch: 0,
      radius: 500,
      version: APP_VERSION,
      xpos: 0,
      yaw: 0,
      ypos: 50,
      zpos: 0,
    };
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
      return Number.parseInt(localStorage.getItem(key) as string);
    }

    if (localStorage.getItem(key.toLowerCase()) === "nan") {
      localStorage.setItem(key.toLowerCase(), "0");
      return 0;
    }

    if (localStorage.getItem(key.toLowerCase()) === "true") {
      return 1;
    } else if (localStorage.getItem(key.toLowerCase()) === "false") {
      return 0;
    }

    return Number.parseFloat(localStorage.getItem(key) as string);
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
        (typeof defaultValue === "number" && isNaN(Number.parseFloat(stored))) ||
        (typeof defaultValue === "boolean" && stored !== "true" && stored !== "false")
      ) {
        localStorage.setItem(key, String(defaultValue));
      }
    }
  }
}
