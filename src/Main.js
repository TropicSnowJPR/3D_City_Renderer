import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import * as CONFIG from './ConfigManager.js'
import {CameraController} from "./CameraController.js";
import {GUIController} from "./GUIController.js";
import {APP_VERSION} from "./Version.js";
import {MapController} from "./MapController.js";
import {APIController} from "./APIController.js";

export let REQUESTED_DATA;

export const FXAA_SETTINGS = {
    enabled: true,
    samples: 12,
    minEdgeThreshold: 0.0312,
    maxEdgeThreshold: 0.125,
    subpixelQuality: 0.75
};


document.title = "3D Map Generator [" + APP_VERSION + "]";

const CCONFIG = new CONFIG.ConfigManager();


// if (CCONFIG.getConfigVersion() !== APP_VERSION) {
//     console.log("Version: " + CCONFIG.getConfigVersion());
//     CCONFIG.initConfig()
// }
const OBJECT_CONFIG = await (await fetch("http://localhost:3000/api/config")).json();

let COLOR_MODE = CCONFIG.getConfigValue("colormode")
if (!COLOR_MODE) { COLOR_MODE = 0 }

const DEBUG = CCONFIG.getConfigValue("debug")
const RADIUS = CCONFIG.getConfigValue("radius");

let BOUNDS_CIRCLE_MATERIAL
let BOUNDS_CIRCLE
let DEBUG_BOUNDS_CIRCLE_MATERIAL
let DEBUG_BOUNDS_CIRCLE

const SCENE = new THREE.Scene();
const RENDERER = new THREE.WebGLRenderer();
const STATS = new Stats();
const EVALUATOR = new THREECSG.Evaluator();
const API_CONTROLLER = new APIController(CONFIG);
const CAMERA_CONTROLLER = new CameraController(RENDERER, CONFIG);
const GUI_CONTROLLER = new GUIController(CONFIG)
const MAP_CONTROLLER = new MapController(CONFIG)

let COMPOSER;
let FXAA_PASS;


MAP_CONTROLLER.onStart()
while (MAP_CONTROLLER.mapActive()) {
    await sleep(100)
}


await init();
await loadScene();



async function init() {

    GUI_CONTROLLER.onStart()

    CAMERA_CONTROLLER.onStart()

    document.body.appendChild( RENDERER.domElement );
    RENDERER.antialias = true
    RENDERER.alpha = true
    RENDERER.precision = "highp"
    RENDERER.sortObjects = true;
    RENDERER.shadowMap.enabled = true;
    RENDERER.shadowMap.type = THREE.PCFSoftShadowMap; // Smooth shadow edges (better than PCFShadowMap or BasicShadowMap)
    RENDERER.autoClear = false;
    RENDERER.powerPreference = "high-performance";
    RENDERER.setPixelRatio( window.devicePixelRatio );
    RENDERER.setSize( window.innerWidth, window.innerHeight );
    RENDERER.setClearColor(0x3a3a3d, 1);
    RENDERER.setAnimationLoop(render);

    BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xE0A030, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,} );
    BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 300, 512, 1,), BOUNDS_CIRCLE_MATERIAL );
    DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: true, opacity: 0.1, side: THREE.DoubleSide,} );
    DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 300, 512, 1,), DEBUG_BOUNDS_CIRCLE_MATERIAL );
    DEBUG_BOUNDS_CIRCLE.position.y = 45;

    document.body.appendChild( STATS.dom );
    STATS.showPanel( 0 )

    const AMBIENT_LIGHT = new THREE.AmbientLight( 0xcccccc );
    SCENE.add( AMBIENT_LIGHT );

    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight(0xffffff, 3);
    DIRECTIONAL_LIGHT.position.set(RADIUS, RADIUS, RADIUS);
    DIRECTIONAL_LIGHT.castShadow = true;

    // Optimized shadow map size - balanced quality/performance
    // Using power of 2 for better GPU efficiency (2048 or 4096)
    const shadowMapSize = Math.min(4096, Math.max(2048, Math.pow(2, Math.ceil(Math.log2(RADIUS * 2)))));
    DIRECTIONAL_LIGHT.shadow.mapSize.set(4096, 4096);

    // Shadow camera frustum - tightly fit to scene (reduced from 2x to 1.5x for better shadow resolution)
    DIRECTIONAL_LIGHT.shadow.camera.left = -RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.right = RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.top = RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.bottom = -RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.near = 1;
    DIRECTIONAL_LIGHT.shadow.camera.far = RADIUS * 3;

    // Enable PCF (Percentage Closer Filtering) for smooth shadow edges
    DIRECTIONAL_LIGHT.shadow.radius = 2; // Softness of shadow edges (1-4 recommended)

    // Bias settings to prevent shadow acne and peter panning
    DIRECTIONAL_LIGHT.shadow.bias = -0.00005; // Negative helps prevent shadow acne
    DIRECTIONAL_LIGHT.shadow.normalBias = 0.02; // Helps with surfaces at grazing angles

    SCENE.add(DIRECTIONAL_LIGHT);

    const HEMI_LIGHT = new THREE.HemisphereLight( 0xffffff, 0x444444, 1 );
    HEMI_LIGHT.position.set( 0, 200, 0 );
    SCENE.add( HEMI_LIGHT );

    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xd3d3d3 });
    if ( CCONFIG.getConfigValue("colormode") === 1 ) {
        BASEPLATE_MATERIAL.color = new THREE.Color(0x1C1C1E);
        document.body.style.backgroundColor = '#FFFFFF';
    } else if ( CCONFIG.getConfigValue("colormode") === 2 ) {
        BASEPLATE_MATERIAL.color = new THREE.Color(0x0B0B0D);
        document.body.style.backgroundColor = '#FFFFFF';
    }
    const BASEPLATE = new THREE.Mesh(new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 5, 128, 1,), BASEPLATE_MATERIAL );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;
    SCENE.add( BASEPLATE );

    EVALUATOR.useGroups = true;
    EVALUATOR.consolidateGroups = true;

    CAMERA_CONTROLLER.onStart()

    // Initialize FXAA post-processing
    COMPOSER = new EffectComposer(RENDERER);

    // Add render pass
    const renderPass = new RenderPass(SCENE, CAMERA_CONTROLLER.CAMERA);
    COMPOSER.addPass(renderPass);

    // Add FXAA pass
    FXAA_PASS = new ShaderPass(FXAAShader);
    const pixelRatio = RENDERER.getPixelRatio();
    FXAA_PASS.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    FXAA_PASS.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    COMPOSER.addPass(FXAA_PASS);

    // Handle window resize for FXAA
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    if (!COMPOSER || !FXAA_PASS) return;

    const pixelRatio = RENDERER.getPixelRatio();
    FXAA_PASS.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    FXAA_PASS.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    COMPOSER.setSize(window.innerWidth, window.innerHeight);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



