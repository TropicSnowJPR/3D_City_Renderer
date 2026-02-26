import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/examples/jsm/shaders/FXAAShader.js';
import * as CONFIG from './ConfigManager.js'
import {CameraController} from "./CameraController.js";
import {GUIController} from "./GUIController.js";
import {APP_VERSION} from "./Version.js";
import {MapController} from "./MapController.js";
import {APIController} from "./APIController.js";
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {DebugTools} from "./DebugTools.js";
import {OutlinePass} from "three/examples/jsm/postprocessing/OutlinePass.js";

// === SET DOCUMENT TITLE === //
document.title = "3D Map Generator [" + APP_VERSION + "]";


// ==== INIT VARIABLES AND CONSTANTS ==== //
export let REQUESTED_DATA;
export let FPS = 0;
export const FXAA_SETTINGS = {
    enabled: false,
    samples: 32,
    minEdgeThreshold: 0.081,
    maxEdgeThreshold: 0.111,
    subpixelQuality: 0.75
};
export const CCONFIG = new CONFIG.ConfigManager();

let SCENE, RENDERER, EVALUATOR, API_CONTROLLER, CAMERA_CONTROLLER, GUI_CONTROLLER, MAP_CONTROLLER, DEBUG_TOOL, COMPOSER, FXAA_PASS;
let OBJECT_CONFIG, COLOR_MODE, DEBUG, RADIUS, BOUNDS_CIRCLE;


// === START APPLICATION === //
await init();

async function init() {

    RADIUS = CCONFIG.getConfigValue("radius");

    SCENE = new THREE.Scene();
    RENDERER = new THREE.WebGLRenderer();
    EVALUATOR = new THREECSG.Evaluator();
    API_CONTROLLER = new APIController(CONFIG);
    CAMERA_CONTROLLER = new CameraController(RENDERER, CONFIG);
    GUI_CONTROLLER = new GUIController(CONFIG)
    MAP_CONTROLLER = new MapController(CONFIG)
    DEBUG_TOOL = new DebugTools();

    OBJECT_CONFIG = await (await fetch("http://localhost:3000/api/config")).json();
    COLOR_MODE = CCONFIG.getConfigValue("colormode")
    DEBUG = CCONFIG.getConfigValue("debug")

    await MAP_CONTROLLER.onStart()
    while (MAP_CONTROLLER.mapActive()) {
        await sleep(100)
    }

    GUI_CONTROLLER.onStart()

    CAMERA_CONTROLLER.onStart()

    document.body.appendChild( RENDERER.domElement );
    RENDERER.antialias = false
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

    const BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xE0A030, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,} );
    const BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry( RADIUS, RADIUS, (2*RADIUS), Math.round(RADIUS/2), Math.round(RADIUS/20));
    BOUNDS_CIRCLE_GEOMETRY.translate(0, RADIUS-0.01, 0);
    BOUNDS_CIRCLE = new THREECSG.Brush( BOUNDS_CIRCLE_GEOMETRY, BOUNDS_CIRCLE_MATERIAL );
    const DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: true, opacity: 0.1, side: THREE.BackSide,} );
    const DEBUG_BOUNDS_CIRCLE_GEOMETRY = new THREE.CylinderGeometry( RADIUS, RADIUS, (2*RADIUS), Math.round(RADIUS/2), Math.round(RADIUS/20), true);
    DEBUG_BOUNDS_CIRCLE_GEOMETRY.scale( 1+0.01/RADIUS, 1, 1+0.01/RADIUS );
    DEBUG_BOUNDS_CIRCLE_GEOMETRY.translate(0, RADIUS-0.01, 0);
    const DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush( DEBUG_BOUNDS_CIRCLE_GEOMETRY, DEBUG_BOUNDS_CIRCLE_MATERIAL );
    if (DEBUG) { SCENE.add(new THREE.Mesh(DEBUG_BOUNDS_CIRCLE.geometry, DEBUG_BOUNDS_CIRCLE.material)); }

    const BASEPLATE_GEOMETRY = new THREE.CylinderGeometry( RADIUS, RADIUS, 5, Math.round(RADIUS/2), 1,)
    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xd3d3d3 });
    if ( CCONFIG.getConfigValue("colormode") === 1 ) {
        BASEPLATE_MATERIAL.color = new THREE.Color(0x1C1C1E);
    } else if ( CCONFIG.getConfigValue("colormode") === 2 ) {
        BASEPLATE_MATERIAL.color = new THREE.Color(0x0B0B0D);
    }
    const BASEPLATE = new THREE.Mesh( BASEPLATE_GEOMETRY, BASEPLATE_MATERIAL )
    SCENE.add( BASEPLATE );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;

    const SKYBOX_GEOMETRY = new THREE.BoxGeometry(5*RADIUS, 5*RADIUS, 5*RADIUS);
    const SKYBOX_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide, receiveShadow: false, castShadow: false });
    if ( CCONFIG.getConfigValue("colormode") === 1 ) {
        SKYBOX_MATERIAL.color = new THREE.Color(0x1C1C1E);
    } else if ( CCONFIG.getConfigValue("colormode") === 2 ) {
        SKYBOX_MATERIAL.color = new THREE.Color(0x0B0B0D);
    }
    const SKYBOX = new THREE.Mesh(SKYBOX_GEOMETRY, SKYBOX_MATERIAL);
    SCENE.add(SKYBOX);


    const AMBIENT_LIGHT = new THREE.AmbientLight( 0xFFFFFF );
    SCENE.add( AMBIENT_LIGHT );

    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight(0xffffff, 2);
    DIRECTIONAL_LIGHT.position.set(RADIUS, RADIUS, RADIUS);
    DIRECTIONAL_LIGHT.castShadow = true;
    const shadowMapSize = Math.min(4096, Math.max(2048, Math.pow(2, Math.ceil(Math.log2(RADIUS * 8)))));
    DIRECTIONAL_LIGHT.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    DIRECTIONAL_LIGHT.shadow.camera.left = -RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.right = RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.top = RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.bottom = -RADIUS * 1.5;
    DIRECTIONAL_LIGHT.shadow.camera.near = 1;
    DIRECTIONAL_LIGHT.shadow.camera.far = RADIUS * 3;
    DIRECTIONAL_LIGHT.shadow.radius = 3;
    DIRECTIONAL_LIGHT.shadow.bias = -0.00005;
    DIRECTIONAL_LIGHT.shadow.normalBias = 0.02;

    SCENE.add(DIRECTIONAL_LIGHT);

    const HEMI_LIGHT = new THREE.HemisphereLight( 0xffffff, 0x444444, 1 );
    HEMI_LIGHT.position.set( 0, 200, 0 );
    SCENE.add( HEMI_LIGHT );

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

    window.addEventListener('resize', onWindowResize);

    await loadScene();
}


