import * as THREE from 'three';

import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import GUI from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import * as mod from "overpass-ql-ts";


const DEBUG = false;


const { DefaultOverpassApi } = mod;
const api = new DefaultOverpassApi();


// =-= Global Variables =-= //
let canvas, renderer, scene, gui, stats, camera, fontLoader, font, fov, aspect, near, far, prevTime, moveSpeed, mouseSensitivity, keys, pitch, yaw, radius, lat, lon, count, cameraX, cameraY, cameraZ, cameraSettings, cameraController;

// Camera and movement variables //
prevTime = Date.now();
moveSpeed = 0.8
mouseSensitivity = 0.002
keys = {}
pitch = 0
yaw = 0
fov = 60;
aspect = window.innerWidth / window.innerHeight;
near = 1;
far = 500000;

// Overpass API Variables //
radius = 1000; // 100 - 1000 (meters) [PLS KEEP IT IN RANGE FOR PERFORMANCE REASONS]
lat = 55.67594
lon = 12.56553

cameraX = 0;
cameraY = 10;
cameraZ = 0;


count = 0;

let BoundingBox = _getMaxMinCoords(lon, lat, radius);

const params = {
    CameraSettings: {
        moveSpeed: moveSpeed,
        mouseSensitivity: mouseSensitivity,
        x: cameraX,
        y: cameraY,
        z: cameraZ
    }
};



function _pointInsideRadius(x, y, cx, cy, cradius) {
    const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    return distance < cradius;
}

function closestPointOnCircle(circleCenter, radius, point) {
    const dx = point.x - circleCenter.x;
    const dy = point.y - circleCenter.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
        return { x: circleCenter.x + radius, y: circleCenter.y };
    }

    const unitVector = { x: dx / distance, y: dy / distance };

    const closestPoint = {
        x: circleCenter.x + unitVector.x * radius,
        y: circleCenter.y + unitVector.y * radius
    };

    return closestPoint;
}

function _toMetricCoords(lat, lon) {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        return null;
    }
    const latInMeters = lat * 111_139; // latitude meters
    const lonInMeters = lon * 111_139 * Math.cos(lat * Math.PI / 180); // longitude meters
    return [latInMeters, lonInMeters];
}

function _toLatLon(x, y) {
    const lat = x / 111_139; // meters to degrees latitude
    const lon = y / (111_139 * Math.cos(lat * Math.PI / 180)); // meters to degrees longitude
    return [lat, lon];
}

function _getMaxMinCoords(lon, lat, radius, exact = false) {
    const center = _toMetricCoords(lat, lon);
    const maxX = center[0] + (radius)*0.75;
    const minX = center[0] - (radius)*0.75;
    const maxY = center[1] + (radius)*0.75;
    const minY = center[1] - (radius)*0.75;
    const maxLatLon = _toLatLon(maxX, maxY);
    const minLatLon = _toLatLon(minX, minY);
    if (exact) {
        return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
    }
    return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
}

async function _queryAll(boundingBox) {
    const q = `
        [out:json][timeout:180][maxsize:1073741824];
        (

          
          way(${boundingBox});
          relation(${boundingBox});
          
        );
        out body geom;
    `;
    console.log(q)
    try {
        return await api.execQuery(q);
        //return "I Dont wanna work"
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}





// =-= Initialization =-= //
async function init() {

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    camera.position.set(0, 1.8, 5)

    stats = new Stats();
    document.body.appendChild(stats.dom);

    scene = new THREE.Scene();

    canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, precision: "mediump"
    });
    renderer.sortObjects = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.autoClearStencil = false;
    renderer.autoClear = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x3a3a3d, 1);
    document.body.appendChild(renderer.domElement);

    fontLoader = new FontLoader();
    font = await fontLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/refs/heads/dev/examples/fonts/helvetiker_regular.typeface.json');

    gui = new GUI();

    cameraSettings = gui.addFolder('Camera Settings');

    cameraSettings.add(params.CameraSettings, 'x', (4*-radius), (4*radius)).onChange(v => {
        let cameraPos = camera.position
        camera.position.set(v, cameraPos.y, cameraPos.z);
    }).listen();
    cameraSettings.add(params.CameraSettings, 'y', (4*-radius), (4*radius)).onChange(v => {
        let cameraPos = camera.position
        camera.position.set(cameraPos.x, v, cameraPos.z);
    }).listen();
    cameraSettings.add(params.CameraSettings, 'z', (4*-radius), (4*radius)).onChange(v => {
        let cameraPos = camera.position
        camera.position.set(cameraPos.x, cameraPos.y, v);
    }).listen();
    cameraSettings.add(params.CameraSettings, 'moveSpeed', 0.01, 20).onChange(v => {
        moveSpeed = v;
    }).listen();
    cameraSettings.add(params.CameraSettings, 'mouseSensitivity', 0.001, 0.01).onChange(v => {
        mouseSensitivity = v;
    });
    cameraSettings.open();

    scene.add( new THREE.AmbientLight( 0xcccccc) );

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(( -radius * 2 - 0.5 * radius ), ( 2 * radius ), -radius * 2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 512 * (radius/10/2);
    directionalLight.shadow.mapSize.height = 512 * (radius/10/2);
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = ( far );
    directionalLight.shadow.camera.left = ( 2 * -radius/1.5 );
    directionalLight.shadow.camera.right = ( 2 * radius/1.5 );
    directionalLight.shadow.camera.top = ( 2 * radius/1.5 );
    directionalLight.shadow.camera.bottom = ( 2 * -radius/1.5 );
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);
}

