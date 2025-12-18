import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as HELPER from './helper.js'
import * as CONFIG from './config.js'
import * as DATA from './data.js'

import Stats from 'three/examples/jsm/libs/stats.module.js';
import {randInt} from "three/src/math/MathUtils.js";

import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';


let prevTime = Date.now();
let keys = {};
let renderTicksCounter = 0
let counter = 0;


try {
    if (CONFIG.loadLocalStorageConfig("debug").hasAssignment) {
    };
} catch (err) {
    CONFIG.initializeLocalStorageConfig()
}

let debugMode = false;
if (CONFIG.loadLocalStorageConfig("debug").toString() === "true") {
    debugMode = true;
}
const DEBUG = debugMode;
// console.log("Debug mode: " + debugMode);
// console.log(CONFIG.loadLocalStorageConfig("debug").toString());



const FOV = CONFIG.loadLocalStorageConfig("fov");
const ASPECT = ( window.innerWidth / window.innerHeight );
const NEAR = CONFIG.loadLocalStorageConfig("near");
const FAR = CONFIG.loadLocalStorageConfig("far");

const CANVAS = document.getElementById('c');
const RENDERER = new THREE.WebGLRenderer();
const SCENE = new THREE.Scene();
const CAMERA = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR)
const STATS = new Stats();
const GUI = new THREEGUI.GUI();
const EVALUATOR = new THREECSG.Evaluator();

const GUI_PARAMS = {
    CameraSettings: {
        moveSpeed: CONFIG.loadLocalStorageConfig("moveSpeed"),
        mouseSensitivity: CONFIG.loadLocalStorageConfig("mouseSensitivity"),
        x: CONFIG.loadLocalStorageConfig("cameraX"),
        y: CONFIG.loadLocalStorageConfig("cameraY"),
        z: CONFIG.loadLocalStorageConfig("cameraZ"),
        yaw: CONFIG.loadLocalStorageConfig("yaw"),
        pitch: CONFIG.loadLocalStorageConfig("pitch")
    },
    LocationSettings: {
        latitude: CONFIG.loadLocalStorageConfig("lat"),
        longitude: CONFIG.loadLocalStorageConfig("lon"),
        radius: CONFIG.loadLocalStorageConfig("radius"),
    },
    RendererSettings: {
        debug: CONFIG.loadLocalStorageConfig("debug"),
        renderTicks: renderTicksCounter,
        update: function() {location.reload();}
    },
    Download: {
        exportOBJ: function() {downloadSceneAsOBJ(SCENE);}
    }
};

const CAMERA_SETTINGS = GUI.addFolder( 'Camera settings' );
const LOCATION_SETTINGS = GUI.addFolder( 'Location settings' );
const RENDERER_SETTINGS = GUI.addFolder( 'Scene settings' );
const DOWNLOAD = GUI.addFolder( 'Download' );

const RADIUS = CONFIG.loadLocalStorageConfig("radius");
const BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,} );
const BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( RADIUS, RADIUS, 300, 512, 1,), BOUNDS_CIRCLE_MATERIAL );
const DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: true, opacity: 0.1, side: THREE.DoubleSide,} );
const DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( RADIUS, RADIUS, 300, 512, 1,), DEBUG_BOUNDS_CIRCLE_MATERIAL );
DEBUG_BOUNDS_CIRCLE.position.y = 45;


