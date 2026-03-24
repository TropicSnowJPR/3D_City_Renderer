import {queryAreaData, toMetricCoords} from "../services/ApiService.js";
import type { Geometry3D, GeometryList3D } from "../types/Geometry.js";
import type { ObjectConfigValue } from "../types/ObjectConfig.js";
import type { OSMElement } from "../types/OpenStreetMapData.js";
import * as THREE from "three";
import * as THREECSG from "three-bvh-csg";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";


interface GeoPoint {
  lat: number;
  lon: number;
}

interface OverpassResponse {
  elements: OSMElement[]
}

const getGeometryFromMember = function getGeometry( element: { geometry?: GeoPoint[] }): GeoPoint[] {
  return element.geometry ?? [];
};

const getGeometryFromElement = (
    element: OSMElement
): GeoPoint[] => {
  if ("geometry" in element && Array.isArray(element.geometry)) {
    return element.geometry;
  }
  return [];
};



const mergeGroupToMesh = function  mergeGroupToMesh(
    GROUP: THREE.Group<THREE.Object3DEventMap>
): THREE.Mesh {

  const GEOMETRIES: THREE.BufferGeometry[] = [];

  GROUP.updateMatrixWorld(true);

  GROUP.traverse((CHILD: THREE.Object3D) => {
    if ((CHILD as THREE.Mesh).isMesh) {
      const MESH = CHILD as THREE.Mesh;
      if (!MESH.geometry) {return;}

      const GEOM = (MESH.geometry as THREE.BufferGeometry).clone();
      GEOM.applyMatrix4(MESH.matrixWorld);

      // 👇 convert material color → vertex colors
      const MATERIAL = MESH.material as THREE.MeshStandardMaterial;
      const COLOR = MATERIAL.color;

      const POSITION = GEOM.getAttribute("position");
      const COLORS = new Float32Array(POSITION.count * 3);

      for (let i = 0; i < POSITION.count; i+=1 ) {
        COLORS[i * 3] = COLOR.r;
        COLORS[i * 3 + 1] = COLOR.g;
        COLORS[i * 3 + 2] = COLOR.b;
      }

      GEOM.setAttribute("color", new THREE.BufferAttribute(COLORS, 3));

      GEOMETRIES.push(GEOM);
    }
  });

  if (GEOMETRIES.length === 0) {
    return new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshStandardMaterial()
    );
  }

  const MERGED = mergeGeometries(GEOMETRIES, true);
  if (!MERGED) {
    return new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshStandardMaterial()
    );
  }

  return new THREE.Mesh(
      MERGED,
      new THREE.MeshStandardMaterial({ vertexColors: true })
  );
};

const hexToInt = function hexToInt(HEX: string): number {
  return Number.parseInt(HEX.replace("#", ""), 16);
}


class SceneController {
  private readonly EVALUATOR: THREECSG.Evaluator;
  private readonly BOUNDS_CIRCLE: THREECSG.Brush;
  private readonly REUSED_DATA: OverpassResponse | string | undefined;
  private readonly GEOJSON: unknown;
  private readonly COLOR_MODE: number;
  private readonly OBJECT_CONFIG: unknown;
  private readonly RADIUS: number;
  private readonly LATITUDE: number;
  private readonly LONGITUDE: number;

  private REQUESTED_DATA: OverpassResponse | undefined;
  private readonly FOLLY_RED_COLOR_MODE: number;
  private readonly DARK_COLOR_MODE: number;
  private readonly LIGHT_COLOR_MODE: number;

