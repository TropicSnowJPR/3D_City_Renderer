import * as THREE from "three";
import * as THREECSG from "three-bvh-csg";
import type { OSMElement } from "../types/OSM.js";
import type { Geometry3D, GeometryList3D } from "../types/Geometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ApiService } from "../services/ApiService.js";
import type { ObjectConfigValue } from "../types/ObjectConfig.js";

class SceneController {
  private readonly EVALUATOR: THREECSG.Evaluator;
  private readonly API_SERVICE: ApiService;
  private readonly BOUNDS_CIRCLE: THREECSG.Brush;
  private readonly DEBUG: number;
  private readonly COLOR_MODE: number;
  private readonly OBJECT_CONFIG: {};
  private REQUESTED_DATA: any;
  private readonly RADIUS: number;
  private readonly REUSED_DATA: any;
  private readonly GEOJSON: any;
  private readonly LATITUDE: number;
  private readonly LONGITUDE: number;

  constructor(
    OBJECT_CONFIG: {},
    RADIUS: number,
    DEBUG: number,
    COLOR_MODE: number,
    GEOJSON: any,
    REUSED_DATA: any,
    LATITUDE: number,
    LONGITUDE: number,
  ) {
    this.EVALUATOR = new THREECSG.Evaluator();
    this.API_SERVICE = new ApiService();
    this.OBJECT_CONFIG = OBJECT_CONFIG;
    this.DEBUG = DEBUG;
    this.COLOR_MODE = COLOR_MODE;
    this.RADIUS = RADIUS;
    this.REUSED_DATA = REUSED_DATA;
    this.GEOJSON = GEOJSON;
    this.LATITUDE = LATITUDE;
    this.LONGITUDE = LONGITUDE;
    this.BOUNDS_CIRCLE = new THREECSG.Brush(
      new THREE.CylinderGeometry(
        this.RADIUS,
        this.RADIUS,
        2 * this.RADIUS,
        Math.round(this.RADIUS / 2),
        Math.round(this.RADIUS / 20),
      ),
      new THREE.MeshBasicMaterial({
        color: 0xE0_A0_30,
        opacity: 1,
        side: THREE.DoubleSide,
        transparent: false,
        wireframe: false,
      }),
    );
  }