async function init() {

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


    document.body.appendChild( STATS.dom );
    STATS.showPanel( 0 )


    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'x' ).onChange(newXPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(newXPos), parseFloat(cameraPos.y), parseFloat(cameraPos.z));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'y' ).onChange(newYPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(cameraPos.x), parseFloat(newYPos), parseFloat(cameraPos.z));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'z' ).onChange(newZPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(cameraPos.x), parseFloat(cameraPos.y), parseFloat(newZPos));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'yaw', 0, 360 ).onChange(newYaw => {
        let pitch = CONFIG.loadLocalStorageConfig("pitch");
        CAMERA.rotation.set( pitch, ( newYaw * ( Math.PI / 180 ) ), 0, 'YXZ');
        CONFIG.saveLocalStorageConfig("yaw", newYaw.toFixed(3));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'pitch', -90, 90 ).onChange(newPitch=> {
        let yaw = CONFIG.loadLocalStorageConfig("yaw")
        CAMERA.rotation.set( ( parseInt( newPitch ) * ( Math.PI / 180 ) ), yaw, 0, 'YXZ');
        CONFIG.saveLocalStorageConfig("pitch", newPitch.toFixed(3));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'moveSpeed', 0.01, 10 ).onChange(moveSpeed => {
        CONFIG.saveLocalStorageConfig("moveSpeed", moveSpeed);
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'mouseSensitivity', 0.001, 0.01 ).onChange(mouseSensitivity => {
        CONFIG.saveLocalStorageConfig("mouseSensitivity", mouseSensitivity);
    });
    CAMERA_SETTINGS.open();

    LOCATION_SETTINGS.add( GUI_PARAMS.LocationSettings, 'latitude' ).onChange(v => {
        localStorage.setItem("lat", v);
    }).listen();
    LOCATION_SETTINGS.add( GUI_PARAMS.LocationSettings, 'longitude' ).onChange(v => {
        localStorage.setItem("lon", v);
    }).listen();
    LOCATION_SETTINGS.add( GUI_PARAMS.LocationSettings, 'radius', 100, 3000 ).onChange(v => {
        localStorage.setItem("radius", v);
    }).listen();
    LOCATION_SETTINGS.open();

    RENDERER_SETTINGS.add( GUI_PARAMS.RendererSettings, 'renderTicks' ).listen();
    RENDERER_SETTINGS.add( GUI_PARAMS.RendererSettings, 'debug' ).onChange( v => {
        localStorage.setItem("debug", v.toString());
        location.reload();
    }).listen();
    RENDERER_SETTINGS.add( GUI_PARAMS.RendererSettings, 'update' ).listen();
    RENDERER_SETTINGS.open();

    DOWNLOAD.add( GUI_PARAMS.Download, 'exportOBJ' );
    DOWNLOAD.open()


    CAMERA.rotation.set(0, 10, 0, 'YXZ');


    const AMBIENT_LIGHT = new THREE.AmbientLight( 0xcccccc );
    SCENE.add( AMBIENT_LIGHT );


    const CAMERA_FAR = CONFIG.loadLocalStorageConfig( "far" );
    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight( 0xffffff, 4 );
    DIRECTIONAL_LIGHT.position.set( 5000, 3000 , 5000 );
    DIRECTIONAL_LIGHT.castShadow = true;
    DIRECTIONAL_LIGHT.shadow.mapSize.width = 512 * ( RADIUS / 10 );
    DIRECTIONAL_LIGHT.shadow.mapSize.height = 512 * ( RADIUS / 10 );
    DIRECTIONAL_LIGHT.shadow.camera.near = 0.5;
    DIRECTIONAL_LIGHT.shadow.camera.far = ( CAMERA_FAR );
    DIRECTIONAL_LIGHT.shadow.camera.left = ( 2 * -RADIUS / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.right = ( 2 * RADIUS / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.top = ( 2 * RADIUS / 1.5 );
    DIRECTIONAL_LIGHT.shadow.camera.bottom = ( 2 * -RADIUS / 1.5 );
    SCENE.add( DIRECTIONAL_LIGHT );


    const HEMI_LIGHT = new THREE.HemisphereLight( 0xffffff, 0x444444, 1 );
    HEMI_LIGHT.position.set( 0, 200, 0 );
    SCENE.add( HEMI_LIGHT );


    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xd3d3d3 });
    const BASEPLATE = new THREE.Mesh(new THREE.CylinderGeometry( RADIUS, RADIUS, 5, 512, 1,), BASEPLATE_MATERIAL );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;
    SCENE.add( BASEPLATE );

    const BASEPLATE_EDGE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xa0a0a0 });
    const BASEPLATE_EDGE = new THREE.Mesh(new THREE.CylinderGeometry( RADIUS+5, RADIUS+5, 10, 512, 1, ), BASEPLATE_EDGE_MATERIAL );
    BASEPLATE_EDGE.position.set(0, -7, 0);
    BASEPLATE_EDGE.receiveShadow = true;
    const result = EVALUATOR.evaluate(new THREECSG.Brush(BASEPLATE_EDGE.geometry, BASEPLATE_EDGE.material), BOUNDS_CIRCLE, THREECSG.SUBTRACTION);
    const csgMesh = new THREE.Mesh(result.geometry, BASEPLATE_EDGE.material);
    SCENE.add(csgMesh);


    EVALUATOR.useGroups = true;
    EVALUATOR.consolidateGroups = true;
}

