import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import Stats from 'three/examples/jsm/libs/stats.module.js';
import * as CONFIG from './ConfigManager.js'
import { CameraController } from "./CameraController.js";
import { GUIController } from "./GUIController.js";
import { APP_VERSION } from "./Version.js";
import { MapController } from "./MapController.js";
import { APIController } from "./APIController.js";

export let REQUESTED_DATA;


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

    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight( 0xffffff, 4 );
    DIRECTIONAL_LIGHT.position.set( 5000, 3000 , 5000 );
    DIRECTIONAL_LIGHT.castShadow = true;
    DIRECTIONAL_LIGHT.shadow.mapSize.width = 512 * ( CCONFIG.getConfigValue("radius") / 10 );
    DIRECTIONAL_LIGHT.shadow.mapSize.height = 512 * ( CCONFIG.getConfigValue("radius") / 10 );
    DIRECTIONAL_LIGHT.shadow.camera.near = 0.5;
    DIRECTIONAL_LIGHT.shadow.camera.far = ( CCONFIG.getConfigValue("far") );
    DIRECTIONAL_LIGHT.shadow.camera.left = ( 2 * -CCONFIG.getConfigValue("radius") / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.right = ( 2 * CCONFIG.getConfigValue("radius") / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.top = ( 2 * CCONFIG.getConfigValue("radius") / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.bottom = ( 2 * -CCONFIG.getConfigValue("radius") / 1.5 );
    SCENE.add( DIRECTIONAL_LIGHT );

    const HEMI_LIGHT = new THREE.HemisphereLight( 0xffffff, 0x444444, 1 );
    HEMI_LIGHT.position.set( 0, 200, 0 );
    SCENE.add( HEMI_LIGHT );

    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xd3d3d3 });
    if ( CCONFIG.getConfigValue("colormode") === 2 ) {
        BASEPLATE_MATERIAL.color = new THREE.Color(0x0B0B0D);
        document.body.style.backgroundColor = '#2E2E34';
    }
    const BASEPLATE = new THREE.Mesh(new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 5, 128, 1,), BASEPLATE_MATERIAL );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;
    SCENE.add( BASEPLATE );

    EVALUATOR.useGroups = true;
    EVALUATOR.consolidateGroups = true;

    CAMERA_CONTROLLER.onStart()
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



async function pointsArrayToScene(element, pointsArray, innerGeometries = []) {
    try {
        if ((pointsArray || !(pointsArray.length === 0)) && (element.tags) && innerGeometries.length === 0) {
            const mesh = await createSceneBoxObject(pointsArray, element)
            console.log("mesh:", mesh);
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


async function createSceneBoxObject(POINTS_ARRAY, ELEMENT, EXTRA = null) {

    if (!OBJECT_CONFIG) { return } // TODO: return info that the function failed

    for (const [CATEGORY_NAME, CATEGORY] of Object.entries(OBJECT_CONFIG)) {
        if (!CATEGORY_NAME.endsWith("_TAGS")) continue;
        if (typeof CATEGORY !== "object") continue;
        for (const [TAG, VALUE] of Object.entries(CATEGORY)) {
            let TEMP_TAG
            if (VALUE.HEIGHT <= 0) { continue }
            console.log("ELEMENT TAG CATEGORY: ", (Object.entries(ELEMENT.tags))[0][0], " CATEGORY NAME:", CATEGORY_NAME.slice(0, -5).toLowerCase())
            if ((Object.entries(ELEMENT.tags))[0][0] !== CATEGORY_NAME.slice(0, -5).toLowerCase()) continue;
            if ((Object.entries(ELEMENT.tags))[0][1] !== TAG) continue;
            console.log("COLOR_MODE:", COLOR_MODE)
            let COLOR, COLOR_D, COLOR_U
            if (COLOR_MODE === 0) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.DEFAULT_COLOR_U);
                    COLOR_D = hexToInt(VALUE.DEFAULT_COLOR_D);
                    console.log(COLOR_U, COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.DEFAULT_COLOR);
                    console.log(COLOR);
                }
            }

            if (COLOR_MODE === 1) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.DARK_COLOR_U);
                    COLOR_D = hexToInt(VALUE.DARK_COLOR_D);
                    console.log(COLOR_U, COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.DARK_COLOR);
                    console.log(COLOR);
                }
            }

            if (COLOR_MODE === 2) {
                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    COLOR_U = hexToInt(VALUE.SPECIAL_COLOR_U);
                    COLOR_D = hexToInt(VALUE.SPECIAL_COLOR_D);
                    console.log(COLOR_U, COLOR_D);
                } else {
                    COLOR = hexToInt(VALUE.SPECIAL_COLOR);
                    console.log(COLOR);
                }
            }

            if (COLOR_MODE < 0 && COLOR_MODE > 2) {
                COLOR = 0xFF0000;
                COLOR_D = 0xFF0000;
                COLOR_U = 0xFF0000;
            }

            console.log("CATEGORY:", CATEGORY_NAME, "TAG:", TAG, " VALUE:", VALUE, " COLOR:", COLOR, " COLOR_D:", COLOR_D, " COLOR_U:", COLOR_U);
            if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                console.log("MAKING HIGHWAY GEOMETRY WITH COLOR_D:", COLOR_D, " AND COLOR_U:", COLOR_U);
                return createWayGeometry(POINTS_ARRAY, 0, VALUE.WIDTH, 0.6, COLOR_D, COLOR_U);
            } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
                console.log("MAKING RAILWAY GEOMETRY WITH COLOR_D:", COLOR_D, " AND COLOR_U:", COLOR_U);
                return createWayGeometry(POINTS_ARRAY, 1, VALUE.WIDTH, 0.6, COLOR_D, COLOR_U);
            } else {
                console.log("MAKING BUILDING GEOMETRY WITH COLOR:", COLOR);
                let HEIGHT = VALUE.HEIGHT;
                if (ELEMENT.tags.height) {
                    const parsedHeight = parseFloat(ELEMENT.tags.height);
                    if (!isNaN(parsedHeight)) {
                        HEIGHT = parsedHeight;
                    }
                }
                return createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT, VALUE.Y_OFFSET);
            }
        }
    }
}