await init()




const baseplateMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF5F4 });

let baseplate = new THREE.Mesh(new THREE.CylinderGeometry( radius, radius, 5, 128, 128,), baseplateMaterial );
scene.add(baseplate);
baseplate.position.set(0, -2.5, 0);
baseplate.receiveShadow = true;


renderer.setAnimationLoop(render);

function getRanHex(size) {
    const result = [];
    const hexRef = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
    for (let n = 0; n < size; n++) {
        result.push(hexRef[Math.floor(Math.random() * 16)]);
    }
    return parseInt("0x" + result.join(''));


}

let data = await _queryAll(BoundingBox);



for (let element of (data.elements)) {
    if (element.type === "way" && element.geometry) {
        const pointsArray = [];
        for (let geoPoint of (element.geometry)) {
            const metricCoords = _toMetricCoords(geoPoint.lat, geoPoint.lon);
            if (metricCoords) {
                const x = metricCoords[0] - _toMetricCoords(lat, lon)[0];
                const z = metricCoords[1] - _toMetricCoords(lat, lon)[1];
                if (DEBUG) {
                    const debugPointGeometry = new THREE.SphereGeometry(0.25, 8, 8);
                    const debugPointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const debugPoint = new THREE.Mesh(debugPointGeometry, debugPointMaterial);
                    debugPoint.position.set(x, 0, z);
                    scene.add(debugPoint);
                }
                if (_pointInsideRadius(x, z, 0, 0, radius)) {
                    pointsArray.push({ x: x, y: 0, z: z });
                } else {
                    if (_pointInsideRadius(x, z, 0, 0, (radius + 50))) {}
                    const closestPoint = closestPointOnCircle({ x: 0, y: 0 }, radius, { x: x, y: z });
                    pointsArray.push({ x: closestPoint.x, y: 0, z: closestPoint.y });
                }

            }

        }
        if (pointsArray.length > 1) {
            if (element.tags) {

                if (element.tags.building || element.tags['building:part']) {
                    let height
                    if (element.tags.height) {
                        height = parseFloat(element.tags.height);
                    } else if (element.tags['building:levels']) {
                        height = parseFloat(element.tags['building:levels']) * 3;
                    } else {
                        height = 10; // default height
                    }

                    const lineMesh = createBuildingGeometry(pointsArray, height);
                    lineMesh.castShadow = true
                    scene.add(lineMesh);
                }

                if (element.tags.leisure) {
                    if (element.tags.leisure === "park") {
                        const parkMesh = createParkGeometry(pointsArray);
                        parkMesh.castShadow = false
                        scene.add(parkMesh)
                    } else if (element.tags.leisure === "garden") {
                        const gardenMesh = createGardenGeometry(pointsArray);
                        gardenMesh.castShadow = false
                        scene.add(gardenMesh)
                    } else if (element.tags.leisure === "pitch") {
                        const pitchMesh = createPitchGeometry(pointsArray);
                        pitchMesh.castShadow = false
                        scene.add(pitchMesh)
                    } else if (element.tags.leisure === "playground") {
                        const playgroundMesh = createPlaygroundGeometry(pointsArray);
                        playgroundMesh.castShadow = false
                        scene.add(playgroundMesh)
                    } else {
                        console.log("Unknown leisure type:", element.tags);
                        const lineMesh = createCustomLineGeometry(pointsArray);
                        lineMesh.castShadow = false
                        scene.add(lineMesh);
                    }

                }

                if (element.tags.railway) {
                    if (element.tags.railway === "rail") {
                        const railwayMesh = createRailwayGeometry(pointsArray);
                        railwayMesh.castShadow = true
                        scene.add(railwayMesh);
                    }
                }

                if (element.tags.highway) { //  "unclassified" || element.tags.highway === "service")
                    let type
                    const highways = [
                        { highway: "motorway", type: 0 },
                        { highway: "trunk", type: 0 },
                        { highway: "primary", type: 0 },
                        { highway: "secondary", type: 0 },
                        { highway: "residential", type: 0 },
                        { highway: "tertiary", type: 0 },
                        { highway: "unclassified", type: 0 },
                        { highway: "service", type: 0 },
                        { highway: "footway", type: 1 },
                        { highway: "path", type: 1 },
                        { highway: "cycleway", type: 1 }
                    ];
                    for (const h of highways) { if (element.tags.highway === h.highway) { type = h.type; break; } }
                    const highwayMesh = createHighwayGeometry(pointsArray, type);
                    scene.add(highwayMesh);
                }

                if (element.tags.amenity) {
                    if (element.tags.amenity === "parking") {
                        const parkingMesh = createParkingGeometry(pointsArray, element.tags.capacity);
                        parkingMesh.castShadow = true
                        scene.add(parkingMesh);
                    }
                }

                if (element.tags.landuse) {
                    if (element.tags.landuse === "forest") {
                        const forestMesh = createForestGeometry(pointsArray);
                        forestMesh.castShadow = false
                        scene.add(forestMesh)
                    } else if (element.tags.landuse === "farmland") {
                        const farmlandMesh = createFarmlandGeometry(pointsArray);
                        farmlandMesh.castShadow = false
                        scene.add(farmlandMesh)
                    }
                }

                if ((element.tags.water && element.tags.natural === "water") || (element.tags.natural === "water") || (element.tags.water)) {
                    const waterMesh = createWaterGeometry(pointsArray);
                    waterMesh.castShadow = false
                    waterMesh.receiveShadow = true;
                    scene.add(waterMesh);
                }

            } else {
                console.log("No tags found for element:", element);
                //const lineMesh = createCustomGeometry(pointsArray, 0xff0000, 0.05);
                //lineMesh.castShadow = true
                //scene.add(lineMesh);
            }
        }
    }
}


