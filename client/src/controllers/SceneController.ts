import * as THREE from 'three'
import * as THREECSG from "three-bvh-csg";
import type { OSMElement, Point3D } from "../types/OSM.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MapController } from "../controllers/MapController.js";
import { ApiService } from "../services/ApiService.js";

class SceneController {
    private readonly EVALUATOR: THREECSG.Evaluator;
    private readonly API_SERVICE: ApiService;
    private readonly BOUNDS_CIRCLE: THREECSG.Brush;
    private readonly DEBUG: number;
    private readonly COLOR_MODE: number;
    private OUTER_GEOMETRIES: Point3D[] = [];
    private readonly OBJECT_CONFIG: {};
    private REQUESTED_DATA: any;
    private readonly RADIUS: number;
    private readonly REUSED_DATA: any;
    private readonly GEOJSON: any;
    private readonly LATITUDE: number;
    private readonly LONGITUDE: number;

    constructor(OBJECT_CONFIG: {},
                RADIUS: number,
                DEBUG: number,
                COLOR_MODE: number,
                GEOJSON: any,
                REUSED_DATA: any,
                LATITUDE: number,
                LONGITUDE: number) {
        this.EVALUATOR = new THREECSG.Evaluator();
        this.API_SERVICE = new ApiService();
        this.OBJECT_CONFIG = OBJECT_CONFIG
        this.DEBUG = DEBUG
        this.COLOR_MODE = COLOR_MODE
        this.OUTER_GEOMETRIES = [];
        this.RADIUS = RADIUS;
        this.REUSED_DATA = REUSED_DATA;
        this.GEOJSON = GEOJSON;
        this.LATITUDE = LATITUDE;
        this.LONGITUDE = LONGITUDE;
        this.BOUNDS_CIRCLE = new THREECSG.Brush(
            new THREE.CylinderGeometry(this.RADIUS, this.RADIUS, (2 * this.RADIUS), Math.round(this.RADIUS / 2), Math.round(this.RADIUS / 20)),
            new THREE.MeshBasicMaterial({color: 0xE0A030, wireframe: false, transparent: false, opacity: 1., side: THREE.DoubleSide,})
        )
    }

    private createWayGeometry(POINTS_ARRAY: Point3D[] = [], TYPE = 0, WIDTH = 3, HEIGHT = 0.6, COLOR_BELOW = 0x707070, COLOR_ABOVE = 0xE0E0E0, Y_OFFSET = 0) {
        if (POINTS_ARRAY.length < 2) {
            self.postMessage({type: "Log", data: "[WARN] POINTS_ARRAY must contain at least two points."})
            return null;
        }

        const MATERIAL_BELOW = new THREE.MeshStandardMaterial({color: COLOR_BELOW});
        const MATERIAL_ABOVE = new THREE.MeshStandardMaterial({color: COLOR_ABOVE});
        const TEMP_GROUP_U = new THREE.Group();
        const TEMP_GROUP_D = new THREE.Group();

        const createCSG = (geom: THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, pos: {
            x: any; y: any; z: any;
        }, angle: number, material: THREE.Material | THREE.Material[] | undefined) => {
            const matrix = new THREE.Matrix4()
                .makeRotationY(angle)
                .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
            geom.applyMatrix4(matrix);
            const brush = new THREECSG.Brush(geom, material);
            //const result = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, brush, THREECSG.INTERSECTION);
            return new THREE.Mesh(brush.geometry, material);
        }

        for (let i = 1; i < POINTS_ARRAY.length; i++) {
            const p0 = POINTS_ARRAY[i - 1];
            const p1 = POINTS_ARRAY[i];

            if (p0 === undefined || p1 === undefined) {
                postMessage({type: "Log", data: `[WARN] Undefined point in POINTS_ARRAY at index ${i - 1} or ${i}. Skipping segment.`});
                continue;
            }

            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const length = Math.sqrt(dx * dx + dz * dz);
            if (length === 0) continue;

            const angle = Math.atan2(dz, dx);
            const midPos = {x: (p0.x + p1.x) / 2, y: HEIGHT / 2 + Y_OFFSET, z: (p0.z + p1.z) / 2};

            const streetBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, WIDTH), midPos, -angle, MATERIAL_BELOW);

