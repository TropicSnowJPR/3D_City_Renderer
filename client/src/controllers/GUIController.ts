import * as THREEGUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { ConfigService } from "../services/ConfigService.js";

export class GUIController {
  private CCONFIG: ConfigService;
  private GUI: THREEGUI.GUI;
  private CAMERA_SETTINGS: THREEGUI.GUI;
  private LOCATION_SETTINGS: THREEGUI.GUI;
  private RENDERER_SETTINGS: THREEGUI.GUI;
  private DOWNLOAD: THREEGUI.GUI;
  private FXAA_SETTINGS_FOLDER: THREEGUI.GUI;
  private COLOR_SETTINGS: THREEGUI.GUI | undefined;
  private readonly GUI_PARAMS: {
    CameraSettings: {
      CAMERA_SPEED: number;
      MOUSE_SENSITIVITY: number;
      CAMERA_X: number;
      CAMERA_Y: number;
      CAMERA_Z: number;
      CAMERA_YAW: number;
      CAMERA_PITCH: number;
      CAMERA_FOV: number;
      CAMERA_FAR: number;
      CAMERA_NEAR: number;
    };
    LocationSettings: {
      LATITUDE: number;
      LONGITUDE: number;
      RADIUS: number;
    };
    RendererSettings: {
      FPS: number;
      DEBUG: boolean;
      CYCLES: number;
      MESHES: number;
      UPDATE: () => void;
    };
    Download: {
      EXPORT_OBJ: () => Promise<void>;
      EXPORT_GLTF: () => Promise<void>;
      EXPORT_PLY: () => Promise<void>;
      EXPORT_JSON: () => Promise<void>;
    };
    ColorSettings: { COLOR_MODE: number };
    FXAASettings: {
      enabled: boolean;
      minEdgeThreshold: number;
      maxEdgeThreshold: number;
      subpixelQuality: number;
    };
  };

  constructor() {
    this.CCONFIG = new ConfigService();
    this.GUI = new THREEGUI.GUI();
    this.CAMERA_SETTINGS = this.GUI;
    this.LOCATION_SETTINGS = this.GUI;
    this.RENDERER_SETTINGS = this.GUI;
    this.DOWNLOAD = this.GUI;
    this.FXAA_SETTINGS_FOLDER = this.GUI;
    this.GUI_PARAMS = {
      CameraSettings: {
        CAMERA_FAR: 0,
        CAMERA_FOV: 0,
        CAMERA_NEAR: 0,
        CAMERA_PITCH: 0,
        CAMERA_SPEED: 0,
        CAMERA_X: 0,
        CAMERA_Y: 0,
        CAMERA_YAW: 0,
        CAMERA_Z: 0,
        MOUSE_SENSITIVITY: 0,
      },
      ColorSettings: {
        COLOR_MODE: 0,
      },
      Download: {
        EXPORT_GLTF: async function () {
          //await FILE.downloadSceneAsGLTF();
        },
        EXPORT_JSON: async function () {
          //await FILE.downloadSceneAsJSON();
        },
        EXPORT_OBJ: async function () {
          //await FILE.downloadSceneAsOBJ();
        },
        EXPORT_PLY: async function () {
          //await FILE.downloadSceneAsPLY();
        },
      },
      FXAASettings: {
        enabled: false,
        maxEdgeThreshold: 0.125,
        minEdgeThreshold: 0.0312,
        subpixelQuality: 0.75,
      },
      LocationSettings: {
        LATITUDE: 0,
        LONGITUDE: 0,
        RADIUS: 0,
      },
      RendererSettings: {
        CYCLES: 0,
        DEBUG: false,
        FPS: 0,
        MESHES: 0,
        UPDATE: function () {
          location.reload();
        },
      },
    };
  }

