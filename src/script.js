import * as THREE from 'three';
import * as THREECSG from 'three-bvh-csg'
import * as THREEGUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
//import * as FILE from './file.js'
import * as HELPER from './helper.js'
import * as CONFIG from './ConfigManager.js'
import * as DATA from './data.js'
import * as API from './api.js'
import {sleep} from "./helper.js";
import {CameraController} from "./CameraController.js";
import ml from "maplibre-gl";
import {Geoman} from "@geoman-io/maplibre-geoman-free";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import {APP_VERSION} from "./Version.js";

export let REQUESTED_DATA;




const CCONFIG = new CONFIG.ConfigManager();

const GUI_PARAMS = {
    CameraSettings: {
        moveSpeed: CCONFIG.getConfigValue("movespeed"),
        mouseSensitivity: CCONFIG.getConfigValue("mousesensitivity"),
        x: CCONFIG.getConfigValue("xpos"),
        y: CCONFIG.getConfigValue("ypos"),
        z: CCONFIG.getConfigValue("zpos"),
        yaw: CCONFIG.getConfigValue("yaw"),
        pitch: CCONFIG.getConfigValue("pitch")
    },
    LocationSettings: {
        latitude: CCONFIG.getConfigValue("latitude"),
        longitude: CCONFIG.getConfigValue("longitude"),
        radius: CCONFIG.getConfigValue("radius"),
    },
    RendererSettings: {
        debug: CCONFIG.getConfigValue("debug"),
        renderTicks: 0,
        update: function() { location.reload(); }
    },
    Download: {
        exportOBJ: async function () {
            //await FILE.downloadSceneAsOBJ();
        },
        exportGLTF: async function () {
            //await FILE.downloadSceneAsGLTF();
        },
        exportPLY: async function () {
            //await FILE.downloadSceneAsPLY();
        },
        exportJOSN: async function () {
            //await FILE.downloadSceneAsJSON();
        }
    }
};

document.title = "3D Map Generator [" + APP_VERSION + "]";

let prevTime = Date.now();
let renderTicksCounter = 0;

// if (CCONFIG.getConfigVersion() !== APP_VERSION) {
//     console.log("Version: " + CCONFIG.getConfigVersion());
//     CCONFIG.initConfig()
// }

const DEBUG = CCONFIG.getConfigValue("debug")

let BOUNDS_CIRCLE_MATERIAL
let BOUNDS_CIRCLE
let DEBUG_BOUNDS_CIRCLE_MATERIAL
let DEBUG_BOUNDS_CIRCLE

const SCENE = new THREE.Scene();
const RENDERER = new THREE.WebGLRenderer();
const STATS = new Stats();
const EVALUATOR = new THREECSG.Evaluator();
const CAMERA_CONTROLLER = new CameraController(RENDERER, CONFIG);

const GUI = new THREEGUI.GUI();
const CAMERA_SETTINGS = GUI.addFolder( 'Camera settings' );
const LOCATION_SETTINGS = GUI.addFolder( 'Location settings' );
const RENDERER_SETTINGS = GUI.addFolder( 'Scene settings' );
const DOWNLOAD = GUI.addFolder( 'Download' );




const map = new ml.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    renderWorldCopies: false,
    zoom: 18,
    center: [11.088986462334187, 50.952314129741964],
});

const gmOptions = {
    settings: {
        controlsPosition: "bottom-left",
        controlsUiEnabledByDefault: false
    },

    controls: {
        draw: {
            circle: {
                title: "Draw Circle",
                icon: "circle-icon", // REQUIRED: icon id
                uiEnabled: false,
                active: true
            },

            // everything else disabled
            marker: { uiEnabled: false },
            circle_marker: { uiEnabled: false },
            ellipse: { uiEnabled: false },
            text_marker: { uiEnabled: false },
            line: { uiEnabled: false },
            rectangle: { uiEnabled: false },
            polygon: { uiEnabled: false },
            freehand: { uiEnabled: false },
            custom_shape: { uiEnabled: false }
        },

        edit: {
            drag: {
                title: "Drag Features",
                icon: "drag-icon",
                uiEnabled: false,
                active: false
            },

            change: { uiEnabled: false },
            rotate: { uiEnabled: false },
            scale: { uiEnabled: false },
            copy: { uiEnabled: false },
            cut: { uiEnabled: false },
            split: { uiEnabled: false },
            union: { uiEnabled: false },
            difference: { uiEnabled: false },
            line_simplification: { uiEnabled: false },
            lasso: { uiEnabled: false },
            delete: { uiEnabled: false }
        },

        helper: {
            // no helpers at all
            shape_markers: { uiEnabled: false },
            pin: { uiEnabled: false },
            snapping: { uiEnabled: false },
            snap_guides: { uiEnabled: false },
            measurements: { uiEnabled: false },
            auto_trace: { uiEnabled: false },
            geofencing: { uiEnabled: false },
            zoom_to_features: { uiEnabled: false },
            click_to_edit: { uiEnabled: false }
        }
    }
};

