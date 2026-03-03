import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/examples/jsm/shaders/FXAAShader.js';
import * as CONFIG from '../services/ConfigService.js'
import {CameraController} from "../controllers/CameraController.js";
import {GUIController} from "../controllers/GUIController.js";
import {APP_VERSION} from "./version.js";
import {MapController} from "../controllers/MapController.js";
import {ApiService} from "../services/ApiService.js";
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {ColorController} from "lil-gui";

import type { OSMElement } from "../types/osm";

// === SET DOCUMENT TITLE === //
document.title = "3D Map Generator [" + APP_VERSION + "]";


// ==== INIT VARIABLES AND CONSTANTS ==== //
export let REQUESTED_DATA: { elements: any; };
export let FPS = 0;
export const FXAA_SETTINGS = {
    enabled: false, samples: 32, minEdgeThreshold: 0.081, maxEdgeThreshold: 0.111, subpixelQuality: 0.75
};
export const CCONFIG = new CONFIG.ConfigService();

type Point3D = {
    x: number;
    y: number;
    z: number;
};



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

    private OUTER_GEOMETRIES: Point3D[][] = [];

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
        this.COLOR_MODE = 0;
        this.RADIUS = 0;
        this.FPS = 0;
        this.DEBUG = 0;
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

        this.GUI_CONTROLLER.onStart()
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
        BASEPLATE.position.set(0, -2.5, 0);
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

        //window.addEventListener('resize', onWindowResize);
    }

    async loadScene() {
        if (await this.MAP_CONTROLLER.REUSED_DATA == null) {
            for (let i = 0; i < 10; i++) {
                try {
                    REQUESTED_DATA = await this.API_SERVICE.queryAreaData();
                    break
                } catch (error) {
                    console.error("Error fetching data from Overpass API, retrying in 10 sec. (Attempt " + (i + 1) + " of 10) [" + error + "]");
                    await this.sleep(10000);
                }
            }

            if (!REQUESTED_DATA) {
                alert("API did not return any data. Please try again later.");
                throw new Error("FATAL: No data returned from Overpass API or from file.");
            } else {
                const GEOJSON = this.MAP_CONTROLLER.getGeoJSON()
                const DATA = REQUESTED_DATA;

                await fetch("http://localhost:3000/api/object", {
                    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({GEOJSON, DATA})
                });
            }
        } else {
            REQUESTED_DATA = this.MAP_CONTROLLER.REUSED_DATA;
        }

        if (REQUESTED_DATA) {
            let pointsArray;
            const centerMetric = this.API_SERVICE.toMetricCoords(this.CCONFIG.getConfigValue("latitude"), this.CCONFIG.getConfigValue("longitude"));
            for (let element of (REQUESTED_DATA.elements)) {
                if (element.members) {
                    let mainGeometries = [];
                    let innerGeometries = [];
                    for (let member of element.members) {
                        let mainGeometriesPointsArray = [];
                        if (member.role === "outer" && member.type === "way") {
                            const geometry = this.getGeometry(member)
                            for (let geoPoint of (geometry)) {
                                const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
                                if (metricCoords) {
                                    const x = metricCoords[0] - centerMetric[0];
                                    const z = metricCoords[1] - centerMetric[1];
                                    mainGeometriesPointsArray.push({x: x, y: 0, z: z});
                                }
                            }
                            mainGeometries.push(mainGeometriesPointsArray);
                        }
                        let innerGeometryPointsArray = [];
                        if (member.role === "inner" && member.type === "way") {
                            const geometry = this.getGeometry(member)
                            for (let geoPoint of (geometry)) {
                                const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
                                if (metricCoords) {
                                    const x = metricCoords[0] - centerMetric[0];
                                    const z = metricCoords[1] - centerMetric[1];
                                    innerGeometryPointsArray.push({x: x, y: 0, z: z});
                                }
                            }
                            innerGeometries.push(innerGeometryPointsArray);
                        } else {
                        }
                    }
                    if (mainGeometries.length > 1) {
                        await this.pointsArrayToScene(element, mainGeometries, innerGeometries);
                    }
                } else {
                    const geometry = this.getGeometry(element)
                    pointsArray = [];
                    for (let geoPoint of (geometry)) {
                        const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
                        if (metricCoords) {
                            const x = metricCoords[0] - centerMetric[0];
                            const z = metricCoords[1] - centerMetric[1];
                            pointsArray.push({x: x, y: 0, z: z});
                        }
                    }
                    if (pointsArray.length > 1) {
                        await this.pointsArrayToScene(element, pointsArray, []);
                    }
                }
            }
        } else {
            console.error("No data to load into scene.");
        }
    }

    private async pointsArrayToScene(ELEMENT: OSMElement, OUTER_GEOMETRIES: Point3D[], INNER_GEOMETRIES: Point3D[] = []) {
        console.log(ELEMENT)
        try {
            if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length === 0) {
                const mesh = await this.createSceneBoxObject(OUTER_GEOMETRIES, ELEMENT)
                if (mesh) {
                    mesh.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                    this.SCENE.add(mesh);
                }
            } else if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length > 0) {
                try {
                    let OUTER_MESH
                    for (let i = 0; i < OUTER_GEOMETRIES.length; i++) {
                        try {
                            const TEMP_MESH = await this.createSceneBoxObject(OUTER_GEOMETRIES[i], ELEMENT);
                            if (this.DEBUG) {
                                const DEBUG_MESH = new THREE.Mesh(TEMP_MESH.geometry, new THREE.MeshBasicMaterial({
                                    color: 0xff0000, transparent: true, opacity: 0.35
                                }));
                                DEBUG_MESH.position.set(0, 20, 0)
                                this.SCENE.add(DEBUG_MESH);
                            }


                            if ((!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position)) {
                                console.warn(`Invalid geometry for element ${ELEMENT.id}, outer geometry ${OUTER_GEOMETRIES[i]}`);
                                continue;
                            }

                            if (!OUTER_MESH) {
                                OUTER_MESH = TEMP_MESH;
                                continue;
                            }

                            try {
                                const RESULT: THREECSG.Brush = this.EVALUATOR.evaluate(new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material), new THREECSG.Brush(TEMP_MESH.geometry, OUTER_MESH.material), THREECSG.ADDITION);
                                OUTER_MESH = new THREE.Mesh(RESULT.geometry, OUTER_MESH.material);
                            } catch (error) {
                                console.error("CSG operation failed element id " + ELEMENT.id + ": " + error);
                            }
                        } catch (error) {
                            console.error("Error creating mesh for outer (" + OUTER_GEOMETRIES[i] + ") geometry of element id " + ELEMENT.id + ": " + error);
                        }
                    }

                    let INNER_MESH
                    for (let i = 0; i < INNER_GEOMETRIES.length; i++) {
                        const TEMP_MESH = await this.createSceneBoxObject(INNER_GEOMETRIES[i], ELEMENT);
                        if (this.DEBUG) {
                            const DEBUG_MESH = new THREE.Mesh(TEMP_MESH.geometry, new THREE.MeshBasicMaterial({
                                color: 0xffff00, transparent: true, opacity: 0.35
                            }));
                            DEBUG_MESH.position.set(0, 21, 0)
                            this.SCENE.add(DEBUG_MESH);
                        }


                        if (!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position) {
                            console.warn(`Invalid geometry for element ${ELEMENT.id}, inner geometry ${INNER_GEOMETRIES[i]}`);
                            continue;
                        }

                        if (!INNER_MESH) {
                            INNER_MESH = TEMP_MESH;
                            continue;
                        }

                        try {
                            const RESULT = this.EVALUATOR.evaluate(new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material), new THREECSG.Brush(TEMP_MESH.geometry, INNER_MESH.material), THREECSG.ADDITION);
                            INNER_MESH = new THREE.Mesh(RESULT.geometry, INNER_MESH.material);
                        } catch (error) {
                            console.error("CSG operation failed element id " + ELEMENT.id + ": " + error);
                        }
                    }
                    const CSG_RESULT = this.EVALUATOR.evaluate(new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material), new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material), THREECSG.SUBTRACTION);
                    const CSG_MESH = new THREE.Mesh(CSG_RESULT.geometry, OUTER_MESH.material);
                    CSG_MESH.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                    this.SCENE.add(CSG_MESH)

                } catch (error) {
                    console.error("Error processing element with id " + ELEMENT.id + ": " + error);
                }
            }
        } catch (error) {
            console.error(error)
        }
    }

    private async createSceneBoxObject(POINTS_ARRAY: Point3D[], ELEMENT: OSMElement) {
        if (!this.OBJECT_CONFIG) {
            return null;
        }
        if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === 0) {
            return null;
        }

        for (const [CATEGORY_NAME, CATEGORY] of Object.entries(this.OBJECT_CONFIG)) {
            const expectedTagKey = CATEGORY_NAME.slice(0, -5).toLowerCase(); // e.g. "BUILDING_TAGS" -> "building"
            if (!(expectedTagKey in ELEMENT.tags) && this.DEBUG) {
                ELEMENT.tags[expectedTagKey] = "DEFAULT"
            } else if (!(expectedTagKey in ELEMENT.tags)) {
                continue;
            }

            const elemTagValue = ELEMENT.tags[expectedTagKey];
            for (const [TAG, VALUE] of Object.entries(<string>CATEGORY)) {
                if (elemTagValue !== TAG) continue;

                //console.log(VALUE)

                // color selection preserved from original logic
                let COLOR, COLOR_D, COLOR_U;
                if (this.COLOR_MODE === 0) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.DEFAULT_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.DEFAULT_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.DEFAULT_COLOR);
                    }
                } else if (this.COLOR_MODE === 1) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.DARK_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.DARK_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.DARK_COLOR);
                    }
                } else if (this.COLOR_MODE === 2) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.SPECIAL_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.SPECIAL_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.SPECIAL_COLOR);
                    }
                } else {
                    COLOR = 0xFF0000;
                    COLOR_D = 0xFF0000;
                    COLOR_U = 0xFF0000;
                }

                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    return this.createWayGeometry(POINTS_ARRAY, 0, VALUE.WIDTH, VALUE.HEIGHT, COLOR_D, COLOR_U);
                } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
                    return this.createWayGeometry(POINTS_ARRAY, 1, VALUE.WIDTH, VALUE.HEIGHT, COLOR);
                } else if (CATEGORY_NAME === "WATERWAY_TAGS" && elemTagValue === "stream") {
                    return this.createWayGeometry(POINTS_ARRAY, 1, 5, VALUE.HEIGHT, COLOR);
                } else {
                    let HEIGHT = VALUE.HEIGHT;
                    if (ELEMENT.tags.height) {
                        const parsedHeight = parseFloat(ELEMENT.tags.height);
                        if (!isNaN(parsedHeight)) {
                            HEIGHT = parsedHeight;
                        }
                    }
                    return this.createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT, VALUE.Y_OFFSET);
                }
            }
        }
        return null;
    }

    private createWayGeometry(POINTS_ARRAY: Point3D[] = [], TYPE = 0, WIDTH = 3, HEIGHT = 0.6, COLOR_BELOW = 0x707070, COLOR_ABOVE = 0xE0E0E0, Y_OFFSET = 0) {
        if (POINTS_ARRAY.length < 2) {
            console.warn("POINTS_ARRAY must contain at least two points.");
            return null;
        }

        const MATERIAL_BELOW = new THREE.MeshStandardMaterial({color: COLOR_BELOW});
        const MATERIAL_ABOVE = new THREE.MeshStandardMaterial({color: COLOR_ABOVE});
        const TEMP_GROUP_U = new THREE.Group();
        const TEMP_GROUP_D = new THREE.Group();

        const createCSG = (geom: THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, pos: {
            x: any; y: any; z: any;
        }, angle: number, material: THREE.Material | THREE.Material[] | undefined) => {
            const matrix = new THREE.Matrix4()
                .makeRotationY(angle)
                .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
            geom.applyMatrix4(matrix);
            const brush = new THREECSG.Brush(geom, material);
            //const result = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
            return new THREE.Mesh(brush.geometry, material);
        }

        for (let i = 1; i < POINTS_ARRAY.length; i++) {
            const p0 = POINTS_ARRAY[i - 1];
            const p1 = POINTS_ARRAY[i];

            if (p0 === undefined || p1 === undefined) {
                console.warn(`Undefined point in POINTS_ARRAY at index ${i - 1} or ${i}. Skipping segment.`);
                continue;
            }

            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const length = Math.sqrt(dx * dx + dz * dz);
            if (length === 0) continue;

            const angle = Math.atan2(dz, dx);
            const midPos = {x: (p0.x + p1.x) / 2, y: HEIGHT / 2 + Y_OFFSET, z: (p0.z + p1.z) / 2};

            const streetBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, WIDTH), midPos, -angle, MATERIAL_BELOW);

            streetBelow.receiveShadow = true;
            streetBelow.castShadow = false;
            TEMP_GROUP_D.add(streetBelow);
            const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32), {
                x: p0.x,
                y: HEIGHT / 2 + Y_OFFSET,
                z: p0.z
            }, 0, MATERIAL_BELOW);
            connectorBelow.receiveShadow = true;
            connectorBelow.castShadow = false;
            TEMP_GROUP_D.add(connectorBelow);

            if (TYPE === 0) {
                const streetAbove = createCSG(new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH / 1.5), midPos, -angle, MATERIAL_ABOVE);
                streetAbove.receiveShadow = true;
                streetAbove.castShadow = false;
                TEMP_GROUP_U.add(streetAbove);
                const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH / 2) / 1.5, (WIDTH / 2) / 1.5, HEIGHT + 0.1, 32), {
                    x: p0.x,
                    y: HEIGHT / 2 + Y_OFFSET,
                    z: p0.z
                }, 0, MATERIAL_ABOVE);
                connectorAbove.receiveShadow = true;
                connectorAbove.castShadow = false;
                TEMP_GROUP_U.add(connectorAbove);
            }
        }

        const plast = POINTS_ARRAY[POINTS_ARRAY.length - 1];

        if (plast !== undefined) {
            const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32), {
                x: plast.x,
                y: HEIGHT / 2,
                z: plast.z
            }, 0, MATERIAL_BELOW);
            connectorBelow.receiveShadow = true;
            TEMP_GROUP_D.add(connectorBelow);

            if (TYPE === 0) {
                const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH / 2) / 1.5, (WIDTH / 2) / 1.5, HEIGHT + 0.1, 32), {
                    x: plast.x,
                    y: HEIGHT / 2,
                    z: plast.z
                }, 0, MATERIAL_ABOVE);
                TEMP_GROUP_U.add(connectorAbove);
                connectorAbove.receiveShadow = true;
            }
        }

        const RESULT = new THREE.Group();

        const MERGED_MESH_D = this.mergeGroupToMesh(TEMP_GROUP_D);
        const EVAL_D = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_D.geometry, MATERIAL_BELOW), THREECSG.INTERSECTION)
        RESULT.add(new THREE.Mesh(EVAL_D.geometry, MATERIAL_BELOW));
        const MERGED_MESH_U = this.mergeGroupToMesh(TEMP_GROUP_U);
        const EVAL_U = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_U.geometry, MATERIAL_ABOVE), THREECSG.INTERSECTION)
        RESULT.add(new THREE.Mesh(EVAL_U.geometry, MATERIAL_ABOVE));

        return RESULT
    }

    private createCustomGeometry(POINTS_ARRAY: [], COLOR: number, HEIGHT = 1, Y_OFFSET = 0) {
        if (POINTS_ARRAY.length <= 1) {
            throw new Error('POINTS_ARRAY length must be greater than 0');
        }
        if (POINTS_ARRAY[0] === undefined) {
            throw new Error('POINTS_ARRAY[0] is undefined');
        }
        const SHAPE = new THREE.Shape();
        SHAPE.moveTo(POINTS_ARRAY[0].x, POINTS_ARRAY[0].z);
        for (let i = 1; i < POINTS_ARRAY.length; i++) {
            SHAPE.lineTo(POINTS_ARRAY[i].x, POINTS_ARRAY[i].z);
        }
        const EXTRUDE_SETTINGS = {
            depth: HEIGHT, bevelEnabled: false,
        };
        const GEOMETRY = new THREE.ExtrudeGeometry(SHAPE, EXTRUDE_SETTINGS);
        GEOMETRY.rotateX(Math.PI / 2);
        GEOMETRY.translate(0, Y_OFFSET + HEIGHT, 0)
        const MATERIAL = new THREE.MeshStandardMaterial({color: COLOR});
        const RESULT = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(GEOMETRY, MATERIAL), THREECSG.INTERSECTION);
        const CSG_MESH = new THREE.Mesh(RESULT.geometry, MATERIAL);

        CSG_MESH.castShadow = true;
        CSG_MESH.receiveShadow = true;
        return CSG_MESH
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getGeometry(element: { geometry: any; }) {
        if (element.geometry) {
            return element.geometry;
        }
        return null;
    }

    private onClick = (event: { clientX: number; clientY: number; }) => {
        this.MOUSE.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.MOUSE.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (this.CAMERA_CONTROLLER.POINTER_LOCK_ENABLED) {
            this.MOUSE.x = window.innerWidth/2;
            this.MOUSE.y = window.innerHeight/2;
        }
        this.RAYCASTER.setFromCamera(this.MOUSE, this.CAMERA_CONTROLLER.CAMERA);

        const INTERSECTS = this.RAYCASTER.intersectObjects(this.SCENE.children, true);

        if (INTERSECTS.length > 0 && INTERSECTS[0] === undefined) {
            return
        }
        if (undefined in INTERSECTS) { return }
        if (INTERSECTS.length > 0 && INTERSECTS[0].object.userData.debug?.type !== "mg:bounds_circle" && INTERSECTS[0].object.userData.debug?.type !== "mg:baseplate" && INTERSECTS[0].object.userData.debug?.type !== "mg:skybox" && !this.CAMERA_CONTROLLER.POINTER_LOCK_ENABLED) {
            if (INTERSECTS[0].object.userData?.tags?.length > 0) {
                console.log("Element tags: " + INTERSECTS[0].object.userData.tags.join(", "))
            }
        }
    }

    private mergeGroupToMesh(group: THREE.Group<THREE.Object3DEventMap>): THREE.Mesh {
        const geometries: THREE.BufferGeometry[] = [];

        group.updateMatrixWorld(true);

        group.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.geometry) {
                    const geom = (mesh.geometry as THREE.BufferGeometry).clone();
                    geom.applyMatrix4(mesh.matrixWorld);
                geometries.push(geom);
            }
            }
        });

        if (geometries.length === 0) {
            return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
        }

        const merged = mergeGeometries(geometries, true) as THREE.BufferGeometry | null;
        if (!merged) {
            return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
        }

        return new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
    }


    private hexToInt(hex: string) {
        return parseInt(hex.replace("#", ""), 16);
    }

    private on() {
        const el = document.getElementById("overlay");
        if (el) el.style.display = "block";
    }

    private off() {
        const el = document.getElementById("overlay");
        if (el) el.style.display = "none";
    }

    finalizeInitialize() {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) loadingEl.style = "display: none;";

        if (this.GUI_CONTROLLER && typeof this.GUI_CONTROLLER.getMeshCount === "function") {
            this.GUI_CONTROLLER.getMeshCount(this.SCENE)
        }

        // attach window resize handler bound to this instance
        window.addEventListener('resize', this.onWindowResize.bind(this));
        // attach click handler bound to this instance
        document.addEventListener("click", this.onClick);
    }

    private onWindowResize() {
        if (!this.COMPOSER || !this.FXAA_PASS) return;

        const pixelRatio = this.RENDERER.getPixelRatio();
        this.FXAA_PASS.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        this.FXAA_PASS.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
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
    APP.loadScene().then(() => {
        APP.finalizeInitialize();
    })
}).catch((error) => {
    console.error("Error during app initialization: " + error);
})









