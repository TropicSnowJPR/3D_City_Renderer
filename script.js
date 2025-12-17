import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'

import * as HELPER from './helper.js'
import * as CONFIG from './config.js'
import * as DATA from './data.js'

import Stats from 'three/examples/jsm/libs/stats.module.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {randInt} from "three/src/math/MathUtils.js";
import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

let prevTime = Date.now();
let keys = {};

let debugMode = false;
if (CONFIG.loadLocalStorageConfig("debug").toString() === "true") {
    debugMode = true;
}
const DEBUG = debugMode;
console.log("Debug mode: " + debugMode);
console.log(CONFIG.loadLocalStorageConfig("debug").toString());

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
const FONTLOADER = new FontLoader();
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
    SceneSettings: {
        debug: CONFIG.loadLocalStorageConfig("debug"),
        update: function() {location.reload();}
    }
};

const CAMERA_SETTINGS = GUI.addFolder( 'Camera settings' );
const LOCATION_SETTINGS = GUI.addFolder( 'Location settings' );
const SCENE_SETTINGS = GUI.addFolder( 'Scene settings' );

const FONT = await FONTLOADER.loadAsync( 'https://raw.githubusercontent.com/mrdoob/three.js/refs/heads/dev/examples/fonts/helvetiker_regular.typeface.json' );

const RADIUS = CONFIG.loadLocalStorageConfig("radius");
const BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,} );
const BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( RADIUS, RADIUS, 100, 512, 1,), BOUNDS_CIRCLE_MATERIAL );
const DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: true, opacity: 0.1, side: THREE.DoubleSide,} );
const DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( RADIUS, RADIUS, 100, 512, 1,), DEBUG_BOUNDS_CIRCLE_MATERIAL );
DEBUG_BOUNDS_CIRCLE.position.y = 45;
SCENE.add( DEBUG_BOUNDS_CIRCLE );


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

    SCENE_SETTINGS.add( GUI_PARAMS.SceneSettings, 'update' );
    SCENE_SETTINGS.add( GUI_PARAMS.SceneSettings, 'debug' ).onChange( v => {
        console.log("Setting debug mode to: " + v.toString());
        localStorage.setItem("debug", v.toString());
        console.log("Debug mode set to: " + v.toString());
        location.reload();
    }).listen();
    SCENE_SETTINGS.open();


    CAMERA.rotation.set(0, 0, 0, 'YXZ');


    const AMBIENT_LIGHT = new THREE.AmbientLight( 0xcccccc );
    SCENE.add( AMBIENT_LIGHT );


    const CAMERA_FAR = CONFIG.loadLocalStorageConfig( "far" );
    const DIRECTIONAL_LIGHT = new THREE.DirectionalLight( 0xffffff, 4 );
    DIRECTIONAL_LIGHT.position.set( ( 1.5 * RADIUS ), 1000, RADIUS );
    DIRECTIONAL_LIGHT.castShadow = true;
    DIRECTIONAL_LIGHT.shadow.mapSize.width = 512 * ( RADIUS / 100 );
    DIRECTIONAL_LIGHT.shadow.mapSize.height = 512 * ( RADIUS / 100 );
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


    const BASEPLATE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xbababa });
    const BASEPLATE = new THREE.Mesh(new THREE.CylinderGeometry( RADIUS, RADIUS, 5, 512, 512,), BASEPLATE_MATERIAL );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;
    SCENE.add( BASEPLATE );


    EVALUATOR.useGroups = true;
    EVALUATOR.consolidateGroups = true;
}


await init()
await loadScene()