function createCustomLineGeometry(pointsArray) {
    const material = new THREE.LineBasicMaterial({ color: getRanHex(6) });
    const points = [];
    for (let i = 0; i < pointsArray.length; i++) {
        points.push(new THREE.Vector3(pointsArray[i].x, pointsArray[i].y, pointsArray[i].z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setFromPoints(points);
    return new THREE.Line(geometry, material);
}

function createRailwayGeometry(pointsArray) {
    const colorHexBelow = 0x707070
    const materialBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    let width = 1
    let height = 0.2
    const group = new THREE.Group();

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const p0z = p0.z;
        const p0x = p0.x;


        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;

        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const railGeomBelow = new THREE.BoxGeometry((length), (height), (3.5*width) );

        const railMeshBelow = new THREE.Mesh(railGeomBelow, materialBelow);

        const connectorGeomBelow = new THREE.CylinderGeometry(((3.5*width)/2), ((3.5*width)/2), (height), 32, 1);

        const connectorMeshBelow = new THREE.Mesh(connectorGeomBelow, materialBelow);

        // rotate box so its long axis aligns with the segment direction
        const angle = Math.atan2(dz, dx);
        railMeshBelow.rotation.y = -angle;
        railMeshBelow.receiveShadow = true;

        // position in the middle of both points
        railMeshBelow.position.set((p0.x + p1.x) / 2, 0, (p0.z + p1.z) / 2);

        group.add(railMeshBelow);


        connectorMeshBelow.receiveShadow = true;

        connectorMeshBelow.position.set(p0x, 0, p0z);

        group.add(connectorMeshBelow);
    }

    const plast = pointsArray[pointsArray.length - 1];

    const p0z = plast.z;
    const p0x = plast.x;

    const connectorGeomBelow = new THREE.CylinderGeometry(((3.5*width)/2), ((3.5*width)/2), (height), 32, 1);
    const connectorMeshBelow = new THREE.Mesh(connectorGeomBelow, materialBelow);
    connectorMeshBelow.position.set(p0x, 0, p0z);
    connectorMeshBelow.receiveShadow = true;
    group.add(connectorMeshBelow);


    return group;
}

function createHighwayGeometry(pointsArray, type) {
    let colorHexAbove
    let colorHexBelow
    let width = 1
    let height = 0.2
    if (type > -1) {colorHexAbove = 0xE0E0E0; colorHexBelow = 0x707070}
    else if (type > 0) {colorHexAbove = 0x7f7053; colorHexBelow = 0x7f7053; width = 0.5; height = 0.1-0.02}
    else {colorHexAbove = 0xE0E0E0; colorHexBelow = 0x707070}
    const materialBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    const materialAbove = new THREE.MeshStandardMaterial({ color: colorHexAbove });
    const group = new THREE.Group();

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const p0z = p0.z;
        const p0x = p0.x;


        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;

        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const streetGeomBelow = new THREE.BoxGeometry((length), (height), (3.5*width) );
        const streetGeomAbove = new THREE.BoxGeometry((length), (height+0.1), (2*width) );

        const streetMeshBelow = new THREE.Mesh(streetGeomBelow, materialBelow);
        const streetMeshAbove = new THREE.Mesh(streetGeomAbove, materialAbove);

        const connectorGeomBelow = new THREE.CylinderGeometry(((3.5*width)/2), ((3.5*width)/2), (height), 32, 1);
        const connectorGeomAbove = new THREE.CylinderGeometry(((2*width)/2), ((2*width)/2), (height+0.1), 32, 1);

        const connectorMeshBelow = new THREE.Mesh(connectorGeomBelow, materialBelow);
        const connectorMeshAbove = new THREE.Mesh(connectorGeomAbove, materialAbove);

        // rotate box so its long axis aligns with the segment direction
        const angle = Math.atan2(dz, dx);
        streetMeshBelow.rotation.y = -angle;
        streetMeshAbove.rotation.y = -angle;
        streetMeshBelow.receiveShadow = true;
        streetMeshAbove.receiveShadow = true;

        // position in the middle of both points
        streetMeshBelow.position.set(
            (p0.x + p1.x) / 2,
            0,
            (p0.z + p1.z) / 2
        );

        streetMeshAbove.position.set(
            (p0.x + p1.x) / 2,
            0,
            (p0.z + p1.z) / 2
        );

        group.add(streetMeshBelow);
        group.add(streetMeshAbove);


        connectorMeshBelow.receiveShadow = true;
        connectorMeshAbove.receiveShadow = true;

        // Position connector at p1
        connectorMeshBelow.position.set(
            p0x,
            0,
            p0z
        );

        connectorMeshAbove.position.set(
            p0x,
            0,
            p0z
        )

        group.add(connectorMeshAbove);
        group.add(connectorMeshBelow);
    }

    const plast = pointsArray[pointsArray.length - 1];

    const p0z = plast.z;
    const p0x = plast.x;

    const connectorGeomBelow = new THREE.CylinderGeometry(((3.5*width)/2), ((3.5*width)/2), (height), 32, 1);
    const connectorGeomAbove = new THREE.CylinderGeometry(((2*width)/2), ((2*width)/2), (height+0.1), 32, 1);

    const connectorMeshBelow = new THREE.Mesh(connectorGeomBelow, materialBelow);
    const connectorMeshAbove = new THREE.Mesh(connectorGeomAbove, materialAbove);

    connectorMeshBelow.position.set(
        p0x,
        0,
        p0z
    );

    connectorMeshAbove.position.set(
        p0x,
        0,
        p0z
    )

    connectorMeshBelow.receiveShadow = true;
    connectorMeshAbove.receiveShadow = true;

    group.add(connectorMeshAbove);
    group.add(connectorMeshBelow);


    return group;
}


function createBuildingGeometry(pointsArray, height) {
    let colorHex
    if (height > 35) {height = 35;}
    if (height < 5) {height = 5;}
    if (height <= 15 ) {colorHex = 0xE0A030;}
    else if (height <= 25 ) {colorHex = 0xE0A030;}
    else {colorHex = 0xE0A030;}
    return createCustomGeometry(pointsArray, colorHex, height);
}

function createParkingGeometry(pointsArray, capacity) {
    let colorHex
    if (capacity > 1000) {capacity = 1000;}
    if (capacity < 5) {capacity = 5;}
    if (capacity <= 331 ) {colorHex = 0xE0E0E0;}
    else if (capacity <= 663 ) {colorHex = 0xE0E0E0;}
    else {colorHex = 0xE0E0E0 ;}
    return createCustomGeometry(pointsArray, colorHex, 0.3);
}

function createFarmlandGeometry(pointsArray) {
    let colorHex = 0xEABB63;
    return createCustomGeometry(pointsArray, colorHex, 0.5);
}

function createForestGeometry(pointsArray) {
    let colorHex = 0x208030;
    return createCustomGeometry(pointsArray, colorHex, 10);
}

function createParkGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomGeometry(pointsArray, colorHex, 0.05);
}