const RAYCASTER = new THREE.Raycaster();
const MOUSE = new THREE.Vector2();

function onClick(event) {
    MOUSE.x = (event.clientX / window.innerWidth) * 2 - 1;
    MOUSE.y = -(event.clientY / window.innerHeight) * 2 + 1;

    RAYCASTER.setFromCamera(MOUSE, CAMERA);

    const INTERSECTS = RAYCASTER.intersectObjects(SCENE.children, true);

    if (INTERSECTS.length > 0) {
        const SELECTED = INTERSECTS[0].object;
        outlinePass.selectedObjects = [SELECTED];
        DEBUG_TOOL.inspectElement(SELECTED);
    }
}


async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function pointsArrayToScene(ELEMENT, OUTER_GEOMETRIES, INNER_GEOMETRIES = []) {
    try {
        if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length === 0) {
            const mesh = await createSceneBoxObject(OUTER_GEOMETRIES, ELEMENT)
            if (mesh) {
                mesh.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                SCENE.add(mesh);
            }
        } else if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length > 0) {
            try {
                let OUTER_MESH
                for (let i = 0; i < OUTER_GEOMETRIES.length; i++) {
                    try {
                        const TEMP_MESH = await createSceneBoxObject(OUTER_GEOMETRIES[i], ELEMENT);

                        if ((!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position)) {
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
                CSG_MESH.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                SCENE.add(CSG_MESH)
            } catch (error) {
                console.error("Error processing element with id " + ELEMENT.id + ": " + error);
            }
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
        if (!(expectedTagKey in ELEMENT.tags) && DEBUG) { ELEMENT.tags[expectedTagKey] = "DEFAULT" }
        else if (!(expectedTagKey in ELEMENT.tags)) { continue; }

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
                return createWayGeometry(POINTS_ARRAY, 1, VALUE.WIDTH, VALUE.HEIGHT, COLOR);
            } else if (CATEGORY_NAME === "WATERWAY_TAGS" && elemTagValue === "stream") {
                return createWayGeometry(POINTS_ARRAY, 1, 5, VALUE.HEIGHT, COLOR);
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
    const TEMP_GROUP_U = new THREE.Group();
    const TEMP_GROUP_D = new THREE.Group();

    function createCSG(geom, pos, angle, material) {
        const matrix = new THREE.Matrix4()
            .makeRotationY(angle)
            .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
        geom.applyMatrix4(matrix);
        const brush = new THREECSG.Brush(geom, material);
        //const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
        return new THREE.Mesh(brush.geometry, material);
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
        TEMP_GROUP_D.add(streetBelow);
        const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH/2, WIDTH/2, HEIGHT, 32), { x: p0.x, y: HEIGHT/2+Y_OFFSET, z: p0.z }, 0, MATERIAL_BELOW);
        connectorBelow.receiveShadow = true;
        connectorBelow.castShadow = false;
        TEMP_GROUP_D.add(connectorBelow);

        if (TYPE === 0) {
            const streetAbove = createCSG(new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH/1.5), midPos, -angle, MATERIAL_ABOVE);
            streetAbove.receiveShadow = true;
            streetAbove.castShadow = false;
            TEMP_GROUP_U.add(streetAbove);
            const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH/2)/1.5, (WIDTH/2)/1.5, HEIGHT + 0.1, 32), { x: p0.x, y: HEIGHT/2+Y_OFFSET, z: p0.z }, 0, MATERIAL_ABOVE);
            connectorAbove.receiveShadow = true;
            connectorAbove.castShadow = false;
            TEMP_GROUP_U.add(connectorAbove);
        }
    }

    const plast = POINTS_ARRAY[POINTS_ARRAY.length - 1];

    const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH/2, WIDTH/2, HEIGHT, 32), { x: plast.x, y: HEIGHT/2, z: plast.z }, 0, MATERIAL_BELOW);
    connectorBelow.receiveShadow = true;
    TEMP_GROUP_D.add(connectorBelow);

    if (TYPE === 0) {
        const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH/2)/1.5, (WIDTH/2)/1.5, HEIGHT + 0.1, 32), { x: plast.x, y: HEIGHT/2, z: plast.z }, 0, MATERIAL_ABOVE);
        TEMP_GROUP_U.add(connectorAbove);
        connectorAbove.receiveShadow = true;
    }



    const RESULT = new THREE.Group();

    const MERGED_MESH_D = mergeGroupToMesh(TEMP_GROUP_D);
    const EVAL_D = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_D.geometry, MATERIAL_BELOW), THREECSG.INTERSECTION)
    RESULT.add(new THREE.Mesh(EVAL_D.geometry, MATERIAL_BELOW));
    const MERGED_MESH_U = mergeGroupToMesh(TEMP_GROUP_U);
    const EVAL_U = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_U.geometry, MATERIAL_ABOVE), THREECSG.INTERSECTION)
    RESULT.add(new THREE.Mesh(EVAL_U.geometry, MATERIAL_ABOVE));

    return RESULT
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


