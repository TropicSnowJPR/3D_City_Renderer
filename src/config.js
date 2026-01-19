const config = {
    XPos: 0,
    YPos: 250,
    ZPos: 1500,
    MoveSpeed: 0.8,
    MouseSensitivity: 0.002,
    FOV: 60,
    Near: 1,
    Far: 500000,
    Aspect: window.innerWidth / window.innerHeight,
    Yaw: 0,
    Pitch: 0,
    Latitude: 50.9786,
    Longitude: 11.0328,
    Radius: 300,
    Debug: false,
    Version: "3.0.2"
}

export function ClientConfig() {
    for (const [key, value] of Object.entries(config)) {
        if (localStorage.getItem(key.toLowerCase()) === null) {
            console.error("BIG PROBLEM: Missing config value: " + key);
        }
    }
}

export function initClientConfig() {
    for (const [key, value] of Object.entries(config)) {
        localStorage.setItem(key.toLowerCase(), value);
    }
}

export function getClientConfigValue(value) {
    if (localStorage.getItem(value.toLowerCase()) === null) {return null;}
    if (localStorage.getItem(value.toLowerCase()) === "true" || localStorage.getItem(value.toLowerCase()) === "false") {
        return localStorage.getItem(value.toLowerCase()) === "true";
    }
    return parseFloat(localStorage.getItem(value.toLowerCase()));
}

export function setClientConfigValue(value, data) {
    localStorage.setItem(value.toLowerCase(), JSON.stringify(data));
}