async function pointsArrayToScene(ELEMENT, OUTER_GEOMETRIES, INNER_GEOMETRIES = []) {
    try {
        if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length === 0) {
            const mesh = await createSceneBoxObject(OUTER_GEOMETRIES, ELEMENT)
            if (mesh) {
                SCENE.add(mesh);
            }
        } else if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length > 0) {
            try {
                console.log(OUTER_GEOMETRIES)
                console.log(INNER_GEOMETRIES)
                let OUTER_MESH
                for (let i = 0; i < OUTER_GEOMETRIES.length; i++) {
                    try {
                        const TEMP_MESH = await createSceneBoxObject(OUTER_GEOMETRIES[i], ELEMENT);

                        if (!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position) {
                            console.warn(`Invalid geometry for element ${ELEMENT.id}, outer geometry ${i}`);
                            continue;
                        }

                        if (!OUTER_MESH) {
                            OUTER_MESH = TEMP_MESH;
                            continue;
                        }

                        try {
                            const RESULT = EVALUATOR.evaluate(new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material), new THREECSG.Brush(TEMP_MESH.geometry, OUTER_MESH.material), THREECSG.ADDITION);
                            OUTER_MESH = new THREE.Mesh(RESULT.geometry, OUTER_MESH.material);
                        } catch (error) {
                            console.error("CSG operation failed element id " + ELEMENT.id + ": " + error);
                        }
                    } catch (error) {
                        console.error("Error creating mesh for outer geometry of element id " + ELEMENT.id + ": " + error);
                    }
                }

                let INNER_MESH
                for (let i = 0; i < INNER_GEOMETRIES.length; i++) {
                    const TEMP_MESH = await createSceneBoxObject(INNER_GEOMETRIES[i], ELEMENT);

                    if (!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position) {
                        console.warn(`Invalid geometry for element ${ELEMENT.id}, inner geometry ${i}`);
                        continue;
                    }

                    if (!INNER_MESH) {
                        INNER_MESH = TEMP_MESH;
                        continue;
                    }

                    try {
                        const RESULT = EVALUATOR.evaluate(
                            new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material),
                            new THREECSG.Brush(TEMP_MESH.geometry, INNER_MESH.material),
                            THREECSG.ADDITION
                        );
                        INNER_MESH = new THREE.Mesh(RESULT.geometry, INNER_MESH.material);
                    } catch (error) {
                        console.error("CSG operation failed element id " + ELEMENT.id + ": " + error);
                    }
                }

                const CSG_RESULT = EVALUATOR.evaluate(
                    new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material),
                    new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material),
                    THREECSG.SUBTRACTION
                );
                const CSG_MESH = new THREE.Mesh(CSG_RESULT.geometry, OUTER_MESH.material);
                SCENE.add(CSG_MESH)
            } catch (error) {
                console.error("Error processing element with id " + ELEMENT.id + ": " + error);
            }
        } else {
            // console.log("Here happened somthing that should not happen")
            // console.log(OUTER_GEOMETRIES)
            // console.log(INNER_GEOMETRIES)
            // console.log(ELEMENT.tags)
            // console.log(ELEMENT)
        }
    } catch (error) {
        console.error(error)
    }
}

async function _pointsArrayToScene(element, pointsArray, innerGeometries = []) {
    try {
        if ((pointsArray || !(pointsArray.length === 0)) && (element.tags) && innerGeometries.length === 0) {
            const mesh = await createSceneBoxObject(pointsArray, element)
            //console.log("mesh:", mesh);
            if (mesh) {SCENE.add(mesh);}
        } else if (pointsArray && pointsArray.length > 0 && innerGeometries && innerGeometries.length > 0) {
            let mainMesh;
            for (let mainGeometry of pointsArray) {
                let mainTempMesh
                if (!mainMesh) {
                    mainMesh = createCustomGeometry(mainGeometry, 0xE0A030, 10, 15, false);
                    try {
                        const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(mainMesh.geometry, mainMesh.material), THREECSG.INTERSECTION);
                        mainMesh = new THREE.Mesh(result.geometry, mainMesh.material);
                    } catch (error) {
                        console.error("CSG operation failed for main geometry of element id " + element.id + ": " + error);
                    }
                }
                mainTempMesh = createCustomGeometry(mainGeometry, 0xE0A030, 10, 15, false);
                try {
                    const result = EVALUATOR.evaluate(mainMesh, new THREECSG.Brush(mainTempMesh.geometry, mainTempMesh.material), THREECSG.ADDITION);
                    let csgMesh = new THREE.Mesh(result.geometry, mainTempMesh.material);
                    const result2 = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(csgMesh.geometry, csgMesh.material), THREECSG.INTERSECTION);
                    mainMesh = new THREE.Mesh(result2.geometry, mainTempMesh.material);
                } catch (error) {
                    console.error("CSG operation failed for main geometry addition of element id " + element.id + ": " + error);
                }
            }
            let csgMesh = mainMesh;
            let csgMesh2
            for (let innerGeometry of innerGeometries) {
                const tempMesh = createCustomGeometry(innerGeometry, 0xE0A030, 100, -50, false);
                const tempMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
                try {
                    csgMesh = EVALUATOR.evaluate(new THREECSG.Brush(csgMesh.geometry, csgMesh.material), new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.SUBTRACTION)
                    tempMesh.material = tempMaterial;
                    const result2 = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.INTERSECTION);
                    csgMesh2 = new THREE.Mesh(result2.geometry, tempMesh.material);
                } catch (error) {
                    console.error("CSG operation failed for inner geometry subtraction of element id " + element.id + ": " + error);
                }
                csgMesh2.geometry.scale(1, -1, 1);
                csgMesh2.geometry.computeVertexNormals();
            }

            csgMesh.geometry.scale(1, -1, 1);
            csgMesh.geometry.computeVertexNormals();
            SCENE.add(csgMesh)
        } else {

        }
    } catch (error) {
        console.error(error)
    }
}