function pointsArrayToScene(element, pointsArray, innerGeometries = []) {

    if ((pointsArray || !(pointsArray.length === 0)) && (element.tags) && innerGeometries.length === 0) {

        if ((element.tags.water || element.tags.natural === "water")) {
            const waterMesh = createWaterGeometry(pointsArray);
            SCENE.add(waterMesh);
        }

        if ((element.tags.building || element.tags['building:part']) || (element.members) || (element.tags['type:building'])) {
            let buildingMesh
            if (element.tags.height) {
                buildingMesh = createBuildingGeometry(pointsArray, parseFloat(element.tags.height));
            } else if (element.tags['building:levels']) {
                buildingMesh = createBuildingGeometry(pointsArray, parseFloat(element.tags['building:levels']) * 3);
            } else {
                buildingMesh = createBuildingGeometry(pointsArray, randInt(9,10));
            }
            SCENE.add(buildingMesh);
        }

        if (element.tags.leisure) {
            let leisureMesh;
            if (element.tags.leisure === "park" || element.tags.leisure === "dog_park") {
                leisureMesh = createParkGeometry(pointsArray);
            } else if (element.tags.leisure === "garden") {
                leisureMesh = createGardenGeometry(pointsArray);
            } else if (element.tags.leisure === "pitch") {
                leisureMesh = createPitchGeometry(pointsArray);
            } else if (element.tags.leisure === "playground") {
                leisureMesh = createPlaygroundGeometry(pointsArray);
            } else {
                leisureMesh = createParkGeometry(pointsArray);
            }
            SCENE.add(leisureMesh);
        }

        if (element.tags.railway) {
            if (element.tags.railway === "rail") {
                const railwayMesh = createRailwayGeometry(pointsArray);
                SCENE.add(railwayMesh);
            }
        }

        if (element.tags.highway) {
            let type
            const highways = [
                {highway: "motorway", type: 0},
                {highway: "trunk", type: 0},
                {highway: "primary", type: 0},
                {highway: "secondary", type: 0},
                {highway: "residential", type: 0},
                {highway: "tertiary", type: 0},
                {highway: "unclassified", type: 0},
                {highway: "service", type: 0}
            ];
            for (const h of highways) {
                if (element.tags.highway === h.highway) {
                    type = h.type;
                    break;
                }
            }
            const highwayMesh = createHighwayGeometry(pointsArray, type);
            SCENE.add(highwayMesh);
        }

        if (element.tags.amenity) {
            if (element.tags.amenity === "parking") {
                const parkingMesh = createParkingGeometry(pointsArray, element.tags.capacity);
                SCENE.add(parkingMesh);
            }
        }

        if (element.tags.landuse) {
            let landuseMesh;

            if (element.tags.landuse === "forest") {
                landuseMesh = createForestGeometry(pointsArray);
            } else if (element.tags.landuse === "farmland") {
                landuseMesh = createFarmlandGeometry(pointsArray);
            } else if (element.tags.landuse === "park" || element.tags.landuse === "meadow" || element.tags.landuse === "grass") {
                landuseMesh = createParkGeometry(pointsArray);
            }
            SCENE.add(landuseMesh);
        }

    } else if (pointsArray && pointsArray.length > 0 && innerGeometries && innerGeometries.length > 0) {
        let mainMesh;
        for (let mainGeometry of pointsArray) {
            let mainTempMesh
            if (!mainMesh) {
                mainMesh = createCustomBoxGeometry(mainGeometry, 0xE0A030, 10, 15, false);
                try {
                    const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(mainMesh.geometry, mainMesh.material), THREECSG.INTERSECTION);
                    mainMesh = new THREE.Mesh(result.geometry, mainMesh.material);
                } catch (error) {
                    console.error("CSG operation failed for main geometry of element id " + element.id + ": " + error);
                }
            }
            mainTempMesh = createCustomBoxGeometry(mainGeometry, 0xE0A030, 10, 15, false);
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
            const tempMesh = createCustomBoxGeometry(innerGeometry, 0xE0A030, 100, -50, false);
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
    } else {
        createCustomLineGeometry(pointsArray, 0xE0A030);
    }
}

