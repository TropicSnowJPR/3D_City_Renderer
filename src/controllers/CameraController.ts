import { ConfigService } from "../services/ConfigService.js";
import * as THREE from "three";
import { Box3 } from "three";
import type { ExtendedTriangle, MeshBVH } from "three-mesh-bvh";

/**
 * CameraController manages the perspective camera, including movement, rotation, and collision detection. It listens for user input (keyboard and mouse) to update the camera's position and orientation accordingly. The controller also handles pointer lock for mouse movement and ensures that the camera stays within defined boundaries.
 */
export class CameraController {
  CAMERA: THREE.PerspectiveCamera;
  private RENDERER: THREE.WebGLRenderer;
  private VELOCITY: THREE.Vector3;
  private CCONFIG: ConfigService;
  private TEMP_CAMERA: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    rawyaw: number;
    rawpitch: number;
    movespeed: number;
    maxvelocity: number;
    mousesensitivity: number;
    fov: number;
    near: number;
    far: number;
    camera: THREE.PerspectiveCamera;
  };
  private FOV: number;
  private ASPECT: number;
  private NEAR: number;
  private FAR: number;
  private readonly DAMPING: number;
  private readonly ACCELERATION: number;
  private CYCLE: number;
  IS_MOVING: boolean;
  IS_ACTIVE: boolean;
  COLLISION_ACTIVE: boolean;
  POINTER_LOCK_ENABLED: boolean;
  private KEY_QUEUE: Record<string, boolean> = {};
  POINTER_TARGET: HTMLCanvasElement | undefined;
  COLLISION_OBJECTS: Array<THREE.Object3D> | undefined;
  CAMERA_HITBOX: THREE.Mesh;

  constructor(
    RENDERER: THREE.WebGLRenderer,
    FOV = 60,
    NEAR = 0.1,
    FAR = 10_000,
  ) {
    this.CCONFIG = new ConfigService();
    this.RENDERER = RENDERER;
    this.CAMERA = new THREE.PerspectiveCamera();
    // Yaw/pitch are stored in degrees for config/UI usage, rawyaw/rawpitch stay in radians for internal camera math
    this.TEMP_CAMERA = {
      camera: new THREE.PerspectiveCamera(),
      far: 0,
      fov: 0,
      maxvelocity: 0,
      mousesensitivity: 0,
      movespeed: 0,
      near: 0,
      pitch: 0,
      rawpitch: 0,
      rawyaw: 0,
      x: 0,
      y: 0,
      yaw: 0,
      z: 0,
    };
    this.FOV = FOV;
    this.ASPECT = window.innerWidth / window.innerHeight;
    this.NEAR = NEAR;
    this.FAR = FAR;
    this.VELOCITY = new THREE.Vector3(0, 0, 0);
    this.DAMPING = 0.96;
    this.ACCELERATION = 0.95;
    this.KEY_QUEUE = {};
    this.POINTER_LOCK_ENABLED = false;
    this.POINTER_TARGET = undefined;
    this.CYCLE = 0;
    this.IS_ACTIVE = false;
    this.IS_MOVING = false;
    this.COLLISION_ACTIVE = false;
    this.COLLISION_OBJECTS = undefined;
    this.CAMERA_HITBOX = new THREE.Mesh();
  }

  /**
   * Initializes the camera controller by setting up the camera's initial position and orientation
   * @return void
   */
  init(): void {
    const RADIUS = this.CCONFIG.getConfigValue("radius") as number;

    this.CAMERA.fov = this.FOV;
    this.CAMERA.aspect = this.ASPECT;
    this.CAMERA.near = this.NEAR;
    this.CAMERA.far = this.FAR;

    this.CAMERA.position.set(RADIUS, RADIUS, RADIUS);
    this.CAMERA.rotation.set(-0.610_865_2, 0.785_398_2, 0, "YXZ");

    this.CAMERA.updateProjectionMatrix();

    this.FOV = this.CCONFIG.getConfigValue("fov") as number;
    this.NEAR = this.CCONFIG.getConfigValue("near") as number;
    this.FAR = this.CCONFIG.getConfigValue("far") as number;

    document.addEventListener("keydown", (e) => (this.KEY_QUEUE[e.code] = true));
    document.addEventListener("keyup", (e) => (this.KEY_QUEUE[e.code] = false));

    const CAMERA_HITBOX_MATERIAL = new THREE.MeshBasicMaterial({
      color: 0xFF_00_00,
      opacity: 1,
      side: THREE.DoubleSide,
      transparent: true,
      wireframe: true,
    });
    const CAMERA_HITBOX_GEOMETRY = new THREE.SphereGeometry(1, 8, 8);
    this.CAMERA_HITBOX = new THREE.Mesh(CAMERA_HITBOX_GEOMETRY, CAMERA_HITBOX_MATERIAL);

    this.POINTER_TARGET =
      this.RENDERER?.domElement ?? (document.querySelector("#c") as HTMLCanvasElement);

    if (this.POINTER_TARGET) {
      this.POINTER_TARGET.tabIndex = this.POINTER_TARGET.tabIndex || 0;
      this.POINTER_TARGET.style.outline = "none";

      this.POINTER_TARGET.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (document.pointerLockElement === this.POINTER_TARGET) {
          document.exitPointerLock();
        } else if (this.POINTER_TARGET) {
          this.POINTER_TARGET.requestPointerLock().then();
        }
      });

      document.addEventListener("pointerlockchange", () => {
        const locked = document.pointerLockElement === this.POINTER_TARGET;
        if (!this.POINTER_LOCK_ENABLED && locked) {
          this.POINTER_LOCK_ENABLED = true;
        } else if (this.POINTER_LOCK_ENABLED && !locked) {
          this.POINTER_LOCK_ENABLED = false;
        }
        document.body.style.cursor = locked ? "none" : "default";
      });

      document.addEventListener("mousemove", (e) => {
        let YAW = 0;
        let PITCH = 0;
        try {
          YAW = THREE.MathUtils.degToRad(this.CCONFIG.getConfigValue("yaw") as number);
          PITCH = THREE.MathUtils.degToRad(this.CCONFIG.getConfigValue("pitch") as number);
        } catch {
          // PASS
        }
        const mouseSensitivity = this.CCONFIG.getConfigValue("mousesensitivity") as number;

        if (document.pointerLockElement === this.POINTER_TARGET) {
          YAW -= e.movementX * mouseSensitivity;
          PITCH -= e.movementY * mouseSensitivity;
          if (PITCH > Math.PI / 2) {
            PITCH = Math.PI / 2;
          } else if (PITCH < -(Math.PI / 2)) {
            PITCH = -(Math.PI / 2);
          }
          if (YAW > 2 * Math.PI) {
            YAW -= 2 * Math.PI;
          } else if (YAW < 0 && YAW < 2 * Math.PI) {
            YAW += 2 * Math.PI;
          }

          // Avoid exactly +/-90° pitch to prevent gimbal-lock-like rotation issues in Three.js
          if (THREE.MathUtils.radToDeg(PITCH) === 90 || THREE.MathUtils.radToDeg(PITCH) === -90) {
            this.CAMERA.rotation.set(THREE.MathUtils.degToRad(THREE.MathUtils.radToDeg(PITCH) * 0.999), YAW, 0, "YXZ");
          } else {
            this.CAMERA.rotation.set(PITCH, YAW, 0, "YXZ");
          }
        }
        this.CCONFIG.setConfigValue("yaw", THREE.MathUtils.radToDeg(YAW));
        this.CCONFIG.setConfigValue("pitch", THREE.MathUtils.radToDeg(PITCH));
      });

      this.CCONFIG.setConfigValue("xpos", this.CAMERA.position.x);
      this.CCONFIG.setConfigValue("ypos", this.CAMERA.position.y);
      this.CCONFIG.setConfigValue("zpos", this.CAMERA.position.z);
      this.CCONFIG.setConfigValue("yaw", this.CAMERA.rotation.y);
      this.CCONFIG.setConfigValue("pitch", this.CAMERA.rotation.x);
    }
  }

  /**
   * Updates the camera's position and orientation based on user input and collision detection.
   * @return void
   */
  onUpdate(): void {
    if (!this.IS_ACTIVE) {
      return;
    }

    this.CAMERA.fov = this.CCONFIG.getConfigValue("fov") as number;
    this.CAMERA.near = this.CCONFIG.getConfigValue("near") as number;
    this.CAMERA.far = this.CCONFIG.getConfigValue("far") as number;

    this.CAMERA.updateProjectionMatrix();

    // Temporary mutable camera state used during each update cycle before applying it to the real camera
    this.TEMP_CAMERA.y = this.CAMERA.position.y;
    this.TEMP_CAMERA.x = this.CAMERA.position.x;
    this.TEMP_CAMERA.z = this.CAMERA.position.z;
    this.TEMP_CAMERA.yaw = THREE.MathUtils.radToDeg(this.CAMERA.rotation.y);
    this.TEMP_CAMERA.pitch = THREE.MathUtils.radToDeg(this.CAMERA.rotation.x);
    this.TEMP_CAMERA.rawyaw = this.CAMERA.rotation.y;
    this.TEMP_CAMERA.rawpitch = this.CAMERA.rotation.x;
    this.TEMP_CAMERA.movespeed = this.CCONFIG.getConfigValue("movespeed") as number;
    this.TEMP_CAMERA.maxvelocity = this.TEMP_CAMERA.movespeed;
    this.TEMP_CAMERA.mousesensitivity = this.CCONFIG.getConfigValue("mousesensitivity") as number;
    this.TEMP_CAMERA.fov = this.CAMERA.fov;
    this.TEMP_CAMERA.near = this.CAMERA.near;
    this.TEMP_CAMERA.far = this.CAMERA.far;
    this.TEMP_CAMERA.camera = this.CAMERA;

    if (this.TEMP_CAMERA.x !== this.CCONFIG.getConfigValue("xpos")) {
      this.TEMP_CAMERA.x = this.CCONFIG.getConfigValue("xpos") as number;
    }

    if (this.TEMP_CAMERA.y !== this.CCONFIG.getConfigValue("ypos")) {
      this.TEMP_CAMERA.y = this.CCONFIG.getConfigValue("ypos") as number;
    }

    if (this.TEMP_CAMERA.z !== this.CCONFIG.getConfigValue("zpos")) {
      this.TEMP_CAMERA.z = this.CCONFIG.getConfigValue("zpos") as number;
    }

    if (this.TEMP_CAMERA.fov !== this.CCONFIG.getConfigValue("fov")) {
      this.TEMP_CAMERA.fov = this.CCONFIG.getConfigValue("fov") as number;
      this.CAMERA.updateProjectionMatrix();
    }

    if (this.TEMP_CAMERA.near !== this.CCONFIG.getConfigValue("near")) {
      this.TEMP_CAMERA.near = this.CCONFIG.getConfigValue("near") as number;
      this.CAMERA.updateProjectionMatrix();
    }

    if (this.TEMP_CAMERA.far !== this.CCONFIG.getConfigValue("far")) {
      this.TEMP_CAMERA.far = this.CCONFIG.getConfigValue("far") as number;
      this.CAMERA.updateProjectionMatrix();
    }

    const FORWARD = new THREE.Vector3();
    this.TEMP_CAMERA.camera.getWorldDirection(FORWARD);
    FORWARD.y = 0;
    FORWARD.normalize();
    const RIGHT = new THREE.Vector3().crossVectors(FORWARD, new THREE.Vector3(0, 1, 0)).normalize();
    const INPUT = new THREE.Vector3(0, 0, 0);

    if (this.KEY_QUEUE["KeyW"]) {
      INPUT.add(FORWARD);
    }
    if (this.KEY_QUEUE["KeyS"]) {
      INPUT.sub(FORWARD);
    }
    if (this.KEY_QUEUE["KeyD"]) {
      INPUT.add(RIGHT);
    }
    if (this.KEY_QUEUE["KeyA"]) {
      INPUT.sub(RIGHT);
    }

    if (this.KEY_QUEUE["Space"]) {
      this.TEMP_CAMERA.y += this.TEMP_CAMERA.movespeed;
    }
    if (this.KEY_QUEUE["ShiftLeft"]) {
      this.TEMP_CAMERA.y -= this.TEMP_CAMERA.movespeed;
    }

    this.IS_MOVING = INPUT.lengthSq() > 0;

    if (this.IS_MOVING) {
      INPUT.normalize();
      this.VELOCITY.x += INPUT.x * this.ACCELERATION;
      this.VELOCITY.z += INPUT.z * this.ACCELERATION;
      const SPEED = Math.hypot(this.VELOCITY.x, this.VELOCITY.z);
      if (SPEED > this.TEMP_CAMERA.maxvelocity) {
        this.VELOCITY.x = (this.VELOCITY.x / SPEED) * this.TEMP_CAMERA.maxvelocity;
        this.VELOCITY.z = (this.VELOCITY.z / SPEED) * this.TEMP_CAMERA.maxvelocity;
      }
    } else {
      this.VELOCITY.x *= this.DAMPING;
      this.VELOCITY.z *= this.DAMPING;
      if (Math.abs(this.VELOCITY.x) < 0.001) {
        this.VELOCITY.x = 0;
      }
      if (Math.abs(this.VELOCITY.z) < 0.001) {
        this.VELOCITY.z = 0;
      }
    }

    this.TEMP_CAMERA.x += this.VELOCITY.x;
    this.TEMP_CAMERA.z += this.VELOCITY.z;

    if (this.TEMP_CAMERA.rawyaw > 2 * Math.PI) {
      this.TEMP_CAMERA.yaw = THREE.MathUtils.radToDeg(this.TEMP_CAMERA.rawyaw - 2 * Math.PI);
    } else if (this.TEMP_CAMERA.rawyaw < 0 && this.TEMP_CAMERA.rawyaw < 2 * Math.PI) {
      this.TEMP_CAMERA.yaw = THREE.MathUtils.radToDeg(this.TEMP_CAMERA.rawyaw + 2 * Math.PI);
    }

    if (this.TEMP_CAMERA.rawpitch > Math.PI / 2) {
      this.TEMP_CAMERA.pitch = THREE.MathUtils.radToDeg(Math.PI / 2);
    } else if (this.TEMP_CAMERA.rawpitch < -(Math.PI / 2)) {
      this.TEMP_CAMERA.pitch = -THREE.MathUtils.radToDeg(Math.PI / 2);
    }

    // Clamp camera position so the player cannot move outside the generated map area and the skybox
    if (this.TEMP_CAMERA.x > 1.5 * (this.CCONFIG.getConfigValue("radius") as number)) {
      this.TEMP_CAMERA.x = 1.5 * (this.CCONFIG.getConfigValue("radius") as number);
    }
    if (this.TEMP_CAMERA.x < -(1.5 * (this.CCONFIG.getConfigValue("radius") as number))) {
      this.TEMP_CAMERA.x = -(1.5 * (this.CCONFIG.getConfigValue("radius") as number));
    }
    if (this.TEMP_CAMERA.z > 1.5 * (this.CCONFIG.getConfigValue("radius") as number)) {
      this.TEMP_CAMERA.z = 1.5 * (this.CCONFIG.getConfigValue("radius") as number);
    }
    if (this.TEMP_CAMERA.z < -(1.5 * (this.CCONFIG.getConfigValue("radius") as number))) {
      this.TEMP_CAMERA.z = -(1.5 * (this.CCONFIG.getConfigValue("radius") as number));
    }
    if (this.TEMP_CAMERA.y > 2 * (this.CCONFIG.getConfigValue("radius") as number)) {
      this.TEMP_CAMERA.y = 2 * (this.CCONFIG.getConfigValue("radius") as number);
    }
    if (this.TEMP_CAMERA.y < -(0.25 * (this.CCONFIG.getConfigValue("radius") as number))) {
      this.TEMP_CAMERA.y = -(0.25 * (this.CCONFIG.getConfigValue("radius") as number));
    }

    const PLAYER_BOX = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z),
      new THREE.Vector3(0.01, 0.01, 0.01),
    );

    if (this.COLLISION_ACTIVE && this.COLLISION_OBJECTS) {
      const collisions = this.detectCollisions(PLAYER_BOX);
      if (collisions) {
        this.TEMP_CAMERA.x = this.CCONFIG.getConfigValue("xpos") as number;
        this.TEMP_CAMERA.y = this.CCONFIG.getConfigValue("ypos") as number;
        this.TEMP_CAMERA.z = this.CCONFIG.getConfigValue("zpos") as number;
        this.VELOCITY = new THREE.Vector3(0, 0, 0);
      }
    }

    this.countCycle();

    this.CCONFIG.setConfigValue("xpos", this.TEMP_CAMERA.x);
    this.CCONFIG.setConfigValue("ypos", this.TEMP_CAMERA.y);
    this.CCONFIG.setConfigValue("zpos", this.TEMP_CAMERA.z);
    this.CCONFIG.setConfigValue("yaw", this.TEMP_CAMERA.yaw);
    this.CCONFIG.setConfigValue("pitch", this.TEMP_CAMERA.pitch);

    this.CAMERA_HITBOX.position.set(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z);

    this.CAMERA.position.set(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z);
    // Avoid exactly +/-90° pitch to prevent gimbal-lock-like rotation issues in Three.js
    if (this.TEMP_CAMERA.pitch === 90 || this.TEMP_CAMERA.pitch === -90) {
      this.CAMERA.rotation.set(
          THREE.MathUtils.degToRad(this.TEMP_CAMERA.pitch * 0.999),
          THREE.MathUtils.degToRad(this.TEMP_CAMERA.yaw),
          0,
          "YXZ",
      );
    } else {
      this.CAMERA.rotation.set(
          THREE.MathUtils.degToRad(this.TEMP_CAMERA.pitch),
          THREE.MathUtils.degToRad(this.TEMP_CAMERA.yaw),
          0,
          "YXZ",
      );
    }

  }

  /**
   * Detects collisions between the player's bounding box and the defined collision objects in the scene.
   * @param playerBox - A THREE.Box3 representing the player's current bounding box for collision detection.
   * @returns true if a collision is detected with any of the collision objects, false otherwise.
   */
  detectCollisions(playerBox: THREE.Box3): boolean {
    if (!this.COLLISION_OBJECTS) {return false;}

    for (const mesh of this.COLLISION_OBJECTS as THREE.Mesh[]) {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const bvh = geometry.boundsTree as MeshBVH;

      if (!bvh) {continue;}

      let collided = false;

      bvh.shapecast({
        intersectsBounds: (box: THREE.Box3) => playerBox.intersectsBox(box),

        intersectsTriangle: (
            triangle: ExtendedTriangle,
            _triangleIndex: number,
            _contained: boolean,
            _depth: number
        ) => {
          const triBox = new Box3().setFromPoints([
            triangle.a.clone(),
            triangle.b.clone(),
            triangle.c.clone(),
          ]);

          if (playerBox.intersectsBox(triBox)) {
            collided = true;
            return true;
          }
        },
      });

      if (collided) {return true;}
    }

    return false;
  }

  /**
   * Increments the internal cycle counter.
   */
  countCycle(): void {
    this.CYCLE += 1;
  }

  /**
   * Gets the current value of the internal cycle counter.
   */
  getCycle(): number {
    return this.CYCLE;
  }
}