function createWayGeometry(POINTS_ARRAY, TYPE = 0, WIDTH = 3, HEIGHT = 0.6, COLOR_BELOW = 0x707070, COLOR_ABOVE = 0xE0E0E0, ) {
    if (POINTS_ARRAY.length < 2) {
        console.warn("createWayGeometry: pointsArray must contain at least two points.");
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
        const midPos = { x: (p0.x + p1.x) / 2, y: HEIGHT/2, z: (p0.z + p1.z) / 2 };

        const streetBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, WIDTH), midPos, -angle, MATERIAL_BELOW);

        streetBelow.receiveShadow = true;
        TEMP_GROUP.add(streetBelow);
        const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH/2, WIDTH/2, HEIGHT, 32), { x: p0.x, y: HEIGHT/2, z: p0.z }, 0, MATERIAL_BELOW);
        connectorBelow.receiveShadow = true;
        TEMP_GROUP.add(connectorBelow);

        if (TYPE === 0) {
            const streetAbove = createCSG(new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH/1.5), midPos, -angle, MATERIAL_ABOVE);
            streetAbove.receiveShadow = true;
            TEMP_GROUP.add(streetAbove);
            const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH/2)/1.5, (WIDTH/2)/1.5, HEIGHT + 0.1, 32), { x: p0.x, y: HEIGHT/2, z: p0.z }, 0, MATERIAL_ABOVE);
            connectorAbove.receiveShadow = true;
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
function createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT = 1, Y = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(POINTS_ARRAY[0]. x, POINTS_ARRAY[0]. z);
    for (let i = 1; i < POINTS_ARRAY.length; i++) {
        shape.lineTo(POINTS_ARRAY[i].x, POINTS_ARRAY[i].z);
    }
    const extrudeSettings = {
        depth: HEIGHT,
        bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
        color: COLOR,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = Y;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    // if (IGNORE_BOUNDS === true) {return mesh;} TODO: IGNORE BOUNDS GLOBAL BOOL

    const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( mesh.geometry, mesh.material ), THREECSG.INTERSECTION );
    const csgMesh = new THREE.Mesh( result.geometry, mesh.material );
    csgMesh.material.side = THREE.DoubleSide;
    csgMesh.geometry.scale( 1,-1, 1 );
    csgMesh.castShadow = true;
    csgMesh.receiveShadow = false;
    csgMesh.geometry.computeVertexNormals();
    return csgMesh
}

function hexToInt(hex) {
    return parseInt(hex.replace("#", ""), 16);
}