function getGeometry(element) {
    console.log(element)
    if (element.geometry) {
        return element.geometry;
    }
    return null;
}

async function loadScene() {
    let request;
    try {
        const res = await fetch('/data.json');
        if (res.ok) {
            throw new Error("NOT ACTIVE");
            request = await res.json();
            if (!request || !request.elements) throw new Error("Empty or invalid data.json.");
            console.log("Loaded data from data.json");
        } else {
            throw new Error("data.json not available");
        }
    } catch (err) {
        for ( let i = 0; i < 5; i++ ) {
            try {
                request = await DATA.queryAreaData(HELPER.getMaxMinCoordsOfArea(CONFIG.loadLocalStorageConfig("lon"), CONFIG.loadLocalStorageConfig("lat"), RADIUS));
                break;
            } catch (error) {
                console.error("Error fetching data from Overpass API, retrying in 5 sec. (Attempt " + (i+1) + " of 5)");
                await HELPER.sleep(5000);
            }
        }
    }
    console.log(request)
    console.log(request.elements)
    if (!request) {
        throw new Error("No data returned from Overpass API or `data.json`.");
    } else {
        let pointsArray;
        const centerMetric = HELPER.toMetricCoords( CONFIG.loadLocalStorageConfig("lat"), CONFIG.loadLocalStorageConfig("lon") );
        for (let element of (request.elements)) {
            if (element.members) {
                let mainGeometries = [];
                let innerGeometries = [];
                for (let member of element.members) {
                    let mainGeometriesPointsArray = [];
                    let innerGeometryPointsArray = [];
                    if (member.role === "outer" && member.type === "way") {
                        const geometry = getGeometry(member)
                        for (let geoPoint of (geometry)) {
                            const metricCoords = HELPER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                            if (metricCoords) {
                                const x = metricCoords[0] - centerMetric[0];
                                const z = metricCoords[1] - centerMetric[1];
                                mainGeometriesPointsArray.push({x: x, y: 0, z: z});
                            }
                        }
                        mainGeometries.push(mainGeometriesPointsArray);
                    } else if (member.role === "inner" && member.type === "way") {
                        const geometry = getGeometry(member)
                        for (let geoPoint of (geometry)) {
                            const metricCoords = HELPER.toMetricCoords(geoPoint.lat, geoPoint.lon);
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
                    const metricCoords = HELPER.toMetricCoords(geoPoint.lat, geoPoint.lon);
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
    }
}

function createHighwayGeometry(pointsArray, type = 1) {
    let colorHexAbove, colorHexBelow;
    let width = 1, height = 0.6;

    if (type > -1) {
        colorHexAbove = 0xE0E0E0;
        colorHexBelow = 0x707070;
    } else if (type > 0) {
        colorHexAbove = 0x7f7053;
        colorHexBelow = 0x7f7053;
        width = 0.5;
        height = 0.2;
    } else {
        colorHexAbove = 0xE0E0E0;
        colorHexBelow = 0x707070;
    }

    const materialBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    const materialAbove = new THREE.MeshStandardMaterial({ color: colorHexAbove });
    const group = new THREE.Group();

    const halfWidthBelow = 3.5 * width / 2;
    const halfWidthAbove = 2 * width / 2;

    function createCSG(geom, pos, angle, material) {
        const matrix = new THREE.Matrix4()
            .makeRotationY(angle)
            .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
        geom.applyMatrix4(matrix);
        const brush = new THREECSG.Brush(geom, material);
        const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
        return new THREE.Mesh(result.geometry, material);
    }

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const angle = Math.atan2(dz, dx);
        const midPos = { x: (p0.x + p1.x) / 2, y: height/2, z: (p0.z + p1.z) / 2 };

        const streetBelow = createCSG(new THREE.BoxGeometry(length, height, 3.5 * width), midPos, -angle, materialBelow);
        const streetAbove = createCSG(new THREE.BoxGeometry(length, height + 0.1, 2 * width), midPos, -angle, materialAbove);

        streetBelow.receiveShadow = true;
        streetAbove.receiveShadow = true;

        group.add(streetBelow);
        group.add(streetAbove);

        const connectorBelow = createCSG(new THREE.CylinderGeometry(halfWidthBelow, halfWidthBelow, height, 16), { x: p0.x, y: height/2, z: p0.z }, 0, materialBelow);
        const connectorAbove = createCSG(new THREE.CylinderGeometry(halfWidthAbove, halfWidthAbove, height + 0.1, 16), { x: p0.x, y: height/2, z: p0.z }, 0, materialAbove);

        connectorBelow.receiveShadow = true;
        connectorAbove.receiveShadow = true;

        group.add(connectorBelow);
        group.add(connectorAbove);
    }

    const plast = pointsArray[pointsArray.length - 1];
    const connectorBelow = createCSG(new THREE.CylinderGeometry(halfWidthBelow, halfWidthBelow, height, 16), { x: plast.x, y: height/2, z: plast.z }, 0, materialBelow);
    const connectorAbove = createCSG(new THREE.CylinderGeometry(halfWidthAbove, halfWidthAbove, height + 0.1, 16), { x: plast.x, y: height/2, z: plast.z }, 0, materialAbove);

    connectorBelow.receiveShadow = true;
    connectorAbove.receiveShadow = true;

    group.add(connectorBelow);
    group.add(connectorAbove);

    return group;
}

function createRailwayGeometry(pointsArray) {
    const COLOR_HEX = 0x707070
    const WIDTH = 1
    const HEIGHT = 0.4;

    const RAIL_MATERIAL = new THREE.MeshStandardMaterial({ color: COLOR_HEX });
    const GROUP = new THREE.Group();

    const halfWidthBelow = 3.5 * WIDTH / 2;

    function createCSG(geom, pos, angle, material) {
        const matrix = new THREE.Matrix4()
            .makeRotationY(angle)
            .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
        geom.applyMatrix4(matrix);
        const brush = new THREECSG.Brush(geom, material);
        const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
        return new THREE.Mesh(result.geometry, material);
    }

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const angle = Math.atan2(dz, dx);
        const midPos = { x: (p0.x + p1.x) / 2, y: HEIGHT/2, z: (p0.z + p1.z) / 2 };

        const railBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, 3.5 * WIDTH), midPos, -angle, RAIL_MATERIAL);

        railBelow.receiveShadow = true;

        GROUP.add(railBelow);

        const connectorBelow = createCSG(new THREE.CylinderGeometry(halfWidthBelow, halfWidthBelow, HEIGHT, 16), { x: p0.x, y: HEIGHT/2, z: p0.z }, 0, RAIL_MATERIAL);

        connectorBelow.receiveShadow = true;

        GROUP.add(connectorBelow);
    }

    const plast = pointsArray[pointsArray.length - 1];
    const connectorBelow = createCSG(new THREE.CylinderGeometry(halfWidthBelow, halfWidthBelow, HEIGHT, 16), { x: plast.x, y: HEIGHT/2, z: plast.z }, 0, RAIL_MATERIAL);

    connectorBelow.receiveShadow = true;

    GROUP.add(connectorBelow);

    return GROUP;
}


function createBuildingGeometry(pointsArray, height) {
    const colorHex = 0xE0A030;
    return createCustomBoxGeometry(pointsArray, colorHex, height);
}

function createParkingGeometry(pointsArray, capacity) {
    const colorHex = 0xE0E0E0;
    const mesh = createCustomBoxGeometry(pointsArray, colorHex, 0.25);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh
}

function createFarmlandGeometry(pointsArray) {
    let colorHex = 0xEABB63 ;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.15);
}

