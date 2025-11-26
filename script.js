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

let Flying = false;
let OnFloor = true;
let PressedJump = 0;

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
radius = 1500; // 100 - 1000 (meters) [PLS KEEP IT IN RANGE FOR PERFORMANCE REASONS]
lat = 50.77596
lon = 11.08262

cameraX = 0;
cameraY = 10 + radius/2;
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
    const maxX = center[0] + (radius);
    const minX = center[0] - (radius);
    const maxY = center[1] + (radius);
    const minY = center[1] - (radius);
    const maxLatLon = _toLatLon(maxX, maxY);
    const minLatLon = _toLatLon(minX, minY);
    if (exact) {
        return `${minLatLon[0]},${minLatLon[1]},${maxLatLon[0]},${maxLatLon[1]}`;
    }
    return `${minLatLon[0].toFixed(7)},${minLatLon[1].toFixed(7)},${maxLatLon[0].toFixed(7)},${maxLatLon[1].toFixed(7)}`;
}

async function _queryAll(boundingBox) {
    const q = `
        [out:json][timeout:180];
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

    const loader = new THREE.TextureLoader();
    const texture = loader.load(
        'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/qwantani_sunrise_puresky.jpg',
        () => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            scene.background = texture;
        });

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    camera.position.set(0, cameraY, 5)

    stats = new Stats();
    document.body.appendChild(stats.dom);

    scene = new THREE.Scene();

    canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, precision: "lowp-"
    });
    renderer.sortObjects = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.autoClearStencil = false;
    renderer.autoClear = false;
    renderer.antialias = false;
    renderer.powerPreference = "high-performance",
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

    const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
    directionalLight.position.set((1.5*radius), 1000, radius);
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

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);
}

await init()




const baseplateMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF5F4 });

let baseplate = new THREE.Mesh(new THREE.CylinderGeometry( radius, radius, 5, 512, 512,), baseplateMaterial );
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



function loadData(data) {

    if (!data) {
        console.error("No data returned from Overpass API.");
        throw new Error("No data returned from Overpass API.");
    } else {
        let pointsArray;
        for (let element of (data.elements)) {
            if (element.geometry) {
                pointsArray = [];
                let lastgeoPoint = [radius + 1, radius + 1]; // First point outside of radius so it doesnt connect
                for (let geoPoint of (element.geometry)) {
                    const metricCoords = _toMetricCoords(geoPoint.lat, geoPoint.lon);
                    if (metricCoords) {
                        const x = metricCoords[0] - _toMetricCoords(lat, lon)[0];
                        const z = metricCoords[1] - _toMetricCoords(lat, lon)[1];
                        if (_pointInsideRadius(x, z, 0, 0, radius)) {
                            pointsArray.push({x: x, y: 0, z: z});
                            lastgeoPoint = [x, z];
                        } else if (_pointInsideRadius(x, z, 0, 0, (radius + 10))) {
                            const closestPoint = closestPointOnCircle({x: 0, y: 0}, radius, {x: x, y: z});
                            pointsArray.push({x: closestPoint.x, y: 0, z: closestPoint.y});
                            lastgeoPoint = [x, z];
                        }
                    }
                }
            } else if (element.members) {
                pointsArray = [];
                for (let member of (element.members)) {
                    if (member.geometry) {
                        let lastgeoPoint = [radius + 1, radius + 1]; // First point outside of radius so it doesnt connect
                        for (let geoPoint of (member.geometry)) {
                            const metricCoords = _toMetricCoords(geoPoint.lat, geoPoint.lon);
                            if (metricCoords) {
                                const x = metricCoords[0] - _toMetricCoords(lat, lon)[0];
                                const z = metricCoords[1] - _toMetricCoords(lat, lon)[1];
                                if (_pointInsideRadius(x, z, 0, 0, radius)) {
                                    pointsArray.push({x: x, y: 0, z: z});
                                    lastgeoPoint = [x, z];
                                } else if (_pointInsideRadius(x, z, 0, 0, (radius + 10))) {
                                    const closestPoint = closestPointOnCircle({x: 0, y: 0}, radius, {x: x, y: z});
                                    pointsArray.push({x: closestPoint.x, y: 0, z: closestPoint.y});
                                    lastgeoPoint = [x, z];
                                }
                            }
                        }
                        if (pointsArray.length > 1) {
                            _pointsArrayToScene(element, pointsArray);
                        }
                    }
                }
            }
            if (pointsArray.length > 1) {
                _pointsArrayToScene(element, pointsArray);
            }
        }
    }
}

function _pointsArrayToScene(element, pointsArray) {
    if ((pointsArray || !(pointsArray.length === 0)) && (element.tags)) {
        if ((element.tags.water || element.tags.natural === "water")) {
            const waterMesh = createWaterGeometry(pointsArray);
            waterMesh.castShadow = false
            waterMesh.receiveShadow = true;
            scene.add(waterMesh);
        }

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
            lineMesh.receiveShadow = true;
            scene.add(lineMesh);
        }

        if (element.tags.leisure) {
            if (element.tags.leisure === "park" || element.tags.leisure === "dog_park") {
                const parkMesh = createParkGeometry(pointsArray);
                parkMesh.castShadow = false
                parkMesh.receiveShadow = true;
                scene.add(parkMesh)
            } else if (element.tags.leisure === "garden") {
                const gardenMesh = createGardenGeometry(pointsArray);
                gardenMesh.castShadow = false
                gardenMesh.receiveShadow = true;
                scene.add(gardenMesh)
            } else if (element.tags.leisure === "pitch") {
                const pitchMesh = createPitchGeometry(pointsArray);
                pitchMesh.castShadow = false
                pitchMesh.receiveShadow = true;
                scene.add(pitchMesh)
            } else if (element.tags.leisure === "playground") {
                const playgroundMesh = createPlaygroundGeometry(pointsArray);
                playgroundMesh.castShadow = false
                playgroundMesh.receiveShadow = true;
                scene.add(playgroundMesh)
            } else {
                const lineMesh = createCustomLineGeometry(pointsArray);
                lineMesh.castShadow = false
                lineMesh.receiveShadow = true;
                scene.add(lineMesh);
            }
        }

        if (element.tags.railway) {
            if (element.tags.railway === "rail") {
                const railwayMesh = createRailwayGeometry(pointsArray);
                railwayMesh.castShadow = true
                railwayMesh.receiveShadow = true;
                scene.add(railwayMesh);
            }
        }

        if (element.tags.highway) { //  "unclassified" || element.tags.highway === "service")
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
            //const highwayMesh = createCustomLineGeometry(pointsArray, 0x000000);
            const highwayMesh = createHighwayGeometry(pointsArray, type);
            scene.add(highwayMesh);
        }

        if (element.tags.amenity) {
            if (element.tags.amenity === "parking") {
                const parkingMesh = createParkingGeometry(pointsArray, element.tags.capacity);
                parkingMesh.castShadow = false;
                parkingMesh.receiveShadow = true;
                scene.add(parkingMesh);
            }
        }

        if (element.tags.landuse) {
            if (element.tags.landuse === "forest") {
                const forestMesh = createForestGeometry(pointsArray);
                forestMesh.castShadow = false
                forestMesh.receiveShadow = true;
                scene.add(forestMesh)
            } else if (element.tags.landuse === "farmland") {
                const farmlandMesh = createFarmlandGeometry(pointsArray);
                farmlandMesh.castShadow = false
                farmlandMesh.receiveShadow = true;
                scene.add(farmlandMesh)
            }
        }

    } else {
        if (DEBUG) {
            const lineMesh = createCustomLineGeometry(pointsArray);
            lineMesh.castShadow = false
            scene.add(lineMesh);
        }
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}



let dataA = await _queryAll(BoundingBox);

loadData(dataA);





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


function createRailwayGeometry(pointsArray) {
    const colorHexBelow = 0x707070
    const width = 1

    const group = new THREE.Group();

    const geomBelow = new THREE.PlaneGeometry(1, 3.5 * width);
    const geomConnBelow = new THREE.CircleGeometry((3.5 * width) / 2, 16);

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
        dummy.rotation.set(-Math.PI/2, 0, -angle);
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        instBelow.setMatrixAt(i - 1, dummy.matrix);
    }

    for (let i = 0; i < pointsArray.length; i++) {
        const p = pointsArray[i];

        dummy.position.set(p.x, 0.025, p.z);
        dummy.rotation.set(-Math.PI/2, 0, 0);
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

    const geomBelow = new THREE.PlaneGeometry(1, 3.5 * width);
    const geomAbove = new THREE.PlaneGeometry(1, 2 * width);
    const geomConnBelow = new THREE.CircleGeometry((3.5 * width) / 2, 16);
    const geomConnAbove = new THREE.CircleGeometry((2 * width) / 2, 16);

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

        dummy.position.set((p0.x + p1.x)/2, 0.050, (p0.z + p1.z)/2);
        dummy.rotation.set(-Math.PI/2, 0, -angle);
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        instBelow.setMatrixAt(i - 1, dummy.matrix);

        dummy.position.set((p0.x + p1.x)/2, 0.060, (p0.z + p1.z)/2);
        dummy.updateMatrix();
        instAbove.setMatrixAt(i - 1, dummy.matrix);
    }

    for (let i = 0; i < pointsArray.length; i++) {
        const p = pointsArray[i];

        dummy.position.set(p.x, 0.050, p.z);
        dummy.rotation.set(-Math.PI/2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        instConnBelow.setMatrixAt(i, dummy.matrix);

        dummy.position.set(p.x, 0.060, p.z);
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
    const colorHex = 0xE0A030;
    return createCustomGeometry(pointsArray, colorHex, height);
}

function createParkingGeometry(pointsArray, capacity) {
    const colorHex = 0xE0E0E0;
    return createCustomGeometry(pointsArray, colorHex, 0.3);
}

function createFarmlandGeometry(pointsArray) {
    let colorHex = 0xEABB63;
    return createCustomGeometry(pointsArray, colorHex, 0.5);
}

function createForestGeometry(pointsArray) {
    let colorHex = 0x208030;
    return createCustomGeometry(pointsArray, colorHex, 7);
}

function createParkGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomGeometry(pointsArray, colorHex, 0.045);
}

function createGardenGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomGeometry(pointsArray, colorHex, 0.04);
}

function createPitchGeometry(pointsArray) {
    let colorHex = 0x40A040;
    return createCustomGeometry(pointsArray, colorHex, 0.04);
}

function createPlaygroundGeometry(pointsArray) {
    let colorHex = 0x70B070;
    return createCustomGeometry(pointsArray, colorHex, 0.04);
}

function createWaterGeometry(pointsArray) {
    let colorHex = 0x3E8fe0;
    return createCustomGeometry(pointsArray, colorHex, 0.075);
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
    params.CameraSettings.moveSpeed = moveSpeed.toFixed(1);
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


    if (keys['Space']) {camera.position.y += speed;}
    if (keys['ShiftLeft']) {camera.position.y -= speed}


    stats.begin();
    renderer.render(scene, camera);
    stats.end();

    params.CameraSettings.x = camera.position.x.toFixed(3);
    params.CameraSettings.y = camera.position.y.toFixed(3);
    params.CameraSettings.z = camera.position.z.toFixed(3);

}


window.addEventListener('resize', render);

render();