function createGardenGeometry(pointsArray) {
    let colorHex = 0x60C060;
    return createCustomGeometry(pointsArray, colorHex, 0.05);
}

function createPitchGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomGeometry(pointsArray, colorHex, 0.05);
}

function createPlaygroundGeometry(pointsArray) {
    let colorHex = 0x70B070;
    return createCustomGeometry(pointsArray, colorHex, 0.05);
}

function createWaterGeometry(pointsArray) {
    let colorHex = 0x3E8fe0;
    const waterMesh = createCustomGeometry(pointsArray, colorHex, 0.06);

    return waterMesh;
}



function createCustomGeometry(pointsArray, colorHex, height = 1, bevelEnabled = false, bevelThickness = 0.2, bevelSize = 0.2, bevelSegments = 1, steps = 1) {
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
    const material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.BackSide });
    return new THREE.Mesh(geometry, material)
}

function updateMovementSpeed(MouseWheelEvent) {
    if (MouseWheelEvent.deltaY < 0) {
        moveSpeed += 0.1;
    } else {
        moveSpeed -= 0.1;
        if (moveSpeed < 0.1) {
            moveSpeed = 0.1;
        }
    }
    params.CameraSettings.moveSpeed = moveSpeed;
}

window.addEventListener("wheel", event => updateMovementSpeed(event));

