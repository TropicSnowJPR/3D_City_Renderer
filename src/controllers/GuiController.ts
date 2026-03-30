import { ConfigService } from "../services/ConfigService.js";
import * as THREEGUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import {FileService} from "../services/FileService.js";

const FILE = new FileService();


/**
 *
 */
const reloadPage = function reloadPage(): void {
  location.reload()
}


/**
 *
 * @constructor
 */
const EXPORT_GLTF = function EXPORT_GLTF(): void {
  FILE.downloadSceneAsGLTF();
}


/**
 *
 * @constructor
 */
const EXPORT_OBJ = function EXPORT_OBJ(): void {
  FILE.downloadSceneAsOBJ();
}


/**
 *
 * @constructor
 */
const EXPORT_PLY = function EXPORT_PLY(): void {
  FILE.downloadSceneAsPLY();
}



export class GuiController {
  private CCONFIG: ConfigService;
  private GUI: THREEGUI.GUI;
  private CAMERA_SETTINGS: THREEGUI.GUI;
  private LOCATION_SETTINGS: THREEGUI.GUI;
  private RENDERER_SETTINGS: THREEGUI.GUI;
  private DOWNLOAD: THREEGUI.GUI;
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
    LocationSettings: { LATITUDE: number; LONGITUDE: number; RADIUS: number };
    RendererSettings: {
      FPS: number;
      DEBUG: boolean;
      CYCLES: number;
      MESHES: number;
      UPDATE: () => void;
    };
    Download: {
      EXPORT_OBJ: () => void;
      EXPORT_GLTF: () => void;
      EXPORT_PLY: () => void;
    };
    ColorSettings: { COLOR_MODE: number };
  };
  private DEFAULT_POS_FRACTION_DIGITS: number;
  private DEFAULT_YAW_PITCH_FRACTION_DIGITS: number;
  private DEFAULT_FOV_FRACTION_DIGITS: number;
  private DEFAULT_NEAR_FAR_FRACTION_DIGITS: number;
  private DEFAULT_CAMERA_SPEED_FRACTION_DIGITS: number;
  private DEFAULT_MOUSE_SENSITIVITY_FRACTION_DIGITS: number;
  private DEFAULT_DEBUG_FALSE: number;
  private DEFAULT_DEBUG_TRUE: number;
  private MAX_MOUSESENSITIVITY: number;
  private MIN_MOUSESENSITIVITY: number;
  private MAX_CAMERA_SPEED: number;
  private MIN_CAMERA_SPEED: number;
  private MAX_FAR: number;
  private MIN_FAR: number;
  private MAX_NEAR: number;
  private MIN_NEAR: number;
  private MAX_FOV: number;
  private MIN_FOV: number;
  private MAX_PITCH: number;
  private MIN_PITCH: number;
  private MAX_YAW: number;
  private MIN_YAW: number;

  /**
   *
   */
  constructor() {
    this.CCONFIG = new ConfigService();
    this.GUI = new THREEGUI.GUI();
    this.CAMERA_SETTINGS = this.GUI;
    this.LOCATION_SETTINGS = this.GUI;
    this.RENDERER_SETTINGS = this.GUI;
    this.DOWNLOAD = this.GUI;
    // Central object bound to lil-gui controls. Values are synchronized with ConfigService in onUpdate() and onChange() callbacks.
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
      ColorSettings: { COLOR_MODE: 0 },
      Download: {
        EXPORT_GLTF: EXPORT_GLTF,
        EXPORT_OBJ: EXPORT_OBJ,
        EXPORT_PLY: EXPORT_PLY,
      },
      LocationSettings: { LATITUDE: 0, LONGITUDE: 0, RADIUS: 0 },
      RendererSettings: {
        CYCLES: 0,
        DEBUG: false,
        FPS: 0,
        MESHES: 0,
        UPDATE: reloadPage
      },
    };
    // Default display precision and allowed ranges for all GUI-controlled values
    this.DEFAULT_POS_FRACTION_DIGITS = 5
    this.DEFAULT_YAW_PITCH_FRACTION_DIGITS = 2
    this.DEFAULT_FOV_FRACTION_DIGITS = 0
    this.DEFAULT_NEAR_FAR_FRACTION_DIGITS = 2
    this.DEFAULT_CAMERA_SPEED_FRACTION_DIGITS = 2
    this.DEFAULT_MOUSE_SENSITIVITY_FRACTION_DIGITS = 5
    this.DEFAULT_POS_FRACTION_DIGITS = 2
    this.DEFAULT_DEBUG_FALSE = 0
    this.DEFAULT_DEBUG_TRUE = 1
    this.MAX_MOUSESENSITIVITY = 0.01
    this.MIN_MOUSESENSITIVITY = 0.001
    this.MAX_CAMERA_SPEED = 10
    this.MIN_CAMERA_SPEED = 0.01
    this.MAX_FAR = 20_000
    this.MIN_FAR = 100
    this.MAX_NEAR = 100
    this.MIN_NEAR = 0.1
    this.MAX_FOV = 120
    this.MIN_FOV = 10
    this.MAX_PITCH = 90
    this.MIN_PITCH = -90
    this.MAX_YAW = 360
    this.MIN_YAW = 0
  }


  /**
   *
   */
  init(): void {
    this.CAMERA_SETTINGS = this.GUI.addFolder("Camera");
    this.LOCATION_SETTINGS = this.GUI.addFolder("Location");
    this.RENDERER_SETTINGS = this.GUI.addFolder("Render");
    this.COLOR_SETTINGS = this.GUI.addFolder("Color modes");
    this.DOWNLOAD = this.GUI.addFolder('Download');

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
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_YAW", this.MIN_YAW, this.MAX_YAW)
      .listen()
      .onChange((newYaw) => {
        this.CCONFIG.setConfigValue("yaw", newYaw);
      })
      .name("Camera Yaw");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_PITCH", this.MIN_PITCH, this.MAX_PITCH)
      .listen()
      .onChange((newPitch) => {
        this.CCONFIG.setConfigValue("pitch", newPitch);
      })
      .name("Camera Pitch");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_FOV", this.MIN_FOV, this.MAX_FOV)
      .listen()
      .onChange((newFov) => {
        this.CCONFIG.setConfigValue("fov", newFov);
      })
      .name("Camera Fov");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_NEAR", this.MIN_NEAR, this.MAX_NEAR)
      .listen()
      .onChange((newNear) => {
        this.CCONFIG.setConfigValue("near", newNear);
      })
      .name("Camera Near");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_FAR", this.MIN_FAR, this.MAX_FAR)
      .listen()
      .onChange((newFar) => {
        this.CCONFIG.setConfigValue("far", newFar);
      })
      .name("Camera Far");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "CAMERA_SPEED", this.MIN_CAMERA_SPEED, this.MAX_CAMERA_SPEED)
      .listen()
      .onChange((moveSpeed) => {
        this.CCONFIG.setConfigValue("movespeed", moveSpeed);
      })
      .name("Camera Move Speed");
    this.CAMERA_SETTINGS.add(this.GUI_PARAMS.CameraSettings, "MOUSE_SENSITIVITY", this.MIN_MOUSESENSITIVITY, this.MAX_MOUSESENSITIVITY)
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

    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "FPS").listen().name("FPS");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "CYCLES")
      .listen()
      .name("Render Cycles");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "MESHES")
      .listen()
      .name("Mesh Count");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "DEBUG")
      .onChange((debug) => {
        if (debug) {
          this.CCONFIG.setConfigValue("debug", this.DEFAULT_DEBUG_TRUE);
        } else {
          this.CCONFIG.setConfigValue("debug", this.DEFAULT_DEBUG_FALSE);
        }
      })
      .listen()
      .name("Debug");
    this.RENDERER_SETTINGS.add(this.GUI_PARAMS.RendererSettings, "UPDATE")
      .listen()
      .name("Reload Page");

    this.RENDERER_SETTINGS.open();

    this.GUI_PARAMS.ColorSettings.COLOR_MODE = this.CCONFIG.getConfigValue("colormode") as number;
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

    this.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_OBJ').name("Export as OBJ");
    this.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_GLTF').name("Export as GLTF");
    this.DOWNLOAD.add(this.GUI_PARAMS.Download, 'EXPORT_PLY').name("Export as PLY");

    this.DOWNLOAD.close()

    this.onUpdate()

    this.GUI_PARAMS.RendererSettings.FPS = 0;
    this.GUI_PARAMS.RendererSettings.DEBUG = Boolean(this.CCONFIG.getConfigValue("debug"));
    this.GUI_PARAMS.RendererSettings.CYCLES = 0;
    this.GUI_PARAMS.RendererSettings.MESHES = 0;
  }


  /**
   *
   */
  onUpdate(): void {
    this.GUI_PARAMS.CameraSettings.CAMERA_X = Number(
      (this.CCONFIG.getConfigValue("xpos") as number).toFixed(this.DEFAULT_POS_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Y = Number(
      (this.CCONFIG.getConfigValue("ypos") as number).toFixed(this.DEFAULT_POS_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_Z = Number(
      (this.CCONFIG.getConfigValue("zpos") as number).toFixed(this.DEFAULT_POS_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_YAW = Number(
      (this.CCONFIG.getConfigValue("yaw") as number).toFixed(this.DEFAULT_YAW_PITCH_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_PITCH = Number(
      (this.CCONFIG.getConfigValue("pitch") as number).toFixed(this.DEFAULT_YAW_PITCH_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FOV = Number(
      (this.CCONFIG.getConfigValue("fov") as number).toFixed(this.DEFAULT_FOV_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_NEAR = Number(
      (this.CCONFIG.getConfigValue("near") as number).toFixed(this.DEFAULT_NEAR_FAR_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_FAR = Number(
      (this.CCONFIG.getConfigValue("far") as number).toFixed(this.DEFAULT_NEAR_FAR_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.CAMERA_SPEED = Number(
      (this.CCONFIG.getConfigValue("movespeed") as number).toFixed(this.DEFAULT_CAMERA_SPEED_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.CameraSettings.MOUSE_SENSITIVITY = Number(
      (this.CCONFIG.getConfigValue("mousesensitivity") as number).toFixed(this.DEFAULT_MOUSE_SENSITIVITY_FRACTION_DIGITS),
    );
    this.GUI_PARAMS.LocationSettings.LATITUDE = this.CCONFIG.getConfigValue("latitude") as number;
    this.GUI_PARAMS.LocationSettings.LONGITUDE = this.CCONFIG.getConfigValue("longitude") as number;
    this.GUI_PARAMS.LocationSettings.RADIUS = this.CCONFIG.getConfigValue("radius") as number;
  }


  /**
   *
   * @param cycles - :number
   */
  setCycles(cycles: number): void {
    this.GUI_PARAMS.RendererSettings.CYCLES = cycles;
  }


  /**
   *
   * @param fps - :number
   */
  setFPS(fps: number): void {
    this.GUI_PARAMS.RendererSettings.FPS = fps;
  }
}