function getGeometry(element) {
    if (element.geometry) {
        return element.geometry;
    }
    return null;
}

async function _loadScene() {
    if (await MAP_CONTROLLER.REUSED_DATA == null) {
        for (let i = 0; i < 10; i++) {
            try {
                REQUESTED_DATA = await API_CONTROLLER.queryAreaData();
                break
            } catch (error) {
                console.error("Error fetching data from Overpass API, retrying in 10 sec. (Attempt " + (i+1) + " of 10) [" + error + "]");
                await sleep(10000);
            }
        }

        if (!REQUESTED_DATA) {
            alert("API did not return any data. Please try again later.");
            throw new Error("FATAL: No data returned from Overpass API or from file.");
        } else {

            console.log(MAP_CONTROLLER.getGeoJSON());
            console.log(REQUESTED_DATA);

            const GEOJSON = MAP_CONTROLLER.getGeoJSON()
            const DATA = REQUESTED_DATA;

            await fetch("http://localhost:3000/api/object", {
                method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({GEOJSON, DATA})
            });
        }
    } else {
        REQUESTED_DATA = MAP_CONTROLLER.REUSED_DATA;
    }

    if (REQUESTED_DATA) {
        let pointsArray;
        const CENTER_METRIC = API_CONTROLLER.toMetricCoords( CCONFIG.getConfigValue("latitude"), CCONFIG.getConfigValue("longitude") );
        console.log(REQUESTED_DATA)
        for (let element of REQUESTED_DATA.elements) {
            if (element.members && element.members.length > 0 && element.type === "relation") {
                const outers = element.members.filter(m => m.type === "way" && m.role === "outer");
                const inners = element.members.filter(m => m.type === "way" && m.role === "inner");

                // console.log(element.members)
                // console.log(outers)
                // console.log(inners)

                const innerGeometriesMap = inners.map(member => {
                    return getGeometry(member).map(geoPoint => {
                        const METRIC_COORDS = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                        if (!METRIC_COORDS) return null;
                        return {x: METRIC_COORDS[0] - CENTER_METRIC[0], y: 0, z: METRIC_COORDS[1] - CENTER_METRIC[1]};
                    }).filter(p => p !== null);
                });

                const outerGeometriesMap = outers.map(member => {
                    return getGeometry(member).map(geoPoint => {
                        const METRIC_COORDS = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                        if (!METRIC_COORDS) return null;
                        return {x: METRIC_COORDS[0] - CENTER_METRIC[0], y: 0, z: METRIC_COORDS[1] - CENTER_METRIC[1]};
                    }).filter(p => p !== null);
                });

                await pointsArrayToScene(element, outerGeometriesMap, innerGeometriesMap);

            } else {
                const pointsArray = getGeometry(element).map(geoPoint => {
                    const metricCoords = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                    if (!metricCoords) return null;
                    return { x: metricCoords[0] - CENTER_METRIC[0], y: 0, z: CENTER_METRIC[1] - CENTER_METRIC[1] };
                }).filter(p => p !== null);

                if (pointsArray.length > 1) {
                    await pointsArrayToScene(element, pointsArray);
                }
            }
        }
    } else {
        console.error("No data to load into scene.");
    }
}