const geoman = new Geoman(map, gmOptions);

map.on("gm:loaded", () => {
    console.log("Geoman fully loaded");

    // Here you can add your geojson shapes for example
    const shapeGeoJson = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 51] },
    };
    map.gm.features.addGeoJsonFeature({ shapeGeoJson });
});

map.on('gm:create',  async (event) => {
    const geo = event.feature._geoJson;

    if (geo.geometry.type !== "Polygon") return;

    // unwrap linear ring
    let points = geo.geometry.coordinates[0];

    // remove duplicated closing point
    if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) {
        points = points.slice(0, -1);
    }

    const center = geo.properties.__gm_center; // [lon, lat]

    let radiusSum = 0;
    for (const p of points) {
        radiusSum += haversine(center, p);
    }

    const radius = radiusSum / points.length;
    const diameter = radius * 2;

    CCONFIG.setConfigValue("radius", radius.toFixed(0))
    CCONFIG.setConfigValue("latitude", center[1])
    CCONFIG.setConfigValue("longitude", center[0])

    document.getElementById("map").remove();

    try {
        console.log('gm:create handler: starting init/loadScene', { center, radius });
        await init();
        await loadScene();
        console.log('gm:create handler: finished init/loadScene');
    } catch (err) {
        console.error('gm:create handler error:', err);
    }
});

function haversine(a, b) {
    const R = 6371000; // meters
    const toRad = d => d * Math.PI / 180;

    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);

    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
}








