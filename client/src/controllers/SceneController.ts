import { ApiService } from "../services/ApiService.js";
import type { Geometry3D, GeometryList3D } from "../types/Geometry.js";
import type { ObjectConfigValue } from "../types/ObjectConfig.js";
import type { OSMElement } from "../types/OpenStreetMapData.js";
import * as THREE from "three";
import * as THREECSG from "three-bvh-csg";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";


const getGeometry = function getGeometry(element: {geometry?: unknown}): unknown {
  if (element.geometry) {
    return element.geometry ?? [];
  }
}

const mergeGroupToMesh = function mergeGroupToMesh(GROUP: THREE.Group<THREE.Object3DEventMap>): THREE.Mesh {
  const GEOMETRIES_RETURN_LENGTH = 0;
  const GEOMETRIES: THREE.BufferGeometry[] = [];

  GROUP.updateMatrixWorld(true);

  GROUP.traverse((CHILD: THREE.Object3D) => {
    if ((CHILD as THREE.Mesh).isMesh) {
      const MESH = CHILD as THREE.Mesh;
      if (MESH.geometry) {
        const GEOM = (MESH.geometry as THREE.BufferGeometry).clone();
        GEOM.applyMatrix4(MESH.matrixWorld);
        GEOMETRIES.push(GEOM);
      }
    }
  });

  if (GEOMETRIES.length === GEOMETRIES_RETURN_LENGTH) {
    return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  }

  const MERGED = mergeGeometries(GEOMETRIES, true) as THREE.BufferGeometry | null;
  if (!MERGED) {
    return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  }

  return new THREE.Mesh(MERGED, new THREE.MeshStandardMaterial());
}

const hexToInt = function hexToInt(HEX: string): number {
  return Number.parseInt(HEX.replace("#", ""), 16);
}


class SceneController {
  private readonly EVALUATOR: THREECSG.Evaluator;
  private readonly API_SERVICE: ApiService;
  private readonly BOUNDS_CIRCLE: THREECSG.Brush;
  private readonly DEBUG: number;
  private readonly COLOR_MODE: number;
  private readonly OBJECT_CONFIG: unknown;
  private REQUESTED_DATA: unknown | undefined;
  private readonly RADIUS: number;
  private readonly REUSED_DATA: unknown | undefined;
  private readonly GEOJSON: unknown;
  private readonly LATITUDE: number;
  private readonly LONGITUDE: number;
  private readonly FALLBACK_COLOR: number;
  private readonly FOR_LOOP_INCREMENT: number;
  private readonly API_RETRY_INTERVAL: number;
  private readonly API_TRY_LIMIT: number;
  private readonly WG_RADIAL_SEGMENTS: number;
  private readonly WG_TYPE_FOR_STREET: number;
  private readonly WG_CONNECTOR_ANGLE: number;
  private readonly WG_DEFAULT_WIDTH: number;
  private readonly WG_DEFAULT_HEIGHT: number;
  private readonly WG_DEFAULT_Y_OFFSET: number;
  private readonly WG_DEFAULT_TYPE: number;
  private readonly WG_TOP_SIZE_MULTIPLIER: number;
  private readonly WG_BOTTOM_SIZE_MULTIPLIER: number;
  private readonly WG_POINT_Y_MULTIPLIER: number;
  private readonly WG_HEIGHT_ADDITION: number;
  private readonly WG_ITERATION_INDEX_FIX: number;
  private readonly WG_HEIGHT_MULTIPLIER: number;
  private readonly WG_MIN_POINT_ARRAY_LENGTH: number;
  private readonly WG_WIDTH_MULTIPLIER: number;
  private readonly WG_MIN_LENGTH: number;
  private readonly WATERWAY_DEFAULT_WIDTH: number;
  private readonly WATERWAY_DEFAULT_TYPE: number;
  private readonly RAILWAY_DEFAULT_TYPE: number;
  private readonly HIGHWAY_DEFAULT_TYPE: number;
  private readonly FOLLY_RED_COLOR_MODE: number;
  private readonly DARK_COLOR_MODE: number;
  private readonly LIGHT_COLOR_MODE: number;
  private readonly MIN_TAG_LENGTH: number;
  private readonly MIN_EXPECTED_TAG_SLICE: number;
  private readonly MAX_EXPECTED_TAG_SLICE: number;
  private readonly GEO_MIN_LENGTH: number;
  private readonly DEFAULT_MIN_Y: number;
  private readonly HEIGHT_SEGMENTS_MULTIPLIER: number;
  private readonly RADIAL_SEGMENTS_MULTIPLIER: number;
  private readonly CCONFIG_DATA: {
    aspect: number;
    colorMode: number;
    debug: boolean;
    far: number;
    fov: number;
    latitude: number;
    longitude: number;
    mousesensitivity: number;
    movespeed: number;
    near: number;
    pitch: number;
    radius: number;
    version: string;
    xpos: number;
    yaw: number;
    ypos: number;
    zpos: number
  };