  async loadSceneFromData() {
    if (this.REUSED_DATA == null) {
      for (let i = 0; i < 10; i++) {
        try {
          this.REQUESTED_DATA = await this.API_SERVICE.queryAreaData();
          break;
        } catch (error) {
          self.postMessage({
            data: `[WARN] Error fetching data from Overpass API, retrying in 10 sec. (Attempt ${i + 1} of 10) [${error}]`,
            type: "Log",
          }, self.location.origin);
          setTimeout("loadSceneFromData()", 10_000);
        }
      }

      if (!this.REQUESTED_DATA) {
        alert("API did not return any data. Please try again later.");
        throw new Error(
          "FATAL: No data returned from Overpass API or from file.",
        );
      } else {
        const {GEOJSON} = this;
        const DATA = this.REQUESTED_DATA;

        await fetch("http://localhost:3000/api/object", {
          body: JSON.stringify({ DATA, GEOJSON }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }
    } else {
      this.REQUESTED_DATA = this.REUSED_DATA;
    }

    if (this.REQUESTED_DATA) {
      const CENTER_METRIC = this.API_SERVICE.toMetricCoords(
        this.LATITUDE,
        this.LONGITUDE,
      );
      for (const ELEMENT of this.REQUESTED_DATA.elements) {
        const OUTER_GEOMETRY_LIST_3D: GeometryList3D = [];
        const INNER_GEOMETRY_LIST_3D: GeometryList3D = [];
        if (ELEMENT.members) {
          for (const MEMBER of ELEMENT.members) {
            if (MEMBER.role === "") {
              break;
            }
            const GEOMETRY_3D: Geometry3D = [];
            const GEOMETRY = this.getGeometry(MEMBER);
            if (!CENTER_METRIC || !GEOMETRY) {continue;}
            for (const GEO_POINT of GEOMETRY) {
              const METRIC_CORDS = this.API_SERVICE.toMetricCoords(
                GEO_POINT.lat,
                GEO_POINT.lon,
              );

              if (!METRIC_CORDS) {continue;}

              const [mx, mz] = METRIC_CORDS;
              const [cx, cz] = CENTER_METRIC;

              if (!mx || !mz || !cx || !cz) {continue;}

              GEOMETRY_3D.push({ x: mx - cx, y: 0, z: mz - cz });
            }

            if (
              MEMBER.role === "outer" &&
              MEMBER.type === "way" &&
              GEOMETRY_3D.length > 1
            ) {
              OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
            if (
              MEMBER.role === "inner" &&
              MEMBER.type === "way" &&
              GEOMETRY_3D.length > 1
            ) {
              INNER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
          }
          if (
            OUTER_GEOMETRY_LIST_3D.length > 0 &&
            INNER_GEOMETRY_LIST_3D.length > 0
          ) {
            await this.pointsArrayToScene(
              ELEMENT,
              OUTER_GEOMETRY_LIST_3D,
              INNER_GEOMETRY_LIST_3D,
            );
          }
        } else {
          const GEOMETRY = this.getGeometry(ELEMENT);
          if (!CENTER_METRIC || !GEOMETRY) {continue;}
          for (const GEO_POINT of GEOMETRY) {
            const METRIC_CORDS = this.API_SERVICE.toMetricCoords(
              GEO_POINT.lat,
              GEO_POINT.lon,
            );

            if (!METRIC_CORDS) {continue;}

            const [mx, mz] = METRIC_CORDS;
            const [cx, cz] = CENTER_METRIC;

            if (!mx || !mz || !cx || !cz) {continue;}

            GEOMETRY_3D.push({ x: mx - cx, y: 0, z: mz - cz });
          }
          if (GEOMETRY_3D.length > 1) {
            OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
          }
          if (OUTER_GEOMETRY_LIST_3D.length === 1) {
            await this.pointsArrayToScene(ELEMENT, OUTER_GEOMETRY_LIST_3D);
          }
        }
      }
      self.postMessage({ type: "SceneLoaded" }, self.location.origin);
    } else {
      self.postMessage({ data: "No data to load into scene.", type: "Log" }, self.location.origin);
    }
  }

  private async pointsArrayToScene(
    ELEMENT: OSMElement,
    OUTER_GEOMETRY_LIST_3D: GeometryList3D,
    INNER_GEOMETRY_LIST_3D: GeometryList3D | undefined,
  ) {
    try {
      if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length === 1 &&
        (INNER_GEOMETRY_LIST_3D === undefined ||
          INNER_GEOMETRY_LIST_3D.length === 0) &&
        ELEMENT.tags
      ) {
        const GEOMETRY = OUTER_GEOMETRY_LIST_3D[0];
        if (GEOMETRY === undefined) {
          return;
        }
        const MESH = await this.createSceneBoxObject(GEOMETRY, ELEMENT);
        if (MESH) {
          MESH.userData.tags = Object.entries(ELEMENT.tags).map(
            ([key, value]) => `${key}=${value}`,
          );
          const JSON = MESH.toJSON();
          self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
        }
      } else if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length > 0 &&
        INNER_GEOMETRY_LIST_3D &&
        INNER_GEOMETRY_LIST_3D.length > 0 &&
        ELEMENT.tags
      ) {
        self.postMessage({
          data:
            " [INFO] Processing element with id " +
            ELEMENT.id +
            " using CSG operations. Outer geometries: " +
            OUTER_GEOMETRY_LIST_3D.length +
            ", Inner geometries: " +
            INNER_GEOMETRY_LIST_3D.length,
          type: "Log",
        }, self.location.origin);
        let OUTER_MESH;
        for (let i = 0; i < OUTER_GEOMETRY_LIST_3D.length; i++) {
          const GEOMETRY = OUTER_GEOMETRY_LIST_3D[i];
          if (GEOMETRY === undefined) {
            return;
          }
          const MESH = await this.createSceneBoxObject(GEOMETRY, ELEMENT);
          if (!MESH) {
            continue;
          }
          if (this.DEBUG) {
            const DEBUG_MESH = new THREE.Mesh(
              MESH.geometry,
              new THREE.MeshBasicMaterial({
                color: 0xFF_00_00,
                opacity: 0.35,
                transparent: true,
              }),
            );
            DEBUG_MESH.position.set(0, 20, 0);
            const JSON = DEBUG_MESH.toJSON();
            self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
          }

          if (!OUTER_MESH) {
            OUTER_MESH = MESH;
            continue;
          }

          try {
            const RESULT: THREE.Mesh = this.EVALUATOR.evaluate(
              new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material),
              new THREECSG.Brush(MESH.geometry, OUTER_MESH.material),
              THREECSG.ADDITION,
            );
            OUTER_MESH = new THREE.Mesh(RESULT.geometry, OUTER_MESH.material);
          } catch (error) {
            self.postMessage({
              data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during outer geometry processing: ${error}`,
              type: "Log",
            }, self.location.origin);
          }
        }

        let INNER_MESH;
        for (let i = 0; i < INNER_GEOMETRY_LIST_3D.length; i++) {
          const GEOMETRY = INNER_GEOMETRY_LIST_3D[i];
          if (GEOMETRY === undefined) {
            return;
          }
          const MESH = await this.createSceneBoxObject(GEOMETRY, ELEMENT);
          if (!MESH) {
            continue;
          }
          if (this.DEBUG) {
            const DEBUG_MESH = new THREE.Mesh(
              MESH.geometry,
              new THREE.MeshBasicMaterial({
                color: 0xFF_00_00,
                opacity: 0.35,
                transparent: true,
              }),
            );
            DEBUG_MESH.position.set(0, 20, 0);
            const JSON = DEBUG_MESH.toJSON();
            self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
          }

          if (!INNER_MESH) {
            INNER_MESH = MESH;
            continue;
          }

          try {
            const RESULT: THREE.Mesh = this.EVALUATOR.evaluate(
              new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material),
              new THREECSG.Brush(MESH.geometry, INNER_MESH.material),
              THREECSG.ADDITION,
            );
            INNER_MESH = new THREE.Mesh(RESULT.geometry, INNER_MESH.material);
          } catch (error) {
            self.postMessage({
              data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during inner geometry processing: ${error}`,
              type: "Log",
            }, self.location.origin);
          }
        }
        if (!OUTER_MESH || !INNER_MESH) {
          self.postMessage({
            data: `[WARN] Missing outer or inner mesh for element ${ELEMENT.id}, skipping CSG subtraction.`,
            type: "Log",
          }, self.location.origin);
          return;
        }
        const CSG_RESULT = this.EVALUATOR.evaluate(
          new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material),
          new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material),
          THREECSG.SUBTRACTION,
        );
        const CSG_MESH = new THREE.Mesh(
          CSG_RESULT.geometry,
          OUTER_MESH.material,
        );
        CSG_MESH.userData.tags = Object.entries(ELEMENT.tags).map(
          ([key, value]) => `${key}=${value}`,
        );
        const JSON = CSG_MESH.toJSON();
        self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
      }
    } catch (error) {
      self.postMessage({
        data:
          `[ERROR] Error creating geometry for element with id ${ELEMENT.id}: ${error}`,
        type: "Log",
      }, self.location.origin);
    }
  }

