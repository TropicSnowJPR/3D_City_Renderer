import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

export class GUIController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager()
        this.GUI = null;
        this.CAMERA_SETTINGS = null;
        this.LOCATION_SETTINGS = null;
        this.RENDERER_SETTINGS = null;
        this.DOWNLOAD = null;
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
                DEBUG: false,
                CYCLES: 0,
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
            SecretSettings: {
                FOLLY_FEVER_MODE: false
            }
        };
    }

    onStart() {
        this.GUI = new THREEGUI.GUI();
        this.CAMERA_SETTINGS = this.GUI.addFolder( 'CAMERA' );
        this.LOCATION_SETTINGS = this.GUI.addFolder( 'LOCATION' );
        this.RENDERER_SETTINGS = this.GUI.addFolder( 'RENDERER' );
        this.DOWNLOAD = this.GUI.addFolder( 'DOWNLOAD' );
        this.SECRET_SETTINGS = this.GUI.addFolder( 'SECRET SETTINGS' );

        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_X' ).onChange(newXPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("xpos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_Y' ).onChange(newYPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("ypos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_Z' ).onChange(newZPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("zpos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_YAW', 0, 360 ).onChange(newYaw => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("yaw");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_PITCH', -90, 90 ).onChange(newPitch=> {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("pitch");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_FOV', 10, 120 ).onChange(newFov => {
            this.CCONFIG.setConfigValue("fov", newFov);
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_NEAR', 0.1, 100 ).onChange(newNear => {
            this.CCONFIG.setConfigValue("near", newNear);
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_FAR', 100, 20000 ).onChange(newFar => {
            this.CCONFIG.setConfigValue("far", newFar);
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA_SPEED', 0.01, 10 ).onChange(moveSpeed => {
            this.CCONFIG.setConfigValue("movespeed", moveSpeed);
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'MOUSE_SENSITIVITY', 0.001, 0.01 ).onChange(mouseSensitivity => {
            this.CCONFIG.setConfigValue("mousesensitivity", mouseSensitivity);
        }).listen();

        this.CAMERA_SETTINGS.open();


        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'LATITUDE' ).onChange(v => {
            this.LOCATION_SETTINGS.LONGITUDE = this.CCONFIG.getConfigValue("latitude");
        }).listen();
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'LONGITUDE' ).onChange(v => {
            this.LOCATION_SETTINGS.LONGITUDE = this.CCONFIG.getConfigValue("longitude");
        }).listen();
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'RADIUS', 100, 3000 ).onChange(v => {
            this.LOCATION_SETTINGS.RADIUS = this.CCONFIG.getConfigValue("radius");
        }).listen();

        this.LOCATION_SETTINGS.open();


        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'CYCLES' ).listen();
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'DEBUG' ).onChange( v => {
            this.CCONFIG.setConfigValue("debug", v);
        }).listen();
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'UPDATE' ).listen();

        this.RENDERER_SETTINGS.open();


        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_OBJ' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_GLTF' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_PLY' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'EXPORT_JSON')

        this.DOWNLOAD.close()

        this.GUI_PARAMS.SecretSettings.FOLLY_FEVER_MODE = this.CCONFIG.getConfigValue("follyFeverMode");
        this.SECRET_SETTINGS.add( this.GUI_PARAMS.SecretSettings, 'FOLLY_FEVER_MODE' ).onChange( v => {
            this.CCONFIG.setConfigValue("follyFeverMode", v);
        });

        this.SECRET_SETTINGS.close();


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

        this.GUI_PARAMS.RendererSettings.DEBUG = this.CCONFIG.getConfigValue("debug");
        this.GUI_PARAMS.RendererSettings.CYCLES = 0;
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
}