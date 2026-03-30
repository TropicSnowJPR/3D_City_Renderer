import { CameraController } from "../controllers/CameraController.js";
import { GuiController } from "../controllers/GuiController.js";
import { MapController } from "../controllers/MapController.js";
import * as CONFIG from "../services/ConfigService.js";
import { APP_VERSION } from "./Version.js";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import {
  createAmbientLight,
  createBaseplate,
  createDirectionalLight,
  createHemisphereLight,
  createSkybox
} from "./SceneElements.js";

document.title = `3D Map Generator ${APP_VERSION}`;


/**
 * The App class is the main entry point of the 3D Map Generator application. It initializes the Three.js scene, renderer, camera controller, GUI controller, and map controller. It also handles the loading of scene geometry in a separate worker thread to keep the UI responsive. The render loop is set up to update the camera and GUI controllers and render the scene using either the EffectComposer or the WebGLRenderer.
 */
class App {
  public readonly SCENE: THREE.Scene;
  private readonly RENDERER: THREE.WebGLRenderer;
  private readonly CCONFIG: CONFIG.ConfigService;
  private readonly COMPOSER: EffectComposer;
  private readonly CAMERA_CONTROLLER: CameraController;
  private readonly GUI_CONTROLLER: GuiController;
  private readonly MAP_CONTROLLER: MapController;
  private OBJECT_CONFIG: Response;
  private FRAME_TIMES: number[];
  private COLOR_MODE: number | string;
  private RADIUS: number;
  private FPS: number;
  private SCENE_WORKER: Worker | undefined;