  onStart() {
    this.CAMERA_SETTINGS = this.GUI.addFolder("Camera");
    this.LOCATION_SETTINGS = this.GUI.addFolder("Location");
    this.RENDERER_SETTINGS = this.GUI.addFolder("Render");
    // This.FXAA_SETTINGS_FOLDER = this.GUI.addFolder('FXAA (Anti-Aliasing)');
    this.COLOR_SETTINGS = this.GUI.addFolder("Color modes");
    // This.DOWNLOAD = this.GUI.addFolder('Download');

    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_X")
      .listen()
      .onChange((newXPos) => {
        this.CCONFIG.setConfigValue("xpos", newXPos);
      })
      .name("Camera X");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_Y")
      .listen()
      .onChange((newYPos) => {
        this.CCONFIG.setConfigValue("ypos", newYPos);
      })
      .name("Camera Y");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_Z")
      .listen()
      .onChange((newZPos) => {
        this.CCONFIG.setConfigValue("zpos", newZPos);
      })
      .name("Camera Z");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_YAW",
      0,
      360,
    )
      .listen()
      .onChange((newYaw) => {
        this.CCONFIG.setConfigValue("yaw", newYaw);
      })
      .name("Camera Yaw");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_PITCH",
      -90,
      90,
    )
      .listen()
      .onChange((newPitch) => {
        this.CCONFIG.setConfigValue("pitch", newPitch);
      })
      .name("Camera Pitch");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_FOV",
      10,
      120,
    )
      .listen()
      .onChange((newFov) => {
        this.CCONFIG.setConfigValue("fov", newFov);
      })
      .name("Camera Fov");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_NEAR",
      0.1,
      100,
    )
      .listen()
      .onChange((newNear) => {
        this.CCONFIG.setConfigValue("near", newNear);
      })
      .name("Camera Near");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_FAR",
      100,
      20_000,
    )
      .listen()
      .onChange((newFar) => {
        this.CCONFIG.setConfigValue("far", newFar);
      })
      .name("Camera Far");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "CAMERA_SPEED",
      0.01,
      10,
    )
      .listen()
      .onChange((moveSpeed) => {
        this.CCONFIG.setConfigValue("movespeed", moveSpeed);
      })
      .name("Camera Move Speed");
    this.CAMERA_SETTINGS.add(
      this.GUI_PARAMS.CameraSettings,
      "MOUSE_SENSITIVITY",
      0.001,
      0.01,
    )
      .listen()
      .onChange((mouseSensitivity) => {
        this.CCONFIG.setConfigValue("mousesensitivity", mouseSensitivity);
      })
      .name("Camera Mouse Sensitivity");

    this.CAMERA_SETTINGS.open();

    this.LOCATION_SETTINGS.add(this.GUI_PARAMS.LocationSettings, "LATITUDE")
      .listen()
      .name("Latitude");
    this.LOCATION_SETTINGS.add(this.GUI_PARAMS.LocationSettings, "LONGITUDE")
      .listen()
      .name("Longitude");
    this.LOCATION_SETTINGS.add(this.GUI_PARAMS.LocationSettings, "RADIUS")
      .listen()
      .name("Radius (m)");

    this.LOCATION_SETTINGS.open();

    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "FPS")
      .listen()
      .name("FPS");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "CYCLES")
      .listen()
      .name("Render Cycles");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "MESHES")
      .listen()
      .name("Mesh Count");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "DEBUG")
      .onChange((debug) => {
        if (debug) {
          this.CCONFIG.setConfigValue("debug", 1);
        } else {
          this.CCONFIG.setConfigValue("debug", 0);
        }
      })
      .listen()
      .name("Debug");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "UPDATE")
      .listen()
      .name("Reload Page");

    this.RENDERER_SETTINGS.open();

    this.GUI_PARAMS.ColorSettings.COLOR_MODE =
      this.CCONFIG.getConfigValue("colormode");
    this.COLOR_SETTINGS.add(this.GUI_PARAMS.ColorSettings, "COLOR_MODE", {
      Dark: 1,
      Light: 0,
      Special: 2,
    })
      .onChange((colormode) => {
        this.CCONFIG.setConfigValue("colormode", colormode);
      })
      .name("Color Mode");

    this.COLOR_SETTINGS.open();

    // This.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_OBJ').name("Export as OBJ");
    // This.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_GLTF').name("Export as GLTF");
    // This.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_PLY').name("Export as PLY");
    // This.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_JSON').name("Export as JSON");

    // This.DOWNLOAD.close()

    // This.GUI_PARAMS.FXAASettings.enabled = FXAA_SETTINGS.enabled;
    // This.GUI_PARAMS.FXAASettings.minEdgeThreshold = FXAA_SETTINGS.minEdgeThreshold;
    // This.GUI_PARAMS.FXAASettings.maxEdgeThreshold = FXAA_SETTINGS.maxEdgeThreshold;
    // This.GUI_PARAMS.FXAASettings.subpixelQuality = FXAA_SETTINGS.subpixelQuality;
    //
    // This.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'enabled').onChange(v => {
    //     FXAA_SETTINGS.enabled = v;
    // }).name('Enable FXAA');
    //
    // This.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'minEdgeThreshold', 0.0, 1.0, 0.001).onChange(v => {
    //     FXAA_SETTINGS.minEdgeThreshold = v;
    // }).name('Min Edge Threshold');
    //
    // This.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'maxEdgeThreshold', 0.0, 1.0, 0.001).onChange(v => {
    //     FXAA_SETTINGS.maxEdgeThreshold = v;
    // }).name('Max Edge Threshold');
    //
    // This.FXAA_SETTINGS_FOLDER.add(this.GUI_PARAMS.FXAASettings, 'subpixelQuality', 0.0, 1.0, 0.01).onChange(v => {
    //     FXAA_SETTINGS.subpixelQuality = v;
    // }).name('Subpixel Quality');
    //
    // This.FXAA_SETTINGS_FOLDER.open();

    this.GUI_PARAMS.CameraSettings.CAMERA_X = Number(
      this.CCONFIG.getConfigValue("xpos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Y = Number(
      this.CCONFIG.getConfigValue("ypos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Z = Number(
      this.CCONFIG.getConfigValue("zpos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_YAW = Number(
      this.CCONFIG.getConfigValue("yaw").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_PITCH = Number(
      this.CCONFIG.getConfigValue("pitch").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FOV = Number(
      this.CCONFIG.getConfigValue("fov").toFixed(0),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_NEAR = Number(
      this.CCONFIG.getConfigValue("near").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FAR = Number(
      this.CCONFIG.getConfigValue("far").toFixed(0),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_SPEED = Number(
      this.CCONFIG.getConfigValue("movespeed").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.MOUSE_SENSITIVITY = Number(
      this.CCONFIG.getConfigValue("mousesensitivity").toFixed(5),
    );

    this.GUI_PARAMS.LocationSettings.LATITUDE =
      this.CCONFIG.getConfigValue("latitude");
    this.GUI_PARAMS.LocationSettings.LONGITUDE =
      this.CCONFIG.getConfigValue("longitude");
    this.GUI_PARAMS.LocationSettings.RADIUS =
      this.CCONFIG.getConfigValue("radius");

    this.GUI_PARAMS.RendererSettings.FPS = 0;
    this.GUI_PARAMS.RendererSettings.DEBUG = Boolean(
      this.CCONFIG.getConfigValue("debug"),
    );
    this.GUI_PARAMS.RendererSettings.CYCLES = 0;
    this.GUI_PARAMS.RendererSettings.MESHES = 0;
  }

  onUpdate() {
    this.GUI_PARAMS.CameraSettings.CAMERA_X = Number(
      this.CCONFIG.getConfigValue("xpos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Y = Number(
      this.CCONFIG.getConfigValue("ypos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Z = Number(
      this.CCONFIG.getConfigValue("zpos").toFixed(5),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_YAW = Number(
      this.CCONFIG.getConfigValue("yaw").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_PITCH = Number(
      this.CCONFIG.getConfigValue("pitch").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FOV = Number(
      this.CCONFIG.getConfigValue("fov").toFixed(0),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_NEAR = Number(
      this.CCONFIG.getConfigValue("near").toFixed(0),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FAR = Number(
      this.CCONFIG.getConfigValue("far").toFixed(0),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_SPEED = Number(
      this.CCONFIG.getConfigValue("movespeed").toFixed(2),
    );
    this.GUI_PARAMS.CameraSettings.MOUSE_SENSITIVITY = Number(
      this.CCONFIG.getConfigValue("mousesensitivity").toFixed(5),
    );
    this.GUI_PARAMS.LocationSettings.LATITUDE =
      this.CCONFIG.getConfigValue("latitude");
    this.GUI_PARAMS.LocationSettings.LONGITUDE =
      this.CCONFIG.getConfigValue("longitude");
    this.GUI_PARAMS.LocationSettings.RADIUS =
      this.CCONFIG.getConfigValue("radius");
  }

  setCycles(cycles: number) {
    this.GUI_PARAMS.RendererSettings.CYCLES = cycles;
  }

  setFPS(fps: number) {
    this.GUI_PARAMS.RendererSettings.FPS = fps;
  }
}
