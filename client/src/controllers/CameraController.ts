import * as THREE from 'three';
import * as THREEBVH from "three-mesh-bvh";
import { Box3, Matrix4 } from "three";
import {ConfigService} from "../services/ConfigService.js";

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
        camera: THREE.PerspectiveCamera
    };
    private YAW: number;
    private PITCH: number;
    FOV: number;
    private ASPECT: number;
    NEAR: number;
    FAR: number;
    MOVE_SPEED: number;
    readonly DAMPING: number;
    readonly MAX_VELOCITY: number;
    readonly ACCELERATION: number;
    CYCLE: number;
    IS_MOVING: boolean;
    IS_ACTIVE: boolean;
    COLLISION_ACTIVE: boolean;
    POINTER_LOCK_ENABLED: boolean;
    private KEY_QUEUE: { [key: string]: boolean } = {};
    POINTER_TARGET: HTMLElement | null;
    COLLISION_OBJECTS: any | null;
    CAMERA_HITBOX: THREE.Mesh


    constructor(RENDERER: THREE.WebGLRenderer, YAW = 0, PITCH = 0, FOV = 60, NEAR = 0.1, FAR = 10000) {
        this.CCONFIG                = new ConfigService();
        this.RENDERER               = RENDERER
        this.CAMERA                 = new THREE.PerspectiveCamera()
        this.TEMP_CAMERA            = {
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
            pitch: 0,
            rawyaw: 0,
            rawpitch: 0,
            movespeed: 0,
            maxvelocity: 0,
            mousesensitivity: 0,
            fov: 0,
            near: 0,
            far: 0,
            camera: new THREE.PerspectiveCamera()
        };
        this.YAW                    = YAW;
        this.PITCH                  = PITCH;
        this.FOV                    = FOV;
        this.ASPECT                 = window.innerWidth / window.innerHeight;
        this.NEAR                   = NEAR;
        this.FAR                    = FAR;
        this.MOVE_SPEED             = 1
        this.VELOCITY               = new THREE.Vector3(0, 0, 0);
        this.DAMPING                = 0.96
        this.MAX_VELOCITY           = 3.0;
        this.ACCELERATION           = 0.95;
        this.KEY_QUEUE              = {};
        this.POINTER_LOCK_ENABLED   = false;
        this.POINTER_TARGET         = null;
        this.CYCLE                  = 0;
        this.IS_ACTIVE              = false;
        this.IS_MOVING              = false;
        this.COLLISION_ACTIVE       = true;
        this.COLLISION_OBJECTS      = undefined
        this.CAMERA_HITBOX          = new THREE.Mesh();
    }

    onStart() {
        const RADIUS        = this.CCONFIG.getConfigValue("radius");

        this.CAMERA.fov             = this.FOV
        this.CAMERA.aspect          = this.ASPECT;
        this.CAMERA.near            = this.NEAR;
        this.CAMERA.far             = this.FAR;

        this.CAMERA.position.set(RADIUS, 1.5*RADIUS, RADIUS);
        this.YAW = 45 * (Math.PI / 180);
        this.PITCH = -35 * (Math.PI / 180);
        this.CAMERA.rotation.set(this.PITCH, this.YAW, 0, 'YXZ');

        this.CAMERA.updateProjectionMatrix();

        this.MOVE_SPEED             = this.CCONFIG.getConfigValue("movespeed");
        this.FOV                    = this.CCONFIG.getConfigValue("fov");
        this.NEAR                   = this.CCONFIG.getConfigValue("near");
        this.FAR                    = this.CCONFIG.getConfigValue("far");

        this.YAW                    = this.CCONFIG.getConfigValue("yaw");
        this.PITCH                  = this.CCONFIG.getConfigValue("pitch");

        document.addEventListener('keydown', (e) => this.KEY_QUEUE[e.code] = true)
        document.addEventListener('keyup', (e) => this.KEY_QUEUE[e.code] = false)

        const CAMERA_HITBOX_MATERIAL = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
        });
        const CAMERA_HITBOX_GEOMETRY = new THREE.SphereGeometry(1, 8, 8);
        this.CAMERA_HITBOX = new THREE.Mesh(CAMERA_HITBOX_GEOMETRY, CAMERA_HITBOX_MATERIAL);

        this.POINTER_TARGET = this.RENDERER?.domElement ?? document.getElementById('c');

        if (this.POINTER_TARGET !== null) {
            this.POINTER_TARGET.tabIndex = this.POINTER_TARGET.tabIndex || 0;
            this.POINTER_TARGET.style.outline = 'none';

            this.POINTER_TARGET.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (document.pointerLockElement === this.POINTER_TARGET) {
                    document.exitPointerLock();
                } else {
                    if (this.POINTER_TARGET) {
                        this.POINTER_TARGET.requestPointerLock();
                    }
                }
            });

            document.addEventListener('pointerlockchange', () => {
                const locked = document.pointerLockElement === this.POINTER_TARGET;
                if (!this.POINTER_LOCK_ENABLED && locked) {
                    this.POINTER_LOCK_ENABLED = true;
                } else if (this.POINTER_LOCK_ENABLED && !locked) {
                    this.POINTER_LOCK_ENABLED = false;
                }
                document.body.style.cursor = locked ? 'none' : 'default';
            });

            document.addEventListener('pointerlockerror', (err) => {
                console.error('Pointer lock error', err);
            });

            document.addEventListener('mousemove', (e) => {
                let yaw, pitch;
                try {
                    yaw = this.CAMERA.rotation.y || this.CCONFIG.getConfigValue("yaw");
                    pitch = this.CAMERA.rotation.x || this.CCONFIG.getConfigValue("pitch");
                } catch (e) {
                    yaw = 0
                    pitch = 0
                }
                let mouseSensitivity = this.CCONFIG.getConfigValue( "mousesensitivity" );

                if (document.pointerLockElement === this.POINTER_TARGET) {
                    yaw -= e.movementX * mouseSensitivity;
                    pitch -= e.movementY * mouseSensitivity;
                    //console.log( "Pitch: " + pitch * ( 180 / Math.PI )  + "; Yaw: " + yaw * ( 180 / Math.PI ) );
                    if ( pitch > ( Math.PI / 2 ) ) {
                        pitch = ( Math.PI / 2 )
                    } else if ( pitch < -( Math.PI / 2 ) ) {
                        pitch = -( Math.PI / 2 );
                    }
                    if (yaw > ( 2 * Math.PI ) ) {
                        yaw = yaw - ( 2 * Math.PI );
                    } else if ( yaw < 0 && yaw < ( 2 * Math.PI ) ) {
                        yaw = yaw + ( 2 * Math.PI );
                    }
                    this.CAMERA.rotation.set( pitch, yaw, 0, 'YXZ' );
                }
                this.CCONFIG.setConfigValue("yaw", yaw);
                this.YAW = yaw;
                this.CCONFIG.setConfigValue("pitch", pitch);
                this.PITCH = pitch;
            });

            this.CCONFIG.setConfigValue("xpos", this.CAMERA.position.x)
            this.CCONFIG.setConfigValue("ypos", this.CAMERA.position.x)
            this.CCONFIG.setConfigValue("zpos", this.CAMERA.position.z)
            this.CCONFIG.setConfigValue("yaw", this.CAMERA.rotation.y);
            this.CCONFIG.setConfigValue("pitch", this.CAMERA.rotation.x);
        } else {
            console.warn('Pointer lock: no canvas element found (RENDERER.domElement or #c).');
        }
    }

    onUpdate() {
        if (!this.IS_ACTIVE) return;

        this.CAMERA.fov  = this.CCONFIG.getConfigValue("fov");
        this.CAMERA.near = this.CCONFIG.getConfigValue("near");
        this.CAMERA.far  = this.CCONFIG.getConfigValue("far");

        this.CAMERA.updateProjectionMatrix();

        this.TEMP_CAMERA.y                  = this.CAMERA.position.y;
        this.TEMP_CAMERA.x                  = this.CAMERA.position.x;
        this.TEMP_CAMERA.z                  = this.CAMERA.position.z;
        this.TEMP_CAMERA.yaw                = THREE.MathUtils.radToDeg(this.CAMERA.rotation.y);
        this.TEMP_CAMERA.pitch              = THREE.MathUtils.radToDeg(this.CAMERA.rotation.x);
        this.TEMP_CAMERA.rawyaw             = this.CAMERA.rotation.y;
        this.TEMP_CAMERA.rawpitch           = this.CAMERA.rotation.x;
        this.TEMP_CAMERA.movespeed          = this.CCONFIG.getConfigValue("movespeed");
        this.TEMP_CAMERA.maxvelocity        = this.TEMP_CAMERA.movespeed
        this.TEMP_CAMERA.mousesensitivity   = this.CCONFIG.getConfigValue("mousesensitivity");
        this.TEMP_CAMERA.fov                = this.CAMERA.fov
        this.TEMP_CAMERA.near               = this.CAMERA.near
        this.TEMP_CAMERA.far                = this.CAMERA.far
        this.TEMP_CAMERA.camera             = this.CAMERA;


        if (this.TEMP_CAMERA.x !== this.CCONFIG.getConfigValue("xpos")) {
            this.TEMP_CAMERA.x = this.CCONFIG.getConfigValue("xpos");
        }

        if (this.TEMP_CAMERA.y !== this.CCONFIG.getConfigValue("ypos")) {
            this.TEMP_CAMERA.y = this.CCONFIG.getConfigValue("ypos");
        }

        if (this.TEMP_CAMERA.z !== this.CCONFIG.getConfigValue("zpos")) {
            this.TEMP_CAMERA.z = this.CCONFIG.getConfigValue("zpos");
        }

        if (this.TEMP_CAMERA.fov !== this.CCONFIG.getConfigValue("fov")) {
            this.TEMP_CAMERA.fov = this.CCONFIG.getConfigValue("fov");
            this.CAMERA.updateProjectionMatrix();
        }

        if (this.TEMP_CAMERA.near !== this.CCONFIG.getConfigValue("near")) {
            this.TEMP_CAMERA.near = this.CCONFIG.getConfigValue("near");
            this.CAMERA.updateProjectionMatrix();
        }

        if (this.TEMP_CAMERA.far !== this.CCONFIG.getConfigValue("far")) {
            this.TEMP_CAMERA.far = this.CCONFIG.getConfigValue("far");
            this.CAMERA.updateProjectionMatrix();
        }

        // if (this.TEMP_CAMERA.yaw !== this.CCONFIG.getConfigValue("yaw")) {
        //     this.TEMP_CAMERA.yaw = this.CCONFIG.getConfigValue("yaw");
        // }
        //
        // if (this.TEMP_CAMERA.pitch !== this.CCONFIG.getConfigValue("pitch")) {
        //     this.TEMP_CAMERA.pitch = this.CCONFIG.getConfigValue("pitch");
        // }

        const FORWARD = new THREE.Vector3();
        this.TEMP_CAMERA.camera.getWorldDirection(FORWARD);
        FORWARD.y = 0;
        FORWARD.normalize();
        const RIGHT = new THREE.Vector3()
            .crossVectors(FORWARD, new THREE.Vector3(0, 1, 0))
            .normalize();
        const INPUT = new THREE.Vector3(0, 0, 0);

        if (this.KEY_QUEUE["KeyW"]) INPUT.add(FORWARD);
        if (this.KEY_QUEUE["KeyS"]) INPUT.sub(FORWARD);
        if (this.KEY_QUEUE["KeyD"]) INPUT.add(RIGHT);
        if (this.KEY_QUEUE["KeyA"]) INPUT.sub(RIGHT);

        if (this.KEY_QUEUE["Space"])     this.TEMP_CAMERA.y += this.TEMP_CAMERA.movespeed;
        if (this.KEY_QUEUE["ShiftLeft"]) this.TEMP_CAMERA.y -= this.TEMP_CAMERA.movespeed;

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
            if (Math.abs(this.VELOCITY.x) < 0.001) this.VELOCITY.x = 0;
            if (Math.abs(this.VELOCITY.z) < 0.001) this.VELOCITY.z = 0;
        }

        this.applyVelocity(this.VELOCITY);

        if (this.TEMP_CAMERA.rawyaw > ( 2 * Math.PI ) ) {
            this.TEMP_CAMERA.yaw = THREE.MathUtils.radToDeg(this.TEMP_CAMERA.rawyaw - ( 2 * Math.PI ));
        } else if ( this.TEMP_CAMERA.rawyaw < 0 && this.TEMP_CAMERA.rawyaw < ( 2 * Math.PI ) ) {
            this.TEMP_CAMERA.yaw = THREE.MathUtils.radToDeg(this.TEMP_CAMERA.rawyaw + ( 2 * Math.PI ));
        }

        if (this.TEMP_CAMERA.rawpitch > ( Math.PI / 2 ) ) {
            this.TEMP_CAMERA.pitch = THREE.MathUtils.radToDeg(( Math.PI / 2 ));
        } else if (this.TEMP_CAMERA.rawpitch < -( Math.PI / 2 )) {
            this.TEMP_CAMERA.pitch = - THREE.MathUtils.radToDeg(( Math.PI / 2 ));
        }

        if (this.TEMP_CAMERA.x > (1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.x = (1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TEMP_CAMERA.x < -(1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.x = -(1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TEMP_CAMERA.z > (1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.z = (1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TEMP_CAMERA.z < -(1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.z = -(1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TEMP_CAMERA.y > (2*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.y = (2*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TEMP_CAMERA.y < -(1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TEMP_CAMERA.y = -(1.5*this.CCONFIG.getConfigValue("radius"));
        }

        const PLAYER_BOX = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z),
            new THREE.Vector3(0.01, 0.01, 0.01)
        );

        if (this.COLLISION_ACTIVE && this.COLLISION_OBJECTS != undefined) {
            const collisions = this.detectCollisions(PLAYER_BOX);
            if (collisions) {
                this.TEMP_CAMERA.x = this.CCONFIG.getConfigValue("xpos");
                this.TEMP_CAMERA.y = this.CCONFIG.getConfigValue("ypos");
                this.TEMP_CAMERA.z = this.CCONFIG.getConfigValue("zpos");
                this.VELOCITY = new THREE.Vector3(0, 0, 0);
            }
        }


        this.countCycle()

        this.CCONFIG.setConfigValue("xpos", this.TEMP_CAMERA.x)
        this.CCONFIG.setConfigValue("ypos", this.TEMP_CAMERA.y)
        this.CCONFIG.setConfigValue("zpos", this.TEMP_CAMERA.z)
        this.CCONFIG.setConfigValue("yaw", this.TEMP_CAMERA.yaw);
        this.CCONFIG.setConfigValue("pitch", this.TEMP_CAMERA.pitch);

        this.CAMERA_HITBOX.position.set(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z);

        this.CAMERA.position.set(this.TEMP_CAMERA.x, this.TEMP_CAMERA.y, this.TEMP_CAMERA.z);
        this.CAMERA.rotation.set(THREE.MathUtils.degToRad(this.TEMP_CAMERA.pitch), THREE.MathUtils.degToRad(this.TEMP_CAMERA.yaw), 0, 'YXZ');
    }

    applyVelocity(velocity: THREE.Vector3) {
        this.TEMP_CAMERA.x += velocity.x;
        this.TEMP_CAMERA.z += velocity.z;
    }

    detectCollisions(playerBox: THREE.Box3) {

        for (const mesh of this.COLLISION_OBJECTS) {

            const geometry = mesh.geometry;
            const bvh = geometry.boundsTree;

            let collided = false;

            bvh.shapecast({

                intersectsBounds: (box: THREE.Box3) => {
                    return playerBox.intersectsBox(box);
                },

                intersectsTriangle: (tri: { a: any; b: any; c: any; }) => {

                    const triBox = new Box3().setFromPoints([
                        tri.a,
                        tri.b,
                        tri.c
                    ]);

                    if (playerBox.intersectsBox(triBox)) {
                        collided = true;
                        return true;
                    }

                    return false;
                }

            });

            if (collided) {
                return true;
            }
        }

        return false;
    }

    countCycle() {
        this.CYCLE += 1;
    }

    getCycle() {
        return this.CYCLE;
    }

    onSceneReady(COLLISION_OBJECTS: any) {
        this.COLLISION_OBJECTS = COLLISION_OBJECTS;
    }
}