function pointsArrayToScene(element, pointsArray, outside = false) {

    if ((pointsArray || !(pointsArray.length === 0)) && (element.tags)) {

        if ((element.tags.water || element.tags.natural === "water")) {
            const waterMesh = createWaterGeometry(pointsArray);
            const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( waterMesh.geometry, waterMesh.material ), THREECSG.INTERSECTION );
            const csgMesh = new THREE.Mesh( result.geometry, waterMesh.material );
            SCENE.add(csgMesh);
        }

        if (element.tags.building || element.tags['building:part']) {
            let height
            if (element.tags.height) {
                height = parseFloat(element.tags.height);
            } else if (element.tags['building:levels']) {
                height = parseFloat(element.tags['building:levels']) * 3;
            } else {
                height = randInt(9,10);
            }

            const buildingMesh = createBuildingGeometry(pointsArray, height);
            const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( buildingMesh.geometry, buildingMesh.material ), THREECSG.INTERSECTION );
            const csgMesh = new THREE.Mesh( result.geometry, buildingMesh.material );
            SCENE.add(csgMesh);
            //SCENE.add(buildingMesh);
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
            const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( leisureMesh.geometry, leisureMesh.material ), THREECSG.INTERSECTION );
            const csgMesh = new THREE.Mesh( result.geometry, leisureMesh.material );
            SCENE.add(csgMesh);
        }

        if (element.tags.railway) {
            if (element.tags.railway === "rail") {
                const railwayMesh = createRailwayGeometry(pointsArray);
                SCENE.add(railwayMesh);
            }
        }

        if (element.tags.highway) {
            let type
            const highways = [{highway: "motorway", type: 0}, {
                highway: "trunk", type: 0
            }, {highway: "primary", type: 0}, {highway: "secondary", type: 0}, {
                highway: "residential", type: 0
            }, {highway: "tertiary", type: 0}, {highway: "unclassified", type: 0}, {
                highway: "service", type: 0
            }];
            for (const h of highways) {
                if (element.tags.highway === h.highway) {
                    type = h.type;
                    break;
                }
            }
            const highwayMesh = _createHighwayGeometry(pointsArray, type);
            SCENE.add(highwayMesh);
        }

        if (element.tags.amenity) {
            if (element.tags.amenity === "parking") {
                const parkingMesh = createParkingGeometry(pointsArray, element.tags.capacity);
                const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( parkingMesh.geometry, parkingMesh.material ), THREECSG.INTERSECTION );
                const csgMesh = new THREE.Mesh( result.geometry, parkingMesh.material );
                SCENE.add(csgMesh);
            }
        }

        if (element.tags.landuse) {
            let landuseMesh;
            const lu = element.tags.landuse;

            if (lu === "forest") {
                landuseMesh = createForestGeometry(pointsArray);
            } else if (lu === "farmland") {
                landuseMesh = createFarmlandGeometry(pointsArray);
            } else if (lu === "park" || lu === "meadow" || lu === "grass") {
                landuseMesh = createParkGeometry(pointsArray);
            }

            if (landuseMesh) {
                const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(landuseMesh.geometry, landuseMesh.material), THREECSG.INTERSECTION);
                const csgMesh = new THREE.Mesh(result.geometry, landuseMesh.material);
                SCENE.add(csgMesh);
            }
        }

    } else {
        if (DEBUG) {
            const lineMesh = createCustomLineGeometry(pointsArray);
            SCENE.add(lineMesh);
        }
    }
}

function getGeometry(element) {
    if (element.geometry) return element.geometry;
    if (element.members) return element.members.flatMap(m => m.geometry || []);
    return null;
}

async function loadScene() {
    const LON = CONFIG.loadLocalStorageConfig("lon");
    const LAT = CONFIG.loadLocalStorageConfig("lat");
    const request = await DATA.queryAreaData(HELPER.getMaxMinCoordsOfArea( LON, LAT, RADIUS ));
    if (!request) {
        throw new Error("No data returned from Overpass API.");
    } else {
        let pointsArray;
        const centerMetric = HELPER.toMetricCoords( LAT, LON );
        for (let element of (request.elements)) {
            const geometry = getGeometry(element)
            pointsArray = [];
            let lastGeoPoint = [RADIUS + 1, RADIUS + 1];
            let outside = false;
            for (let geoPoint of (geometry)) {
                const metricCoords = HELPER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                if (metricCoords) {
                    const x = metricCoords[0] - centerMetric[0];
                    const z = metricCoords[1] - centerMetric[1];
                    if (!HELPER.isPointInsideRadius(x, z, 0, 0, RADIUS)) { outside = true; }
                    if (!HELPER.isPointInsideRadius(x, z, 0, 0, RADIUS) && element.tags && (element.tags.highway || element.tags.railway)) {
                        pointsArray.push({x: x, y: 0, z: z});
                        lastGeoPoint = [x, z];
                    } else if (!HELPER.isPointInsideRadius(x, z, 0, 0, (RADIUS + 5)) && element.tags && (element.tags.highway || element.tags.railway)) {
                        const closestPoint = HELPER.getClosestPointOnCircle({x: 0, y: 0}, RADIUS, {x: x, y: z});
                        pointsArray.push({x: closestPoint.x, y: 0, z: closestPoint.y});
                        lastGeoPoint = [closestPoint.x, closestPoint.y];
                        pointsArray.push({x: x, y: 0, z: z});
                    } else {
                        pointsArray.push({x: x, y: 0, z: z});
                    }
                }
            }
            if (pointsArray.length > 1) {
                pointsArrayToScene(element, pointsArray, outside);
            }
        }
    }
}

