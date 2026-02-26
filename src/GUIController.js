import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import {FXAA_SETTINGS} from './Main.js';

export class GUIController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager()
        this.GUI = null;
        this.CAMERA_SETTINGS = null;
        this.LOCATION_SETTINGS = null;
        this.RENDERER_SETTINGS = null;
        this.DOWNLOAD = null;
        this.FXAA_SETTINGS_FOLDER = null;
        this.GUI_PARAMS = {
            CameraSettings: {
                CAMERA_SPEED: 0,
                MOUSE_SENSITIVITY: 0,
                CAMERA_X: 0,
                CAMERA_Y: 0,
                CAMERA_Z: 0,
                CAMERA_YAW: 0,
                CAMERA_PITCH: 0,
                CAMERA_FOV: 0,
                CAMERA_FAR: 0,
                CAMERA_NEAR: 0
            },
            LocationSettings: {
                LATITUDE: 0,
                LONGITUDE: 0,
                RADIUS: 0,
            },
            RendererSettings: {
                FPS: 0,
                DEBUG: false,
                CYCLES: 0,
                MESHES: 0,
                UPDATE: function() { location.reload(); }
            },
            Download: {
                EXPORT_OBJ: async function () {
                    //await FILE.downloadSceneAsOBJ();
                },
                EXPORT_GLTF: async function () {
                    //await FILE.downloadSceneAsGLTF();
                },
                EXPORT_PLY: async function () {
                    //await FILE.downloadSceneAsPLY();
                },
                EXPORT_JSON: async function () {
                    //await FILE.downloadSceneAsJSON();
                }
            },
            ColorSettings: {
                COLOR_MODE: 0
            },
            FXAASettings: {
                enabled: true,
                minEdgeThreshold: 0.0312,
                maxEdgeThreshold: 0.125,
                subpixelQuality: 0.75
            }
        };
    }

    onStart() {
        this.GUI = new THREEGUI.GUI();
        this.CAMERA_SETTINGS = this.GUI.addFolder( 'Camera' );
        this.LOCATION_SETTINGS = this.GUI.addFolder( 'Location' );
        this.RENDERER_SETTINGS = this.GUI.addFolder( 'Render' );
        this.DOWNLOAD = this.GUI.addFolder( 'Download' );
        this.COLOR_SETTINGS = this.GUI.addFolder( 'Color modes' );
        this.FXAA_SETTINGS_FOLDER = this.GUI.addFolder( 'FXAA (Anti-Aliasing)' );

        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_X' ).onChange(newXPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("xpos");
        }).listen().onChange(newXPos => {this.CCONFIG.setConfigValue("xpos", newXPos);}).name("Camera X");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_Y' ).onChange(newYPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("ypos");
        }).listen().onChange(newYPos => {this.CCONFIG.setConfigValue("ypos", newYPos);}).name("Camera Y");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_Z' ).onChange(newZPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("zpos");
        }).listen().onChange(newZPos => {this.CCONFIG.setConfigValue("zpos", newZPos);}).name("Camera Z");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_YAW', 0, 360 ).onChange(newYaw => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("yaw");
        }).listen().name("Camera Yaw");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_PITCH', -90, 90 ).onChange(newPitch=> {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("pitch");
        }).listen().name("Camera Pitch");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_FOV', 10, 120 ).onChange(newFov => {
            this.CCONFIG.setConfigValue("fov", newFov);
        }).listen().name("Camera Fov");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_NEAR', 0.1, 100 ).onChange(newNear => {
            this.CCONFIG.setConfigValue("near", newNear);
        }).listen().name("Camera Near");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_FAR', 100, 20000 ).onChange(newFar => {
            this.CCONFIG.setConfigValue("far", newFar);
        }).listen().name("Camera Far");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_SPEED', 0.01, 10 ).onChange(moveSpeed => {
            this.CCONFIG.setConfigValue("movespeed", moveSpeed);
        }).listen().name("Camera Move Speed");
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'MOUSE_SENSITIVITY', 0.001, 0.01 ).onChange(mouseSensitivity => {
            this.CCONFIG.setConfigValue("mousesensitivity", mouseSensitivity);
        }).listen().name("Camera Mouse Sensitivity");

        this.CAMERA_SETTINGS.open();


        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'LATITUDE' ).onChange(v => {
            this.LOCATION_SETTINGS.LONGITUDE = this.CCONFIG.getConfigValue("latitude");
        }).listen().name("Latitude");
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'LONGITUDE' ).onChange(v => {
            this.LOCATION_SETTINGS.LONGITUDE = this.CCONFIG.getConfigValue("longitude");
        }).listen().name("Longitude");
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'RADIUS' ).onChange(v => {
            this.LOCATION_SETTINGS.RADIUS = this.CCONFIG.getConfigValue("radius");
        }).listen().name("Radius (m)");

        this.LOCATION_SETTINGS.open();


        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'FPS' ).listen().name("FPS");
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'CYCLES' ).listen().name("Render Cycles");
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'MESHES' ).listen().name("Mesh Count (BROKEN)");
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'DEBUG' ).onChange( v => {
            this.CCONFIG.setConfigValue("debug", v);
        }).listen().name("Debug");
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'UPDATE' ).listen().name("Reload Page");

        this.RENDERER_SETTINGS.open();


        this.GUI_PARAMS.ColorSettings.COLOR_MODE = parseInt(this.CCONFIG.getConfigValue("colormode"));
        this.COLOR_SETTINGS.add(this.GUI_PARAMS.ColorSettings, 'COLOR_MODE', [0, 1, 2]).onChange(v => {
            this.CCONFIG.setConfigValue("colormode", v);
        }).name("Color Mode");

        this.COLOR_SETTINGS.open();


        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_OBJ' ).name("Export as OBJ");
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_GLTF' ).name("Export as GLTF");
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_PLY' ).name("Export as PLY");
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_JSON').name("Export as JSON");

        this.DOWNLOAD.close()

        // FXAA Settings
        this.GUI_PARAMS.FXAASettings.enabled = FXAA_SETTINGS.enabled;
        this.GUI_PARAMS.FXAASettings.minEdgeThreshold = FXAA_SETTINGS.minEdgeThreshold;
        this.GUI_PARAMS.FXAASettings.maxEdgeThreshold = FXAA_SETTINGS.maxEdgeThreshold;
        this.GUI_PARAMS.FXAASettings.subpixelQuality = FXAA_SETTINGS.subpixelQuality;

        this.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'enabled').onChange(v => {
            FXAA_SETTINGS.enabled = v;
        }).name('Enable FXAA');

        this.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'minEdgeThreshold', 0.0, 1.0, 0.001).onChange(v => {
            FXAA_SETTINGS.minEdgeThreshold = v;
        }).name('Min Edge Threshold');

        this.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'maxEdgeThreshold', 0.0, 1.0, 0.001).onChange(v => {
            FXAA_SETTINGS.maxEdgeThreshold = v;
        }).name('Max Edge Threshold');

        this.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'subpixelQuality', 0.0, 1.0, 0.01).onChange(v => {
            FXAA_SETTINGS.subpixelQuality = v;
        }).name('Subpixel Quality');

        this.FXAA_SETTINGS_FOLDER.open();


        this.GUI_PARAMS.CameraSettings.CAMERA_X = this.CCONFIG.getConfigValue("xpos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_Y = this.CCONFIG.getConfigValue("ypos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_Z = this.CCONFIG.getConfigValue("zpos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_YAW = this.CCONFIG.getConfigValue("yaw").toFixed(2);
        this.GUI_PARAMS.CameraSettings.CAMERA_PITCH = this.CCONFIG.getConfigValue("pitch").toFixed(2);
        this.GUI_PARAMS.CameraSettings.CAMERA_FOV = this.CCONFIG.getConfigValue("fov").toFixed(0);
        this.GUI_PARAMS.CameraSettings.CAMERA_NEAR = this.CCONFIG.getConfigValue("near").toFixed(2);
        this.GUI_PARAMS.CameraSettings.CAMERA_FAR = this.CCONFIG.getConfigValue("far").toFixed(0);
        this.GUI_PARAMS.CameraSettings.CAMERA_SPEED = this.CCONFIG.getConfigValue("movespeed").toFixed(2);
        this.GUI_PARAMS.CameraSettings.MOUSE_SENSITIVITY = this.CCONFIG.getConfigValue("mousesensitivity").toFixed(5);

        this.GUI_PARAMS.LocationSettings.LATITUDE = this.CCONFIG.getConfigValue("latitude");
        this.GUI_PARAMS.LocationSettings.LONGITUDE = this.CCONFIG.getConfigValue("longitude");
        this.GUI_PARAMS.LocationSettings.RADIUS = this.CCONFIG.getConfigValue("radius");

        this.GUI_PARAMS.RendererSettings.FPS = 0
        this.GUI_PARAMS.RendererSettings.DEBUG = this.CCONFIG.getConfigValue("debug");
        this.GUI_PARAMS.RendererSettings.CYCLES = 0;
        this.GUI_PARAMS.RendererSettings.MESHES = 0;
    }

    onUpdate() {
        this.GUI_PARAMS.CameraSettings.CAMERA_X = this.CCONFIG.getConfigValue("xpos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_Y = this.CCONFIG.getConfigValue("ypos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_Z = this.CCONFIG.getConfigValue("zpos").toFixed(5);
        this.GUI_PARAMS.CameraSettings.CAMERA_YAW = this.CCONFIG.getConfigValue("yaw").toFixed(2);
        this.GUI_PARAMS.CameraSettings.CAMERA_PITCH = this.CCONFIG.getConfigValue("pitch").toFixed(2);
        this.GUI_PARAMS.CameraSettings.CAMERA_FOV = this.CCONFIG.getConfigValue("fov").toFixed(0);
        this.GUI_PARAMS.CameraSettings.CAMERA_NEAR = this.CCONFIG.getConfigValue("near").toFixed(0);
        this.GUI_PARAMS.CameraSettings.CAMERA_FAR = this.CCONFIG.getConfigValue("far").toFixed(0);
        this.GUI_PARAMS.CameraSettings.CAMERA_SPEED = this.CCONFIG.getConfigValue("movespeed").toFixed(2);
        this.GUI_PARAMS.CameraSettings.MOUSE_SENSITIVITY = this.CCONFIG.getConfigValue("mousesensitivity").toFixed(5);
        this.GUI_PARAMS.LocationSettings.LATITUDE = this.CCONFIG.getConfigValue("latitude");
        this.GUI_PARAMS.LocationSettings.LONGITUDE = this.CCONFIG.getConfigValue("longitude");
        this.GUI_PARAMS.LocationSettings.RADIUS = this.CCONFIG.getConfigValue("radius");
    }

    setCycles(cycles) {
        this.GUI_PARAMS.RendererSettings.CYCLES = cycles;
    }

    setFPS(fps) {
        this.GUI_PARAMS.RendererSettings.FPS = fps;
    }

    getMeshCount(SCENE) {
        console.log(SCENE)
        let meshCount = 0;
        SCENE.traverse((obj) => {
            if (obj.children) meshCount++;
        });
        this.GUI_PARAMS.RendererSettings.MESHES = meshCount;
    }
}