  constructor() {
    this.SCENE = new THREE.Scene();
    this.RENDERER = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      precision: "highp",
    });
    // CCONFIG is used to access localstorage on the client side
    this.CCONFIG = new CONFIG.ConfigService();
    this.COMPOSER = new EffectComposer(this.RENDERER);
    this.CAMERA_CONTROLLER = new CameraController(this.RENDERER);
    this.GUI_CONTROLLER = new GuiController();
    this.MAP_CONTROLLER = new MapController();
    // Raw fetch response containing scene object rendering configuration
    this.OBJECT_CONFIG = new Response();
    // Store timestamps from the last second to calculate FPS dynamically
    this.FRAME_TIMES = [];
    this.COLOR_MODE = 0;
    this.RADIUS = 0;
    this.FPS = 0;
    this.SCENE_WORKER = undefined;
  }

  /**
   * Initializes the application by setting up the scene, renderer, camera controller, GUI controller, and map controller. It also loads the scene geometry in a separate worker thread and finalizes the initialization once the scene is fully loaded. The render loop is started to continuously update and render the scene.
   */
  async init(): Promise<void> {
    this.CCONFIG.fixAndValidateConfig();
    // Get the config of the scene objects from the server, which is used to determine how to render the different map features
    this.OBJECT_CONFIG = await fetch("/api/config");
    // Get the color mode that should be chosen from the OBJECT_CONFIG
    this.COLOR_MODE = this.CCONFIG.getConfigValue("colormode");

    await this.MAP_CONTROLLER.init();
    await this.MAP_CONTROLLER.waitUntilFinished();

    // Update the map radius that was saved to localStorage by the MapController after map loading is complete
    this.RADIUS = this.CCONFIG.getConfigValue("radius") as number;

    this.CAMERA_CONTROLLER.init();

    document.body.append(this.RENDERER.domElement);
    this.RENDERER.sortObjects = true;
    this.RENDERER.shadowMap.enabled = true;
    this.RENDERER.shadowMap.type = THREE.PCFSoftShadowMap;
    this.RENDERER.autoClear = false;
    this.RENDERER.setPixelRatio(window.devicePixelRatio);
    this.RENDERER.setSize(window.innerWidth, window.innerHeight);
    this.RENDERER.setClearColor(0x3A_3A_3D, 1);
    this.RENDERER.setAnimationLoop(this.renderLoop.bind(this));

    // Replace default raycasting with BVH-accelerated raycasting for much faster object intersection tests
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;

    if (this.CCONFIG.getConfigValue("colormode") === 1) {
      this.SCENE.add(createBaseplate(this.RADIUS, 0x1C_1C_1E));
      this.SCENE.add(createSkybox(this.RADIUS, 0x1C_1C_1E));
    } else if (this.CCONFIG.getConfigValue("colormode") === 2) {
      this.SCENE.add(createBaseplate(this.RADIUS, 0x0B_0B_0D));
      this.SCENE.add(createSkybox(this.RADIUS, 0x0B_0B_0D));
    } else {
      this.SCENE.add(createBaseplate(this.RADIUS, 0xD3_D3_D3));
      this.SCENE.add(createSkybox(this.RADIUS, 0x87_CE_EB));
    }
    
    this.SCENE.add(createAmbientLight());
    this.SCENE.add(createDirectionalLight(this.RADIUS));
    this.SCENE.add(createHemisphereLight());

    const renderPass = new RenderPass(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
    this.COMPOSER.addPass(renderPass);

    this.COMPOSER.setSize(window.innerWidth, window.innerHeight);

    await this.loadScene()
  }


  /**
   * Loads the scene geometry in a separate worker thread to avoid freezing the UI. The worker is responsible for building the heavy scene geometry based on the map data and object configuration. The main thread listens for messages from the worker and adds the loaded meshes to the scene.
   * @private
   */
  private async loadScene(): Promise<void> {

    // Load and build the heavy scene geometry in a separate thread to avoid freezing the UI
    this.SCENE_WORKER = new Worker(new URL("../controllers/SceneController.js", import.meta.url), {
      type: "module",
    });


    // Listen for messages from the WORKER
    this.SCENE_WORKER.addEventListener("message", (EVENT: MessageEvent): void => {
      if (EVENT.data.type === "SceneMesh") {
        const LOADER = new THREE.ObjectLoader();
        const MESH = LOADER.parse(EVENT.data.data);
        this.SCENE.add(MESH);
      } else if (EVENT.data.type === "SceneLoaded") {
        this.finalizeInitialize();
      }
    })

    // Start the WORKER by passing the necessary data
    this.SCENE_WORKER.postMessage(
      {
        COLOR_MODE: this.COLOR_MODE,
        GEOJSON: this.MAP_CONTROLLER.getGeoJSON(),
        LATITUDE: this.CCONFIG.getConfigValue("latitude"),
        LONGITUDE: this.CCONFIG.getConfigValue("longitude"),
        OBJECT_CONFIG: await this.OBJECT_CONFIG.json(),
        RADIUS: this.CCONFIG.getConfigValue("radius"),
        REUSED_DATA: this.MAP_CONTROLLER.REUSED_DATA
      }
    );

  }


  /**
   * Finalizes the initialization of the application once the scene is fully loaded.
   * @private
   */
  private finalizeInitialize(): void {

    const loadingEl = document.querySelector("#loading-overlay") as HTMLElement;
    if (loadingEl) { loadingEl.style.display = "none"; }

    // Show all the GUI buttons
    this.GUI_CONTROLLER.init();

    // Activate Camera movement
    this.CAMERA_CONTROLLER.IS_ACTIVE = true;

    window.addEventListener("resize", this.onWindowResize.bind(this));

  }


  /**
   * Handles window resize events by updating the size of the renderer and composer to match the new window dimensions.
   * @private
   */
  private onWindowResize(): void {
    if (!this.COMPOSER) {
      return;
    }

    this.COMPOSER.setSize(window.innerWidth, window.innerHeight);
  }


  /**
   * The main render loop of the application, which is called on each animation frame.
   * @private
   */
  private renderLoop(): void {
    const now = performance.now();

    this.FRAME_TIMES.push(now);

    const oneSecondAgo = now - 1000;

    if (this.FRAME_TIMES[0] !== undefined) {
      while (this.FRAME_TIMES.length > 0 && this.FRAME_TIMES[0] < oneSecondAgo) {
        this.FRAME_TIMES.shift();
      }
    }

    this.FPS = this.FRAME_TIMES.length;

    if (!this.CAMERA_CONTROLLER || !this.RENDERER || !this.COMPOSER) {
      return;
    }

    this.CAMERA_CONTROLLER.onUpdate();
    this.GUI_CONTROLLER.onUpdate();

    this.GUI_CONTROLLER.setCycles(this.CAMERA_CONTROLLER.getCycle());
    this.GUI_CONTROLLER.setFPS(this.FPS);

    if (this.COMPOSER) {
      this.COMPOSER.render();
    } else {
      this.RENDERER.render(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
    }
  }

}

const APP = new App();
await APP.init();

/**
 * Returns the main Three.js scene of the application, which contains all the 3D objects and elements that are rendered. This function can be used by other modules to access the scene and add or modify objects as needed.
 * @returns {THREE.Scene} The main Three.js scene of the application.
 */
export const getScene = function getScene(): THREE.Scene {
  return APP.SCENE;
}