function _createHighwayGeometry(pointsArray, type = 1) {
    let colorHexAbove, colorHexBelow;
    let width = 1, height = 0.4;

    if (type > -1) {
        colorHexAbove = 0xE0E0E0;
        colorHexBelow = 0x707070;
    } else if (type > 0) {
        colorHexAbove = 0x7f7053;
        colorHexBelow = 0x7f7053;
        width = 0.5;
        height = 0.08;
    } else {
        colorHexAbove = 0xE0E0E0;
        colorHexBelow = 0x707070;
    }

    const materialBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    const materialAbove = new THREE.MeshStandardMaterial({ color: colorHexAbove });
    const group = new THREE.Group();

    const halfWidthBelow = 3.5 * width / 2;
    const halfWidthAbove = 2 * width / 2;

    // Helper function to create CSG for a geometry with position & rotation applied
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

        // Create street segments
        const streetBelow = createCSG(new THREE.BoxGeometry(length, height, 3.5 * width), midPos, -angle, materialBelow);
        const streetAbove = createCSG(new THREE.BoxGeometry(length, height + 0.1, 2 * width), midPos, -angle, materialAbove);

        streetBelow.receiveShadow = true;
        streetAbove.receiveShadow = true;

        group.add(streetBelow);
        group.add(streetAbove);

        // Create connector at p0
        const connectorBelow = createCSG(new THREE.CylinderGeometry(halfWidthBelow, halfWidthBelow, height, 16), { x: p0.x, y: height/2, z: p0.z }, 0, materialBelow);
        const connectorAbove = createCSG(new THREE.CylinderGeometry(halfWidthAbove, halfWidthAbove, height + 0.1, 16), { x: p0.x, y: height/2, z: p0.z }, 0, materialAbove);

        connectorBelow.receiveShadow = true;
        connectorAbove.receiveShadow = true;

        group.add(connectorBelow);
        group.add(connectorAbove);
    }

    // Add connector at last point
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
    const colorHexBelow = 0x707070
    const width = 1

    const group = new THREE.Group();

    const geomBelow = new THREE.BoxGeometry(1, 0.2, 2 * width);
    const geomConnBelow = new THREE.CylinderGeometry((2 * width) / 2, (2 * width) / 2, 0.2, 16);

    const matBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });

    const countSegments = pointsArray.length - 1;
    const instBelow = new THREE.InstancedMesh(geomBelow, matBelow, countSegments);

    const instConnBelow = new THREE.InstancedMesh(geomConnBelow, matBelow, pointsArray.length);

    const dummy = new THREE.Object3D();

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const angle = Math.atan2(dz, dx);
        const length = Math.sqrt(dx * dx + dz * dz);

        dummy.position.set((p0.x + p1.x)/2, 0.025, (p0.z + p1.z)/2);
        dummy.rotation.set(0, -angle, 0);
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        instBelow.setMatrixAt(i - 1, dummy.matrix);
    }

    for (let i = 0; i < pointsArray.length; i++) {
        const p = pointsArray[i];

        dummy.position.set(p.x, 0.025, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instConnBelow.setMatrixAt(i, dummy.matrix);
    }

    instBelow.instanceMatrix.needsUpdate = true;
    instBelow.receiveShadow = true;
    instConnBelow.instanceMatrix.needsUpdate = true;
    instConnBelow.receiveShadow = true;


    group.add(instBelow);
    group.add(instConnBelow);

    return group;
}

