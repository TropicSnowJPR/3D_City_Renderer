import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import * as CONFIG from '../services/ConfigService.js'
import { CameraController } from "../controllers/CameraController.js";
import { GUIController } from "../controllers/GUIController.js";
import { APP_VERSION } from "./version.js";
import { MapController } from "../controllers/MapController.js";
import { ApiService } from "../services/ApiService.js";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";


// === SET DOCUMENT TITLE === //
document.title = "3D Map Generator [" + APP_VERSION + "]";


// ==== INIT VARIABLES AND CONSTANTS ==== //
export let REQUESTED_DATA: { elements: any; };
export let FPS = 0;
export const CCONFIG = new CONFIG.ConfigService();

class App {

    private readonly SCENE: THREE.Scene;
    private readonly RENDERER: THREE.WebGLRenderer;
    private readonly EVALUATOR: THREECSG.Evaluator;
    private readonly CCONFIG: CONFIG.ConfigService;
    private BOUNDS_CIRCLE: THREECSG.Brush;
    private readonly COMPOSER: EffectComposer;
    private readonly FXAA_PASS: ShaderPass;
    private readonly API_SERVICE: ApiService;
    private readonly CAMERA_CONTROLLER: CameraController;
    private readonly GUI_CONTROLLER: GUIController;
    private readonly MAP_CONTROLLER: MapController;
    private readonly RAYCASTER: THREE.Raycaster;
    private readonly MOUSE: THREE.Vector2;
    private FXAA_CONFIG = {
        enabled: false, samples: 32, minEdgeThreshold: 0.081, maxEdgeThreshold: 0.111, subpixelQuality: 0.75
    }
    private OBJECT_CONFIG: {};
    private FRAME_TIMES: number[];
    private COLOR_MODE: number;
    private RADIUS: number;
    private FPS: number;
    private DEBUG: number;

    private STATIC_MESHES: Array<THREE.Mesh>;
    private SCENE_WORKER: Worker | null;