  constructor(
    OBJECT_CONFIG: unknown,
    RADIUS: number,
    DEBUG: number,
    COLOR_MODE: number,
    GEOJSON: unknown,
    REUSED_DATA: unknown | undefined,
    LATITUDE: number,
    LONGITUDE: number,
    CCONFIG_DATA: {
      aspect: number,
      colorMode: number,
      debug: boolean,
      far: number,
      fov: number,
      latitude: number,
      longitude: number,
      mousesensitivity: number,
      movespeed: number,
      near: number,
      pitch: number,
      radius: number,
      version: string,
      xpos: number,
      yaw: number,
      ypos: number,
      zpos: number,
    }
  ) {
    this.CCONFIG_DATA = CCONFIG_DATA;
    // Please ignore that there are so many wierd variables i was told to use oxlint and fix all bugs that it gave me so it needed to put every number into a variable
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
    this.HEIGHT_SEGMENTS_MULTIPLIER = 2
    this.RADIAL_SEGMENTS_MULTIPLIER = 20
    this.BOUNDS_CIRCLE = new THREECSG.Brush(
      new THREE.CylinderGeometry(
        this.RADIUS,
        this.RADIUS,
        this.RADIUS + this.RADIUS,
        Math.round(this.RADIUS / this.HEIGHT_SEGMENTS_MULTIPLIER),
        Math.round(this.RADIUS / this.RADIAL_SEGMENTS_MULTIPLIER),
      ),
      new THREE.MeshBasicMaterial({
        color: 0xE0_A0_30,
        opacity: 1,
        side: THREE.DoubleSide,
        transparent: false,
        wireframe: false,
      }),
    );
    this.FALLBACK_COLOR = 0xFF_00_00;
    this.FOR_LOOP_INCREMENT = 1;
    this.API_RETRY_INTERVAL = 10_000;
    this.API_TRY_LIMIT = 10;
    this.FOLLY_RED_COLOR_MODE = 2;
    this.DARK_COLOR_MODE = 1;
    this.LIGHT_COLOR_MODE = 0;
    this.WG_RADIAL_SEGMENTS = 32;
    this.WG_TYPE_FOR_STREET = 0;
    this.WG_CONNECTOR_ANGLE = 0;
    this.WG_DEFAULT_TYPE = 0;
    this.WG_DEFAULT_WIDTH = 3;
    this.WG_DEFAULT_HEIGHT = 0.6;
    this.WG_DEFAULT_Y_OFFSET = 0;
    this.WG_TOP_SIZE_MULTIPLIER = 1.3;
    this.WG_BOTTOM_SIZE_MULTIPLIER = 2;
    this.WG_HEIGHT_MULTIPLIER = 0.5
    this.WG_WIDTH_MULTIPLIER = 1.5
    this.WG_POINT_Y_MULTIPLIER = 2;
    this.WG_HEIGHT_ADDITION = 0.1;
    this.WG_ITERATION_INDEX_FIX = 1;
    this.WG_MIN_POINT_ARRAY_LENGTH = 2;
    this.WG_MIN_LENGTH = 0;
    this.GEO_MIN_LENGTH = 1;
    this.WATERWAY_DEFAULT_WIDTH = 5;
    this.WATERWAY_DEFAULT_TYPE = 1;
    this.RAILWAY_DEFAULT_TYPE = 1;
    this.HIGHWAY_DEFAULT_TYPE = 0;
    this.MIN_TAG_LENGTH = 0;
    this.MIN_EXPECTED_TAG_SLICE = 0;
    this.MAX_EXPECTED_TAG_SLICE = -5
    this.DEFAULT_MIN_Y = 0;
  }