function createHighwayGeometry(pointsArray) {
    const colorHexAbove = 0xE0E0E0
    const colorHexBelow = 0x707070
    const width = 1

    const group = new THREE.Group();

    const geomBelow = new THREE.BoxGeometry(1, 0.3, 3.5 * width);
    const geomAbove = new THREE.BoxGeometry(1, 0.2, 2 * width);
    const geomConnBelow = new THREE.CylinderGeometry((3.5 * width) / 2, (3.5 * width) / 2, 0.3, 16);
    const geomConnAbove = new THREE.CylinderGeometry((2 * width) / 2, (2 * width) / 2, 0.2, 16);

    const matBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    const matAbove = new THREE.MeshStandardMaterial({ color: colorHexAbove });

    const countSegments = pointsArray.length - 1;
    const instBelow = new THREE.InstancedMesh(geomBelow, matBelow, countSegments);
    const instAbove = new THREE.InstancedMesh(geomAbove, matAbove, countSegments);

    const instConnBelow = new THREE.InstancedMesh(geomConnBelow, matBelow, pointsArray.length);
    const instConnAbove = new THREE.InstancedMesh(geomConnAbove, matAbove, pointsArray.length);

    const dummy = new THREE.Object3D();

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        const angle = Math.atan2(dz, dx);
        const length = Math.sqrt(dx * dx + dz * dz);

        dummy.position.set((p0.x + p1.x)/2, 0.3, (p0.z + p1.z)/2);
        dummy.rotation.set(0, -angle, 0);
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        instBelow.setMatrixAt(i - 1, dummy.matrix);

        dummy.position.set((p0.x + p1.x)/2, 0.6, (p0.z + p1.z)/2);
        dummy.updateMatrix();
        instAbove.setMatrixAt(i - 1, dummy.matrix);
    }

    for (let i = 0; i < pointsArray.length; i++) {
        const p = pointsArray[i];

        dummy.position.set(p.x, 0.3, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instConnBelow.setMatrixAt(i, dummy.matrix);

        dummy.position.set(p.x, 0.6, p.z);
        dummy.updateMatrix();
        instConnAbove.setMatrixAt(i, dummy.matrix);
    }

    instBelow.instanceMatrix.needsUpdate = true;
    instBelow.receiveShadow = true;
    instAbove.instanceMatrix.needsUpdate = true;
    instAbove.receiveShadow = true;
    instConnBelow.instanceMatrix.needsUpdate = true;
    instConnBelow.receiveShadow = true;
    instConnAbove.instanceMatrix.needsUpdate = true;
    instConnAbove.receiveShadow = true;

    group.add(instBelow);
    group.add(instAbove);
    group.add(instConnBelow);
    group.add(instConnAbove);

    return group;
}

function createBuildingGeometry(pointsArray, height) {
    console.log("Creating building with height: " + height);
    const colorHex = 0xE0A030;
    return createCustomBoxGeometry(pointsArray, colorHex, height);
}

function createParkingGeometry(pointsArray, capacity) {
    const colorHex = 0xE0E0E0;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.25);
}

function createFarmlandGeometry(pointsArray) {
    let colorHex = 0xEABB63 ;
    return createCustomBoxGeometry(pointsArray, colorHex, 0.15);
}

function createForestGeometry(pointsArray) {
    let colorHex = 0x208030;
    return createCustomBoxGeometry(pointsArray, colorHex, 7);
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
    return createCustomBoxGeometry(pointsArray, colorHex, 0.225);
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

function createCustomBoxGeometry(pointsArray, colorHex, height = 1, yPos = 0, bevelEnabled = false, bevelThickness = 0.2, bevelSize = 0.2, bevelSegments = 1, steps = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(pointsArray[0].x, pointsArray[0].z);
    for (let i = 1; i < pointsArray.length; i++) {
        shape.bezierCurveTo(pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z);
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
    const angle = Math.PI / 2;
    geometry.rotateX(-angle);
    geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geometry.computeVertexNormals();
    geometry.rotateY(Math.PI);
    let material
    if (DEBUG) {
        material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.BackSide, wireframe: true });
    } else {
        material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.BackSide});
    }
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = yPos;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh
}

function createCustomShapeGeometry(pointsArray, colorHex, yPos = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(pointsArray[0].x, pointsArray[0].z);
    for (let i = 1; i < pointsArray.length; i++) {
        shape.bezierCurveTo(pointsArray[i].x, pointsArray[i].z,  pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z);
    }
    const geometry = new THREE.ShapeGeometry(shape);
    const angle = Math.PI / 2;
    geometry.rotateX(-angle);
    geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geometry.computeVertexNormals();
    geometry.rotateY(Math.PI);
    const material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.BackSide });
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.y = yPos;
    mesh.castShadow = false
    mesh.receiveShadow = true;
    return mesh
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
    RENDERER.setSize( window.innerWidth, window.innerHeight );

    if (!CAMERA || !RENDERER) { return; }

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

    console.log(GUI_PARAMS.CameraSettings.pitch + " : " + ( CAMERA.rotation.x * ( 180 / Math.PI ) ) + "; " + GUI_PARAMS.CameraSettings.yaw + " : " + ( CAMERA.rotation.y * ( 180 / Math.PI ) ) );
}

render();