  constructor(OBJECT_CONFIG: unknown, RADIUS: number, COLOR_MODE: number, GEOJSON: unknown, REUSED_DATA: OverpassResponse | undefined, LATITUDE: number, LONGITUDE: number,) {
    // Please ignore that there are so many wierd variables i was told to use oxlint and fix all bugs that it gave me so it needed to put every number into a variable
    this.EVALUATOR = new THREECSG.Evaluator();
    this.OBJECT_CONFIG = OBJECT_CONFIG;
    this.COLOR_MODE = COLOR_MODE;
    this.RADIUS = RADIUS;
    this.REUSED_DATA = REUSED_DATA;
    this.GEOJSON = GEOJSON;
    this.LATITUDE = LATITUDE;
    this.LONGITUDE = LONGITUDE;

    this.BOUNDS_CIRCLE = new THREECSG.Brush(new THREE.CylinderGeometry(this.RADIUS, this.RADIUS, this.RADIUS + this.RADIUS, Math.round(this.RADIUS / 2), Math.round(this.RADIUS / 20),), new THREE.MeshBasicMaterial({
      color: 0xE0_A0_30, opacity: 1, side: THREE.DoubleSide, transparent: false, wireframe: false,
    }),);

    this.FOLLY_RED_COLOR_MODE = 2;
    this.DARK_COLOR_MODE = 1;
    this.LIGHT_COLOR_MODE = 0;
  }