  private async createSceneBoxObject(
    GEOMETRY_3D: Geometry3D,
    ELEMENT: OSMElement,
  ) {
    if (!this.OBJECT_CONFIG) {
      return;
    }
    if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === 0) {
      return;
    }

    for (const [CATEGORY_NAME, CATEGORY] of Object.entries(
      this.OBJECT_CONFIG,
    )) {
      const expectedTagKey = CATEGORY_NAME.slice(0, -5).toLowerCase(); // E.g. "BUILDING_TAGS" -> "building"
      if (!(expectedTagKey in ELEMENT.tags)) {
        continue;
      }

      const elemTagValue = ELEMENT.tags[expectedTagKey];
      for (const [TAG, VALUE] of Object.entries(CATEGORY as string)) {
        const TYPED_VALUE = VALUE as unknown as ObjectConfigValue;
        if (elemTagValue !== TAG) {continue;}

        // Color selection preserved from original logic
        let COLOR, COLOR_D, COLOR_U;
        if (this.COLOR_MODE === 0) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = this.hexToInt(TYPED_VALUE.DEFAULT_COLOR_U);
            COLOR_D = this.hexToInt(TYPED_VALUE.DEFAULT_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.DEFAULT_COLOR ? this.hexToInt(TYPED_VALUE.DEFAULT_COLOR) : 0xFF_00_00;
          }
        } else if (this.COLOR_MODE === 1) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = this.hexToInt(TYPED_VALUE.DARK_COLOR_U);
            COLOR_D = this.hexToInt(TYPED_VALUE.DARK_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.DARK_COLOR ? this.hexToInt(TYPED_VALUE.DARK_COLOR) : 0xFF_00_00;
          }
        } else if (this.COLOR_MODE === 2) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = this.hexToInt(TYPED_VALUE.SPECIAL_COLOR_U);
            COLOR_D = this.hexToInt(TYPED_VALUE.SPECIAL_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.SPECIAL_COLOR ? this.hexToInt(TYPED_VALUE.SPECIAL_COLOR) : 0xFF_00_00;
          }
        }
        if (!COLOR) {
          COLOR = 0xFF_00_00;
        }
        if (!COLOR_U) {
          COLOR_U = 0xFF_00_00;
        }
        if (!COLOR_D) {
          COLOR_D = 0xFF_00_00;
        }

        if (CATEGORY_NAME === "HIGHWAY_TAGS") {
          return this.createWayGeometry(
            GEOMETRY_3D,
            0,
            TYPED_VALUE.WIDTH,
            TYPED_VALUE.HEIGHT,
            COLOR_D,
            COLOR_U,
          );
        } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
          return this.createWayGeometry(
            GEOMETRY_3D,
            1,
            TYPED_VALUE.WIDTH,
            TYPED_VALUE.HEIGHT,
            COLOR,
          );
        } else if (
          CATEGORY_NAME === "WATERWAY_TAGS" &&
          elemTagValue === "stream"
        ) {
          return this.createWayGeometry(
            GEOMETRY_3D,
            1,
            5,
            TYPED_VALUE.HEIGHT,
            COLOR,
          );
        }
          let {HEIGHT} = TYPED_VALUE;
          if (ELEMENT.tags.height) {
            const parsedHeight = Number.parseFloat(ELEMENT.tags.height);
            if (!Number.isNaN(parsedHeight)) {
              HEIGHT = parsedHeight;
            }
          }
          return this.createCustomGeometry(
            GEOMETRY_3D,
            COLOR,
            HEIGHT,
            TYPED_VALUE.Y_OFFSET,
          );
        
      }
    }
  }

  private createWayGeometry(
    GEOMETRY_3D: Geometry3D = [],
    TYPE = 0,
    WIDTH = 3,
    HEIGHT = 0.6,
    COLOR_BELOW = 0x70_70_70,
    COLOR_ABOVE = 0xE0_E0_E0,
    Y_OFFSET = 0,
  ) {
    if (GEOMETRY_3D.length < 2) {
      self.postMessage({
        data: "[WARN] (createWayGeometry) GEOMETRY_LIST_3D[0] must contain at least two points.",
        type: "Log",
      }, self.location.origin);
      return;
    }

    const TEMP_GROUP_U = new THREE.Group();
    const TEMP_GROUP_D = new THREE.Group();

    const createCSG = (
      geom: THREE.BufferGeometry<
        THREE.NormalBufferAttributes,
        THREE.BufferGeometryEventMap
      >,
      pos: {
        x: any;
        y: any;
        z: any;
      },
      angle: number,
    ) => {
      const matrix = new THREE.Matrix4()
        .makeRotationY(angle)
        .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
      geom.applyMatrix4(matrix);
      const brush = new THREECSG.Brush(geom, new THREE.MeshStandardMaterial());
      return new THREE.Mesh(brush.geometry, new THREE.MeshStandardMaterial());
    };

    for (let i = 1; i < GEOMETRY_3D.length; i++) {
      const point0 = GEOMETRY_3D[i - 1];
      const point1 = GEOMETRY_3D[i];

      if (point0 === undefined || point1 === undefined) {
        postMessage({
          data: `[WARN] Undefined point in POINTS_ARRAY at index ${i - 1} or ${i}. Skipping segment.`,
          type: "Log",
        });
        continue;
      }

      const dx = point1.x - point0.x;
      const dz = point1.z - point0.z;
      const length = Math.hypot(dx, dz);
      if (length === 0) {continue;}

      const angle = Math.atan2(dz, dx);
      const midPos = {
        x: (point0.x + point1.x) / 2,
        y: HEIGHT / 2 + Y_OFFSET,
        z: (point0.z + point1.z) / 2,
      };

      const streetBelow = createCSG(
        new THREE.BoxGeometry(length, HEIGHT, WIDTH),
        midPos,
        -angle,
      );

      streetBelow.receiveShadow = true;
      streetBelow.castShadow = false;
      TEMP_GROUP_D.add(streetBelow);
      const connectorBelow = createCSG(
        new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32),
        {
          x: point0.x,
          y: HEIGHT / 2 + Y_OFFSET,
          z: point0.z,
        },
        0,
      );
      connectorBelow.receiveShadow = true;
      connectorBelow.castShadow = false;
      TEMP_GROUP_D.add(connectorBelow);

      if (TYPE === 0) {
        const streetAbove = createCSG(
          new THREE.BoxGeometry(length, HEIGHT + 0.1, WIDTH / 1.5),
          midPos,
          -angle,
        );
        streetAbove.receiveShadow = true;
        streetAbove.castShadow = false;
        TEMP_GROUP_U.add(streetAbove);
        const connectorAbove = createCSG(
          new THREE.CylinderGeometry(
            WIDTH / 2 / 1.5,
            WIDTH / 2 / 1.5,
            HEIGHT + 0.1,
            32,
          ),
          {
            x: point0.x,
            y: HEIGHT / 2 + Y_OFFSET,
            z: point0.z,
          },
          0,
        );
        connectorAbove.receiveShadow = true;
        connectorAbove.castShadow = false;
        TEMP_GROUP_U.add(connectorAbove);
      }
    }

    const plast = GEOMETRY_3D.at(-1);

    if (plast !== undefined) {
      const connectorBelow = createCSG(
        new THREE.CylinderGeometry(WIDTH / 2, WIDTH / 2, HEIGHT, 32),
        {
          x: plast.x,
          y: HEIGHT / 2,
          z: plast.z,
        },
        0,
      );
      connectorBelow.receiveShadow = true;
      TEMP_GROUP_D.add(connectorBelow);

      if (TYPE === 0) {
        const connectorAbove = createCSG(
          new THREE.CylinderGeometry(
            WIDTH / 2 / 1.5,
            WIDTH / 2 / 1.5,
            HEIGHT + 0.1,
            32,
          ),
          {
            x: plast.x,
            y: HEIGHT / 2,
            z: plast.z,
          },
          0,
        );
        TEMP_GROUP_U.add(connectorAbove);
        connectorAbove.receiveShadow = true;
      }
    }

    const WAY_GROUP = new THREE.Group();

    const MERGED_MESH_D = this.mergeGroupToMesh(TEMP_GROUP_D);
    const EVAL_D = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_D.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_BELOW }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(
        EVAL_D.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_BELOW }),
      ),
    );
    const MERGED_MESH_U = this.mergeGroupToMesh(TEMP_GROUP_U);
    const EVAL_U = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_U.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_ABOVE }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(
        EVAL_U.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_ABOVE }),
      ),
    );

    const RESULT = this.mergeGroupToMesh(WAY_GROUP);
    if (!RESULT.geometry || !RESULT.geometry.attributes.position) {
      self.postMessage({
        data: `[WARN] Invalid geometry for way geometry during way geometry creation.`,
        type: "Log"
      }, self.location.origin);

      return;
    }

    return RESULT;
  }

  private createCustomGeometry(
    GEOMETRY_3D: Geometry3D = [],
    COLOR: number,
    HEIGHT = 1,
    Y_OFFSET = 0,
  ) {
    if (GEOMETRY_3D.length <= 1) {
      throw new Error("POINTS_ARRAY length must be greater than 0");
    }
    if (GEOMETRY_3D[0] === undefined) {
      throw new Error("POINTS_ARRAY[0] is undefined");
    }
    const SHAPE = new THREE.Shape();
    SHAPE.moveTo(GEOMETRY_3D[0].x, GEOMETRY_3D[0].z);
    for (let i = 1; i < GEOMETRY_3D.length; i++) {
      const POINT = GEOMETRY_3D[i];
      if (POINT === undefined) {
        return;
      }
      SHAPE.lineTo(POINT.x, POINT.z);
    }
    const EXTRUDE_SETTINGS = {
      bevelEnabled: false,
      depth: HEIGHT,
    };
    const GEOMETRY = new THREE.ExtrudeGeometry(SHAPE, EXTRUDE_SETTINGS);
    GEOMETRY.rotateX(Math.PI / 2);
    GEOMETRY.translate(0, Y_OFFSET + HEIGHT, 0);
    const MATERIAL = new THREE.MeshStandardMaterial({ color: COLOR });
    const RESULT = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(GEOMETRY, MATERIAL),
      THREECSG.INTERSECTION,
    );
    const CSG_MESH = new THREE.Mesh(RESULT.geometry, MATERIAL);

    CSG_MESH.castShadow = true;
    CSG_MESH.receiveShadow = true;
    return CSG_MESH;
  }

  private getGeometry(element: { geometry: any }) {
    if (element.geometry)
      {return element.geometry;}
  }

  private mergeGroupToMesh(
    group: THREE.Group<THREE.Object3DEventMap>,
  ): THREE.Mesh {
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
      return new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshStandardMaterial(),
      );
    }

    const merged = mergeGeometries(
      geometries,
      true,
    ) as THREE.BufferGeometry | null;
    if (!merged) {
      return new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshStandardMaterial(),
      );
    }

    return new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
  }

  private hexToInt(hex: string) {
    return Number.parseInt(hex.replace("#", ""), 16);
  }
}

globalThis.addEventListener('message', async function onmessage(event: MessageEvent): Promise<void> {
  const {
    RADIUS,
    OBJECT_CONFIG,
    DEBUG,
    COLOR_MODE,
    GEOJSON,
    REUSED_DATA,
    LATITUDE,
    LONGITUDE,
  } = event.data;
  const sceneController = new SceneController(
      OBJECT_CONFIG,
      RADIUS,
      DEBUG,
      COLOR_MODE,
      GEOJSON,
      REUSED_DATA,
      LATITUDE,
      LONGITUDE,
  );
  await sceneController.loadSceneFromData();
})