async function loadScene() {
    if (await MAP_CONTROLLER.REUSED_DATA == null) {
        for (let i = 0; i < 10; i++) {
            try {
                REQUESTED_DATA = await API_CONTROLLER.queryAreaData();
                break
            } catch (error) {
                console.error("Error fetching data from Overpass API, retrying in 10 sec. (Attempt " + (i+1) + " of 10) [" + error + "]");
                await sleep(10000);
            }
        }

        if (!REQUESTED_DATA) {
            alert("API did not return any data. Please try again later.");
            throw new Error("FATAL: No data returned from Overpass API or from file.");
        } else {

            console.log(MAP_CONTROLLER.getGeoJSON());
            console.log(REQUESTED_DATA);

            const GEOJSON = MAP_CONTROLLER.getGeoJSON()
            const DATA = REQUESTED_DATA;

            await fetch("http://localhost:3000/api/object", {
                method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({GEOJSON, DATA})
            });
        }
    } else {
        REQUESTED_DATA = MAP_CONTROLLER.REUSED_DATA;
    }

    if (REQUESTED_DATA) {
        let pointsArray;
        const centerMetric = API_CONTROLLER.toMetricCoords( CCONFIG.getConfigValue("latitude"), CCONFIG.getConfigValue("longitude") );
        for (let element of (REQUESTED_DATA.elements)) {
            if (element.members) {
                let mainGeometries = [];
                let innerGeometries = [];
                for (let member of element.members) {
                    let mainGeometriesPointsArray = [];
                    if (member.role === "outer" && member.type === "way") {
                        const geometry = getGeometry(member)
                        for (let geoPoint of (geometry)) {
                            const metricCoords = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
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
                        const geometry = getGeometry(member)
                        for (let geoPoint of (geometry)) {
                            const metricCoords = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                            if (metricCoords) {
                                const x = metricCoords[0] - centerMetric[0];
                                const z = metricCoords[1] - centerMetric[1];
                                innerGeometryPointsArray.push({x: x, y: 0, z: z});
                            }
                        }
                        innerGeometries.push(innerGeometryPointsArray);
                    } else {}
                }
                if (mainGeometries.length > 1) {
                    await pointsArrayToScene(element, mainGeometries, innerGeometries);
                }
            } else {
                const geometry = getGeometry(element)
                pointsArray = [];
                for (let geoPoint of (geometry)) {
                    const metricCoords = API_CONTROLLER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                    if (metricCoords) {
                        const x = metricCoords[0] - centerMetric[0];
                        const z = metricCoords[1] - centerMetric[1];
                        pointsArray.push({x: x, y: 0, z: z});
                    }
                }
                if (pointsArray.length > 1) {
                    await pointsArrayToScene(element, pointsArray);
                }
            }
        }
    } else {
        console.error("No data to load into scene.");
    }
}


async function createSceneBoxObject(POINTS_ARRAY, ELEMENT) {

    if (!OBJECT_CONFIG) { return null; }
    if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === 0) { return null; }

    for (const [CATEGORY_NAME, CATEGORY] of Object.entries(OBJECT_CONFIG)) {
        const expectedTagKey = CATEGORY_NAME.slice(0, -5).toLowerCase(); // e.g. "BUILDING_TAGS" -> "building"
        if (!(expectedTagKey in ELEMENT.tags)) continue;

        const elemTagValue = ELEMENT.tags[expectedTagKey];
        for (const [TAG, VALUE] of Object.entries(CATEGORY)) {
            if (elemTagValue !== TAG) continue;

            // color selection preserved from original logic
            let COLOR, COLOR_D, COLOR_U;
            if (COLOR_MODE === 0) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.DEFAULT_COLOR_U);
                    COLOR_D = hexToInt(VALUE.DEFAULT_COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.DEFAULT_COLOR);
                }
            } else if (COLOR_MODE === 1) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.DARK_COLOR_U);
                    COLOR_D = hexToInt(VALUE.DARK_COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.DARK_COLOR);
                }
            } else if (COLOR_MODE === 2) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.SPECIAL_COLOR_U);
                    COLOR_D = hexToInt(VALUE.SPECIAL_COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.SPECIAL_COLOR);
                }
            } else {
                COLOR = 0xFF0000;
                COLOR_D = 0xFF0000;
                COLOR_U = 0xFF0000;
            }

            if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                return createWayGeometry(POINTS_ARRAY, 0, VALUE.WIDTH, VALUE.HEIGHT, COLOR_D, COLOR_U);
            } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
                return createWayGeometry(POINTS_ARRAY, 1, VALUE.WIDTH, VALUE.HEIGHT, COLOR_D, COLOR_U);
            } else {
                let HEIGHT = VALUE.HEIGHT;
                if (ELEMENT.tags.height) {
                    const parsedHeight = parseFloat(ELEMENT.tags.height);
                    if (!isNaN(parsedHeight)) { HEIGHT = parsedHeight; }
                }
                return createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT, VALUE.Y_OFFSET);
            }
        }
    }
    return null;
}


function createWayGeometry(POINTS_ARRAY = [], TYPE = 0, WIDTH = 3, HEIGHT = 0.6, COLOR_BELOW = 0x707070, COLOR_ABOVE = 0xE0E0E0, Y_OFFSET = 0) {
    if (POINTS_ARRAY.length < 2) {
        console.warn("POINTS_ARRAY must contain at least two points.");
        return null;
    }

    const MATERIAL_BELOW = new THREE.MeshStandardMaterial({ color: COLOR_BELOW });
    const MATERIAL_ABOVE = new THREE.MeshStandardMaterial({ color: COLOR_ABOVE });
    const TEMP_GROUP = new THREE.Group();

    function createCSG(geom, pos, angle, material) {
        const matrix = new THREE.Matrix4()
            .makeRotationY(angle)
            .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
        geom.applyMatrix4(matrix);
        const brush = new THREECSG.Brush(geom, material);
        const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
        return new THREE.Mesh(result.geometry, material);
    }

    for (let i = 1; i < POINTS_ARRAY.length; i++) {
        const p0 = POINTS_ARRAY[i - 1];
        const p1 = POINTS_ARRAY[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const angle = Math.atan2(dz, dx);
        const midPos = { x: (p0.x + p1.x) / 2, y: HEIGHT/2+Y_OFFSET, z: (p0.z + p1.z) / 2 };

        const streetBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, WIDTH), midPos, -angle, MATERIAL_BELOW);

        streetBelow.receiveShadow = true;
        streetBelow.castShadow = false;
        TEMP_GROUP.add(streetBelow);
        const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH/2, WIDTH/2, HEIGHT, 32), { x: p0.x, y: HEIGHT/2+Y_OFFSET, z: p0.z }, 0, MATERIAL_BELOW);
        connectorBelow.receiveShadow = true;
        connectorBelow.castShadow = false;
        TEMP_GROUP.add(connectorBelow);

        if (TYPE === 0) {
            const streetAbove = createCSG(new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH/1.5), midPos, -angle, MATERIAL_ABOVE);
            streetAbove.receiveShadow = true;
            streetAbove.castShadow = false;
            TEMP_GROUP.add(streetAbove);
            const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH/2)/1.5, (WIDTH/2)/1.5, HEIGHT + 0.1, 32), { x: p0.x, y: HEIGHT/2+Y_OFFSET, z: p0.z }, 0, MATERIAL_ABOVE);
            connectorAbove.receiveShadow = true;
            connectorAbove.castShadow = false;
            TEMP_GROUP.add(connectorAbove);
        }
    }

    const plast = POINTS_ARRAY[POINTS_ARRAY.length - 1];

    const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH/2, WIDTH/2, HEIGHT, 32), { x: plast.x, y: HEIGHT/2, z: plast.z }, 0, MATERIAL_BELOW);
    connectorBelow.receiveShadow = true;
    TEMP_GROUP.add(connectorBelow);

    if (TYPE === 0) {
        const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH/2)/1.5, (WIDTH/2)/1.5, HEIGHT + 0.1, 32), { x: plast.x, y: HEIGHT/2, z: plast.z }, 0, MATERIAL_ABOVE);
        TEMP_GROUP.add(connectorAbove);
        connectorAbove.receiveShadow = true;
    }

    return TEMP_GROUP;
}



function createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT = 1, Y_OFFSET = 0) {
    const SHAPE = new THREE.Shape();
    SHAPE.moveTo(POINTS_ARRAY[0]. x, POINTS_ARRAY[0]. z);
    for (let i = 1; i < POINTS_ARRAY.length; i++) {
        SHAPE.lineTo(POINTS_ARRAY[i].x, POINTS_ARRAY[i].z);
    }
    const EXTRUDE_SETTINGS = {
        depth: HEIGHT,
        bevelEnabled: false,
    };
    const GEOMETRY = new THREE.ExtrudeGeometry(SHAPE, EXTRUDE_SETTINGS);
    GEOMETRY.rotateX(Math.PI / 2);
    GEOMETRY.translate(0, Y_OFFSET+HEIGHT, 0)
    const MATERIAL = new THREE.MeshStandardMaterial({ color: COLOR });
    const RESULT = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( GEOMETRY, MATERIAL ), THREECSG.INTERSECTION );
    const CSG_MESH = new THREE.Mesh( RESULT.geometry, MATERIAL );

    CSG_MESH.castShadow = true;
    CSG_MESH.receiveShadow = true;
    return CSG_MESH
}

function hexToInt(hex) {
    return parseInt(hex.replace("#", ""), 16);
}

function mibombo() {
    [][(![] + [])[+!+[]] + (!![] + [])[+[]]][([]
        [(![] + [])[+!+[]] + (!![] +
        [])[+[]]] + [])[!+[] + !+[] + !
        +[]] + (!![] + [][(![] + [])[+!
        +[]] + (!![] + [])[+[]]])[+!
        +[] + [+[]]] + ([][[]] + [])[+!
        +[]] + (![] + [])[!+[] + !+[] + !+[]] +
    (!![] + [])[+[]] + (!![] + [])[+!
        +[]] + ([][[]] + [])[+[]] + ([][(
        ![] + [])[+!+[]] + (!![] +
        [])[+[]]] + [])[!+[] + !+[] + !
        +[]] + (!![] + [])[+[]] + (!![] + [][(
        ![] + [])[+!+[]] + (!![] +
        [])[+[]]])[+!+[] + [+[]]] + (!![] +
        [])[+!+[]]]((!![] + [])[+!+[]] +
        (!![] + [])[!+[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + ([][[]] + [])[
            +[]] + (!![] + [])[+!+[]] + ([][
            []] + [])[+!+[]] + (+[![]] + [][
        (![] + [])[+!+[]] + (!![] +
            [])[+[]]])[+!+[] + [+!
            +[]]] + (!![] + [])[!+[] + !+[] + !
            +[]] + (+(!+[] + !+[] + !+[] + [+!
            +[]]))[(!![] + [])[+[]] + (!![] + [][(
            ![] + [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] + [
            +[]]] + ([] + [])[([][(![] + [])[+!
            +[]] + (!![] +
            [])[+[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] + [][(
            ![] + [])[+!+[]] + (
            !![] + [])[+[]]])[+!
            +[] + [+[]]] + ([][[]] +
            [])[+!+[]] + (![] + [])[!+[] + !
            +[] + !+[]] + (!![] +
            [])[+[]] + (!![] + [])[+!
            +[]] + ([][[]] + [])[+[]] +
        ([][(![] + [])[+!+[]] + (!
            ![] + [])[+[]]] + [])[!+[] +
        !+[] + !+[]] + (!![] +
            [])[+[]] + (!![] + [][(![] +
            [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] + [])[+!
            +[]]][([][[]] + [])[+!
            +[]] + (![] + [])[+!+[]] + (
            (+[])[([][(![] + [])[+!
                +[]] + (
                !![] +
                [])[
                +[]]] + [])[!+[] + !
                +[] + !+[]] + (!
                ![] + [][(![] +
                [])[+!
                +[]] + (!
                ![] + [])[
                +[]]])[+!+[] + [
                +[]]] + ([][
                []] + [])[+!+[]] + (
                ![] + [])[!+[] +
            !+[] + !+[]] + (
                !![] + [])[
                +[]] + (!![] + [])[+!
                +[]] + ([][[]] +
                [])[+[]] + ([][(![] +
                    [])[+!+[]] +
                (!![] + [])[
                    +[]]] +
                [])[!+[] + !
                +[] + !+[]] + (!
                ![] + [])[+[]] + (!
                ![] + [][(![] +
                [])[+!
                +[]] + (!
                ![] + [])[
                +[]]])[+!+[] + [
                +[]]] + (!![] +
                [])[+!+[]]] + []
        )[+!+[] + [+!+[]]] + (!
            ![] + [])[!+[] + !+[] +
        !+[]]]](!+[] + !+[] + !+[] +
            [!+[] + !+[]]) + (![] + [])[+!
            +[]] + (![] + [])[!+[] + !+[]])()([]
        [(![] + [])[+!+[]] + (!![] + [])[
        +[]]][([][(![] + [])[+!+[]] + (!
        ![] + [])[+[]]] + [])[!+[] + !
        +[] + !+[]] + (!![] + [][(![] +
        [])[+!+[]] + (!![] +
        [])[+[]]])[+!+[] + [+[]]] +
    ([][[]] + [])[+!+[]] + (![] +
        [])[!+[] + !+[] + !+[]] + (!
        ![] + [])[+[]] + (!![] + [])[+!
        +[]] + ([][[]] + [])[+[]] +
    ([][(![] + [])[+!+[]] + (!![] +
        [])[+[]]] + [])[!+[] + !
        +[] + !+[]] + (!![] + [])[+[]] +
    (!![] + [][(![] + [])[+!+[]] + (
        !![] + [])[+[]]])[+!+[] + [
        +[]]] + (!![] + [])[+!+[]]](
        (!![] + [])[+!+[]] + (!![] +
            [])[!+[] + !+[] + !+[]] + (!![] +
            [])[+[]] + ([][[]] + [])[+[]] +
        (!![] + [])[+!+[]] + ([][[]] +
            [])[+!+[]] + ([] + [])[(![] +
            [])[+[]] + (!![] + [][(![] +
            [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + ([][[]] + [])[+
            !+[]] + (!![] + [])[
            +[]] + ([][(![] + [])[+!+[]] + (
                !![] + [])[+[]]] +
            [])[!+[] + !+[] + !+[]] + (!
            ![] + [][(![] + [])[+!
            +[]] + (!![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (![] + [])[!+[] + !
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] + [])[+!
            +[]]]()[+!+[] + [!+[] +
        !+[]]] + (![] + [])[+!+[]] +
        (![] + [])[!+[] + !+[]] + (!
            ![] + [])[!+[] + !+[] + !+[]] +
        (!![] + [])[+!+[]] + (!![] +
            [])[+[]] + ([][(![] + [])[+!+[]] + (
            !![] + [])[+[]]] + [])[+!
            +[] + [+!+[]]] + ([][(![] + [])[
            +!+[]] + (!![] +
            [])[+[]]][([][(![] + [])[+!
                +[]] + (!
                ![] + [])[+[]]] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!![] +
            [])[+[]]])[+!
            +[] + [+[]]] + ([][[]] +
            [])[+!+[]] + (![] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [])[
            +[]] + (!![] + [])[+
            !+[]] + ([][[]] +
            [])[+[]] + ([][(![] +
            [])[+!+[]] + (!
            ![] + [])[
            +[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] +
            [])[+[]] + (!![] + [][(
            ![] + [])[+!
            +[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] +
            [])[+!+[]]]((!![] + [])[+!
            +[]] + (!![] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + ([]
            [[]] + [])[+[]] + (!
            ![] + [])[+!+[]] + (
            [][[]] + [])[+!
            +[]] + (![] + [+[]])[([
            ![]] + [][[]])[+!
            +[] + [+[]]] + (!
            ![] + [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]] + ![] + (![] +
            [+[]])[([![]] + [][
            []])[+!+[] + [
            +[]]] + (!![] + [])[
            +[]] + (![] + [])[+!
            +[]] + (![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!
            +[] + [+[]]])()[([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + ([][[]] + [])[+!
            +[]] + (![] + [])[!
            +[] + !+[] + !+[]] +
        (!![] + [])[+[]] + (!
            ![] + [])[+!+[]] + ([][
            []] + [])[+[]] + ([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (!![] + [])[+!
            +[]]]((![] + [+[]])[([
            ![]] + [][[]])[+!
            +[] + [+[]]] + (!
            ![] + [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]]) + [])[+!+[]] + [!
            +[] + !+[] + !+[] + !+[]] + [!
            +[] + !+[]] + (+(+!+[] + (!+[] +
            [])[!+[] + !+[] + !
            +[]] + [+!+[]] + [
            +[]] + [+[]] + [+[]]) + [])[
            +[]] + (+[![]] + [][(![] + [])[+!
            +[]] + (!![] + [])[+[]]])[+!
            +[] + [+!+[]]] + (+(+!+[] + [
            +[]] + [+!+[]]))[(!![] + [])[
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!![] +
            [])[+[]]])[+!+[] + [+[]]] +
        ([] + [])[([][(![] + [])[+!
                +[]] + (!
                ![] + [])[+[]]] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!![] +
            [])[+[]]])[+!
            +[] + [+[]]] + ([][[]] +
            [])[+!+[]] + (![] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [])[
            +[]] + (!![] + [])[+
            !+[]] + ([][[]] +
            [])[+[]] + ([][(![] +
            [])[+!+[]] + (!
            ![] + [])[
            +[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] +
            [])[+[]] + (!![] + [][(
            ![] + [])[+!
            +[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] +
            [])[+!+[]]][([][[]] + [])[+!
            +[]] + (![] + [])[+!
            +[]] + ((+[])[([][(
            ![] +
            [])[
            +!
                +[]
            ] +
        (!![] +
            [])[
            +[]]
            ] + [])[!
            +[] + !+[] + !
            +[]] + (!
            ![] + [][(![] +
            [])[
            +!
                +[]
            ] +
        (!![] +
            [])[
            +[]]
            ])[+!
            +[] + [+[]]] + (
            [][[]] + []
        )[+!+[]] + (
            ![] + [])[!
            +[] + !+[] +
        !+[]] + (!
            ![] + [])[+[]] +
        (!![] + [])[+!
            +[]] + ([][[]] +
            [])[+[]] + (
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]] + [])[
        !+[] + !
            +[] + !+[]] + (!
            ![] + [])[
            +[]] + (!![] +
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]])[+!+[] + [
            +[]]] + (!
            ![] + [])[+!+[]]
            ] + [])[+!+[] + [+!
            +[]]] + (!![] + [])[
        !+[] + !+[] + !+[]]]](!
            +[] + !+[] + [+!+[]])[+!
            +[]] + (![] + [])[+!+[]] + (!![] +
            [])[+[]] + (!![] + [])[!+[] + !
            +[] + !+[]] + (+[![]] + [][(
            ![] + [])[+!+[]] + (
            !![] + [])[+[]]])[+!+[] + [+
            !+[]]] + ([][(!![] + [])[!
                +[] + !+[] + !+[]] + ([]
                [[]] + [])[+!+[]] +
            (!![] + [])[+[]] + (!
                ![] + [])[+!+[]] + ([
                ![]] + [][[]])[+!+[] + [
                +[]]] + (!![] + [])[
            !+[] + !+[] + !+[]
                ] + (![] + [])[!
                +[] + !+[] + !+[]]]() +
            [])[!+[] + !+[] + !+[]] + (
            ![] + [])[+!+[]] + (+(!+[] +
            !+[] + !+[] + [+!+[]]))[(!
            ![] + [])[+[]] + (!![] + [][
        (![] + [])[+!+[]] +
        (!![] + [])[+[]]])[+!
            +[] + [+[]]] + ([] + [])[([]
            [(![] + [])[+!+[]] +
        (!![] + [])[+[]]
            ] + [])[!+[] + !
            +[] + !+[]] + (!
            ![] + [][(![] + [])[+!
            +[]] + (!![] +
            [])[+[]]])[+!+[] + [
            +[]]] + ([][[]] +
            [])[+!+[]] + (![] + [])[
        !+[] + !+[] + !+[]
            ] + (!![] + [])[
            +[]] + (!![] + [])[+!+[]] +
        ([][[]] + [])[+[]] + ([]
            [(![] + [])[+!+[]] +
        (!![] + [])[+[]]
            ] + [])[!+[] + !
            +[] + !+[]] + (!
            ![] + [])[+[]] + (!![] +
            [][(![] + [])[+!
                +[]] + (!![] + [])[
                +[]]])[+!
            +[] + [+[]]] + (!![] +
            [])[+!+[]]][([][[]] +
            [])[+!+[]] + (![] + [])[
            +!+[]] + ((+[])[([][
            (![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]
            ] + (!![] +
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]])[+!
            +[] + [+[]]] + (
            [][[]] + []
        )[+!+[]] + (
            ![] + [])[!
            +[] + !+[] +
        !+[]] + (!
            ![] + [])[+[]] +
        (!![] + [])[+!
            +[]] + ([][[]] +
            [])[+[]] + (
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]] + [])[
        !+[] + !
            +[] + !+[]] + (!
            ![] + [])[
            +[]] + (!![] +
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]])[+!+[] + [
            +[]]] + (!
            ![] + [])[+!+[]]
            ] + [])[+!+[] + [+!
            +[]]] + (!![] + [])[
        !+[] + !+[] + !+[]]]](!+[] +
            !+[] + !+[] + [!+[] + !+[]]
        ) + (![] + [])[+!+[]] + (
            ![] + [])[!+[] + !+[] + !+[]] +
        ([][(![] + [])[+!+[]] + (!![] +
            [])[+[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] + [])[+!
            +[]] + ([![]] + [][[]])[+!+[] + [
            +[]]] + (+(!+[] + !+[] + [+!
            +[]] + [+!+[]]))[(!![] + [])[
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!![] +
            [])[+[]]])[+!+[] + [+[]]] +
        ([] + [])[([][(![] + [])[+!
                +[]] + (!
                ![] + [])[+[]]] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!![] +
            [])[+[]]])[+!
            +[] + [+[]]] + ([][[]] +
            [])[+!+[]] + (![] +
            [])[!+[] + !+[] + !
            +[]] + (!![] + [])[
            +[]] + (!![] + [])[+
            !+[]] + ([][[]] +
            [])[+[]] + ([][(![] +
            [])[+!+[]] + (!
            ![] + [])[
            +[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] +
            [])[+[]] + (!![] + [][(
            ![] + [])[+!
            +[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] +
            [])[+!+[]]][([][[]] + [])[+!
            +[]] + (![] + [])[+!
            +[]] + ((+[])[([][(
            ![] +
            [])[
            +!
                +[]
            ] +
        (!![] +
            [])[
            +[]]
            ] + [])[!
            +[] + !+[] + !
            +[]] + (!
            ![] + [][(![] +
            [])[
            +!
                +[]
            ] +
        (!![] +
            [])[
            +[]]
            ])[+!
            +[] + [+[]]] + (
            [][[]] + []
        )[+!+[]] + (
            ![] + [])[!
            +[] + !+[] +
        !+[]] + (!
            ![] + [])[+[]] +
        (!![] + [])[+!
            +[]] + ([][[]] +
            [])[+[]] + (
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]] + [])[
        !+[] + !
            +[] + !+[]] + (!
            ![] + [])[
            +[]] + (!![] +
            [][(![] +
                [])[+!
                +[]] + (
                !
                    ![] + []
            )[
                +[]]])[+!+[] + [
            +[]]] + (!
            ![] + [])[+!+[]]
            ] + [])[+!+[] + [+!
            +[]]] + (!![] + [])[
        !+[] + !+[] + !+[]]]](!
            +[] + !+[] + !+[] + [+!+[]]
        )[+!+[]] + (!![] + [])[
            +[]] + ([][(![] + [])[+!+[]] + (!
            ![] + [])[+[]]][([][(![] +
            [])[+!+[]] + (!
            ![] + [])[
            +[]]] + [])[!+[] + !
            +[] + !+[]] + (!![] + []
            [(![] + [])[+!+[]] +
        (!![] + [])[+[]]
            ])[+!+[] + [
            +[]]] + ([][[]] + [])[+!
            +[]] + (![] + [])[!
            +[] + !+[] + !+[]] +
        (!![] + [])[+[]] + (!
            ![] + [])[+!+[]] + ([][
            []] + [])[+[]] + ([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (!![] + [])[+!
            +[]]]((!![] + [])[+!
            +[]] + (!![] + [])[!+[] + !
            +[] + !+[]] + (!
            ![] + [])[+[]] + ([][
            []] + [])[+[]] + (!![] +
            [])[+!+[]] + ([][
            []] + [])[+!+[]] + (
            ![] + [+[]])[([![]] + []
            [[]])[+!+[] + [
            +[]]] + (!![] +
            [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]] + ![] + (![] +
            [+[]])[([![]] + [][
            []])[+!+[] + [
            +[]]] + (!![] + [])[
            +[]] + (![] + [])[+!
            +[]] + (![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!
            +[] + [+[]]])()[([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + ([][[]] + [])[+!
            +[]] + (![] + [])[!
            +[] + !+[] + !+[]] +
        (!![] + [])[+[]] + (!
            ![] + [])[+!+[]] + ([][
            []] + [])[+[]] + ([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (!![] + [])[+!
            +[]]]((![] + [+[]])[([
            ![]] + [][[]])[+!
            +[] + [+[]]] + (!
            ![] + [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]]) + [])[+!+[]] + [!
            +[] + !+[] + !+[] + !+[]] + [+!
            +[]] + ([][(![] + [])[+!
            +[]] + (!![] + [])[+[]]][([]
            [(![] + [])[+!+[]] +
        (!![] + [])[+[]]
            ] + [])[!+[] + !
            +[] + !+[]] + (!
            ![] + [][(![] + [])[+!
            +[]] + (!![] +
            [])[+[]]])[+!+[] + [
            +[]]] + ([][[]] +
            [])[+!+[]] + (![] + [])[
        !+[] + !+[] + !+[]
            ] + (!![] + [])[
            +[]] + (!![] + [])[+!+[]] +
        ([][[]] + [])[+[]] + ([]
            [(![] + [])[+!+[]] +
        (!![] + [])[+[]]
            ] + [])[!+[] + !
            +[] + !+[]] + (!
            ![] + [])[+[]] + (!![] +
            [][(![] + [])[+!
                +[]] + (!![] + [])[
                +[]]])[+!
            +[] + [+[]]] + (!![] +
            [])[+!+[]]]((!![] + [])[
            +!+[]] + (!![] +
            [])[!+[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + ([]
            [[]] + [])[+[]] + (!
            ![] + [])[+!+[]] + (
            [][[]] + [])[+!
            +[]] + (![] + [+[]])[([
            ![]] + [][[]])[+!
            +[] + [+[]]] + (!
            ![] + [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]] + ![] + (![] +
            [+[]])[([![]] + [][
            []])[+!+[] + [
            +[]]] + (!![] + [])[
            +[]] + (![] + [])[+!
            +[]] + (![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!
            +[] + [+[]]])()[([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + ([][[]] + [])[+!
            +[]] + (![] + [])[!
            +[] + !+[] + !+[]] +
        (!![] + [])[+[]] + (!
            ![] + [])[+!+[]] + ([][
            []] + [])[+[]] + ([][(
            ![] + [])[+!
            +[]] + (!![] + [])[
            +[]]] + [])[!
            +[] + !+[] + !+[]] + (!
            ![] + [])[+[]] + (!
            ![] + [][(![] + [])[
            +!+[]] + (!
            ![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (!![] + [])[+!
            +[]]]((![] + [+[]])[([
            ![]] + [][[]])[+!
            +[] + [+[]]] + (!
            ![] + [])[+[]] + (
            ![] + [])[+!+[]] + (
            ![] + [])[!+[] +
        !+[]] + ([![]] +
            [][[]])[+!+[] +
        [+[]]] + ([][(
                ![] +
                [])[+!+[]] +
            (!![] + [])[
                +[]]] +
            [])[!+[] + !
            +[] + !+[]] + (![] +
            [])[!+[] + !
            +[] + !+[]]]()[+!+[] + [
            +[]]]) + [])[+!+[]] + [!
            +[] + !+[] + !+[] + !+[]] + [!
            +[] + !+[]] + ([] + [] + [][(
            ![] + [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] + [!+[] +
        !+[]]] + ([] + [])[(![] +
            [])[+[]] + (!![] + [][(![] +
            [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + ([][[]] + [])[+
            !+[]] + (!![] + [])[
            +[]] + ([][(![] + [])[+!+[]] + (
                !![] + [])[+[]]] +
            [])[!+[] + !+[] + !+[]] + (!
            ![] + [][(![] + [])[+!
            +[]] + (!![] + [])[
            +[]]])[+!+[] + [
            +[]]] + (![] + [])[!+[] + !
            +[]] + (!![] + [][(![] +
            [])[+!+[]] + (!
            ![] + [])[+[]]])[+!+[] +
        [+[]]] + (!![] + [])[+!
            +[]]]()[+!+[] + [!+[] +
        !+[]]])())
}

// =-= Render Loop =-= //
function render() {
    if ( !CAMERA_CONTROLLER || !RENDERER || !COMPOSER ) { return; }

    CAMERA_CONTROLLER.onUpdate()
    GUI_CONTROLLER.onUpdate()

    GUI_CONTROLLER.setCycles(CAMERA_CONTROLLER.getCycle())

    STATS.begin();

    // Use FXAA if enabled, otherwise render directly
    if (FXAA_SETTINGS.enabled && FXAA_PASS) {
        FXAA_PASS.enabled = true;
        COMPOSER.render();
    } else if (COMPOSER) {
        if (FXAA_PASS) FXAA_PASS.enabled = false;
        COMPOSER.render();
    } else {
        RENDERER.render(SCENE, CAMERA_CONTROLLER.CAMERA);
    }

    STATS.end();
}




