import { APP_VERSION } from "../core/Version.js";

export class ConfigService {
  readonly CONFIG_DEFAULTS: {
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


  /**
   *
   */
  constructor() {
    this.CONFIG_DEFAULTS = {
      aspect: window.innerWidth / window.innerHeight,
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


  /**
   * Writes all default config values to localStorage, converting them to strings.
   */
  initConfig(): void {
    for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
      localStorage.setItem(key.toLowerCase(), String(value));
    }
  }


  /**
   *
   * @param key
   */
  getConfigValue(
      key: string
  ): number | string {
    if (localStorage.getItem(key.toLowerCase()) === "true") {
      return 1;
    } else if (localStorage.getItem(key.toLowerCase()) === "false") {
      return 0;
    }

    if (key.toLowerCase() === "version") {
      return localStorage.getItem(key) as string;
    }

    return Number.parseFloat(localStorage.getItem(key)?.toString() ?? "0") || 0;
  }


  /**
   *
   * @param key
   * @param value
   */
  setConfigValue(
      key: string,
      value: number
  ): number {
    localStorage.setItem(key.toLowerCase(), String(value));
    return 1;
  }


  /**
   *
   */
  validateConfig(): void {
    for (const key of Object.keys(this.CONFIG_DEFAULTS) as (keyof typeof this.CONFIG_DEFAULTS)[]) {
      const stored = localStorage.getItem(key);

      if (stored === null) {
        this.initConfig();
        continue;
      }

      const defaultValue = this.CONFIG_DEFAULTS[key];

      if (
        (typeof defaultValue === "number" && Number.isNaN(Number.parseFloat(stored))) ||
        (typeof defaultValue === "boolean" && stored !== "true" && stored !== "false")
      ) {
        localStorage.setItem(key, String(defaultValue));
      }
    }
  }
}
