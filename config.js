export function resetLocalStorageConfig() {
    localStorage.setItem("cameraX", "0")
    localStorage.setItem("cameraY", "250")
    localStorage.setItem("cameraZ", "1500")
    localStorage.setItem("moveSpeed", "0.8")
    localStorage.setItem("mouseSensitivity", "0.002")
    localStorage.setItem("fov", "60")
    localStorage.setItem("near", "1")
    localStorage.setItem("far", "500000")
    localStorage.setItem("aspect", (window.innerWidth / window.innerHeight).toString())
    localStorage.setItem("yaw", "0")
    localStorage.setItem("pitch", "0")
    localStorage.setItem("lat", "50.9786")
    localStorage.setItem("lon", "11.0328")
    localStorage.setItem("radius", "1000")
}

export function loadLocalStorageConfig(value) {
    if (value === "lat") {
        return parseFloat(localStorage.getItem("lat"));
    } else if (value === "lon") {
        return parseFloat(localStorage.getItem("lon"));
    } else if (value === "radius") {
        return parseFloat(localStorage.getItem("radius"));
    } else if (value === "cameraX") {
        return parseFloat(localStorage.getItem("cameraX"));
    } else if (value === "cameraY") {
        return parseFloat(localStorage.getItem("cameraY"));
    } else if (value === "cameraZ") {
        return parseFloat(localStorage.getItem("cameraZ"));
    } else if (value === "moveSpeed") {
        return parseFloat(localStorage.getItem("moveSpeed"));
    } else if (value === "mouseSensitivity") {
        return parseFloat(localStorage.getItem("mouseSensitivity"));
    } else if (value === "fov") {
        return parseFloat(localStorage.getItem("fov"));
    } else if (value === "near") {
        return parseFloat(localStorage.getItem("near"));
    } else if (value === "far") {
        return parseFloat(localStorage.getItem("far"));
    } else if (value === "aspect") {
        return parseFloat(localStorage.getItem("aspect"));
    } else if (value === "yaw") {
        return parseFloat(localStorage.getItem("yaw"));
    } else if (value === "pitch") {
        return parseFloat(localStorage.getItem("pitch"));
    }
}

export function saveLocalStorageConfig(value, data) {
    if (value === "lat") {
        localStorage.setItem("lat", data.toString());
    } else if (value === "lon") {
        localStorage.setItem("lon", data.toString());
    } else if (value === "radius") {
        localStorage.setItem("radius", data.toString());
    } else if (value === "cameraX") {
        localStorage.setItem("cameraX", data.toString());
    } else if (value === "cameraY") {
        localStorage.setItem("cameraY", data.toString());
    } else if (value === "cameraZ") {
        localStorage.setItem("cameraZ", data.toString());
    } else if (value === "moveSpeed") {
        localStorage.setItem("moveSpeed", data.toString());
    } else if (value === "mouseSensitivity") {
        localStorage.setItem("mouseSensitivity", data.toString());
    } else if (value === "fov") {
        localStorage.setItem("fov", data.toString());
    } else if (value === "near") {
        localStorage.setItem("near", data.toString());
    } else if (value === "far") {
        localStorage.setItem("far", data.toString());
    } else if (value === "aspect") {
        localStorage.setItem("aspect", data.toString());
    } else if (value === "yaw") {
        localStorage.setItem("yaw", data.toString());
    } else if (value === "pitch") {
        localStorage.setItem("pitch", data.toString());
    }
}