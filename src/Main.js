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


if (CCONFIG.getConfigVersion() !== APP_VERSION) {
    console.log("Version: " + CCONFIG.getConfigVersion());
    CCONFIG.initConfig()
}

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
    if ( CCONFIG.getConfigValue("follyFeverMode") ) {
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



function pointsArrayToScene(element, pointsArray, innerGeometries = []) {
    try {
        if ((pointsArray || !(pointsArray.length === 0)) && (element.tags) && innerGeometries.length === 0) {
            SCENE.add(createSceneBoxObject(pointsArray, element));
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
                const tempMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                try {
                    csgMesh = EVALUATOR.evaluate(new THREECSG.Brush(csgMesh.geometry, csgMesh.material), new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.SUBTRACTION)
                    tempMesh.material = tempMaterial;
                    const result2 = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.INTERSECTION);
                    csgMesh2 = new THREE.Mesh(result2.geometry, tempMesh.material);
                } catch (error) {
                    console.error("CSG operation failed for inner geometry subtraction of element id " + element.id + ": " + error);
                }
                csgMesh2.geometry.scale( 1,-1, 1 );
                csgMesh2.geometry.computeVertexNormals();
            }

            csgMesh.geometry.scale( 1,-1, 1 );
            csgMesh.geometry.computeVertexNormals();
            SCENE.add(csgMesh)
        }
        else {

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
                    pointsArrayToScene(element, mainGeometries, innerGeometries);
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
                    pointsArrayToScene(element, pointsArray);
                }
            }
        }
    } else {
        console.error("No data to load into scene.");
    }
}