  async loadSceneFromData(): Promise<void> {
    if (typeof this.REUSED_DATA !== "string") {
      this.REQUESTED_DATA = this.REUSED_DATA;
    }

    if (this.REQUESTED_DATA === undefined) {
      for (
        let ITERATION = 0;
        ITERATION < 10;
        ITERATION += 1
      ) {
        try {
          this.REQUESTED_DATA = await queryAreaData(this.LATITUDE, this.LONGITUDE, this.RADIUS) as OverpassResponse;
          break;
        } catch {
          setTimeout(() => this.loadSceneFromData(), 10_000);
        }
      }

      if (this.REQUESTED_DATA) {
        const { GEOJSON } = this;
        const DATA = this.REQUESTED_DATA;

        await fetch("http://localhost:3000/api/object", {
          body: JSON.stringify({ DATA, GEOJSON }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }
    }

    if (this.REQUESTED_DATA) {
      const CENTER_METRIC = toMetricCoords(this.LATITUDE, this.LONGITUDE);
      const ELEMENTS = this.REQUESTED_DATA.elements
      for (const ELEMENT of ELEMENTS) {
        const OUTER_GEOMETRY_LIST_3D: GeometryList3D = [];
        const INNER_GEOMETRY_LIST_3D: GeometryList3D = [];
        if ("members" in ELEMENT && ELEMENT.members) {
          for (const MEMBER of ELEMENT.members) {
            if (MEMBER.role === "") {
              continue;
            }
            const GEOMETRY_3D: Geometry3D = [];
            const GEOMETRY = getGeometryFromMember(MEMBER);
            if (!CENTER_METRIC || !GEOMETRY) {
              continue
            }
            for (const GEO_POINT of GEOMETRY) {
              const METRIC_CORDS = toMetricCoords(GEO_POINT.lat, GEO_POINT.lon);

              if (!METRIC_CORDS) {
                continue;
              }

              const [mx, mz] = METRIC_CORDS;
              const [cx, cz] = CENTER_METRIC;

              if (!mx || !mz || !cx || !cz) {
                continue;
              }

              GEOMETRY_3D.push({ x: mx - cx, y: 0, z: mz - cz });
            }

            if (MEMBER.role === "outer" && MEMBER.type === "way" && GEOMETRY_3D.length > 1) {
              OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
            if (MEMBER.role === "inner" && MEMBER.type === "way" && GEOMETRY_3D.length > 1) {
              INNER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
          }
          if (OUTER_GEOMETRY_LIST_3D.length > 0 && INNER_GEOMETRY_LIST_3D.length > 0) {
            this.pointsArrayToScene(ELEMENT, OUTER_GEOMETRY_LIST_3D, INNER_GEOMETRY_LIST_3D);
          }
        } else {
          const GEOMETRY_3D: Geometry3D = [];
          const GEOMETRY = getGeometryFromElement(ELEMENT);
          if (!CENTER_METRIC || !GEOMETRY) {
            continue;
          }
          for (const GEO_POINT of GEOMETRY) {
            const METRIC_CORDS = toMetricCoords(GEO_POINT.lat, GEO_POINT.lon);

            if (!METRIC_CORDS) {
              continue;
            }

            const [mx, mz] = METRIC_CORDS;
            const [cx, cz] = CENTER_METRIC;

            if (!mx || !mz || !cx || !cz) {
              continue;
            }

            GEOMETRY_3D.push({ x: mx - cx, y: 0, z: mz - cz });
          }
          if (GEOMETRY_3D.length > 1) {
            OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
          }
          if (OUTER_GEOMETRY_LIST_3D.length === 1) {
            this.pointsArrayToScene(ELEMENT, OUTER_GEOMETRY_LIST_3D);
          }
        }
      }
      self.postMessage({ type: "SceneLoaded" });
    }
  }

  private pointsArrayToScene(
    ELEMENT: OSMElement,
    OUTER_GEOMETRY_LIST_3D: GeometryList3D,
    INNER_GEOMETRY_LIST_3D: GeometryList3D | undefined = undefined,
  ): void {
    try {
      if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length === 1 &&
        (INNER_GEOMETRY_LIST_3D === undefined || INNER_GEOMETRY_LIST_3D.length === 0) &&
        ELEMENT.tags
      ) {
        const [GEOMETRY] = OUTER_GEOMETRY_LIST_3D;
        if (GEOMETRY === undefined) {
          return;
        }
        const MESH = this.createSceneBoxObject(GEOMETRY, ELEMENT);
        if (MESH) {
          MESH.userData.tags = Object.entries(ELEMENT.tags).map(
            ([key, value]) => `${key}=${value}`,
          );
          const JSON = MESH.toJSON();
          self.postMessage({ data: JSON, type: "SceneMesh" });
        }
      } else if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length > 0 &&
        INNER_GEOMETRY_LIST_3D &&
        INNER_GEOMETRY_LIST_3D.length > 0 &&
        ELEMENT.tags
      ) {
        let OUTER_MESH = undefined;
        for (const GEOMETRY of OUTER_GEOMETRY_LIST_3D) {
          if (GEOMETRY === undefined) {
            return;
          }
          const MESH = this.createSceneBoxObject(GEOMETRY, ELEMENT);
          if (!MESH) {
            continue;
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
          } catch {
            // PASS
          }
        }

        let INNER_MESH = undefined;
        for (const GEOMETRY of INNER_GEOMETRY_LIST_3D) {
          if (GEOMETRY === undefined) {
            return;
          }
          const MESH = this.createSceneBoxObject(GEOMETRY, ELEMENT);
          if (!MESH) {
            continue;
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
          } catch {
            // PASS
          }
        }
        if (!OUTER_MESH || !INNER_MESH) {
          return;
        }
        const CSG_RESULT = this.EVALUATOR.evaluate(
          new THREECSG.Brush(OUTER_MESH.geometry, OUTER_MESH.material),
          new THREECSG.Brush(INNER_MESH.geometry, INNER_MESH.material),
          THREECSG.SUBTRACTION,
        );
        const CSG_MESH = new THREE.Mesh(CSG_RESULT.geometry, OUTER_MESH.material);
        CSG_MESH.userData.tags = Object.entries(ELEMENT.tags).map(
          ([key, value]) => `${key}=${value}`,
        );
        const JSON = CSG_MESH.toJSON();
        self.postMessage({ data: JSON, type: "SceneMesh" });
      }
    } catch {
      // PASS
    }
  }

  private createSceneBoxObject(
    GEOMETRY_3D: Geometry3D,
    ELEMENT: OSMElement,
  ): THREE.Mesh | undefined {
    if (!this.OBJECT_CONFIG) {
      return;
    }
    if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === 0) {
      return;
    }

    for (const [CATEGORY_NAME, CATEGORY] of Object.entries(this.OBJECT_CONFIG)) {
      const expectedTagKey = CATEGORY_NAME.slice(0, -5).toLowerCase();
      if (!(expectedTagKey in ELEMENT.tags)) {
        continue;
      }

      const elemTagValue = ELEMENT.tags[expectedTagKey];
      for (const [TAG, VALUE] of Object.entries(CATEGORY as string)) {
        const TYPED_VALUE = VALUE as unknown as ObjectConfigValue;
        if (elemTagValue !== TAG) {
          continue;
        }

        // Color selection preserved from original logic
        let COLOR = undefined;
        let COLOR_D = undefined;
        let COLOR_U = undefined;
        if (this.COLOR_MODE === this.LIGHT_COLOR_MODE) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = hexToInt(TYPED_VALUE.DEFAULT_COLOR_U);
            COLOR_D = hexToInt(TYPED_VALUE.DEFAULT_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.DEFAULT_COLOR
              ? hexToInt(TYPED_VALUE.DEFAULT_COLOR)
              : 0xFF_00_00;
          }
        } else if (this.COLOR_MODE === this.DARK_COLOR_MODE) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = hexToInt(TYPED_VALUE.DARK_COLOR_U);
            COLOR_D = hexToInt(TYPED_VALUE.DARK_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.DARK_COLOR
              ? hexToInt(TYPED_VALUE.DARK_COLOR)
              : 0xFF_00_00;
          }
        } else if (this.COLOR_MODE === this.FOLLY_RED_COLOR_MODE) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = hexToInt(TYPED_VALUE.SPECIAL_COLOR_U);
            COLOR_D = hexToInt(TYPED_VALUE.SPECIAL_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.SPECIAL_COLOR
              ? hexToInt(TYPED_VALUE.SPECIAL_COLOR)
              : 0xFF_00_00;
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
        } else if (CATEGORY_NAME === "WATERWAY_TAGS" && elemTagValue === "stream") {
          return this.createWayGeometry(GEOMETRY_3D, 1, 5, TYPED_VALUE.HEIGHT, COLOR);
        }
        let { HEIGHT } = TYPED_VALUE;
        if (ELEMENT.tags.height) {
          const parsedHeight = Number.parseFloat(ELEMENT.tags.height);
          if (!Number.isNaN(parsedHeight)) {
            HEIGHT = parsedHeight;
          }
        }
        return this.createCustomGeometry(GEOMETRY_3D, COLOR, HEIGHT, TYPED_VALUE.Y_OFFSET);
      }
    }
  }