function mergeGroupToMesh(group) {
    const geometries = [];

    group.updateMatrixWorld(true);

    group.traverse((child) => {
        if (child.isMesh) {
            const geom = child.geometry.clone();
            geom.applyMatrix4(child.matrixWorld);
            geometries.push(geom);
        }
    });

    const merged = mergeGeometries(geometries, true);
    return new THREE.Mesh(merged);
}


function hexToInt(hex) {
    return parseInt(hex.replace("#", ""), 16);
}

function on() {
    document.getElementById("overlay").style.display = "block";
}

function off() {
    document.getElementById("overlay").style.display = "none";
}

document.getElementById("loading").style = "display: none;";

GUI_CONTROLLER.getMeshCount(SCENE)

function onWindowResize() {
    if (!COMPOSER || !FXAA_PASS) return;

    const pixelRatio = RENDERER.getPixelRatio();
    FXAA_PASS.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
    FXAA_PASS.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
    COMPOSER.setSize(window.innerWidth, window.innerHeight);
}


// =-= Render Loop =-= //
let frameTimes = [];
function render() {

    const now = performance.now();

    // ---- 5 second rolling FPS average ----
    frameTimes.push(now);

    const fiveSecondsAgo = now - 1000;

    while (frameTimes.length && frameTimes[0] < fiveSecondsAgo) {
        frameTimes.shift();
    }

    FPS = frameTimes.length;

    if (!CAMERA_CONTROLLER || !RENDERER || !COMPOSER) {
        return;
    }

    CAMERA_CONTROLLER.onUpdate();
    GUI_CONTROLLER.onUpdate();

    GUI_CONTROLLER.setCycles(CAMERA_CONTROLLER.getCycle());
    GUI_CONTROLLER.setFPS(FPS);

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
}




