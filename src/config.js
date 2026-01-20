export class ClientLocalStorageConfiguration {
    constructor(configObject) {
        this.config = configObject;
    }

    initConfig() {
        for (const [key, value] of Object.entries(this.config)) {
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
    }

    setConfigValue(value, data) {
        localStorage.setItem(value.toLowerCase(), data);
    }
}


export class ApplicationConfiguration {
    constructor(configObject) {
        this.config = configObject;
    }

    getConfigValue(value) {
        return this.config[value];
    }

    setConfigValue(value, data) {
        this.config[value] = data;
    }
}