  private createWayGeometry(
    GEOMETRY_3D: Geometry3D = [],
    TYPE = 0,
    WIDTH = 3,
    HEIGHT = 0.6,
    COLOR_BOTTOM = 0xFF_00_00,
    COLOR_TOP = 0xFF_00_00,
    Y_OFFSET = 0,
  ): THREE.Mesh | undefined {
    if (GEOMETRY_3D.length < 2) {
      return;
    }

    const TOP_WIDTH = (WIDTH * 0.85);
    const TOP_HEIGHT = (HEIGHT + 0.1);
    const BOTTOM_WIDTH = (WIDTH);
    const BOTTOM_HEIGHT = (HEIGHT);
    const RADIAL_SEGMENTS = 32

    const TEMP_GROUP_U = new THREE.Group();
    const TEMP_GROUP_D = new THREE.Group();

    const createCSG = (
        geom: THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>,
        pos: {
          x: number;
          y: number;
          z: number
        },
        angle = 0,
    ): THREE.Mesh => {
      const matrix = new THREE.Matrix4()
          .makeRotationY(angle)
          .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
      geom.applyMatrix4(matrix);
      const brush = new THREECSG.Brush(geom, new THREE.MeshStandardMaterial());
      return new THREE.Mesh(brush.geometry, new THREE.MeshStandardMaterial());
    };

    for (let ITERATION = 1; ITERATION < GEOMETRY_3D.length; ITERATION += 1) {

      const POINT_0 = GEOMETRY_3D[ITERATION - 1];
      const POINT_1 = GEOMETRY_3D[ITERATION];

      if (POINT_0 === undefined || POINT_1 === undefined) {
        continue;
      }

      const DX = POINT_1.x - POINT_0.x;
      const DZ = POINT_1.z - POINT_0.z;

      const LENGTH = Math.hypot(DX, DZ);

      if (LENGTH <= 0) {
        continue;
      }

      const ANGLE = Math.atan2(DZ, DX);

      const MID_POS = {
        x: (POINT_0.x + POINT_1.x) * 0.5,
        y: Y_OFFSET,
        z: (POINT_0.z + POINT_1.z) * 0.5,
      };


      const SEGMENT_BOX_BOTTOM = createCSG(
        new THREE.BoxGeometry(
          LENGTH,
          BOTTOM_HEIGHT,
          BOTTOM_WIDTH,
        ),
        MID_POS,
        -ANGLE
      );

      const CONNECTOR_CYLINDER_BOTTOM = createCSG(
        new THREE.CylinderGeometry(
          BOTTOM_WIDTH * 0.5,
          BOTTOM_WIDTH * 0.5,
          BOTTOM_HEIGHT,
          RADIAL_SEGMENTS
        ),
        {
          x: POINT_0.x,
          y: Y_OFFSET,
          z: POINT_0.z
        }
      );

      TEMP_GROUP_D.add(new THREE.Mesh(CONNECTOR_CYLINDER_BOTTOM.geometry, new THREE.MeshStandardMaterial({color: COLOR_BOTTOM})));
      TEMP_GROUP_D.add(new THREE.Mesh(SEGMENT_BOX_BOTTOM.geometry, new THREE.MeshStandardMaterial({color: COLOR_BOTTOM})));


      if (TYPE === 0) {

        const SEGMENT_BOX_TOP = createCSG(
          new THREE.BoxGeometry(
              LENGTH,
              TOP_HEIGHT,
              TOP_WIDTH
          ),
          MID_POS,
          -ANGLE,
        );

        const CONNECTOR_CYLINDER_TOP = createCSG(
          new THREE.CylinderGeometry(
              TOP_WIDTH * 0.5,
              TOP_WIDTH * 0.5,
              TOP_HEIGHT,
              RADIAL_SEGMENTS
          ),
          {
            x: POINT_0.x,
            y: Y_OFFSET,
            z: POINT_0.z
          }
        );

        TEMP_GROUP_U.add(new THREE.Mesh(CONNECTOR_CYLINDER_TOP.geometry, new THREE.MeshStandardMaterial({color: COLOR_TOP})));
        TEMP_GROUP_U.add(new THREE.Mesh(SEGMENT_BOX_TOP.geometry, new THREE.MeshStandardMaterial({color: COLOR_TOP})));

      }
    }

    const LAST_POINT = GEOMETRY_3D.at(-1);

    if (LAST_POINT !== undefined) {
      const CONNECTOR_CYLINDER_BOTTOM = createCSG(
        new THREE.CylinderGeometry(
            BOTTOM_WIDTH * 0.5,
            BOTTOM_WIDTH * 0.5,
            BOTTOM_HEIGHT,
            RADIAL_SEGMENTS
        ),
        {
          x: LAST_POINT.x,
          y: Y_OFFSET,
          z: LAST_POINT.z
        }
      );

      TEMP_GROUP_D.add(new THREE.Mesh(CONNECTOR_CYLINDER_BOTTOM.geometry, new THREE.MeshStandardMaterial({color: COLOR_BOTTOM})));


      if (TYPE === 0) {
        const CONNECTOR_CYLINDER_TOP = createCSG(
          new THREE.CylinderGeometry(
              TOP_WIDTH * 0.5,
              TOP_WIDTH * 0.5,
              TOP_HEIGHT,
              RADIAL_SEGMENTS
          ),
          {
            x: LAST_POINT.x,
            y: Y_OFFSET,
            z: LAST_POINT.z
          }
        );

        TEMP_GROUP_U.add(new THREE.Mesh(CONNECTOR_CYLINDER_TOP.geometry, new THREE.MeshStandardMaterial({color: COLOR_TOP})));
      }
    }

    const WAY_GROUP = new THREE.Group();

    const MERGED_MESH_D = mergeGroupToMesh(TEMP_GROUP_D);
    const EVAL_D = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_D.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_BOTTOM }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(EVAL_D.geometry, new THREE.MeshStandardMaterial({ color: COLOR_BOTTOM })),
    );
    const MERGED_MESH_U = mergeGroupToMesh(TEMP_GROUP_U);
    const EVAL_U = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_U.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_TOP }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(EVAL_U.geometry, new THREE.MeshStandardMaterial({ color: COLOR_TOP })),
    );

    const RESULT = mergeGroupToMesh(WAY_GROUP);
    if (!RESULT.geometry || !RESULT.geometry.attributes.position) {
      return;
    }

    RESULT.receiveShadow = true
    RESULT.castShadow = true

    return RESULT;
  }

  private createCustomGeometry(
    GEOMETRY_3D: Geometry3D,
    COLOR: number,
    HEIGHT: number | undefined,
    Y_OFFSET: number | undefined,
  ): THREE.Mesh | undefined {
    const FIRST_LIST_ELEMENT = 0;
    const MIN_GEOMETRY_LENGTH = 2;
    if (GEOMETRY_3D.length < MIN_GEOMETRY_LENGTH) {
      throw new Error("Point array length must be greater than 2.");
    }
    if (GEOMETRY_3D[FIRST_LIST_ELEMENT] === undefined) {
      throw new Error("The first coordinate point is undefined.");
    }
    const SHAPE = new THREE.Shape();
    SHAPE.moveTo(GEOMETRY_3D[FIRST_LIST_ELEMENT].x, GEOMETRY_3D[FIRST_LIST_ELEMENT].z);
    for (let ITERATION = 1; ITERATION < GEOMETRY_3D.length; ITERATION += 1) {
      const POINT = GEOMETRY_3D[ITERATION];
      if (POINT === undefined) {
        return;
      }
      SHAPE.lineTo(POINT.x, POINT.z);
    }
    const EXTRUDE_SETTINGS = { bevelEnabled: false, depth: HEIGHT };
    const GEOMETRY = new THREE.ExtrudeGeometry(SHAPE, EXTRUDE_SETTINGS);
    const FIX_ROTATION = 90;
    GEOMETRY.rotateX(THREE.MathUtils.degToRad(FIX_ROTATION));
    const GEOMETRY_TRANSLATION_X = 0;
    const GEOMETRY_TRANSLATION_Z = 0;
    if (HEIGHT && (Y_OFFSET || Y_OFFSET === 0)) {
      GEOMETRY.translate(GEOMETRY_TRANSLATION_X, Y_OFFSET + HEIGHT, GEOMETRY_TRANSLATION_Z);
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
  }
}

globalThis.addEventListener(
  "message",
  async function onmessage(EVENT: MessageEvent): Promise<void> {
    const { RADIUS, OBJECT_CONFIG, COLOR_MODE, GEOJSON, REUSED_DATA, LATITUDE, LONGITUDE } =
      EVENT.data;
    const SCENE_CONTROLLER = new SceneController(
      OBJECT_CONFIG,
      RADIUS,
      COLOR_MODE,
      GEOJSON,
      REUSED_DATA,
      LATITUDE,
      LONGITUDE,
    );
    await SCENE_CONTROLLER.loadSceneFromData();
  },
);