function createForestGeometry(pointsArray) {
    let colorHex = 0x208030;
    return createCustomBoxGeometry(pointsArray, colorHex, 7).castShadow = true;
}

function createParkGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.2);
}

function createGardenGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.3);
}

function createPitchGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.25);
}

function createPlaygroundGeometry(pointsArray) {
    let colorHex = 0x70B070;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.15);
}

function createWaterGeometry(pointsArray) {
    let colorHex = 0x3E8fe0;
    const mesh = createCustomBoxGeometry(pointsArray, colorHex, 4);
    mesh.material.transparent = true;
    mesh.material.opacity = 0.65;
    mesh.position.y = -3.5;
    mesh.castShadow = false;
    return mesh;
}

function createCustomLineGeometry(pointsArray, colorHex) {
    const material = new THREE.LineBasicMaterial({ color: colorHex });
    const points = [];
    for (let i = 0; i < pointsArray.length; i++) {
        points.push(new THREE.Vector3(pointsArray[i].x, pointsArray[i].y, pointsArray[i].z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setFromPoints(points);
    return new THREE.Line(geometry, material);
}

function createCustomBoxGeometry(pointsArray, colorHex, height = 1, yPos = 0, formatedData = true ,bevelEnabled = false, bevelThickness = 0.2, bevelSize = 0.2, bevelSegments = 1, steps = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(pointsArray[0]. x, pointsArray[0]. z);
    for (let i = 1; i < pointsArray.length; i++) {
        shape.lineTo(pointsArray[i].x, pointsArray[i].z);
    }
    const extrudeSettings = {
        steps: steps,
        depth: height,
        bevelEnabled: bevelEnabled,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelSegments: bevelSegments
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
        color: colorHex,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = yPos;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (formatedData === false) {return mesh;}

    const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( mesh.geometry, mesh.material ), THREECSG.INTERSECTION );
    const csgMesh = new THREE.Mesh( result.geometry, mesh.material );
    csgMesh.castShadow = true;
    csgMesh.material.side = THREE.DoubleSide;
    csgMesh.geometry.scale( 1,-1, 1 );
    csgMesh.geometry.computeVertexNormals();
    return csgMesh
}



function updateMovementSpeed(MouseWheelEvent) {
    let moveSpeed = CONFIG.loadLocalStorageConfig("moveSpeed");
    if (MouseWheelEvent.deltaY < 0) {
        moveSpeed += 0.01;
    } else {
        moveSpeed -= 0.01;
        if (moveSpeed < 0.01) {
            moveSpeed = 0.01;
        }
    }
    CONFIG.saveLocalStorageConfig("moveSpeed", moveSpeed.toFixed(2));
    GUI_PARAMS.CameraSettings.moveSpeed = CONFIG.loadLocalStorageConfig("moveSpeed").toFixed(2);
}

function downloadSceneAsOBJ(scene, filename = 'scene.obj') {
    const exporter = new OBJExporter();
    const objData = exporter.parse(scene);

    const blob = new Blob([objData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}


window.addEventListener('resize', render);
window.addEventListener("wheel", event => updateMovementSpeed(event));
document.addEventListener('keydown', (e) => keys[e.code] = true)
document.addEventListener('keyup', (e) => keys[e.code] = false)

const pointerTarget = RENDERER?.domElement ?? document.getElementById('c');
if (pointerTarget) {
    pointerTarget.tabIndex = pointerTarget.tabIndex || 0;
    pointerTarget.style.outline = 'none';

    pointerTarget.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (document.pointerLockElement === pointerTarget) {
            document.exitPointerLock();
        } else {
            pointerTarget.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const locked = document.pointerLockElement === pointerTarget;
        document.body.style.cursor = locked ? 'none' : 'default';
    });

    document.addEventListener('pointerlockerror', (err) => {
        console.error('Pointer lock error', err);
    });

    document.addEventListener('mousemove', (e) => {
        let yaw, pitch;
        try {
            yaw = CAMERA.rotation.y
            pitch = CAMERA.rotation.x
        } catch (e) {
            yaw = CONFIG.loadLocalStorageConfig( "yaw" );
            pitch = CONFIG.loadLocalStorageConfig( "pitch" );
        }
        let mouseSensitivity = CONFIG.loadLocalStorageConfig( "mouseSensitivity" );

        if (document.pointerLockElement === pointerTarget) {
            yaw -= e.movementX * mouseSensitivity;
            pitch -= e.movementY * mouseSensitivity;
            //console.log( "Pitch: " + pitch * ( 180 / Math.PI )  + "; Yaw: " + yaw * ( 180 / Math.PI ) );
            if ( pitch > ( Math.PI / 2 ) ) {
                pitch = ( Math.PI / 2 )
            } else if ( pitch < -( Math.PI / 2 ) ) {
                pitch = -( Math.PI / 2 );
            }
            if (yaw > ( 2 * Math.PI ) ) {
                yaw = yaw - ( 2 * Math.PI );
            } else if ( yaw < 0 && yaw < ( 2 * Math.PI ) ) {
                yaw = yaw + ( 2 * Math.PI );
            }
            CAMERA.rotation.set( pitch, yaw, 0, 'YXZ' );
        }
        CONFIG.saveLocalStorageConfig("yaw", yaw);
        CONFIG.saveLocalStorageConfig("pitch", pitch);
        CONFIG.saveLocalStorageConfig("mouseSensitivity", mouseSensitivity);
    });
} else {
    console.warn('Pointer lock: no canvas element found (RENDERER.domElement or #c).');
}





// =-= Render Loop =-= //
function render() {
    if (!CAMERA || !RENDERER) { return; }

    renderTicksCounter++;
    GUI_PARAMS.RendererSettings.renderTicks = renderTicksCounter;

    const currentTime = Date.now();
    const delta = (currentTime - prevTime) / 1000; // seconds
    prevTime = currentTime;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(CAMERA.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(CAMERA.quaternion);
    right.y = 0;
    right.normalize();

    const speed = CONFIG.loadLocalStorageConfig("moveSpeed") * (delta * 60);
    if (keys['KeyW']) CAMERA.position.addScaledVector(forward, speed);
    if (keys['KeyS']) CAMERA.position.addScaledVector(forward, -speed);
    if (keys['KeyA']) CAMERA.position.addScaledVector(right, -speed);
    if (keys['KeyD']) CAMERA.position.addScaledVector(right, speed);

    if (keys['Space']) {CAMERA.position.y += speed;}
    if (keys['ShiftLeft']) {CAMERA.position.y -= speed}

    if (DEBUG) {
        DEBUG_BOUNDS_CIRCLE.visible = true;
    } else {
        DEBUG_BOUNDS_CIRCLE.visible = false;
    }

    STATS.begin();
    RENDERER.render(SCENE, CAMERA);
    STATS.end();

    GUI_PARAMS.CameraSettings.x = CAMERA.position.x.toFixed(3);
    GUI_PARAMS.CameraSettings.y = CAMERA.position.y.toFixed(3);
    GUI_PARAMS.CameraSettings.z = CAMERA.position.z.toFixed(3);
    if ( CAMERA.rotation.y > ( 2 * Math.PI ) ) {
        CAMERA.rotation.y = CAMERA.rotation.y - ( 2 * Math.PI );
    } else if ( CAMERA.rotation.y < 0 && CAMERA.rotation.y < ( 2 * Math.PI ) ) {
        CAMERA.rotation.y = CAMERA.rotation.y + ( 2 * Math.PI );
    }
    GUI_PARAMS.CameraSettings.yaw = ( CAMERA.rotation.y * ( 180 / Math.PI ) ).toFixed(3);
    if (CAMERA.rotation.x > ( Math.PI / 2 ) ) {
        CAMERA.rotation.x = ( Math.PI / 2 );
    } else if (CAMERA.rotation.x < -( Math.PI / 2 )) {
        CAMERA.rotation.x = - ( Math.PI / 2 );
    }
    GUI_PARAMS.CameraSettings.pitch = ( CAMERA.rotation.x * ( 180 / Math.PI ) ).toFixed(3);

    // console.log(GUI_PARAMS.CameraSettings.pitch + " : " + ( CAMERA.rotation.x * ( 180 / Math.PI ) ) + "; " + GUI_PARAMS.CameraSettings.yaw + " : " + ( CAMERA.rotation.y * ( 180 / Math.PI ) ) );
}

await init()
await loadScene()