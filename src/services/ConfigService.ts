import { APP_VERSION } from "../core/Version.js";


/**
 * The ConfigService class manages the configuration settings for the 3D Map Generator application. It provides methods to initialize default config values, get and set config values in localStorage, and validate the config values against the defaults. The config values include settings such as camera parameters, user preferences, and application version. By using this service, the application can ensure that all config values are valid and easily accessible throughout the codebase.
 */
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
  private FUNCTION_SUCCESS: number;
  private FUNCTION_FAILURE: number;

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
    this.FUNCTION_SUCCESS = 1;
    this.FUNCTION_FAILURE = 0;
  }


  /**
   * Writes all default config values to localStorage.
   */
  initConfig(): void {
    for (const [key, value] of Object.entries(this.CONFIG_DEFAULTS)) {
      localStorage.setItem(key.toLowerCase(), String(value));
    }
  }


  /**
   * Gets a config value in localStorage, converting it to the correct type. The key is converted to lowercase before retrieving. If the value is "true" or "false", it is converted to 1 or 0 respectively. If the key is "version", the string value is returned. For all other keys, the value is parsed as a float and returned as a number. If parsing fails, 0 is returned.
   * @param key - string key of the config value to retrieve from localStorage
   * @return The value of the config key from localStorage, parsed to the correct type.
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

    return Number.parseFloat(localStorage.getItem(key)?.toString() ?? "0") || this.FUNCTION_FAILURE;
  }


  /**
   * Sets a config value in localStorage, converting the value to a string. The key is converted to lowercase before storing. After successfully setting the value, the function returns 1.
   * @param key - string key of the config value to set in localStorage
   * @param value - int value of the config value to set in localStorage
   * @return 1 after successfully setting the value in localStorage
   */
  setConfigValue(
      key: string,
      value: number
  ): number {
    try {
      localStorage.setItem(key.toLowerCase(), String(value));
      return this.FUNCTION_SUCCESS;
    } catch {
      return this.FUNCTION_FAILURE;
    }
  }


  /**
   * Validates the config values in localStorage against the default config values. If a value is missing or cannot be parsed to the correct type, it is reset to the default value. This ensures that all config values in localStorage are valid and can be used without errors.
   */
  fixAndValidateConfig(): void {
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