function mibombo() {
    [][(![] + [])[+!+[]] + (!![] + [])[+[]]][([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((!![] + [])[+!+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + ([][[]] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+!+[]] + (+[![]] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+!+[]]] + (!![] + [])[!+[] + !+[] + !+[]] + (+(!+[] + !+[] + !+[] + [+!+[]]))[(!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([] + [])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]][([][[]] + [])[+!+[]] + (![] + [])[+!+[]] + ((+[])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]] + [])[+!+[] + [+!+[]]] + (!![] + [])[!+[] + !+[] + !+[]]]](!+[] + !+[] + !+[] + [!+[] + !+[]]) + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]])()([][(![] + [])[+!+[]] + (!![] + [])[+[]]][([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((!![] + [])[+!+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + ([][[]] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+!+[]] + ([] + [])[(![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (!![] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]()[+!+[] + [!+[] + !+[]]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+!+[]] + (!![] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[+!+[] + [+!+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]][([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((!![] + [])[+!+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + ([][[]] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+!+[]] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]] + ![] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]])()[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]]) + [])[+!+[]] + [!+[] + !+[] + !+[] + !+[]] + [!+[] + !+[]] + (+(+!+[] + (!+[] + [])[!+[] + !+[] + !+[]] + [+!+[]] + [+[]] + [+[]] + [+[]]) + [])[+[]] + (+[![]] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+!+[]]] + (+(+!+[] + [+[]] + [+!+[]]))[(!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([] + [])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]][([][[]] + [])[+!+[]] + (![] + [])[+!+[]] + ((+[])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]] + [])[+!+[] + [+!+[]]] + (!![] + [])[!+[] + !+[] + !+[]]]](!+[] + !+[] + [+!+[]])[+!+[]] + (![] + [])[+!+[]] + (!![] + [])[+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (+[![]] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+!+[]]] + ([][(!![] + [])[!+[] + !+[] + !+[]] + ([][[]] + [])[+!+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]() + [])[!+[] + !+[] + !+[]] + (![] + [])[+!+[]] + (+(!+[] + !+[] + !+[] + [+!+[]]))[(!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([] + [])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]][([][[]] + [])[+!+[]] + (![] + [])[+!+[]] + ((+[])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]] + [])[+!+[] + [+!+[]]] + (!![] + [])[!+[] + !+[] + !+[]]]](!+[] + !+[] + !+[] + [!+[] + !+[]]) + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+!+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (+(!+[] + !+[] + [+!+[]] + [+!+[]]))[(!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([] + [])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]][([][[]] + [])[+!+[]] + (![] + [])[+!+[]] + ((+[])[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]] + [])[+!+[] + [+!+[]]] + (!![] + [])[!+[] + !+[] + !+[]]]](!+[] + !+[] + !+[] + [+!+[]])[+!+[]] + (!![] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]][([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((!![] + [])[+!+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + ([][[]] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+!+[]] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]] + ![] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]])()[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]]) + [])[+!+[]] + [!+[] + !+[] + !+[] + !+[]] + [+!+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]][([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((!![] + [])[+!+[]] + (!![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + ([][[]] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+!+[]] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]] + ![] + (![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]])()[([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (![] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [])[+!+[]] + ([][[]] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]((![] + [+[]])[([![]] + [][[]])[+!+[] + [+[]]] + (!![] + [])[+[]] + (![] + [])[+!+[]] + (![] + [])[!+[] + !+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (![] + [])[!+[] + !+[] + !+[]]]()[+!+[] + [+[]]]) + [])[+!+[]] + [!+[] + !+[] + !+[] + !+[]] + [!+[] + !+[]] + ([] + [] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [!+[] + !+[]]] + ([] + [])[(![] + [])[+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + ([][[]] + [])[+!+[]] + (!![] + [])[+[]] + ([][(![] + [])[+!+[]] + (!![] + [])[+[]]] + [])[!+[] + !+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]] + (!![] + [][(![] + [])[+!+[]] + (!![] + [])[+[]]])[+!+[] + [+[]]] + (!![] + [])[+!+[]]]()[+!+[] + [!+[] + !+[]]])())
}

// =-= Render Loop =-= //
function render() {
    if ( !CAMERA_CONTROLLER || !RENDERER ) { return; }

    CAMERA_CONTROLLER.onUpdate()
    GUI_CONTROLLER.onUpdate()

    GUI_CONTROLLER.setCycles(CAMERA_CONTROLLER.getCycle())

    STATS.begin();
    RENDERER.render(SCENE, CAMERA_CONTROLLER.CAMERA);
    STATS.end();
}




