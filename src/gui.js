import * as CONFIG from './config.js'
import * as FILE from './file.js'

export const GUI_PARAMS = {
    CameraSettings: {
        moveSpeed: CONFIG.getClientConfigValue("MoveSpeed"),
        mouseSensitivity: CONFIG.getClientConfigValue("MouseSensitivity"),
        x: CONFIG.getClientConfigValue("XPos"),
        y: CONFIG.getClientConfigValue("YPos"),
        z: CONFIG.getClientConfigValue("ZPos"),
        yaw: CONFIG.getClientConfigValue("Yaw"),
        pitch: CONFIG.getClientConfigValue("Pitch")
    },
    LocationSettings: {
        latitude: CONFIG.getClientConfigValue("Latitude"),
        longitude: CONFIG.getClientConfigValue("Longitude"),
        radius: CONFIG.getClientConfigValue("Radius"),
    },
    RendererSettings: {
        debug: CONFIG.getClientConfigValue("Debug"),
        renderTicks: 0,
        update: function() {location.reload();}
    },
    Download: {
        exportOBJ: async function () {
            await FILE.downloadSceneAsOBJ();
        },
        exportGLB: async function () {
            await FILE.downloadSceneAsGLB();
        },
        exportGLTF: async function () {
            await FILE.downloadSceneAsGLTF();
        },
        exportPLY: async function () {
            await FILE.downloadSceneAsPLY();
        }
    }
};