/**
 * Initializes the 3D scene, renderer, camera, lights, and GUI controls.
 */
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

    BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xE0A030, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,} );
    BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 300, 512, 1,), BOUNDS_CIRCLE_MATERIAL );
    DEBUG_BOUNDS_CIRCLE_MATERIAL = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: false, transparent: true, opacity: 0.1, side: THREE.DoubleSide,} );
    DEBUG_BOUNDS_CIRCLE = new THREECSG.Brush( new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 300, 512, 1,), DEBUG_BOUNDS_CIRCLE_MATERIAL );
    DEBUG_BOUNDS_CIRCLE.position.y = 45;

    document.body.appendChild( STATS.dom );
    STATS.showPanel( 0 )


    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'x' ).onChange(newXPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(newXPos), parseFloat(cameraPos.y), parseFloat(cameraPos.z));
        CCONFIG.setConfigValue("xpos", newXPos)
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'y' ).onChange(newYPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(cameraPos.x), parseFloat(newYPos), parseFloat(cameraPos.z));
        CCONFIG.setConfigValue("ypos", newYPos)
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'z' ).onChange(newZPos => {
        let cameraPos = CAMERA.position
        CAMERA.position.set(parseFloat(cameraPos.x), parseFloat(cameraPos.y), parseFloat(newZPos));
        CCONFIG.setConfigValue("zpos", newZPos)
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'yaw', 0, 360 ).onChange(newYaw => {
        let pitch = CCONFIG.getConfigValue("pitch");
        CAMERA.rotation.set( pitch, ( newYaw * ( Math.PI / 180 ) ), 0, 'YXZ');
        CCONFIG.setConfigValue("yaw", newYaw.toFixed(3));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'pitch', -90, 90 ).onChange(newPitch=> {
        let yaw = CCONFIG.getConfigValue("yaw")
        CAMERA.rotation.set( ( parseInt( newPitch ) * ( Math.PI / 180 ) ), yaw, 0, 'YXZ');
        CCONFIG.setConfigValue("pitch", newPitch.toFixed(3));
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'moveSpeed', 0.01, 10 ).onChange(moveSpeed => {
        CCONFIG.setConfigValue("movespeed", moveSpeed.toFixed(2));
        console.log("speed update")
    }).listen();
    CAMERA_SETTINGS.add( GUI_PARAMS.CameraSettings, 'mouseSensitivity', 0.001, 0.01 ).onChange(mouseSensitivity => {
        console.log("sensi update")
        CCONFIG.setConfigValue("mousesensitivity", parseFloat(mouseSensitivity.toFixed(2)));
    });
    CAMERA_SETTINGS.open();

    LOCATION_SETTINGS.add( GUI_PARAMS.LocationSettings, 'latitude' ).onChange(v => {
        localStorage.setItem("latitude", v);
    }).listen();
    LOCATION_SETTINGS.add( GUI_PARAMS.LocationSettings, 'longitude' ).onChange(v => {
        localStorage.setItem("longitude", v);
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
    DOWNLOAD.add( GUI_PARAMS.Download, 'exportGLTF' );
    DOWNLOAD.add( GUI_PARAMS.Download, 'exportPLY' );
    DOWNLOAD.add( GUI_PARAMS.Download, 'exportJOSN')
    DOWNLOAD.close()



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
    const BASEPLATE = new THREE.Mesh(new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius"), CCONFIG.getConfigValue("radius"), 5, 128, 1,), BASEPLATE_MATERIAL );
    BASEPLATE.position.set(0, -2.5, 0);
    BASEPLATE.receiveShadow = true;
    SCENE.add( BASEPLATE );

    // const BASEPLATE_EDGE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xa0a0a0 });
    // const BASEPLATE_EDGE = new THREE.Mesh(new THREE.CylinderGeometry( CCONFIG.getConfigValue("radius")+3, CCONFIG.getConfigValue("radius")+3, 6, 128, 1, ), BASEPLATE_EDGE_MATERIAL );
    // BASEPLATE_EDGE.position.set(0, -7, 0);
    // BASEPLATE_EDGE.receiveShadow = true;
    // const result = EVALUATOR.evaluate(new THREECSG.Brush(BASEPLATE_EDGE.geometry, BASEPLATE_EDGE.material), BOUNDS_CIRCLE, THREECSG.SUBTRACTION);
    // const csgMesh = new THREE.Mesh(result.geometry, BASEPLATE_EDGE.material);
    // SCENE.add(csgMesh);


    EVALUATOR.useGroups = true;
    EVALUATOR.consolidateGroups = true;

    CAMERA_CONTROLLER.onStart()
}




function pointsArrayToScene(element, pointsArray, innerGeometries = []) {
    try {
        if ((pointsArray || !(pointsArray.length === 0)) && (element.tags) && innerGeometries.length === 0) {
            console.log("Point 1 Reached")
            SCENE.add(createSceneBoxObject(pointsArray, element));

        } // else if (pointsArray && pointsArray.length > 0 && innerGeometries && innerGeometries.length > 0) {
        //     let mainMesh;
        //     for (let mainGeometry of pointsArray) {
        //         let mainTempMesh
        //         if (!mainMesh) {
        //             mainMesh = createCustomGeometry(mainGeometry, 0xE0A030, 10, 15, false);
        //             try {
        //                 const result = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(mainMesh.geometry, mainMesh.material), THREECSG.INTERSECTION);
        //                 mainMesh = new THREE.Mesh(result.geometry, mainMesh.material);
        //             } catch (error) {
        //                 console.error("CSG operation failed for main geometry of element id " + element.id + ": " + error);
        //             }
        //         }
        //         mainTempMesh = createCustomGeometry(mainGeometry, 0xE0A030, 10, 15, false);
        //         try {
        //             const result = EVALUATOR.evaluate(mainMesh, new THREECSG.Brush(mainTempMesh.geometry, mainTempMesh.material), THREECSG.ADDITION);
        //             let csgMesh = new THREE.Mesh(result.geometry, mainTempMesh.material);
            //             const result2 = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(csgMesh.geometry, csgMesh.material), THREECSG.INTERSECTION);
        //             mainMesh = new THREE.Mesh(result2.geometry, mainTempMesh.material);
        //         } catch (error) {
        //             console.error("CSG operation failed for main geometry addition of element id " + element.id + ": " + error);
        //         }
        //     }
        //     let csgMesh = mainMesh;
        //     let csgMesh2
        //     for (let innerGeometry of innerGeometries) {
        //         const tempMesh = createCustomGeometry(innerGeometry, 0xE0A030, 100, -50, false);
        //         const tempMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        //         try {
        //             csgMesh = EVALUATOR.evaluate(new THREECSG.Brush(csgMesh.geometry, csgMesh.material), new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.SUBTRACTION)
        //             tempMesh.material = tempMaterial;
        //             const result2 = EVALUATOR.evaluate(BOUNDS_CIRCLE, new THREECSG.Brush(tempMesh.geometry, tempMesh.material), THREECSG.INTERSECTION);
        //             csgMesh2 = new THREE.Mesh(result2.geometry, tempMesh.material);
        //         } catch (error) {
        //             console.error("CSG operation failed for inner geometry subtraction of element id " + element.id + ": " + error);
        //         }
        //         csgMesh2.geometry.scale( 1,-1, 1 );
        //         csgMesh2.geometry.computeVertexNormals();
        //     }
        //
        //     csgMesh.geometry.scale( 1,-1, 1 );
        //     csgMesh.geometry.computeVertexNormals();
        //     SCENE.add(csgMesh)
        // }
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
    // THIS CODE WILL BE POINTLESS IF THE FILE SAVE GETS IMPLEMENTED
    if ( false ) {
        const overlay = document.getElementById('dropOverlay');
        let dragCounter = 0;

        window.addEventListener('dragenter', listener => {
            listener.preventDefault();
            dragCounter++;
            overlay.classList.add('active');
        });

        window.addEventListener('dragover', listener => {
            listener.preventDefault();
        });

        window.addEventListener('dragleave', listener => {
            dragCounter--;
            if (dragCounter === 0) {
                overlay.classList.remove('active');
            }
        });

        window.addEventListener('drop', async listener => {
            listener.preventDefault();
            dragCounter = 0;
            overlay.classList.remove('active');

            const file = listener.dataTransfer.files[0];
            if (!file || !file.name.endsWith('.json')) {
                console.error('Invalid file');
            }

            try {
                const text = await file.text();
                const sceneData = JSON.parse(text);

                console.log(sceneData);
                REQUESTED_DATA = sceneData;
                document.getElementById('dropOverlay').remove()
                return sceneData;
            } catch (err) {
                console.error('Failed to load scene.json', err);
            }
        });

        let waitCounter = 0;

        while (!REQUESTED_DATA) {
            await sleep(1000);
            if (waitCounter > 30) {
                break;
            }
            waitCounter++
        }
    }

    //  Check if data is loaded from file, if not, fetch from Overpass API
    if (!REQUESTED_DATA) {
        for (let i = 0; i < 10; i++) {
            try {
                REQUESTED_DATA = await DATA.queryAreaData(HELPER.getMaxMinCoordsOfArea(CCONFIG.getConfigValue("longitude"), CCONFIG.getConfigValue("latitude"), CCONFIG.getConfigValue("radius")));
                break
            } catch (error) {
                console.error("Error fetching data from Overpass API, retrying in 10 sec. (Attempt " + (i+1) + " of 10) [" + error + "]");
                await HELPER.sleep(10000);
            }
        }
    }

    //  Check if data is available if not alert the user for a fatal error
    if (!REQUESTED_DATA) {
        alert("API did not return any data. Please try again later.");
        throw new Error("FATAL: No data returned from Overpass API or from file.");
    } else {
        let pointsArray;
        const centerMetric = HELPER.toMetricCoords( CCONFIG.getConfigValue("latitude"), CCONFIG.getConfigValue("longitude") );
        for (let element of (REQUESTED_DATA.elements)) {
            if (element.members) {
                let mainGeometries = [];
                let innerGeometries = [];
                for (let member of element.members) {
                    let mainGeometriesPointsArray = [];
                    if (member.role === "outer" && member.type === "way") {
                        const geometry = getGeometry(member)
                        for (let geoPoint of (geometry)) {
                            const metricCoords = HELPER.toMetricCoords(geoPoint.lat, geoPoint.lon);
                            if (metricCoords) {
                                const x = metricCoords[0] - centerMetric[0];
                                //console.log("metricCoords[0]: " + metricCoords[0] + " + centerMetric[0]: " + centerMetric[0] + " = x: " + x);
                                const z = metricCoords[1] - centerMetric[1];
                                //console.log("metricCoords[0]: " + metricCoords[1] + " + centerMetric[0]: " + centerMetric[1] + " = x: " + z);
                                mainGeometriesPointsArray.push({x: x, y: 0, z: z});
                            }
                        }
                        mainGeometries.push(mainGeometriesPointsArray);
                    }
                    let innerGeometryPointsArray = [];
                    if (member.role === "inner" && member.type === "way") {
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

function createSceneBoxObject(POINTS_ARRAY, ELEMENT, EXTRA = null) {
    const SCENE_OBJECTS = [

        {TAG: "highway", VALUE: "motorway", OBJECT: 0, HEIGHT: 1, COLOR: 0xE6E6E6, Y: 0, WIDTH: 5},
        {TAG: "highway", VALUE: "trunk", OBJECT: 0, HEIGHT: 1, COLOR: 0xE0E0E0, Y: 0, WIDTH: 2},
        {TAG: "highway", VALUE: "primary", OBJECT: 0, HEIGHT: 1, COLOR: 0xDADADA, Y: 0, WIDTH: 4},
        {TAG: "highway", VALUE: "secondary", OBJECT: 0, HEIGHT: 1, COLOR: 0xD4D4D4, Y: 0, WIDTH: 3},
        {TAG: "highway", VALUE: "residential", OBJECT: 0, HEIGHT: 1, COLOR: 0xCECECE, Y: 0, WIDTH: 2.5},
        {TAG: "highway", VALUE: "service", OBJECT: 0, HEIGHT: 1, COLOR: 0xC8C8C8, Y: 0, WIDTH: 2},
        {TAG: "highway", VALUE: "path", OBJECT: 0, HEIGHT: 1, COLOR: 0xDAD6CC, Y: 0, WIDTH: 1},
        {TAG: "highway", VALUE: "footway", OBJECT: 0, HEIGHT: 1, COLOR: 0xE0D8C8, Y: 0, WIDTH: 1},
        {TAG: "highway", VALUE: "cycleway", OBJECT: 0, HEIGHT: 1, COLOR: 0xD0E0EA, Y: 0, WIDTH: 1},
        {TAG: "highway", VALUE: "default", OBJECT: 0, HEIGHT: 1, COLOR: 0xD0D0D0, Y: 0, WIDTH: 3},

        {TAG: "railway", VALUE: "rail", OBJECT: 1, HEIGHT: 1, COLOR: 0xB8B8B8, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "tram", OBJECT: 1, HEIGHT: 1, COLOR: 0xC0C0C0, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "subway", OBJECT: 1, HEIGHT: 1, COLOR: 0xB0B0B0, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "station", OBJECT: 1, HEIGHT: 0, COLOR: 0xD8D8D8, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "platform", OBJECT: 1, HEIGHT: 0, COLOR: 0xE0E0E0, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "railway", VALUE: "default", OBJECT: 1, HEIGHT: 1, COLOR: 0xC0C0C0, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "building", VALUE: "yes", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "house", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "apartments", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "industrial", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "commercial", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "building", VALUE: "default", OBJECT: 2, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "landuse", VALUE: "residential", OBJECT: 3, HEIGHT: 0, COLOR: 0xE8F0EA, DARK_COLOR: 0x2B3A2F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "industrial", OBJECT: 3, HEIGHT: 0, COLOR: 0xF0E6E6, DARK_COLOR: 0x3B2F2F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "commercial", OBJECT: 3, HEIGHT: 0, COLOR: 0xE8EAF2, DARK_COLOR: 0x2F2F46, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "farmland", OBJECT: 3, HEIGHT: 0.5, COLOR: 0xEEF2D8, DARK_COLOR: 0x253422, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "forest", OBJECT: 3, HEIGHT: 10, COLOR: 0xE1F0E5, DARK_COLOR: 0x17321F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "grass", OBJECT: 3, HEIGHT: 0.5, COLOR: 0xE6F4E4, DARK_COLOR: 0x21331F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "landuse", VALUE: "default", OBJECT: 3, HEIGHT: 0, COLOR: 0xE6F4E4, DARK_COLOR: 0x21331F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "natural", VALUE: "wood", OBJECT: 4, HEIGHT: 0, COLOR: 0xDCEFE0, DARK_COLOR: 0x153018, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "water", OBJECT: 4, HEIGHT: 10, COLOR: 0xDCECF6, DARK_COLOR: 0x0F2A3A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "peak", OBJECT: 4, HEIGHT: 0, COLOR: 0xECECEC, DARK_COLOR: 0x322F2B, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "beach", OBJECT: 4, HEIGHT: 0.75, COLOR: 0xF4E8D6, DARK_COLOR: 0x3A2F23, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "tree", OBJECT: 4, HEIGHT: 7.5, COLOR: 0xD6EDD9, DARK_COLOR: 0x1B4426, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "wetland", OBJECT: 4, HEIGHT: 0.25, COLOR: 0xE0F2EC, DARK_COLOR: 0x12332A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "natural", VALUE: "default", OBJECT: 4, HEIGHT: 0.25, COLOR: 0xE0F2EC, DARK_COLOR: 0x12332A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "waterway", VALUE: "river", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xD6ECF7, DARK_COLOR: 0x0D3B55, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "stream", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xE0F2FA, DARK_COLOR: 0x0C2E42, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "canal", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xDCEFF8, DARK_COLOR: 0x0B2A3A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "waterway", VALUE: "default", OBJECT: 5, HEIGHT: 0, COLOR: 0xDCEFF8, DARK_COLOR: 0x0B2A3A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "water", VALUE: "lake", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xD6ECF7, DARK_COLOR: 0x062635, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "pond", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xE0F2FA, DARK_COLOR: 0x063042, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "reservoir", OBJECT: 5, HEIGHT: 0.25, COLOR: 0xDCEFF8, DARK_COLOR: 0x042B39, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "water", VALUE: "default", OBJECT: 5, HEIGHT: 0, COLOR: 0xDCEFF8, DARK_COLOR: 0x042B39, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "amenity", VALUE: "school", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "hospital", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "police", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "fire_station", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "parking", OBJECT: 6, HEIGHT: 0.5, COLOR: 0xDDDDDD, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "restaurant", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "toilets", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "amenity", VALUE: "default", OBJECT: 6, HEIGHT: 10, COLOR: 0xEAEAEA, DARK_COLOR: 0x2E2E2E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "place", VALUE: "continent", OBJECT: 7, HEIGHT: 0, COLOR: 0xECECF2, DARK_COLOR: 0x1B1B2A, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "country", OBJECT: 7, HEIGHT: 0, COLOR: 0xEAE8F0, DARK_COLOR: 0x1C1620, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "city", OBJECT: 7, HEIGHT: 0, COLOR: 0xE6E2EA, DARK_COLOR: 0x2A1F27, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "town", OBJECT: 7, HEIGHT: 0, COLOR: 0xE8E4E8, DARK_COLOR: 0x262126, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "village", OBJECT: 7, HEIGHT: 0, COLOR: 0xECE8EC, DARK_COLOR: 0x221B1F, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "hamlet", OBJECT: 7, HEIGHT: 0, COLOR: 0xF0ECEF, DARK_COLOR: 0x1F1518, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "place", VALUE: "default", OBJECT: 7, HEIGHT: 0, COLOR: 0xF0ECEF, DARK_COLOR: 0x1F1518, Y: 0, TRANSPARENT: false, OPACITY: 1.0},

        {TAG: "leisure", VALUE: "park", OBJECT: 8, HEIGHT: 0.75, COLOR: 0xE2F2E5, DARK_COLOR: 0x102712, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "pitch", OBJECT: 8, HEIGHT: 0.25, COLOR: 0xDCF0E4, DARK_COLOR: 0x163022, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "stadium", OBJECT: 8, HEIGHT: 10, COLOR: 0xECECEC, DARK_COLOR: 0x1B1720, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "playground", OBJECT: 8, HEIGHT: 1.5, COLOR: 0xF0E2E2, DARK_COLOR: 0x2A1E1E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
        {TAG: "leisure", VALUE: "default", OBJECT: 8, HEIGHT: 0, COLOR: 0xF0E2E2, DARK_COLOR: 0x2A1E1E, Y: 0, TRANSPARENT: false, OPACITY: 1.0},
    ];

    console.log(ELEMENT.tags)
    for (const OBJECT of SCENE_OBJECTS) {
        if ( OBJECT.TAG in ELEMENT.tags) {
            //console.log("Match for tag " + OBJECT.TAG + " with value " + OBJECT.VALUE + "\nElement tags: " + ELEMENT.tags + "\nOBJECT.OBJECT: " + OBJECT.OBJECT);
            if (OBJECT.HEIGHT <= 0) { continue }
            if ( (ELEMENT.tags[OBJECT.TAG] === OBJECT.VALUE) || ((!ELEMENT.tags[OBJECT.TAG] || !ELEMENT.tags[OBJECT.TAG].hasValue) && OBJECT.VALUE === "default") ) {
                if (OBJECT.OBJECT === 0 || OBJECT.OBJECT === 1) {
                    return createWayGeometry(POINTS_ARRAY, OBJECT.OBJECT, OBJECT.WIDTH , 0.6);
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
                return createCustomGeometry(POINTS_ARRAY, OBJECT.COLOR, OBJECT.HEIGHT, OBJECT.Y);
            }

            console.log("Code Should not get here (" + OBJECT.TAG + " with value " + OBJECT.VALUE + ") (" + ELEMENT.tags + " with value " + ELEMENT.tags[OBJECT.TAG] + ")");
        } else {

        }
    }
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // if (IGNORE_BOUNDS === true) {return mesh;} TODO: IGNORE BOUNDS GLOBAL BOOL

    const result = EVALUATOR.evaluate( BOUNDS_CIRCLE, new THREECSG.Brush( mesh.geometry, mesh.material ), THREECSG.INTERSECTION );
    const csgMesh = new THREE.Mesh( result.geometry, mesh.material );
    csgMesh.castShadow = true;
    csgMesh.material.side = THREE.DoubleSide;
    csgMesh.geometry.scale( 1,-1, 1 );
    csgMesh.geometry.computeVertexNormals();
    return csgMesh
}


// =-= Render Loop =-= //
function render() {
    if ( !CAMERA_CONTROLLER || !RENDERER ) { return; }

    renderTicksCounter++;
    GUI_PARAMS.RendererSettings.renderTicks = renderTicksCounter;

    CAMERA_CONTROLLER.onUpdate()


    DEBUG_BOUNDS_CIRCLE.visible = !!DEBUG;

    STATS.begin();
    RENDERER.render(SCENE, CAMERA_CONTROLLER.CAMERA);
    STATS.end();

    GUI_PARAMS.CameraSettings.x = CAMERA_CONTROLLER.CAMERA.position.x.toFixed(3);
    GUI_PARAMS.CameraSettings.y = CAMERA_CONTROLLER.CAMERA.position.y.toFixed(3);
    GUI_PARAMS.CameraSettings.z = CAMERA_CONTROLLER.CAMERA.position.z.toFixed(3);
    if ( CAMERA_CONTROLLER.CAMERA.rotation.y > ( 2 * Math.PI ) ) {
        CAMERA_CONTROLLER.CAMERA.rotation.y = CAMERA_CONTROLLER.CAMERA.rotation.y - ( 2 * Math.PI );
    } else if ( CAMERA_CONTROLLER.CAMERA.rotation.y < 0 && CAMERA_CONTROLLER.CAMERA.rotation.y < ( 2 * Math.PI ) ) {
        CAMERA_CONTROLLER.CAMERA.rotation.y = CAMERA_CONTROLLER.CAMERA.rotation.y + ( 2 * Math.PI );
    }
    GUI_PARAMS.CameraSettings.yaw = ( CAMERA_CONTROLLER.CAMERA.rotation.y * ( 180 / Math.PI ) ).toFixed(3);
    if (CAMERA_CONTROLLER.CAMERA.rotation.x > ( Math.PI / 2 ) ) {
        CAMERA_CONTROLLER.CAMERA.rotation.x = ( Math.PI / 2 );
    } else if (CAMERA_CONTROLLER.CAMERA.rotation.x < -( Math.PI / 2 )) {
        CAMERA_CONTROLLER.CAMERA.rotation.x = - ( Math.PI / 2 );
    }
    GUI_PARAMS.CameraSettings.pitch = ( CAMERA_CONTROLLER.CAMERA.rotation.x * ( 180 / Math.PI ) ).toFixed(3);

    // console.log(GUI_PARAMS.CameraSettings.pitch + " : " + ( CAMERA.rotation.x * ( 180 / Math.PI ) ) + "; " + GUI_PARAMS.CameraSettings.yaw + " : " + ( CAMERA.rotation.y * ( 180 / Math.PI ) ) );
}







