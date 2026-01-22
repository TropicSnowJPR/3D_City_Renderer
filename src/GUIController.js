import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import GUI from "lil-gui";

export class GUIController {
    constructor(CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.GUI = null;
        this.CAMERA_SETTINGS = null;
        this.LOCATION_SETTINGS = null;
        this.RENDERER_SETTINGS = null;
        this.DOWNLOAD = null;
        this.GUI_PARAMS = {
            CameraSettings: {
                moveSpeed: 0,
                mouseSensitivity: 0,
                x: 0,
                y: 0,
                z: 0,
                yaw: 0,
                pitch: 0,
            },
            LocationSettings: {
                latitude: 0,
                longitude: 0,
                radius: 0,
            },
            RendererSettings: {
                debug: false,
                renderTicks: 0,
                update: function() { location.reload(); }
            },
            Download: {
                exportOBJ: async function () {
                    //await FILE.downloadSceneAsOBJ();
                },
                exportGLTF: async function () {
                    //await FILE.downloadSceneAsGLTF();
                },
                exportPLY: async function () {
                    //await FILE.downloadSceneAsPLY();
                },
                exportJOSN: async function () {
                    //await FILE.downloadSceneAsJSON();
                }
            }
        };
    }

    onStart() {
        this.GUI = new THREEGUI.GUI();
        this.CAMERA_SETTINGS = this.GUI.addFolder( 'CAMERA' );
        this.LOCATION_SETTINGS = this.GUI.addFolder( 'LOCATION' );
        this.RENDERER_SETTINGS = this.GUI.addFolder( 'RENDERER' );
        this.DOWNLOAD = this.GUI.addFolder( 'DOWNLOAD' );

        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA X' ).onChange(newXPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("xpos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA Y' ).onChange(newYPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("ypos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'CAMERA Z' ).onChange(newZPos => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("zpos");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'yaw', 0, 360 ).onChange(newYaw => {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("yaw");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'pitch', -90, 90 ).onChange(newPitch=> {
            this.CAMERA_SETTINGS = this.CCONFIG.getConfigValue("pitch");
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'moveSpeed', 0.01, 10 ).onChange(moveSpeed => {
            this.CCONFIG.setConfigValue("movespeed", moveSpeed);
        }).listen();
        this.CAMERA_SETTINGS.add( this.GUI_PARAMS.CameraSettings, 'mouseSensitivity', 0.001, 0.01 ).onChange(mouseSensitivity => {
            this.CCONFIG.setConfigValue("mousesensitivity", mouseSensitivity);
        }).listen();

        this.CAMERA_SETTINGS.open();


        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'latitude' ).onChange(v => {
            this.LOCATION_SETTINGS = this.CCONFIG.getConfigValue("latitude");
        }).listen();
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'longitude' ).onChange(v => {
            this.LOCATION_SETTINGS = this.CCONFIG.getConfigValue("longitude");
        }).listen();
        this.LOCATION_SETTINGS.add( this.GUI_PARAMS.LocationSettings, 'radius', 100, 3000 ).onChange(v => {
            this.LOCATION_SETTINGS = this.CCONFIG.getConfigValue("radius");
        }).listen();

        this.LOCATION_SETTINGS.open();


        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'cycles' ).listen();
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'debug' ).onChange( v => {
            this.CCONFIG.setConfigValue("debug", v);
        }).listen();
        this.RENDERER_SETTINGS.add( this.GUI_PARAMS.RendererSettings, 'update' ).listen();

        this.RENDERER_SETTINGS.open();


        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'exportOBJ' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'exportGLTF' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'exportPLY' );
        this.DOWNLOAD.add( this.GUI_PARAMS.Download, 'exportJOSN')

        this.DOWNLOAD.close()
    }
}