  async loadSceneFromData(): Promise<void> {
    this.REQUESTED_DATA = this.REUSED_DATA;
    if (this.REQUESTED_DATA === undefined) {
      for (
        let ITERATION = 0;
        ITERATION < this.API_TRY_LIMIT;
        ITERATION += this.FOR_LOOP_INCREMENT
      ) {
        try {
          this.REQUESTED_DATA = await this.API_SERVICE.queryAreaData(this.CCONFIG_DATA.latitude, this.CCONFIG_DATA.longitude, this.CCONFIG_DATA.radius);
          break;
        } catch (ERROR) {
          self.postMessage(
            {
              // oxlint-disable-next-line no-magic-numbers <= This is only as long needed as long as all the console logging gets removed.
              data: `[WARN] Error fetching data from Overpass API, retrying in 10 sec. (Attempt ${ITERATION + 1} of 10) [${ERROR}]`,
              type: "Log",
            }, self.location.origin
          );
          setTimeout(() => this.loadSceneFromData(), this.API_RETRY_INTERVAL);
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
      const CENTER_METRIC = this.API_SERVICE.toMetricCoords(this.LATITUDE, this.LONGITUDE);
      const ELEMENTS = this.REQUESTED_DATA.elements
      for (const ELEMENT of ELEMENTS) {
        const OUTER_GEOMETRY_LIST_3D: GeometryList3D = [];
        const INNER_GEOMETRY_LIST_3D: GeometryList3D = [];
        if (ELEMENT.members) {
          for (const MEMBER of ELEMENT.members) {
            if (MEMBER.role === "") {
              break;
            }
            const GEOMETRY_3D: Geometry3D = [];
            const GEOMETRY: unknown = getGeometry(MEMBER);
            if (!CENTER_METRIC || !GEOMETRY) {
              continue;
            }
            for (const GEO_POINT of GEOMETRY) {
              const METRIC_CORDS = this.API_SERVICE.toMetricCoords(GEO_POINT.lat, GEO_POINT.lon);

              if (!METRIC_CORDS) {
                continue;
              }

              const [mx, mz] = METRIC_CORDS;
              const [cx, cz] = CENTER_METRIC;

              if (!mx || !mz || !cx || !cz) {
                continue;
              }

              GEOMETRY_3D.push({ x: mx - cx, y: this.DEFAULT_MIN_Y, z: mz - cz });
            }

            if (MEMBER.role === "outer" && MEMBER.type === "way" && GEOMETRY_3D.length > this.GEO_MIN_LENGTH) {
              OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
            if (MEMBER.role === "inner" && MEMBER.type === "way" && GEOMETRY_3D.length > this.GEO_MIN_LENGTH) {
              INNER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
            }
          }
          if (OUTER_GEOMETRY_LIST_3D.length >= this.GEO_MIN_LENGTH && INNER_GEOMETRY_LIST_3D.length >= this.GEO_MIN_LENGTH) {
            await this.pointsArrayToScene(ELEMENT, OUTER_GEOMETRY_LIST_3D, INNER_GEOMETRY_LIST_3D);
          }
        } else {
          const GEOMETRY_3D: Geometry3D = [];
          const GEOMETRY = getGeometry(ELEMENT);
          if (!CENTER_METRIC || !GEOMETRY) {
            continue;
          }
          for (const GEO_POINT of GEOMETRY) {
            const METRIC_CORDS = this.API_SERVICE.toMetricCoords(GEO_POINT.lat, GEO_POINT.lon);

            if (!METRIC_CORDS) {
              continue;
            }

            const [mx, mz] = METRIC_CORDS;
            const [cx, cz] = CENTER_METRIC;

            if (!mx || !mz || !cx || !cz) {
              continue;
            }

            GEOMETRY_3D.push({ x: mx - cx, y: this.DEFAULT_MIN_Y, z: mz - cz });
          }
          if (GEOMETRY_3D.length > this.GEO_MIN_LENGTH) {
            OUTER_GEOMETRY_LIST_3D.push(GEOMETRY_3D);
          }
          if (OUTER_GEOMETRY_LIST_3D.length === this.GEO_MIN_LENGTH) {
            await this.pointsArrayToScene(ELEMENT, OUTER_GEOMETRY_LIST_3D);
          }
        }
      }
      // , self.location.origin
      self.postMessage({ type: "SceneLoaded" }, self.location.origin);
    } else {
      self.postMessage({ data: "No data to load into scene.", type: "Log" }, self.location.origin);
    }
  }

  private async pointsArrayToScene(
    ELEMENT: OSMElement,
    OUTER_GEOMETRY_LIST_3D: GeometryList3D,
    INNER_GEOMETRY_LIST_3D: GeometryList3D | undefined = undefined,
  ): Promise<void> {
    try {
      if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length === this.GEO_MIN_LENGTH &&
        (INNER_GEOMETRY_LIST_3D === undefined || INNER_GEOMETRY_LIST_3D.length < this.GEO_MIN_LENGTH) &&
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
          console.log("Before postMessage()")
          self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
          console.log("PostMessage() Sent")
        }
      } else if (
        OUTER_GEOMETRY_LIST_3D &&
        OUTER_GEOMETRY_LIST_3D.length >= this.GEO_MIN_LENGTH &&
        INNER_GEOMETRY_LIST_3D &&
        INNER_GEOMETRY_LIST_3D.length >= this.GEO_MIN_LENGTH &&
        ELEMENT.tags
      ) {
        self.postMessage(
          {
            data: `[INFO] Processing element with id ${ELEMENT.id}  using CSG operations. Outer geometries: ${OUTER_GEOMETRY_LIST_3D.length}, Inner geometries: ${INNER_GEOMETRY_LIST_3D.length}`,
            type: "Log",
          }, self.location.origin
        );
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
          } catch (error) {
            self.postMessage(
              {
                data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during outer geometry processing: ${error}`,
                type: "Log",
              }, self.location.origin
            );
          }
        }

        let INNER_MESH = undefined;
        for (const GEOMETRY of INNER_GEOMETRY_LIST_3D) {
          if (GEOMETRY === undefined) {
            return;
          }
          const MESH = await this.createSceneBoxObject(GEOMETRY, ELEMENT);
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
          } catch (error) {
            self.postMessage(
              {
                data: `[ERROR] CSG operation failed for element ${ELEMENT.id} during inner geometry processing: ${error}`,
                type: "Log",
              }, self.location.origin
            );
          }
        }
        if (!OUTER_MESH || !INNER_MESH) {
          self.postMessage(
            {
              data: `[WARN] Missing outer or inner mesh for element ${ELEMENT.id}, skipping CSG subtraction.`,
              type: "Log",
            }, self.location.origin
          );
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
        self.postMessage({ data: JSON, type: "SceneMesh" }, self.location.origin);
      }
    } catch (error) {
      self.postMessage(
        {
          data: `[ERROR] Error creating geometry for element with id ${ELEMENT.id}: ${error}`,
          type: "Log",
        }, self.location.origin
      );
    }
  }

  private createSceneBoxObject(
    GEOMETRY_3D: Geometry3D,
    ELEMENT: OSMElement,
  ): THREE.Mesh | undefined {
    if (!this.OBJECT_CONFIG) {
      return;
    }
    if (!ELEMENT || !ELEMENT.tags || Object.keys(ELEMENT.tags).length === this.MIN_TAG_LENGTH) {
      return;
    }

    for (const [CATEGORY_NAME, CATEGORY] of Object.entries(this.OBJECT_CONFIG)) {
      const expectedTagKey = CATEGORY_NAME.slice(this.MIN_EXPECTED_TAG_SLICE, this.MAX_EXPECTED_TAG_SLICE).toLowerCase();
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
              : this.FALLBACK_COLOR;
          }
        } else if (this.COLOR_MODE === this.DARK_COLOR_MODE) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = hexToInt(TYPED_VALUE.DARK_COLOR_U);
            COLOR_D = hexToInt(TYPED_VALUE.DARK_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.DARK_COLOR
              ? hexToInt(TYPED_VALUE.DARK_COLOR)
              : this.FALLBACK_COLOR;
          }
        } else if (this.COLOR_MODE === this.FOLLY_RED_COLOR_MODE) {
          if (CATEGORY_NAME === "HIGHWAY_TAGS") {
            COLOR_U = hexToInt(TYPED_VALUE.SPECIAL_COLOR_U);
            COLOR_D = hexToInt(TYPED_VALUE.SPECIAL_COLOR_D);
          } else {
            COLOR = TYPED_VALUE.SPECIAL_COLOR
              ? hexToInt(TYPED_VALUE.SPECIAL_COLOR)
              : this.FALLBACK_COLOR;
          }
        }
        if (!COLOR) {
          COLOR = this.FALLBACK_COLOR;
        }
        if (!COLOR_U) {
          COLOR_U = this.FALLBACK_COLOR;
        }
        if (!COLOR_D) {
          COLOR_D = this.FALLBACK_COLOR;
        }

        if (CATEGORY_NAME === "HIGHWAY_TAGS") {
          return this.createWayGeometry(
            GEOMETRY_3D,
            this.HIGHWAY_DEFAULT_TYPE,
            TYPED_VALUE.WIDTH,
            TYPED_VALUE.HEIGHT,
            COLOR_D,
            COLOR_U,
          );
        } else if (CATEGORY_NAME === "RAILWAY_TAGS") {
          return this.createWayGeometry(
            GEOMETRY_3D,
            this.RAILWAY_DEFAULT_TYPE,
            TYPED_VALUE.WIDTH,
            TYPED_VALUE.HEIGHT,
            COLOR,
          );
        } else if (CATEGORY_NAME === "WATERWAY_TAGS" && elemTagValue === "stream") {
          return this.createWayGeometry(GEOMETRY_3D, this.WATERWAY_DEFAULT_TYPE, this.WATERWAY_DEFAULT_WIDTH, TYPED_VALUE.HEIGHT, COLOR);
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
    TYPE = this.WG_DEFAULT_TYPE,
    WIDTH = this.WG_DEFAULT_WIDTH,
    HEIGHT = this.WG_DEFAULT_HEIGHT,
    COLOR_BELOW = this.FALLBACK_COLOR,
    COLOR_ABOVE = this.FALLBACK_COLOR,
    Y_OFFSET = this.WG_DEFAULT_Y_OFFSET,
  ): THREE.Mesh | undefined {
    if (GEOMETRY_3D.length < this.WG_MIN_POINT_ARRAY_LENGTH) {
      self.postMessage(
        {
          data: "[WARN] (createWayGeometry) GEOMETRY_LIST_3D[0] must contain at least two points.",
          type: "Log",
        }, self.location.origin
      );
      return;
    }

    const TEMP_GROUP_U = new THREE.Group();
    const TEMP_GROUP_D = new THREE.Group();

    const createCSG = (
      geom: THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>,
      pos: {
        x: number;
        y: number;
        z: number
      },
      angle: number,
    ): THREE.Mesh => {
      const matrix = new THREE.Matrix4()
        .makeRotationY(angle)
        .setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
      geom.applyMatrix4(matrix);
      const brush = new THREECSG.Brush(geom, new THREE.MeshStandardMaterial());
      return new THREE.Mesh(brush.geometry, new THREE.MeshStandardMaterial());
    };

    for (let ITERATION = 1; ITERATION < GEOMETRY_3D.length; ITERATION += this.WG_ITERATION_INDEX_FIX) {
      const point0 = GEOMETRY_3D[ITERATION - this.WG_ITERATION_INDEX_FIX];
      const point1 = GEOMETRY_3D[ITERATION];

      if (point0 === undefined || point1 === undefined) {
        postMessage({
          data: `[WARN] Undefined point in POINTS_ARRAY at index ${ITERATION - this.WG_ITERATION_INDEX_FIX} or ${ITERATION}. Skipping segment.`,
          type: "Log",
        });
        continue;
      }

      const dx = point1.x - point0.x;
      const dz = point1.z - point0.z;
      const length = Math.hypot(dx, dz);
      if (length === this.WG_MIN_LENGTH) {
        continue;
      }

      const angle = Math.atan2(dz, dx);
      const midPos = {
        x: (point0.x + point1.x) / this.WG_POINT_Y_MULTIPLIER,
        y: HEIGHT / this.WG_POINT_Y_MULTIPLIER + Y_OFFSET,
        z: (point0.z + point1.z) / this.WG_POINT_Y_MULTIPLIER,
      };

      const streetBelow = createCSG(new THREE.BoxGeometry(length, HEIGHT, WIDTH), midPos, -angle);

      streetBelow.receiveShadow = true;
      streetBelow.castShadow = false;
      TEMP_GROUP_D.add(streetBelow);
      const connectorBelow = createCSG(
        new THREE.CylinderGeometry(
          WIDTH / this.WG_BOTTOM_SIZE_MULTIPLIER,
          WIDTH / this.WG_BOTTOM_SIZE_MULTIPLIER,
          HEIGHT, this.WG_RADIAL_SEGMENTS
        ),
        {
          x: point0.x,
          y: HEIGHT / this.WG_POINT_Y_MULTIPLIER + Y_OFFSET,
          z: point0.z
        },
        this.WG_CONNECTOR_ANGLE,
      );
      connectorBelow.receiveShadow = true;
      connectorBelow.castShadow = false;
      TEMP_GROUP_D.add(connectorBelow);

      if (TYPE === this.WG_TYPE_FOR_STREET) {
        const streetAbove = createCSG(
          new THREE.BoxGeometry(
              length,
              HEIGHT + this.WG_HEIGHT_ADDITION,
              WIDTH / this.WG_WIDTH_MULTIPLIER
          ),
          midPos,
          -angle,
        );
        streetAbove.receiveShadow = true;
        streetAbove.castShadow = false;
        TEMP_GROUP_U.add(streetAbove);
        const connectorAbove = createCSG(
          new THREE.CylinderGeometry(
              WIDTH / this.WG_TOP_SIZE_MULTIPLIER,
              WIDTH / this.WG_TOP_SIZE_MULTIPLIER,
              HEIGHT + this.WG_HEIGHT_ADDITION,
              this.WG_RADIAL_SEGMENTS
          ),
          {
            x: point0.x,
            y: HEIGHT / this.WG_POINT_Y_MULTIPLIER + Y_OFFSET,
            z: point0.z
          },
          this.WG_CONNECTOR_ANGLE,
        );
        connectorAbove.receiveShadow = true;
        connectorAbove.castShadow = false;
        TEMP_GROUP_U.add(connectorAbove);
      }
    }

    const LAST_POINT = GEOMETRY_3D.at(-this.WG_ITERATION_INDEX_FIX);

    if (LAST_POINT !== undefined) {
      const connectorBelow = createCSG(
        new THREE.CylinderGeometry(
            WIDTH / this.WG_BOTTOM_SIZE_MULTIPLIER,
            WIDTH / this.WG_BOTTOM_SIZE_MULTIPLIER,
            HEIGHT,
            this.WG_RADIAL_SEGMENTS
        ),
        {
          x: LAST_POINT.x,
          y: HEIGHT / this.WG_POINT_Y_MULTIPLIER,
          z: LAST_POINT.z
        },
        this.WG_CONNECTOR_ANGLE,
      );
      connectorBelow.receiveShadow = true;
      TEMP_GROUP_D.add(connectorBelow);

      if (TYPE === this.WG_TYPE_FOR_STREET) {
        const connectorAbove = createCSG(
          new THREE.CylinderGeometry(
              WIDTH,
              WIDTH,
              HEIGHT + this.WG_HEIGHT_ADDITION,
              this.WG_RADIAL_SEGMENTS
          ),
          {
            x: LAST_POINT.x,
            y: HEIGHT + this.WG_HEIGHT_MULTIPLIER,
            z: LAST_POINT.z
          },
          this.WG_CONNECTOR_ANGLE,
        );
        TEMP_GROUP_U.add(connectorAbove);
        connectorAbove.receiveShadow = true;
      }
    }

    const WAY_GROUP = new THREE.Group();

    const MERGED_MESH_D = mergeGroupToMesh(TEMP_GROUP_D);
    const EVAL_D = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_D.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_BELOW }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(EVAL_D.geometry, new THREE.MeshStandardMaterial({ color: COLOR_BELOW })),
    );
    const MERGED_MESH_U = mergeGroupToMesh(TEMP_GROUP_U);
    const EVAL_U = this.EVALUATOR.evaluate(
      this.BOUNDS_CIRCLE,
      new THREECSG.Brush(
        MERGED_MESH_U.geometry,
        new THREE.MeshStandardMaterial({ color: COLOR_ABOVE }),
      ),
      THREECSG.INTERSECTION,
    );
    WAY_GROUP.add(
      new THREE.Mesh(EVAL_U.geometry, new THREE.MeshStandardMaterial({ color: COLOR_ABOVE })),
    );

    const RESULT = mergeGroupToMesh(WAY_GROUP);
    if (!RESULT.geometry || !RESULT.geometry.attributes.position) {
      self.postMessage(
        {
          data: `[WARN] Invalid geometry for way geometry during way geometry creation.`,
          type: "Log",
        }, self.location.origin
      );

      return;
    }

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
    for (let ITERATION = 1; ITERATION < GEOMETRY_3D.length; ITERATION += this.FOR_LOOP_INCREMENT) {
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
    if (HEIGHT && Y_OFFSET) {
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
    const { RADIUS, OBJECT_CONFIG, DEBUG, COLOR_MODE, GEOJSON, REUSED_DATA, LATITUDE, LONGITUDE, CCONFIG_DATA } =
      EVENT.data;
    const SCENE_CONTROLLER = new SceneController(
      OBJECT_CONFIG,
      RADIUS,
      DEBUG,
      COLOR_MODE,
      GEOJSON,
      REUSED_DATA,
      LATITUDE,
      LONGITUDE,
      CCONFIG_DATA
    );
    await SCENE_CONTROLLER.loadSceneFromData();
  },
);
