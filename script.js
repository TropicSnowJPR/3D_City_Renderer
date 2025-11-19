import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { EdgesGeometry } from 'three';
import { LineSegments } from 'three';
import { LineBasicMaterial } from 'three';
import * as mod from "overpass-ql-ts";
import fs from 'fs';
const { DefaultOverpassApi, OverpassApi, OverpassFormat, OverpassOutputVerbosity, OverpassOutputGeoInfo } = mod;

const api = new DefaultOverpassApi();


// Config //
const radius = 1000; // in meters. pls no above 1000 or pc go boom 💥💥💥💥
const lat = 50.984767
const lon = 11.029879

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

async function _queryBuildings(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           way["building"](${boundingBox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryHighways(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           way["highway"](${boundingBox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryRailways(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           way["railway"](${boundingBox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryParks(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           nwr["leisure"="park"](${boundingBox});
        );
        out geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryWaterways(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           way["waterway"](${boundingBox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryForests(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
           relation["landuse"="forest"](${boundingBox});
           way["landuse"="forest"](${boundingBox});
        );
        out ids geom;
    `;

    try {
        return await api.execQuery(q);
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}

async function _queryAll(boundingBox) {
    const q = `
        [out:json][timeout:180];
        (
          way(${boundingBox});
        );
        out ids geom;
    `;
    console.log(q)
    try {
        //return await api.execQuery(q);
        return "I Dont wanna work"
    } catch (error) {
        console.error("Error executing Overpass query:", error);
        return null;
    }
}


console.log(JSON.stringify(_queryAll(BoundingBox)))


// fs.writeFileSync('railways.json', JSON.stringify(_queryRailways(BoundingBox)), null, 2);
// console.log('Saved railways.json');
//
// fs.writeFileSync('highways.json', JSON.stringify(_queryHighways(BoundingBox)), null, 2);
// console.log('Saved highways.json');
//
// fs.writeFileSync('buildings.json', JSON.stringify(_queryBuildings(BoundingBox)), null, 2);
// console.log('Saved buildings.json');



const canvas = document.querySelector( '#c' );
const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );
const loader = new FontLoader();
const font = await loader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/refs/heads/dev/examples/fonts/helvetiker_regular.typeface.json');


const fov = 30;
const aspect = 2; // the canvas default
const near = 1;
const far = 500;
const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
camera.position.z = 250;
camera.position.y = 80;

const controls = new OrbitControls( camera, canvas );
controls.target.set( 0, 0, 0 );
controls.maxPolarAngle = 360
controls.minPolarAngle = -360
controls.maxAzimuthAngle = 360
controls.minAzimuthAngle = -360
controls.minDistance = 50
controls.maxDistance = 300

// controls.enableRotate = true
// controls.autoRotate = true
// controls.autoRotateSpeed = 20

controls.enablePan = false
controls.update();

const scene = new THREE.Scene();

renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( render );
document.body.appendChild( renderer.domElement );

const ambient = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 3);
dir.position.set(100, 150, 200);
scene.add( dir ) ;



// --- your meshes ---
const circleGeometry = new THREE.CylinderGeometry(100, 100, 0, 128, 1);
const circleMaterial = new THREE.MeshStandardMaterial({ color: 0x3E8fe0 });
const circle = new THREE.Mesh(circleGeometry, circleMaterial);

const cubeGeometry = new THREE.BoxGeometry(5, 5, 5, 1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xcf003d });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

scene.add(circle);
scene.add(cube);
cube.position.y = 3.5;

// --- your text ---
const textGeometry = new TextGeometry("Some Test Text", {
    font: font,
    size: 1,
    depth: 0.1,
    curveSegments: 12
});
const textMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const textMesh = new THREE.Mesh(textGeometry, textMaterial);
scene.add(textMesh);
textMesh.position.set(-50, 20, 0);


// --- OUTLINE PART (CARTOON EDGE LINES) ---
function addOutline(mesh) {
    const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 1);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const outline = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(outline);
}

// Apply outlines to your meshes:
addOutline(circle);
addOutline(cube);
addOutline(textMesh);








function render() {

    if ( resizeRendererToDisplaySize( renderer ) ) {

        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();

    }

    renderer.render( scene, camera );

}

function resizeRendererToDisplaySize( renderer ) {

    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if ( needResize ) {

        renderer.setSize( width, height, false );

    }

    return needResize;

}

// window.addEventListener( 'mousedown', ( e ) => {
//
//     e.preventDefault();
//     window.focus();
//
// } );
// window.addEventListener( 'keydown', ( e ) => {
//
//     e.preventDefault();
//
// } );

controls.addEventListener( 'change', render );
window.addEventListener( 'resize', render );