            streetBelow.receiveShadow = true;
            streetBelow.castShadow = false;
            TEMP_GROUP_D.add(streetBelow);
            const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32), {
                x: p0.x,
                y: HEIGHT / 2 + Y_OFFSET,
                z: p0.z
            }, 0, MATERIAL_BELOW);
            connectorBelow.receiveShadow = true;
            connectorBelow.castShadow = false;
            TEMP_GROUP_D.add(connectorBelow);

            if (TYPE === 0) {
                const streetAbove = createCSG(new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH / 1.5), midPos, -angle, MATERIAL_ABOVE);
                streetAbove.receiveShadow = true;
                streetAbove.castShadow = false;
                TEMP_GROUP_U.add(streetAbove);
                const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH / 2) / 1.5, (WIDTH / 2) / 1.5, HEIGHT + 0.1, 32), {
                    x: p0.x,
                    y: HEIGHT / 2 + Y_OFFSET,
                    z: p0.z
                }, 0, MATERIAL_ABOVE);
                connectorAbove.receiveShadow = true;
                connectorAbove.castShadow = false;
                TEMP_GROUP_U.add(connectorAbove);
            }
        }

        const plast = POINTS_ARRAY[POINTS_ARRAY.length - 1];

        if (plast !== undefined) {
            const connectorBelow = createCSG(new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32), {
                x: plast.x,
                y: HEIGHT / 2,
                z: plast.z
            }, 0, MATERIAL_BELOW);
            connectorBelow.receiveShadow = true;
            TEMP_GROUP_D.add(connectorBelow);

            if (TYPE === 0) {
                const connectorAbove = createCSG(new THREE.CylinderGeometry((WIDTH / 2) / 1.5, (WIDTH / 2) / 1.5, HEIGHT + 0.1, 32), {
                    x: plast.x,
                    y: HEIGHT / 2,
                    z: plast.z
                }, 0, MATERIAL_ABOVE);
                TEMP_GROUP_U.add(connectorAbove);
                connectorAbove.receiveShadow = true;
            }
        }

        const RESULT = new THREE.Group();

        const MERGED_MESH_D = this.mergeGroupToMesh(TEMP_GROUP_D);
        const EVAL_D = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_D.geometry, MATERIAL_BELOW), THREECSG.INTERSECTION)
        RESULT.add(new THREE.Mesh(EVAL_D.geometry, MATERIAL_BELOW));
        const MERGED_MESH_U = this.mergeGroupToMesh(TEMP_GROUP_U);
        const EVAL_U = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(MERGED_MESH_U.geometry, MATERIAL_ABOVE), THREECSG.INTERSECTION)
        RESULT.add(new THREE.Mesh(EVAL_U.geometry, MATERIAL_ABOVE));

        return RESULT
    }

    private createCustomGeometry(POINTS_ARRAY: [], COLOR: number, HEIGHT = 1, Y_OFFSET = 0) {
        if (POINTS_ARRAY.length <= 1) {
            throw new Error('POINTS_ARRAY length must be greater than 0');
        }
        if (POINTS_ARRAY[0] === undefined) {
            throw new Error('POINTS_ARRAY[0] is undefined');
        }
        const SHAPE = new THREE.Shape();
        SHAPE.moveTo(POINTS_ARRAY[0].x, POINTS_ARRAY[0].z);
        for (let i = 1; i < POINTS_ARRAY.length; i++) {
            SHAPE.lineTo(POINTS_ARRAY[i].x, POINTS_ARRAY[i].z);
        }
        const EXTRUDE_SETTINGS = {
            depth: HEIGHT, bevelEnabled: false,
        };
        const GEOMETRY = new THREE.ExtrudeGeometry(SHAPE, EXTRUDE_SETTINGS);
        GEOMETRY.rotateX(Math.PI / 2);
        GEOMETRY.translate(0, Y_OFFSET + HEIGHT, 0)
        const MATERIAL = new THREE.MeshStandardMaterial({color: COLOR});
        const RESULT = this.EVALUATOR.evaluate(this.BOUNDS_CIRCLE, new THREECSG.Brush(GEOMETRY, MATERIAL), THREECSG.INTERSECTION);
        const CSG_MESH = new THREE.Mesh(RESULT.geometry, MATERIAL);

        CSG_MESH.castShadow = true;
        CSG_MESH.receiveShadow = true;
        return CSG_MESH
    }

    async loadSceneFromData() {
        if (this.REUSED_DATA == null) {
            for (let i = 0; i < 10; i++) {
                try {
                    this.REQUESTED_DATA = await this.API_SERVICE.queryAreaData();
                    break
                } catch (error) {
                    self.postMessage({type: "Log", data: `[WARN] Error fetching data from Overpass API, retrying in 10 sec. (Attempt ${i + 1} of 10) [${error}]`});
                    setTimeout("loadSceneFromData()", 10000);
                }
            }

            if (!this.REQUESTED_DATA) {
                alert("API did not return any data. Please try again later.");
                throw new Error("FATAL: No data returned from Overpass API or from file.");
            } else {
                const GEOJSON = this.GEOJSON
                const DATA = this.REQUESTED_DATA;

                await fetch("http://localhost:3000/api/object", {
                    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({GEOJSON, DATA})
                });
            }
        } else {
            this.REQUESTED_DATA = this.REUSED_DATA;
        }

        if (this.REQUESTED_DATA) {
            let pointsArray;
            const centerMetric = this.API_SERVICE.toMetricCoords(this.LATITUDE, this.LONGITUDE);
            for (let element of (this.REQUESTED_DATA.elements)) {
                if (element.members) {
                    let mainGeometries = [];
                    let innerGeometries = [];
                    for (let member of element.members) {
                        let mainGeometriesPointsArray = [];
                        if (member.role === "outer" && member.type === "way") {
                            const geometry = this.getGeometry(member)
                            for (let geoPoint of (geometry)) {
                                const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
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
                            const geometry = this.getGeometry(member)
                            for (let geoPoint of (geometry)) {
                                const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
                                if (metricCoords) {
                                    const x = metricCoords[0] - centerMetric[0];
                                    const z = metricCoords[1] - centerMetric[1];
                                    innerGeometryPointsArray.push({x: x, y: 0, z: z});
                                }
                            }
                            innerGeometries.push(innerGeometryPointsArray);
                        } else {
                        }
                    }
                    if (mainGeometries.length > 1) {
                        await this.pointsArrayToScene(element, mainGeometries, innerGeometries);
                    }
                } else {
                    const geometry = this.getGeometry(element)
                    pointsArray = [];
                    for (let geoPoint of (geometry)) {
                        const metricCoords = this.API_SERVICE.toMetricCoords(geoPoint.lat, geoPoint.lon);
                        if (metricCoords) {
                            const x = metricCoords[0] - centerMetric[0];
                            const z = metricCoords[1] - centerMetric[1];
                            pointsArray.push({x: x, y: 0, z: z});
                        }
                    }
                    if (pointsArray.length > 1) {
                        await this.pointsArrayToScene(element, pointsArray, []);
                    }
                }
            }
            self.postMessage({type: "SceneLoaded"})
        } else {
            self.postMessage({type: "Log", data: "No data to load into scene."})
        }
    }

    private async pointsArrayToScene(ELEMENT: OSMElement, OUTER_GEOMETRIES: Point3D[], INNER_GEOMETRIES: Point3D[] = []) {
        try {
            if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length === 0) {
                const MESH = await this.createSceneBoxObject(OUTER_GEOMETRIES, ELEMENT)
                if (MESH) {
                    MESH.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                    const JSON = MESH.toJSON();
                    self.postMessage({type: "SceneMesh", data: JSON});
                }
            } else if (OUTER_GEOMETRIES && OUTER_GEOMETRIES.length > 1 && ELEMENT.tags && INNER_GEOMETRIES.length > 0) {
                try {
                    let OUTER_MESH
                    for (let i = 0; i < OUTER_GEOMETRIES.length; i++) {
                        try {
                            const TEMP_MESH = await this.createSceneBoxObject(OUTER_GEOMETRIES[i], ELEMENT);
                            if (this.DEBUG) {
                                const DEBUG_MESH = new THREE.Mesh(TEMP_MESH.geometry, new THREE.MeshBasicMaterial({
                                    color: 0xff0000, transparent: true, opacity: 0.35
                                }));
                                DEBUG_MESH.position.set(0, 20, 0)
                                const JSON = DEBUG_MESH.toJSON();
                                self.postMessage({type: "SceneMesh", data: JSON});
                            }


                            if ((!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position)) {
                                self.postMessage({type: "Log", data: `[WARN] Invalid geometry for element ${ELEMENT.id}, outer geometry ${OUTER_GEOMETRIES[i]}`})
                                continue;
                            }

                            if (!OUTER_MESH) {
                                OUTER_MESH = TEMP_MESH;
                                continue;
                            }

                            try {
                                const RESULT: THREECSG.Brush = this.EVALUATOR.evaluate(new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material), new THREECSG.Brush(TEMP_MESH.geometry, OUTER_MESH.material), THREECSG.ADDITION);
                                OUTER_MESH = new THREE.Mesh(RESULT.geometry, OUTER_MESH.material);
                            } catch (error) {
                                self.postMessage({type: "Log", data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during outer geometry processing: ${error}`})
                            }
                        } catch (error) {
                            self.postMessage({type: "Log", data: "[ERROR] Error creating mesh for outer (" + OUTER_GEOMETRIES[i] + ") geometry of element id " + ELEMENT.id + ": " + error})
                        }
                    }

                    let INNER_MESH
                    for (let i = 0; i < INNER_GEOMETRIES.length; i++) {
                        const TEMP_MESH = await this.createSceneBoxObject(INNER_GEOMETRIES[i], ELEMENT);
                        if (this.DEBUG) {
                            const DEBUG_MESH = new THREE.Mesh(TEMP_MESH.geometry, new THREE.MeshBasicMaterial({
                                color: 0xffff00, transparent: true, opacity: 0.35
                            }));
                            DEBUG_MESH.position.set(0, 21, 0)
                            const JSON = DEBUG_MESH.toJSON();
                            self.postMessage({type: "SceneMesh", data: JSON});
                        }


                        if (!TEMP_MESH || !TEMP_MESH.geometry || !TEMP_MESH.geometry.attributes.position) {
                            self.postMessage({type: "Log", data: `[WARN] Invalid geometry for element ${ELEMENT.id}, inner geometry ${INNER_GEOMETRIES[i]}`})
                            continue;
                        }

                        if (!INNER_MESH) {
                            INNER_MESH = TEMP_MESH;
                            continue;
                        }

                        try {
                            const RESULT = this.EVALUATOR.evaluate(new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material), new THREECSG.Brush(TEMP_MESH.geometry, INNER_MESH.material), THREECSG.ADDITION);
                            INNER_MESH = new THREE.Mesh(RESULT.geometry, INNER_MESH.material);
                        } catch (error) {
                            self.postMessage({type: "Log", data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during inner geometry processing: ${error}`})
                        }
                    }
                    const CSG_RESULT = this.EVALUATOR.evaluate(new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material), new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material), THREECSG.SUBTRACTION);
                    const CSG_MESH = new THREE.Mesh(CSG_RESULT.geometry, OUTER_MESH.material);
                    CSG_MESH.userData.tags = [...Object.entries(ELEMENT.tags).map(([key, value]) => `${key}=${value}`)];
                    const JSON = CSG_MESH.toJSON();
                    self.postMessage({type: "SceneMesh", data: JSON});
                } catch (error) {
                    self.postMessage({type: "Log", data: "[ERROR] Error processing element with id " + ELEMENT.id + ": " + error})
                }
            }
        } catch (error) {
            self.postMessage({type: "Log", data: "[ERROR] Error creating geometry for element with id " + ELEMENT.id + ": " + error})
        }
    }

    private async createSceneBoxObject(POINTS_ARRAY: Point3D[], ELEMENT: OSMElement) {
        if (!this.OBJECT_CONFIG) {
            return null;
        }
        if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === 0) {
            return null;
        }

        for (const [CATEGORY_NAME, CATEGORY] of Object.entries(this.OBJECT_CONFIG)) {
            const expectedTagKey = CATEGORY_NAME.slice(0, -5).toLowerCase(); // e.g. "BUILDING_TAGS" -> "building"
            if (!(expectedTagKey in ELEMENT.tags) && this.DEBUG) {
                ELEMENT.tags[expectedTagKey] = "DEFAULT"
            } else if (!(expectedTagKey in ELEMENT.tags)) {
                continue;
            }

            const elemTagValue = ELEMENT.tags[expectedTagKey];
            for (const [TAG, VALUE] of Object.entries(<string>CATEGORY)) {
                if (elemTagValue !== TAG) continue;

                // color selection preserved from original logic
                let COLOR, COLOR_D, COLOR_U;
                if (this.COLOR_MODE === 0) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.DEFAULT_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.DEFAULT_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.DEFAULT_COLOR);
                    }
                } else if (this.COLOR_MODE === 1) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.DARK_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.DARK_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.DARK_COLOR);
                    }
                } else if (this.COLOR_MODE === 2) {
                    if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                        COLOR_U = this.hexToInt(VALUE.SPECIAL_COLOR_U);
                        COLOR_D = this.hexToInt(VALUE.SPECIAL_COLOR_D);
                    } else {
                        COLOR = this.hexToInt(VALUE.SPECIAL_COLOR);
                    }
                } else {
                    COLOR = 0xFF0000;
                    COLOR_D = 0xFF0000;
                    COLOR_U = 0xFF0000;
                }

                if (CATEGORY_NAME === "HIGHWAY_TAGS") {
                    return this.createWayGeometry(POINTS_ARRAY, 0, VALUE.WIDTH, VALUE.HEIGHT, COLOR_D, COLOR_U);
                } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
                    return this.createWayGeometry(POINTS_ARRAY, 1, VALUE.WIDTH, VALUE.HEIGHT, COLOR);
                } else if (CATEGORY_NAME === "WATERWAY_TAGS" && elemTagValue === "stream") {
                    return this.createWayGeometry(POINTS_ARRAY, 1, 5, VALUE.HEIGHT, COLOR);
                } else {
                    let HEIGHT = VALUE.HEIGHT;
                    if (ELEMENT.tags.height) {
                        const parsedHeight = parseFloat(ELEMENT.tags.height);
                        if (!isNaN(parsedHeight)) {
                            HEIGHT = parsedHeight;
                        }
                    }
                    return this.createCustomGeometry(POINTS_ARRAY, COLOR, HEIGHT, VALUE.Y_OFFSET);
                }
            }
        }
        return null;
    }

    private getGeometry(element: { geometry: any; }) {
        if (element.geometry) {
            return element.geometry;
        }
        return null;
    }

    private mergeGroupToMesh(group: THREE.Group<THREE.Object3DEventMap>): THREE.Mesh {
        const geometries: THREE.BufferGeometry[] = [];

        group.updateMatrixWorld(true);

        group.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.geometry) {
                    const geom = (mesh.geometry as THREE.BufferGeometry).clone();
                    geom.applyMatrix4(mesh.matrixWorld);
                    geometries.push(geom);
                }
            }
        });

        if (geometries.length === 0) {
            return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
        }

        const merged = mergeGeometries(geometries, true) as THREE.BufferGeometry | null;
        if (!merged) {
            return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
        }

        return new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
    }


    private hexToInt(hex: string) {
        return parseInt(hex.replace("#", ""), 16);
    }

    sendMesh(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        const material = mesh.material;

        const position = geometry.getAttribute("position");
        const normal = geometry.getAttribute("normal");
        const uv = geometry.getAttribute("uv");
        const index = geometry.getIndex();

        self.postMessage(
            {
                type: "SceneMesh",

                positions: position ? position.array : null,
                normals: normal ? normal.array : null,
                uvs: uv ? uv.array : null,
                indices: index ? index.array : null,

                color: material.color ? material.color.getHex() : 0xffffff
            },
            [
                position?.array.buffer,
                normal?.array.buffer,
                uv?.array.buffer,
                index?.array.buffer
            ].filter(Boolean)
        );
    }
}

self.onmessage = async function(event: MessageEvent) {
    const {RADIUS, OBJECT_CONFIG, DEBUG, COLOR_MODE, GEOJSON, REUSED_DATA, LATITUDE, LONGITUDE} = event.data;
    const sceneController = new SceneController(OBJECT_CONFIG, RADIUS, DEBUG, COLOR_MODE, GEOJSON, REUSED_DATA, LATITUDE, LONGITUDE);
    await sceneController.loadSceneFromData();
}