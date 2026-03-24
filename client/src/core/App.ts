import { CameraController } from "../controllers/CameraController.js";
import { GuiController } from "../controllers/GuiController.js";
import { MapController } from "../controllers/MapController.js";
import * as CONFIG from "../services/ConfigService.js";
import { APP_VERSION } from "./Version.js";
import * as THREE from "three";
import * as THREECSG from "three-bvh-csg";
import type {Brush, Evaluator} from "three-bvh-csg";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

document.title = `3D Map Generator ${APP_VERSION}`;

class App {
  public readonly SCENE: THREE.Scene;
  private readonly RENDERER: THREE.WebGLRenderer;
  private readonly CCONFIG: CONFIG.ConfigService;
  private readonly COMPOSER: EffectComposer;
  private readonly FXAA_PASS: ShaderPass;
  private readonly CAMERA_CONTROLLER: CameraController;
  private readonly GUI_CONTROLLER: GuiController;
  private readonly MAP_CONTROLLER: MapController;
  private readonly RAYCASTER: THREE.Raycaster;
  private readonly MOUSE: THREE.Vector2;
  private FXAA_CONFIG = {
    enabled: false,
    maxEdgeThreshold: 0.111,
    minEdgeThreshold: 0.081,
    samples: 32,
    subpixelQuality: 0.75,
  };
  private OBJECT_CONFIG: Response;
  private FRAME_TIMES: number[];
  private COLOR_MODE: number;
  private RADIUS: number;
  private FPS: number;
  private DEBUG: number;

  private SCENE_WORKER: Worker | undefined;
  private BOUNDS_CIRCLE: Brush;
  private EVALUATOR: Evaluator;