document.addEventListener('keydown', (e) => keys[e.code] = true)
document.addEventListener('keyup', (e) => keys[e.code] = false)

const pointerTarget = renderer?.domElement ?? document.getElementById('c');
if (pointerTarget) {
    // allow focus (helpful for some browsers)
    pointerTarget.tabIndex = pointerTarget.tabIndex || 0;
    pointerTarget.style.outline = 'none';

    pointerTarget.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (document.pointerLockElement === pointerTarget) {
            document.exitPointerLock();
        } else {
            // user gesture: request pointer lock on the actual canvas
            pointerTarget.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const locked = document.pointerLockElement === pointerTarget;
        console.log('pointerlockchange, locked=', locked);
        document.body.style.cursor = locked ? 'none' : 'default';
        // optional: reset or store state when locking/unlocking
    });

    document.addEventListener('pointerlockerror', (err) => {
        console.error('Pointer lock error', err);
    });

    // update your mousemove check to ensure it's the same target
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === pointerTarget) {
            yaw -= e.movementX * mouseSensitivity;
            pitch -= e.movementY * mouseSensitivity;
            pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
            camera.rotation.set(pitch, yaw, 0, 'YXZ');
        }
    });
} else {
    console.warn('Pointer lock: no canvas element found (renderer.domElement or #c).');
}





// =-= Render Loop =-= //

// javascript
// add this near your other globals (e.g. after startTime)


// replace your existing render() with this version
function render() {
    if (!camera || !renderer) { return; }

    const currentTime = Date.now();
    const delta = (currentTime - prevTime) / 1000; // seconds
    prevTime = currentTime;

    // Movement: compute forward and right vectors in XZ plane
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    // WASD controls (use e.code keys: KeyW, KeyA, KeyS, KeyD)
    const speed = moveSpeed * (delta * 60); // keep feel consistent across frame rates
    if (keys['KeyW']) camera.position.addScaledVector(forward, speed);
    if (keys['KeyS']) camera.position.addScaledVector(forward, -speed);
    if (keys['KeyA']) camera.position.addScaledVector(right, -speed);
    if (keys['KeyD']) camera.position.addScaledVector(right, speed);

    // optional: vertical movement with Space / ShiftLeft
    if (keys['Space']) camera.position.y += speed;
    if (keys['ShiftLeft']) camera.position.y -= speed;

    stats.begin();
    renderer.render(scene, camera);
    stats.end();

    params.CameraSettings.x = camera.position.x.toFixed(3);
    params.CameraSettings.y = camera.position.y.toFixed(3);
    params.CameraSettings.z = camera.position.z.toFixed(3);

}


window.addEventListener('resize', render);

render();