function createSceneBoxObject(POINTS_ARRAY, ELEMENT, EXTRA = null) {
    const SCENE_OBJECTS = [

        // https://colorkit.co/palette/F5004A-FF004F-FF0058-0B0B0D-121214-18181B-1F1F23-26262Bvv-2E2E34/ folly_fever_color_codes

        {TAG: "highway", VALUE: "motorway", OBJECT: 0, HEIGHT: 1, WIDTH: 5, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "trunk", OBJECT: 0, HEIGHT: 1, WIDTH: 2, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "primary", OBJECT: 0, HEIGHT: 1, WIDTH: 4, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "secondary", OBJECT: 0, HEIGHT: 1, WIDTH: 3, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "residential", OBJECT: 0, HEIGHT: 1, WIDTH: 2.5, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "service", OBJECT: 0, HEIGHT: 1, WIDTH: 2, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "path", OBJECT: 0, HEIGHT: 1, WIDTH: 1, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "footway", OBJECT: 0, HEIGHT: 1, WIDTH: 1, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "cycleway", OBJECT: 0, HEIGHT: 1, WIDTH: 1, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },
        {TAG: "highway", VALUE: "default", OBJECT: 0, HEIGHT: 1, WIDTH: 3, COLOR_BELOW: 0xCECECE, COLOR_ABOVE: 0xFFFFFF, DARK_COLOR_BELOW: null, DARK_COLOR_ABOVE: null, FOLLY_FEVER_COLOR_BELOW: 0x121214, FOLLY_FEVER_COLOR_ABOVE: 0xFF004F, Y: 0 },

        {TAG: "railway", VALUE: "rail", OBJECT: 1, HEIGHT: 1, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "tram", OBJECT: 1, HEIGHT: 1, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "subway", OBJECT: 1, HEIGHT: 1, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "station", OBJECT: 1, HEIGHT: 0, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "platform", OBJECT: 1, HEIGHT: 0, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "default", OBJECT: 1, HEIGHT: 1, COLOR: 0xCECECE, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "building", VALUE: "yes", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "house", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "apartments", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "industrial", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "commercial", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "default", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "landuse", VALUE: "residential", OBJECT: 3, HEIGHT: 0, COLOR: 0xE8F0EA, DARK_COLOR: 0x2B3A2F, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "industrial", OBJECT: 3, HEIGHT: 0, COLOR: 0xF0E6E6, DARK_COLOR: 0x3B2F2F, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "commercial", OBJECT: 3, HEIGHT: 0, COLOR: 0xE8EAF2, DARK_COLOR: 0x2F2F46, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "farmland", OBJECT: 3, HEIGHT: 0.5, COLOR: 0xEEF2D8, DARK_COLOR: 0x253422, FOLLY_FEVER_COLOR: 0x2E2E34, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "forest", OBJECT: 3, HEIGHT: 10, COLOR: 0xE1F0E5, DARK_COLOR: 0x17321F, FOLLY_FEVER_COLOR: 0x1F1F23, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "grass", OBJECT: 3, HEIGHT: 0.5, COLOR: 0xE6F4E4, DARK_COLOR: 0x21331F, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "default", OBJECT: 3, HEIGHT: 0, COLOR: 0xE6F4E4, DARK_COLOR: 0x21331F, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "natural", VALUE: "wood", OBJECT: 4, HEIGHT: 0, COLOR: 0xDCEFE0, DARK_COLOR: 0x153018, FOLLY_FEVER_COLOR: 0x1F1F23, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "water", OBJECT: 4, HEIGHT: 0.25, COLOR: 0xDCECF6, DARK_COLOR: 0x0F2A3A, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "peak", OBJECT: 4, HEIGHT: 0, COLOR: 0xECECEC, DARK_COLOR: 0x322F2B, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "beach", OBJECT: 4, HEIGHT: 0.75, COLOR: 0xF4E8D6, DARK_COLOR: 0x3A2F23, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "tree", OBJECT: 4, HEIGHT: 7.5, COLOR: 0xD6EDD9, DARK_COLOR: 0x1B4426, FOLLY_FEVER_COLOR: 0x1F1F23, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "wetland", OBJECT: 4, HEIGHT: 0.25, COLOR: 0xE0F2EC, DARK_COLOR: 0x12332A, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "default", OBJECT: 4, HEIGHT: 0.25, COLOR: 0xE0F2EC, DARK_COLOR: 0x12332A, FOLLY_FEVER_COLOR: 0x26262B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "waterway", VALUE: "river", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xD6ECF7, DARK_COLOR: 0x0D3B55, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "stream", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xE0F2FA, DARK_COLOR: 0x0C2E42, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "canal", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xDCEFF8, DARK_COLOR: 0x0B2A3A, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "default", OBJECT: 5, HEIGHT: 0, COLOR: 0xDCEFF8, DARK_COLOR: 0x0B2A3A, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "water", VALUE: "lake", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xD6ECF7, DARK_COLOR: 0x062635, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "pond", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xE0F2FA, DARK_COLOR: 0x063042, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "reservoir", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xDCEFF8, DARK_COLOR: 0x042B39, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "default", OBJECT: 5, HEIGHT: 0, COLOR: 0xDCEFF8, DARK_COLOR: 0x042B39, FOLLY_FEVER_COLOR: 0xFF0058, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "amenity", VALUE: "school", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "hospital", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "police", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "fire_station", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "parking", OBJECT: 6, HEIGHT: 0.5, COLOR: 0xDDDDDD, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "restaurant", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "toilets", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "default", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, FOLLY_FEVER_COLOR: 0xFF004F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "place", VALUE: "continent", OBJECT: 7, HEIGHT: 0, COLOR: 0xECECF2, DARK_COLOR: 0x1B1B2A, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "country", OBJECT: 7, HEIGHT: 0, COLOR: 0xEAE8F0, DARK_COLOR: 0x1C1620, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "city", OBJECT: 7, HEIGHT: 0, COLOR: 0xE6E2EA, DARK_COLOR: 0x2A1F27, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "town", OBJECT: 7, HEIGHT: 0, COLOR: 0xE8E4E8, DARK_COLOR: 0x262126, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "village", OBJECT: 7, HEIGHT: 0, COLOR: 0xECE8EC, DARK_COLOR: 0x221B1F, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "hamlet", OBJECT: 7, HEIGHT: 0, COLOR: 0xF0ECEF, DARK_COLOR: 0x1F1518, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "default", OBJECT: 7, HEIGHT: 0, COLOR: 0xF0ECEF, DARK_COLOR: 0x1F1518, FOLLY_FEVER_COLOR: 0xF5004A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "leisure", VALUE: "park", OBJECT: 8, HEIGHT: 0.75, COLOR: 0xE2F2E5, DARK_COLOR: 0x102712, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "pitch", OBJECT: 8, HEIGHT: 0.25, COLOR: 0xDCF0E4, DARK_COLOR: 0x163022, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "stadium", OBJECT: 8, HEIGHT: 10, COLOR: 0xECECEC, DARK_COLOR: 0x1B1720, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "playground", OBJECT: 8, HEIGHT: 1.5, COLOR: 0xF0E2E2, DARK_COLOR: 0x2A1E1E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "default", OBJECT: 8, HEIGHT: 0, COLOR: 0xF0E2E2, DARK_COLOR: 0x2A1E1E, FOLLY_FEVER_COLOR: 0x121214, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
    ];

    for (const OBJECT of SCENE_OBJECTS) {
        if ( OBJECT.TAG in ELEMENT.tags) {
            //console.log("Match for tag " + OBJECT.TAG + " with value " + OBJECT.VALUE + "\nElement tags: " + ELEMENT.tags + "\nOBJECT.OBJECT: " + OBJECT.OBJECT);
            if (OBJECT.HEIGHT <= 0) { continue }
            if ( (ELEMENT.tags[OBJECT.TAG] === OBJECT.VALUE) || ((!ELEMENT.tags[OBJECT.TAG] || !ELEMENT.tags[OBJECT.TAG].hasValue) && OBJECT.VALUE === "default") ) {
                if (OBJECT.OBJECT === 0 || OBJECT.OBJECT === 1) {
                    if (CCONFIG.getConfigValue("follyFeverMode") === true) {
                        return createWayGeometry(POINTS_ARRAY, OBJECT.OBJECT, OBJECT.WIDTH , 0.6, OBJECT.FOLLY_FEVER_COLOR_BELOW, OBJECT.FOLLY_FEVER_COLOR_ABOVE);
                    }
                    return createWayGeometry(POINTS_ARRAY, OBJECT.OBJECT, OBJECT.WIDTH , 0.6, OBJECT.COLOR_BELOW, OBJECT.COLOR_ABOVE);
                }
                if (OBJECT.OBJECT === 2) {
                    let height = OBJECT.HEIGHT;
                    if (ELEMENT.tags.height) {
                        const parsedHeight = parseFloat(ELEMENT.tags.height);
                        if (!isNaN(parsedHeight)) {
                            height = parsedHeight;
                        }
                    }
                }
                if (CCONFIG.getConfigValue("follyFeverMode") === true) {
                    return createCustomGeometry(POINTS_ARRAY, OBJECT.FOLLY_FEVER_COLOR, OBJECT.HEIGHT, OBJECT.Y);
                }
                return createCustomGeometry(POINTS_ARRAY, OBJECT.COLOR, OBJECT.HEIGHT, OBJECT.Y);
            }
        } else {

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