  constructor() {
    /**
     *
     */
    this.SCENE = new THREE.Scene();
    this.RENDERER = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      precision: "highp",
    });
    this.EVALUATOR = new THREECSG.Evaluator();
    this.CCONFIG = new CONFIG.ConfigService();
    this.BOUNDS_CIRCLE = new THREECSG.Brush();
    this.COMPOSER = new EffectComposer(this.RENDERER);
    this.FXAA_PASS = new ShaderPass(FXAAShader);
    this.CAMERA_CONTROLLER = new CameraController(this.RENDERER);
    this.GUI_CONTROLLER = new GuiController();
    this.MAP_CONTROLLER = new MapController();
    this.RAYCASTER = new THREE.Raycaster();
    this.MOUSE = new THREE.Vector2();
    this.FXAA_CONFIG = {
      enabled: false,
      maxEdgeThreshold: 0.111,
      minEdgeThreshold: 0.081,
      samples: 32,
      subpixelQuality: 0.75,
    };
    this.OBJECT_CONFIG = new Response();
    this.FRAME_TIMES = [];
    this.COLOR_MODE = 0;
    this.RADIUS = 0;
    this.FPS = 0;
    this.DEBUG = 0;
    this.SCENE_WORKER = undefined;
    this.FXAA_PASS.enabled = false;
  }

  async initialize(): Promise<void> {
    this.CCONFIG.validateConfig();
    this.OBJECT_CONFIG = await fetch("http://localhost:3000/api/config");
    this.COLOR_MODE = this.CCONFIG.getConfigValue("colormode");
    this.DEBUG = this.CCONFIG.getConfigValue("debug");
    this.FXAA_CONFIG = {
      enabled: false,
      maxEdgeThreshold: 0.111,
      minEdgeThreshold: 0.081,
      samples: 32,
      subpixelQuality: 0.75,
    };

    await this.MAP_CONTROLLER.onStart();
    while (this.MAP_CONTROLLER.mapActive()) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 20);
      });
    }

    // Update the map radius that was saved to localStorage by the MapController after map loading is complete
    this.RADIUS = this.CCONFIG.getConfigValue("radius");

    this.CAMERA_CONTROLLER.onStart();

    document.body.append(this.RENDERER.domElement);
    this.RENDERER.sortObjects = true;
    this.RENDERER.shadowMap.enabled = true;
    this.RENDERER.shadowMap.type = THREE.PCFSoftShadowMap;
    this.RENDERER.autoClear = false;
    this.RENDERER.setPixelRatio(window.devicePixelRatio);
    this.RENDERER.setSize(window.innerWidth, window.innerHeight);
    this.RENDERER.setClearColor(0x3A_3A_3D, 1);
    this.RENDERER.setAnimationLoop(this.renderLoop.bind(this));

    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;

    const BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial({
      color: 0xE0_A0_30,
      opacity: 1,
      side: THREE.DoubleSide,
      transparent: false,
      wireframe: false,
    });
    const BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry(
      this.RADIUS,
      this.RADIUS,
      2 * this.RADIUS,
      Math.round(this.RADIUS / 2),
      Math.round(this.RADIUS / 20),
    );
    BOUNDS_CIRCLE_GEOMETRY.translate(0, this.RADIUS - 0.01, 0);
    this.BOUNDS_CIRCLE = new THREECSG.Brush(BOUNDS_CIRCLE_GEOMETRY, BOUNDS_CIRCLE_MATERIAL);

    if (this.DEBUG) {
      const DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial({
        color: 0xFF_00_00,
        opacity: 0.1,
        side: THREE.BackSide,
        transparent: true,
        wireframe: false,
      });
      const DEBUG_BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry(
        this.RADIUS,
        this.RADIUS,
        2 * this.RADIUS,
        Math.round(this.RADIUS / 2),
        Math.round(this.RADIUS / 20),
        true,
      );
      DEBUG_BOUNDS_CIRCLE_GEOMETRY.scale(1 + 0.01 / this.RADIUS, 1, 1 + 0.01 / this.RADIUS);
      DEBUG_BOUNDS_CIRCLE_GEOMETRY.translate(0, this.RADIUS - 0.01, 0);
      const DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush(
        DEBUG_BOUNDS_CIRCLE_GEOMETRY,
        DEBUG_BOUNDS_CIRCLE_MATERIAL,
      );
      DEBUG_BOUNDS_CIRCLE.userData.debug = { type: "mg:bounds_circle" };
      this.SCENE.add(new THREE.Mesh(DEBUG_BOUNDS_CIRCLE.geometry, DEBUG_BOUNDS_CIRCLE.material));
    }

    const BASEPLATE_GEOMETRY = new THREE.CylinderGeometry(
      this.RADIUS,
      this.RADIUS,
      5,
      Math.round(this.RADIUS / 2),
      1,
    );
    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xD3_D3_D3 });
    if (this.CCONFIG.getConfigValue("colormode") === 1) {
      BASEPLATE_MATERIAL.color = new THREE.Color(0x1C_1C_1E);
    } else if (this.CCONFIG.getConfigValue("colormode") === 2) {
      BASEPLATE_MATERIAL.color = new THREE.Color(0x0B_0B_0D);
    }
    const BASEPLATE = new THREE.Mesh(BASEPLATE_GEOMETRY, BASEPLATE_MATERIAL);
    BASEPLATE.userData.debug = { type: "mg:baseplate" };
    this.SCENE.add(BASEPLATE);
    BASEPLATE.geometry.translate(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;

    const SKYBOX_GEOMETRY = new THREE.BoxGeometry(
      5 * this.RADIUS,
      5 * this.RADIUS,
      5 * this.RADIUS,
    );
    const SKYBOX_MATERIAL = new THREE.MeshBasicMaterial({
      color: 0x87_CE_EB,
      side: THREE.BackSide,
    });
    if (this.CCONFIG.getConfigValue("colormode") === 1) {
      SKYBOX_MATERIAL.color = new THREE.Color(0x1C_1C_1E);
    } else if (this.CCONFIG.getConfigValue("colormode") === 2) {
      SKYBOX_MATERIAL.color = new THREE.Color(0x0B_0B_0D);
    }
    const SKYBOX = new THREE.Mesh(SKYBOX_GEOMETRY, SKYBOX_MATERIAL);
    SKYBOX.userData.debug = { type: "mg:skybox" };
    this.SCENE.add(SKYBOX);

    const AMBIENT_LIGHT = new THREE.AmbientLight(0xFF_FF_FF);
    AMBIENT_LIGHT.userData.debug = { type: "mg:ambient_light" };
    this.SCENE.add(AMBIENT_LIGHT);

    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight(0xFF_FF_FF, 2);
    DIRECTIONAL_LIGHT.position.set(this.RADIUS, this.RADIUS, this.RADIUS);
    DIRECTIONAL_LIGHT.castShadow = true;
    const shadowMapSize = Math.min(
      4096,
      Math.max(2048, 2 ** Math.ceil(Math.log2(this.RADIUS * 8))),
    );
    DIRECTIONAL_LIGHT.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    DIRECTIONAL_LIGHT.shadow.camera.left = -this.RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.right = this.RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.top = this.RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.bottom = -this.RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.near = 1;
    DIRECTIONAL_LIGHT.shadow.camera.far = this.RADIUS * 3;
    DIRECTIONAL_LIGHT.shadow.radius = 3;
    DIRECTIONAL_LIGHT.shadow.bias = -0.000_05;
    DIRECTIONAL_LIGHT.shadow.normalBias = 0.02;
    DIRECTIONAL_LIGHT.userData.debug = { type: "mg:directional_light" };
    this.SCENE.add(DIRECTIONAL_LIGHT);
    if (this.DEBUG) {
      this.SCENE.add(new THREE.CameraHelper(DIRECTIONAL_LIGHT.shadow.camera));
    }

    const HEMI_LIGHT = new THREE.HemisphereLight(0xFF_FF_FF, 0x44_44_44, 1);
    HEMI_LIGHT.position.set(0, 200, 0);
    HEMI_LIGHT.userData.debug = { type: "mg:hemisphere_light" };
    this.SCENE.add(HEMI_LIGHT);

    const renderPass = new RenderPass(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
    this.COMPOSER.addPass(renderPass);

    const pixelRatio = this.RENDERER.getPixelRatio();
    // Both of these values can be undefined and should be checked before being used.
    if (this.FXAA_PASS.material.uniforms["resolution"]) {
      this.FXAA_PASS.material.uniforms["resolution"].value.x = 1 / (window.innerWidth * pixelRatio);
      this.FXAA_PASS.material.uniforms["resolution"].value.y =
        1 / (window.innerHeight * pixelRatio);
    }
    this.COMPOSER.addPass(this.FXAA_PASS);
  }

  async loadScene(): Promise<void> {
    this.CAMERA_CONTROLLER.IS_ACTIVE = true;
    const el = document.querySelector("#loading-overlay") as HTMLElement;
    if (el !== null) {
      el.style.display = "none";
    }

    this.SCENE_WORKER = new Worker(new URL("../controllers/SceneController.js", import.meta.url), {
      type: "module",
    });

    this.SCENE_WORKER.postMessage(
      {
        COLOR_MODE: this.COLOR_MODE,
        DEBUG: this.DEBUG,
        GEOJSON: this.MAP_CONTROLLER.getGeoJSON(),
        LATITUDE: this.CCONFIG.getConfigValue("latitude"),
        LONGITUDE: this.CCONFIG.getConfigValue("longitude"),
        OBJECT_CONFIG: await this.OBJECT_CONFIG.json(),
        RADIUS: this.CCONFIG.getConfigValue("radius"),
        REUSED_DATA: this.MAP_CONTROLLER.REUSED_DATA
      }
    );

    this.SCENE_WORKER.addEventListener("message", (EVENT: MessageEvent): void => {
      if (EVENT.data.type === "SceneMesh") {
        const LOADER = new THREE.ObjectLoader();
        const MESH = LOADER.parse(EVENT.data.data);
        this.SCENE.add(MESH);
      } else if (EVENT.data.type === "SceneLoaded") {
        this.finalizeInitialize();
      }
    })


  }

  finalizeInitialize(): void {
    const loadingEl = document.querySelector("#loading-overlay") as HTMLElement;
    if (loadingEl) {
      loadingEl.style = "display: none;";
    }

    this.GUI_CONTROLLER.onStart();

    this.CAMERA_CONTROLLER.IS_ACTIVE = true;

    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private onWindowResize(): void {
    if (!this.COMPOSER || !this.FXAA_PASS) {
      return;
    }

    const pixelRatio = this.RENDERER.getPixelRatio();
    const { uniforms } = this.FXAA_PASS.material;
    if (!("resolution" in uniforms)) {
      throw new Error("FXAA resolution uniform missing");
    }

    const { value } = uniforms["resolution"];
    value.x = 1 / (window.innerWidth * pixelRatio);
    value.y = 1 / (window.innerHeight * pixelRatio);
    this.COMPOSER.setSize(window.innerWidth, window.innerHeight);
  }

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

    if (this.FXAA_CONFIG.enabled && this.FXAA_PASS) {
      this.FXAA_PASS.enabled = true;
      this.COMPOSER.render();
    } else if (this.COMPOSER) {
      if (this.FXAA_PASS) {
        this.FXAA_PASS.enabled = false;
      }
      this.COMPOSER.render();
    } else {
      this.RENDERER.render(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
    }
  }
}

const APP = new App();
await APP.initialize();
await APP.loadScene();

export const getScene = function getScene(): THREE.Scene {
  return APP.SCENE;
}