import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import * as SceneUtils from 'three/addons/utils/SceneUtils.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import * as mod from "overpass-ql-ts";

const { DefaultOverpassApi, OverpassApi, OverpassFormat, OverpassOutputVerbosity, OverpassOutputGeoInfo } = mod;



const api = new DefaultOverpassApi();

let prevTime = Date.now();
let moveSpeed = 0.1
let mouseSensitivity = 0.002
let keys = {}
let pitch = 0, yaw = 0

let radius = 1000; // 100 - 1000 (meters) [PLS KEEP IT IN RANGE FOR PERFORMANCE REASONS]
let lat = 50.7799659
let lon = 11.0833784

let BoundingBox = _getMaxMinCoords(lon, lat, radius);



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
    const maxX = center[0] + radius;
    const minX = center[0] - radius;
    const maxY = center[1] + radius;
    const minY = center[1] - radius;
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
        );
        out meta geom;
    `;
    console.log(q)
    try {
        return await api.execQuery(q);
        // return "I Dont wanna work"
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}



// =-= Global Variables =-= //
let canvas, renderer, scene, startTime, gui, stats, camera, controls, fontLoader, font, object, renderFloorMesh;
let fov, aspect, near, far;

const params = {
    Coordinates: {
        latitude: lat,
        longitude: lon,
        radius: radius
    },
    CameraSettings: {
        moveSpeed: moveSpeed,
        mouseSensitivity: mouseSensitivity
    }
};



// =-= Initialization =-= //
async function init() {


    // Camera Initialization //
    fov = 30;
    aspect = window.innerWidth / window.innerHeight;
    near = 1;
    far = 100000;

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    camera.position.set(0, 1.8, 5)


    // Stats Initialization //
    stats = new Stats();
    document.body.appendChild(stats.dom);


    // Scene Initialization //
    scene = new THREE.Scene();


    // Renderer Initialization //

    canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, logarithmicDepthBuffer: true, precision: "highp", stencil: true
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


    // Font Initialization //
    fontLoader = new FontLoader();
    font = await fontLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/refs/heads/dev/examples/fonts/helvetiker_regular.typeface.json');


    // GUI Initialization //
    gui = new GUI();

    const coordinates = gui.addFolder('Coordinates');

    coordinates.add(params.Coordinates, 'latitude', -90, 90).onChange(v => {
        lat = v;
    });
    coordinates.add(params.Coordinates, 'longitude', -180, 180).onChange(v => {
        lon = v;
    });
    coordinates.add(params.Coordinates, 'radius', 10, 1000).onChange(v => {
        radius = v;
    });
    coordinates.open();

    const cameraSettings = gui.addFolder('Camera Settings');
    cameraSettings.add(params.CameraSettings, 'moveSpeed', 0.01, 20).onChange(v => {
        moveSpeed = v;
    });
    cameraSettings.add(params.CameraSettings, 'mouseSensitivity', 0.001, 0.01).onChange(v => {
        mouseSensitivity = v;
    });
    cameraSettings.open();




    // Lights Initialization //
    scene.add( new THREE.AmbientLight( 0xcccccc) );

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(( -radius * 2 - 0.5 * radius ), ( 2 * radius ), -radius * 2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 8192;
    directionalLight.shadow.mapSize.height = 8192;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = ( far );
    directionalLight.shadow.camera.left = ( 2 * -radius );
    directionalLight.shadow.camera.right = ( 2 * radius );
    directionalLight.shadow.camera.top = ( 2 * radius );
    directionalLight.shadow.camera.bottom = ( 2 * -radius );
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);
}

await init()


// // =-= Stencil =-= //
// const renderFloorGeometry = new THREE.BoxGeometry((2 * radius + 0.05), 1, (2 * radius + 0.05));// MeshPhongMaterial
// const renderFloorMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: false, colorWrite: false});
// const renderFloor = new THREE.Mesh(renderFloorGeometry, renderFloorMaterial);
// renderFloorMesh = new THREE.Group();
// renderFloorMesh.add(renderFloor);
// renderFloorMesh.position.set(0, 0.5, 0)
// scene.add(renderFloorMesh);
//
// const stencilizedArea = new THREE.CylinderGeometry(radius, radius, 40, 128);
//
// var frontMaterial = new THREE.MeshBasicMaterial({  wireframe: false });
// frontMaterial.depthWrite = false;
// frontMaterial.depthTest = true;
// frontMaterial.colorWrite = false;
// frontMaterial.stencilWrite = true;
// frontMaterial.stencilFunc = THREE.AlwaysStencilFunc;
// frontMaterial.side = THREE.FrontSide;
// frontMaterial.stencilFail = THREE.KeepStencilOp;
// frontMaterial.stencilZFail = THREE.KeepStencilOp;
// frontMaterial.stencilZPass = THREE.IncrementWrapStencilOp;
//
// var backMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// backMaterial.depthWrite = false;
// backMaterial.colorWrite = false;
// backMaterial.stencilWrite = true;
// backMaterial.stencilFunc = THREE.AlwaysStencilFunc;
// backMaterial.side = THREE.BackSide ;
// backMaterial.stencilFail = THREE.KeepStencilOp;
// backMaterial.stencilZFail = THREE.KeepStencilOp;
// backMaterial.stencilZPass = THREE.DecrementWrapStencilOp;
//
// var intersectMaterial = new THREE.MeshBasicMaterial({ wireframe: false}); //Circle in middle
// intersectMaterial.depthWrite = false;
// intersectMaterial.depthTest = false;
// intersectMaterial.colorWrite = true;
// intersectMaterial.stencilWrite = true;
// intersectMaterial.color.set(0xfec365);
//
// intersectMaterial.stencilFunc = THREE.NotEqualStencilFunc;
// intersectMaterial.stencilFail = THREE.ReplaceStencilOp;
// intersectMaterial.stencilZFail = THREE.ReplaceStencilOp;
// intersectMaterial.stencilZPass = THREE.ReplaceStencilOp;
//
// const materials = [ frontMaterial, backMaterial, intersectMaterial ];
// const intersectionGroup = SceneUtils.createMultiMaterialObject( stencilizedArea, materials );
// intersectionGroup.position.set(0,1,0);
// scene.add(intersectionGroup);


// =-= Materials =-= //
const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x3E8fe0 });
const parkMaterial = new THREE.MeshStandardMaterial({ color: 0x009A17 });
const forestMaterial = new THREE.MeshStandardMaterial({ color: 0x208030 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A0A0 });
const smallBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xE0A030 });
const mediumBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xE0C070 });
const largeBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xC07020 });
const circleMaterial = new THREE.MeshStandardMaterial({ color: 0x2389da });
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xcf003d });
const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });


// =-= Geometries and Meshes =-= //


let grass = new THREE.Mesh(new THREE.BoxGeometry( (radius * 2), 1, (radius * 2), 128, 128), parkMaterial );
scene.add(grass);
grass.receiveShadow = true;








let cube = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), cubeMaterial);
cube.castShadow = true;
cube.position.y = 3.5;
// scene.add(cube);





// =-= Helpers =-= //
function resizeRendererToDisplaySize(renderer) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) renderer.setSize(width, height, false);
    return needResize;
}

renderer.setAnimationLoop(render);

startTime = Date.now();

const getRanHex = size => {
    let result = [];
    let hexRef = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

    for (let n = 0; n < size; n++) {
        result.push(hexRef[Math.floor(Math.random() * 16)]);
    }
    return result.join('');
}

console.log();


let data = await _queryAll(BoundingBox);

console.log(JSON.stringify(data))

for (let element of (data.elements)) {
    if (element.type === "way" && element.geometry) {
        const color = parseInt(getRanHex(6), 16);
        const pointsArray = [];
        for (let geoPoint of (element.geometry)) {
            const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
            const sphereMaterial = new THREE.MeshStandardMaterial({ color: color });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            const metricCoords = _toMetricCoords(geoPoint.lat, geoPoint.lon);
            if (metricCoords) {
                const x = metricCoords[0] - _toMetricCoords(lat, lon)[0];
                const z = metricCoords[1] - _toMetricCoords(lat, lon)[1];
                // sphere.position.set(x, 1, z);
                // scene.add(sphere);
                pointsArray.push({ x: x, y: 1, z: z });
            }

        }
        if (pointsArray.length > 1) {
            if (element.tags) {
                if (element.tags.building) {
                    const lineMesh = createBuildingGeometry(pointsArray, 10);
                    lineMesh.castShadow = true
                    scene.add(lineMesh);
                } else if (element.tags.leisure && (element.tags.leisure === "park" || element.tags.leisure === "garden") || (element.tags.landuse && (element.tags.landuse === "recreation_ground" || element.tags.landuse === "grass" || element.tags.landuse === "meadow"))) {
                    //const lineMesh = createBuildingGeometry(pointsArray, 3);
                    // lineMesh.castShadow = true
                    // scene.add(lineMesh);
                } else if (element.tags.highway) { //  "unclassified" || element.tags.highway === "service")
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
                    highwayMesh.castShadow = false
                    scene.add(highwayMesh);
                } else if (element.tags.amenity) {
                    if (element.tags.amenity === "parking") {
                        const parkingMesh = createParkingGeometry(pointsArray, element.tags.capacity);
                        parkingMesh.castShadow = true
                        scene.add(parkingMesh);
                    }
                } else if (element.tags.landuse && (element.tags.landuse === "residential" || element.tags.landuse === "commercial" || element.tags.landuse === "industrial")) {
                    // pass
                } else if (element.tags.landuse && (element.tags.landuse === "farmland")) {
                    const lineMesh = createCustomLineGeometry(pointsArray, 0xFFBF00);
                    lineMesh.castShadow = false
                    scene.add(lineMesh)
                }else {
                    console.log("Unknown Element with tags:", element.tags)
                    const lineMesh = createCustomLineGeometry(pointsArray, color);
                    lineMesh.castShadow = false
                    scene.add(lineMesh);
                }
            } else {
                const lineMesh = createCustomLineGeometry(pointsArray, color);
                lineMesh.castShadow = true
                scene.add(lineMesh);
            }
        }
    }
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

function createHighwayGeometry(pointsArray, type) {
    let colorHexAbove
    let colorHexBelow
    let width = 1
    let height = 1
    if (type === 0) {colorHexAbove = 0xE0E0E0; colorHexBelow = 0x707070}
    else if (type >= 1) {colorHexAbove = 0x7f7053; colorHexBelow = 0x7f7053}
    if (type === 1) {width = 0.5; height = 0.5}
    const materialBelow = new THREE.MeshStandardMaterial({ color: colorHexBelow });
    const materialAbove = new THREE.MeshStandardMaterial({ color: colorHexAbove });
    const group = new THREE.Group();

    for (let i = 1; i < pointsArray.length; i++) {
        const p0 = pointsArray[i - 1];
        const p1 = pointsArray[i];

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;

        const length = Math.sqrt(dx * dx + dz * dz);
        if (length === 0) continue;

        const geomBelow = new THREE.BoxGeometry((length + 1.5), (0.5*height), (4*width) );
        const geomAbove = new THREE.BoxGeometry((length + 0.75), (1.1*height), (3*width) );

        const meshBelow = new THREE.Mesh(geomBelow, materialBelow);
        const meshAbove = new THREE.Mesh(geomAbove, materialAbove);

        // rotate box so its long axis aligns with the segment direction
        const angle = Math.atan2(dz, dx);
        meshBelow.rotation.y = -angle;
        meshAbove.rotation.y = -angle;

        // position in the middle of both points
        meshBelow.position.set(
            (p0.x + p1.x) / 2,
            0.5,
            (p0.z + p1.z) / 2
        );

        meshAbove.position.set(
            (p0.x + p1.x) / 2,
            0.5,
            (p0.z + p1.z) / 2
        );

        group.add(meshBelow);
        group.add(meshAbove);
    }

    return group;
}

function createBuildingGeometry(pointsArray, height) {
    let colorHex
    if (height > 35) {height = 35;}
    if (height < 5) {height = 5;}
    if (height <= 15 ) {colorHex = 0xE0A030;}
    else if (height <= 25 ) {colorHex = 0xE0C070;}
    else {colorHex = 0xC07020;}
    const shape = new THREE.Shape();
    shape.moveTo(pointsArray[0].x, pointsArray[0].z);
    for (let i = 1; i < pointsArray.length; i++) {
        shape.bezierCurveTo(pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z);
    }
    const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelSegments: 2
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const angle = Math.PI / 2;
    geometry.rotateX(-angle);
    geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geometry.computeVertexNormals();
    geometry.rotateY(Math.PI);
    const material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide });
    return new THREE.Mesh(geometry, material)
}

function createParkingGeometry(pointsArray, capacity) {
    let colorHex
    if (capacity > 1000) {capacity = 1000;}
    if (capacity < 5) {capacity = 5;}
    if (capacity <= 331 ) {colorHex = 0xE0E0E0;} //0xE0A030
    else if (capacity <= 663 ) {colorHex = 0xE0E0E0;} //0xE0C070
    else {colorHex = 0xE0E0E0 ;} //0xC07020
    const shape = new THREE.Shape();
    shape.moveTo(pointsArray[0].x, pointsArray[0].z);
    for (let i = 1; i < pointsArray.length; i++) {
        shape.bezierCurveTo(pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z, pointsArray[i].x, pointsArray[i].z);
    }
    const extrudeSettings = {
        steps: 1,
        depth: 0.57,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelSegments: 2
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const angle = Math.PI / 2;
    geometry.rotateX(-angle);
    geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    geometry.computeVertexNormals();
    geometry.rotateY(Math.PI);
    const material = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide });
    return new THREE.Mesh(geometry, material)
}


document.addEventListener('keydown', (e) => keys[e.code] = true)
document.addEventListener('keyup', (e) => keys[e.code] = false)

// javascript
// Attach pointer-lock to the actual render canvas and make checks explicit.
// Put this after you create `renderer` (so `renderer.domElement` exists).

// choose target: prefer renderer.domElement, fallback to element with id 'c'
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
}


window.addEventListener('resize', render);

render();