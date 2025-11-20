import * as THREE from 'three';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import * as SceneUtils from 'three/addons/utils/SceneUtils.js';

let radius = 100; // in meters. pls no above 1000 or pc go boom 💥💥💥💥
let lat = 50.984767
let lon = 11.029879

let canvas, renderer, scene, gui, stats, camera, controls, fontLoader, font;
let fov, aspect, near, far;

let renderFloorMesh;

const params = {
    CameraSettings: {
        fov: 30,
        aspect: window.innerWidth / window.innerHeight,
        near: 0.1,
        far: 100000,
        maxDistance: 3000,
        minDistance: 10
    },
    Coordinates: {
        latitude: lat,
        longitude: lon,
        radius: radius
    }
};


// =-= Initialization =-= //
async function init() {

    // Renderer Initialization //
    canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: true, logarithmicDepthBuffer: true, precision: "highp", stencil: true
    });
    renderer.sortObjects = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClearStencil = false;
    renderer.autoClear = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(render);
    renderer.setClearColor(0x000000, 0.0);
    document.body.appendChild(renderer.domElement);


    // Font Initialization //
    fontLoader = new FontLoader();
    font = await fontLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/refs/heads/dev/examples/fonts/helvetiker_regular.typeface.json');


    // Scene Initialization //
    scene = new THREE.Scene();


    // Camera Initialization //
    fov = 30;
    aspect = window.innerWidth / window.innerHeight;
    near = 1;
    far = 100000;

    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    camera.position.z = 250;
    camera.position.y = 80;


    // GUI Initialization //
    gui = new GUI();

    const cameraSettings = gui.addFolder('Camera');

    cameraSettings.add(params.CameraSettings, 'fov', 10, 120).onChange(v => {
        camera.fov = v;
        camera.updateProjectionMatrix();
    });
    cameraSettings.add(params.CameraSettings, 'aspect', 0.1, 4).onChange(v => {
        camera.aspect = v;
        camera.updateProjectionMatrix();
    });
    cameraSettings.add(params.CameraSettings, 'near', 0.1, 100).onChange(v => {
        camera.near = v;
        camera.updateProjectionMatrix();
    });
    cameraSettings.add(params.CameraSettings, 'far', 10, 2000).onChange(v => {
        camera.far = v;
        camera.updateProjectionMatrix();
    });
    cameraSettings.add(params.CameraSettings, 'minDistance', 1, 1000).onChange(v => {
        controls.minDistance = v;
    });
    cameraSettings.add(params.CameraSettings, 'maxDistance', 100, 5000).onChange(v => {
        controls.maxDistance = v;
    });
    cameraSettings.open();


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


    // Controls Initialization //
    controls = new  OrbitControls( camera, renderer.domElement );
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI; // sane limits
    controls.minPolarAngle = 0;
    controls.minDistance = 10;
    controls.maxDistance = 3000;
    controls.enablePan = false;
    controls.update();
}

await init()

stats = new Stats();
document.body.appendChild( stats.dom );

// =-= Stencil =-= //
const renderFloorGeometry = new THREE.BoxGeometry((2 * radius + 0.01), 1, (2 * radius + 0.01));// MeshPhongMaterial
const renderFloorMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: false, colorWrite: false});
const renderFloor = new THREE.Mesh(renderFloorGeometry, renderFloorMaterial);
renderFloorMesh = new THREE.Group();
renderFloorMesh.add(renderFloor);
renderFloorMesh.position.set(0, 0.1, 0)
scene.add(renderFloorMesh);

const stencilizedArea = new THREE.CylinderGeometry(radius, radius, 40, 128);

var frontMaterial = new THREE.MeshBasicMaterial({  wireframe: false });
frontMaterial.depthWrite = false;
frontMaterial.depthTest = true;
frontMaterial.colorWrite = false;
frontMaterial.stencilWrite = true;
frontMaterial.stencilFunc = THREE.AlwaysStencilFunc;
frontMaterial.side = THREE.FrontSide;
frontMaterial.stencilFail = THREE.KeepStencilOp;
frontMaterial.stencilZFail = THREE.KeepStencilOp;
frontMaterial.stencilZPass = THREE.IncrementWrapStencilOp;

var backMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
backMaterial.depthWrite = false;
backMaterial.colorWrite = false;
backMaterial.stencilWrite = true;
backMaterial.stencilFunc = THREE.AlwaysStencilFunc;
backMaterial.side = THREE.BackSide ;
backMaterial.stencilFail = THREE.KeepStencilOp;
backMaterial.stencilZFail = THREE.KeepStencilOp;
backMaterial.stencilZPass = THREE.DecrementWrapStencilOp;

var intersectMaterial = new THREE.MeshBasicMaterial({ wireframe: false}); //Circle in middle
intersectMaterial.depthWrite = false;
intersectMaterial.depthTest = false;
intersectMaterial.colorWrite = true;
intersectMaterial.stencilWrite = true;
intersectMaterial.color.set(0xfec365);

intersectMaterial.stencilFunc = THREE.NotEqualStencilFunc;
intersectMaterial.stencilFail = THREE.ReplaceStencilOp;
intersectMaterial.stencilZFail = THREE.ReplaceStencilOp;
intersectMaterial.stencilZPass = THREE.ReplaceStencilOp;

const materials = [ frontMaterial, backMaterial, intersectMaterial ];
const intersectionGroup = SceneUtils.createMultiMaterialObject( stencilizedArea, materials );
intersectionGroup.position.set(0,1,0);
scene.add(intersectionGroup);


// =-= Materials =-= //
const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x3E8fe0 });
const parkMaterial = new THREE.MeshStandardMaterial({ color: 0x30E050 });
const forestMaterial = new THREE.MeshStandardMaterial({ color: 0x208030 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xA0A0A0 });
const smallBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xE0A030 });
const mediumBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xE0C070 });
const largeBuildingMaterial = new THREE.MeshStandardMaterial({ color: 0xC07020 });
const circleMaterial = new THREE.MeshStandardMaterial({ color: 0x2389da });
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xcf003d });
const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });


// =-= Geometries and Meshes =-= //
let water = new THREE.Mesh(new THREE.BoxGeometry( (radius + 100), 1, (radius + 100), 128, 128), waterMaterial );
let cube = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), cubeMaterial);
cube.position.y = 3.5;
//scene.add(water);
//scene.add(cube);

const text = new THREE.Mesh(new TextGeometry("Some Test Text", { font: font, size: 1, depth: 0.1, curveSegments: 12 }), textMaterial);

scene.add(text);
text.position.set(-50, 20, 0);

// =-= Helpers =-= //
function resizeRendererToDisplaySize(renderer) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) renderer.setSize(width, height, false);
    return needResize;
}


// =-= Render Loop =-= //
function render() {
    if (resizeRendererToDisplaySize(renderer)) {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }

    renderer.clear();
    stats.begin();
    renderer.render(scene, camera);
    stats.end();
}

// events
controls.addEventListener('change', render);
window.addEventListener('resize', render);

render();