    constructor() {
        this.SCENE = new THREE.Scene();
        this.RENDERER = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            precision: "highp",
            powerPreference: "high-performance",
        });
        this.EVALUATOR = new THREECSG.Evaluator();
        this.CCONFIG = new CONFIG.ConfigService();
        this.BOUNDS_CIRCLE = new THREECSG.Brush();
        this.COMPOSER = new EffectComposer(this.RENDERER);
        this.FXAA_PASS = new ShaderPass(FXAAShader);
        this.API_SERVICE = new ApiService();
        this.CAMERA_CONTROLLER = new CameraController(this.RENDERER);
        this.GUI_CONTROLLER = new GUIController();
        this.MAP_CONTROLLER = new MapController();
        this.RAYCASTER = new THREE.Raycaster();
        this.MOUSE = new THREE.Vector2();
        this.FXAA_CONFIG = {
            enabled: false, samples: 32, minEdgeThreshold: 0.081, maxEdgeThreshold: 0.111, subpixelQuality: 0.75
        };
        this.OBJECT_CONFIG = {};
        this.FRAME_TIMES = [];
        this.STATIC_MESHES = [];
        this.COLOR_MODE = 0;
        this.RADIUS = 0;
        this.FPS = 0;
        this.DEBUG = 0;
        this.SCENE_WORKER = null;
        this.FXAA_PASS.enabled = false; // or false

    }

    async initialize() {
        this.CCONFIG.validateConfig()
        this.OBJECT_CONFIG = await (await fetch("http://localhost:3000/api/config")).json();
        this.COLOR_MODE = CCONFIG.getConfigValue("colormode")
        this.DEBUG = CCONFIG.getConfigValue("debug")
        this.FXAA_CONFIG = {
            enabled: false, samples: 32, minEdgeThreshold: 0.081, maxEdgeThreshold: 0.111, subpixelQuality: 0.75
        }

        await this.MAP_CONTROLLER.onStart()
        while (this.MAP_CONTROLLER.mapActive()) {
            await this.sleep(10)
        }

        // Update the map radius that was saved to localStorage by the MapController after map loading is complete
        this.RADIUS = CCONFIG.getConfigValue("radius");

        this.CAMERA_CONTROLLER.onStart()

        document.body.appendChild(this.RENDERER.domElement);
        this.RENDERER.sortObjects = true;
        this.RENDERER.shadowMap.enabled = true;
        this.RENDERER.shadowMap.type = THREE.PCFSoftShadowMap;
        this.RENDERER.autoClear = false;
        this.RENDERER.setPixelRatio(window.devicePixelRatio);
        this.RENDERER.setSize(window.innerWidth, window.innerHeight);
        this.RENDERER.setClearColor(0x3a3a3d, 1);
        this.RENDERER.setAnimationLoop(this.renderLoop.bind(this));

        THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
        THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
        THREE.Mesh.prototype.raycast = acceleratedRaycast;

        const BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial({
            color: 0xE0A030,
            wireframe: false,
            transparent: false,
            opacity: 1.,
            side: THREE.DoubleSide,
        });
        const BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry(this.RADIUS, this.RADIUS, (2 * this.RADIUS), Math.round(this.RADIUS / 2), Math.round(this.RADIUS / 20));
        BOUNDS_CIRCLE_GEOMETRY.translate(0, this.RADIUS - 0.01, 0);
        this.BOUNDS_CIRCLE = new THREECSG.Brush(BOUNDS_CIRCLE_GEOMETRY, BOUNDS_CIRCLE_MATERIAL);

        if (this.DEBUG) {
            const DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: false,
                transparent: true,
                opacity: 0.1,
                side: THREE.BackSide,
            });
            const DEBUG_BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry(this.RADIUS, this.RADIUS, (2 * this.RADIUS), Math.round(this.RADIUS / 2), Math.round(this.RADIUS / 20), true);
            DEBUG_BOUNDS_CIRCLE_GEOMETRY.scale(1 + 0.01 / this.RADIUS, 1, 1 + 0.01 / this.RADIUS);
            DEBUG_BOUNDS_CIRCLE_GEOMETRY.translate(0, this.RADIUS - 0.01, 0);
            const DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush(DEBUG_BOUNDS_CIRCLE_GEOMETRY, DEBUG_BOUNDS_CIRCLE_MATERIAL);
            DEBUG_BOUNDS_CIRCLE.userData.debug = {
                type: "mg:bounds_circle",
            }
            this.SCENE.add(new THREE.Mesh(DEBUG_BOUNDS_CIRCLE.geometry, DEBUG_BOUNDS_CIRCLE.material));
        }

        const BASEPLATE_GEOMETRY = new THREE.CylinderGeometry(this.RADIUS, this.RADIUS, 5, Math.round(this.RADIUS / 2), 1,)
        const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({color: 0xd3d3d3});
        if (CCONFIG.getConfigValue("colormode") === 1) {
            BASEPLATE_MATERIAL.color = new THREE.Color(0x1C1C1E);
        } else if (CCONFIG.getConfigValue("colormode") === 2) {
            BASEPLATE_MATERIAL.color = new THREE.Color(0x0B0B0D);
        }
        const BASEPLATE = new THREE.Mesh(BASEPLATE_GEOMETRY, BASEPLATE_MATERIAL)
        BASEPLATE.userData.debug = {
            type: "mg:baseplate",
        }
        this.SCENE.add(BASEPLATE);
        BASEPLATE.geometry.translate(0, -2.5, 0);
        BASEPLATE.receiveShadow = true;

        const SKYBOX_GEOMETRY = new THREE.BoxGeometry(5 * this.RADIUS, 5 * this.RADIUS, 5 * this.RADIUS);
        const SKYBOX_MATERIAL = new THREE.MeshBasicMaterial({color: 0x87CEEB, side: THREE.BackSide});
        if (CCONFIG.getConfigValue("colormode") === 1) {
            SKYBOX_MATERIAL.color = new THREE.Color(0x1C1C1E);
        } else if (CCONFIG.getConfigValue("colormode") === 2) {
            SKYBOX_MATERIAL.color = new THREE.Color(0x0B0B0D);
        }
        const SKYBOX = new THREE.Mesh(SKYBOX_GEOMETRY, SKYBOX_MATERIAL);
        SKYBOX.userData.debug = {
            type: "mg:skybox",
        }
        this.SCENE.add(SKYBOX);


        const AMBIENT_LIGHT = new THREE.AmbientLight(0xFFFFFF);
        AMBIENT_LIGHT.userData.debug = {
            type: "mg:ambient_light",
        }
        this.SCENE.add(AMBIENT_LIGHT);

        const DIRECTIONAL_LIGHT = new THREE.DirectionalLight(0xffffff, 2);
        DIRECTIONAL_LIGHT.position.set(this.RADIUS, this.RADIUS, this.RADIUS);
        DIRECTIONAL_LIGHT.castShadow = true;
        const shadowMapSize = Math.min(4096, Math.max(2048, Math.pow(2, Math.ceil(Math.log2(this.RADIUS * 8)))));
        DIRECTIONAL_LIGHT.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        DIRECTIONAL_LIGHT.shadow.camera.left = -this.RADIUS * 1.5;
        DIRECTIONAL_LIGHT.shadow.camera.right = this.RADIUS * 1.5;
        DIRECTIONAL_LIGHT.shadow.camera.top = this.RADIUS * 1.5;
        DIRECTIONAL_LIGHT.shadow.camera.bottom = -this.RADIUS * 1.5;
        DIRECTIONAL_LIGHT.shadow.camera.near = 1;
        DIRECTIONAL_LIGHT.shadow.camera.far = this.RADIUS * 3;
        DIRECTIONAL_LIGHT.shadow.radius = 3;
        DIRECTIONAL_LIGHT.shadow.bias = -0.00005;
        DIRECTIONAL_LIGHT.shadow.normalBias = 0.02;
        DIRECTIONAL_LIGHT.userData.debug = {
            type: "mg:directional_light",
        }
        this.SCENE.add(DIRECTIONAL_LIGHT);
        if (this.DEBUG) {
            this.SCENE.add(new THREE.CameraHelper(DIRECTIONAL_LIGHT.shadow.camera))
        }

        const HEMI_LIGHT = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
        HEMI_LIGHT.position.set(0, 200, 0);
        HEMI_LIGHT.userData.debug = {
            type: "mg:hemisphere_light",
        }
        this.SCENE.add(HEMI_LIGHT);

        const renderPass = new RenderPass(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
        this.COMPOSER.addPass(renderPass);

        const pixelRatio = this.RENDERER.getPixelRatio();
        // Both of these values can be undefined and should be checked before being used.
        if ( this.FXAA_PASS.material.uniforms['resolution'] ) {
            this.FXAA_PASS.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
            this.FXAA_PASS.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
        }
        this.COMPOSER.addPass(this.FXAA_PASS);

        if (this.CAMERA_CONTROLLER.CAMERA_HITBOX != null) {
            //this.SCENE.add(this.CAMERA_CONTROLLER.CAMERA_HITBOX);
        }

        //window.addEventListener('resize', onWindowResize);
    }

    async loadScene() {
        // this.CAMERA_CONTROLLER.IS_ACTIVE = true;
        // const el = document.getElementById("loading-overlay");
        // if (el !== null) {
        //     el.style.display =w "none"
        // }

        this.SCENE_WORKER = new Worker(new URL("../controllers/SceneController.js", import.meta.url), {type: "module"});
        this.SCENE_WORKER.postMessage({
            OBJECT_CONFIG: this.OBJECT_CONFIG,
            RADIUS: this.RADIUS,
            DEBUG: this.DEBUG,
            COLOR_MODE: this.COLOR_MODE,
            GEOJSON: this.MAP_CONTROLLER.getGeoJSON(),
            REUSED_DATA: this.MAP_CONTROLLER.REUSED_DATA,
            LATITUDE: this.CCONFIG.getConfigValue("latitude"),
            LONGITUDE: this.CCONFIG.getConfigValue("longitude")
        })
        this.SCENE_WORKER.onmessage = (event) => {
            if (event.data.type === "SceneMesh") {
                const LOADER = new THREE.ObjectLoader();
                const MESH = LOADER.parse(event.data.data);
                this.SCENE.add(MESH);
            } else if (event.data.type === "SceneLoaded") {
                console.log("Scene loaded in worker, finalizing initialization...");
                this.finalizeInitialize();
            } else if (event.data.type === "Log") {
                console.log("Worker: " + event.data.data);
            }
        }
    }


    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    finalizeInitialize() {
        const loadingEl = document.getElementById("loading-overlay");
        if (loadingEl) loadingEl.style = "display: none;";

        this.GUI_CONTROLLER.onStart()

        this.CAMERA_CONTROLLER.IS_ACTIVE = true;

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    private onWindowResize() {
        if (!this.COMPOSER || !this.FXAA_PASS) return;

        const pixelRatio = this.RENDERER.getPixelRatio();
        this.FXAA_PASS.material.uniforms['resolution']!.value.x = 1 / (window.innerWidth * pixelRatio);
        this.FXAA_PASS.material.uniforms['resolution']!.value.y = 1 / (window.innerHeight * pixelRatio);
        this.COMPOSER.setSize(window.innerWidth, window.innerHeight);
    }

    private renderLoop() {
        const now = performance.now();

        this.FRAME_TIMES.push(now);

        const oneSecondAgo = now - 1000;

        if (this.FRAME_TIMES[0] !== undefined) {
            while (this.FRAME_TIMES.length && this.FRAME_TIMES[0] < oneSecondAgo) {
                this.FRAME_TIMES.shift();
            }
        }

        FPS = this.FRAME_TIMES.length;

        if (!this.CAMERA_CONTROLLER || !this.RENDERER || !this.COMPOSER) {
            return;
        }

        this.CAMERA_CONTROLLER.onUpdate();
        this.GUI_CONTROLLER.onUpdate();

        this.GUI_CONTROLLER.setCycles(this.CAMERA_CONTROLLER.getCycle());
        this.GUI_CONTROLLER.setFPS(FPS);

        if (this.FXAA_CONFIG.enabled && this.FXAA_PASS) {
            this.FXAA_PASS.enabled = true;
            this.COMPOSER.render();
        } else if (this.COMPOSER) {
            if (this.FXAA_PASS) this.FXAA_PASS.enabled = false;
            this.COMPOSER.render();
        } else {
            this.RENDERER.render(this.SCENE, this.CAMERA_CONTROLLER.CAMERA);
        }
    }
}


// === START APPLICATION === //
const APP = new App();
APP.initialize().then(() => {
    APP.loadScene().then(() => {})
}).catch((error) => {
    console.error("Error during app initialization: " + error);
})









