import * as THREE from 'three';
import {ConfigService} from "../services/ConfigService.js";

export class CameraController {

    constructor(RENDERER,) {
        this.CCONFIG = new ConfigService();
        this.RENDERER = RENDERER
        this.CAMERA = null;
        this.TCAMERA = {
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
            camera: null
        };
        this.YAW = 0;
        this.PITCH = 0;
        this.FOV = 60;
        this.ASPECT = window.innerWidth / window.innerHeight;
        this.NEAR = 0.1
        this.FAR = 10000
        this.MOVE_SPEED = 1
        this.VELOCITY = new THREE.Vector3(0, 0, 0);
        this.DAMPING = 0.96
        this.MAX_VELOCITY = 3.0;
        this.ACCELERATION = 0.95;
        this.IS_MOVING = false;
        this.KEY_QUEUE = {};
        this.POINTER_LOCK_ENABLED = false;
        this.POINTER_TARGET = null;
        this.CYCLE = 0;
    }

    onStart() {
        this.CAMERA = new THREE.PerspectiveCamera(this.FOV, this.ASPECT, this.NEAR, this.FAR);
        const RADIUS = this.CCONFIG.getConfigValue("yaw");
        this.CAMERA.position.set(RADIUS, 2*RADIUS, RADIUS);
        this.CAMERA.lookAt(new THREE.Vector3(0, 0, 0));

        this.YAW = this.CCONFIG.getConfigValue("yaw");
        this.PITCH = this.CCONFIG.getConfigValue("pitch");

        this.MOVE_SPEED = this.CCONFIG.getConfigValue("movespeed");
        this.FOV = this.CCONFIG.getConfigValue("fov");
        this.NEAR = this.CCONFIG.getConfigValue("near");
        this.FAR = this.CCONFIG.getConfigValue("far");

        document.addEventListener('keydown', (e) => this.KEY_QUEUE[e.code] = true)
        document.addEventListener('keyup', (e) => this.KEY_QUEUE[e.code] = false)

        this.POINTER_TARGET = this.RENDERER?.domElement ?? document.getElementById('c');

        if (this.POINTER_TARGET !== null) {
            this.POINTER_TARGET.tabIndex = this.POINTER_TARGET.tabIndex || 0;
            this.POINTER_TARGET.style.outline = 'none';

            this.POINTER_TARGET.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (document.pointerLockElement === this.POINTER_TARGET) {
                    document.exitPointerLock();
                } else {
                    this.POINTER_TARGET.requestPointerLock();
                }
            });

            document.addEventListener('pointerlockchange', () => {
                const locked = document.pointerLockElement === this.POINTER_TARGET;
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
        this.CAMERA.fov  = this.CCONFIG.getConfigValue("fov");
        this.CAMERA.near = this.CCONFIG.getConfigValue("near");
        this.CAMERA.far  = this.CCONFIG.getConfigValue("far");

        this.CAMERA.updateProjectionMatrix();

        this.TCAMERA.y = this.CAMERA.position.y;
        this.TCAMERA.x = this.CAMERA.position.x;
        this.TCAMERA.z = this.CAMERA.position.z;
        this.TCAMERA.yaw = THREE.MathUtils.radToDeg(this.CAMERA.rotation.y);
        this.TCAMERA.pitch = THREE.MathUtils.radToDeg(this.CAMERA.rotation.x);
        this.TCAMERA.rawyaw = this.CAMERA.rotation.y;
        this.TCAMERA.rawpitch = this.CAMERA.rotation.x;
        this.TCAMERA.movespeed = this.CCONFIG.getConfigValue("movespeed");
        this.TCAMERA.maxvelocity = this.TCAMERA.movespeed
        this.TCAMERA.mousesensitivity = this.CCONFIG.getConfigValue("mousesensitivity");
        this.TCAMERA.fov = this.CAMERA.fov
        this.TCAMERA.near = this.CAMERA.near
        this.TCAMERA.far = this.CAMERA.far
        this.TCAMERA.camera = this.CAMERA;

        if (this.TCAMERA.x !== this.CCONFIG.getConfigValue("xpos")) {
            this.TCAMERA.x = this.CCONFIG.getConfigValue("xpos");
        }

        if (this.TCAMERA.y !== this.CCONFIG.getConfigValue("ypos")) {
            this.TCAMERA.y = this.CCONFIG.getConfigValue("ypos");
        }

        if (this.TCAMERA.z !== this.CCONFIG.getConfigValue("zpos")) {
            this.TCAMERA.z = this.CCONFIG.getConfigValue("zpos");
        }

        if (this.TCAMERA.fov !== this.CCONFIG.getConfigValue("fov")) {
            this.TCAMERA.fov = this.CCONFIG.getConfigValue("fov");
            this.CAMERA.updateProjectionMatrix();
        }

        if (this.TCAMERA.near !== this.CCONFIG.getConfigValue("near")) {
            this.TCAMERA.near = this.CCONFIG.getConfigValue("near");
            this.CAMERA.updateProjectionMatrix();
        }

        if (this.TCAMERA.far !== this.CCONFIG.getConfigValue("far")) {
            this.TCAMERA.far = this.CCONFIG.getConfigValue("far");
            this.CAMERA.updateProjectionMatrix();
        }

        // if (this.TCAMERA.yaw !== this.CCONFIG.getConfigValue("yaw")) {
        //     this.TCAMERA.yaw = this.CCONFIG.getConfigValue("yaw");
        // }
        //
        // if (this.TCAMERA.pitch !== this.CCONFIG.getConfigValue("pitch")) {
        //     this.TCAMERA.pitch = this.CCONFIG.getConfigValue("pitch");
        // }

        const FORWARD = new THREE.Vector3();
        this.TCAMERA.camera.getWorldDirection(FORWARD);
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

        if (this.KEY_QUEUE["Space"])     this.TCAMERA.y += this.TCAMERA.movespeed;
        if (this.KEY_QUEUE["ShiftLeft"]) this.TCAMERA.y -= this.TCAMERA.movespeed;

        this.IS_MOVING = INPUT.lengthSq() > 0;

        if (this.IS_MOVING) {
            INPUT.normalize();
            this.VELOCITY.x += INPUT.x * this.ACCELERATION;
            this.VELOCITY.z += INPUT.z * this.ACCELERATION;
            const SPEED = Math.hypot(this.VELOCITY.x, this.VELOCITY.z);
            if (SPEED > this.TCAMERA.maxvelocity) {
                this.VELOCITY.x = (this.VELOCITY.x / SPEED) * this.TCAMERA.maxvelocity;
                this.VELOCITY.z = (this.VELOCITY.z / SPEED) * this.TCAMERA.maxvelocity;
            }
        } else {
            this.VELOCITY.x *= this.DAMPING;
            this.VELOCITY.z *= this.DAMPING;
            if (Math.abs(this.VELOCITY.x) < 0.001) this.VELOCITY.x = 0;
            if (Math.abs(this.VELOCITY.z) < 0.001) this.VELOCITY.z = 0;
        }
        this.applyVelocity(this.VELOCITY);


        if (this.TCAMERA.rawyaw > ( 2 * Math.PI ) ) {
            this.TCAMERA.yaw = THREE.MathUtils.radToDeg(this.TCAMERA.rawyaw - ( 2 * Math.PI ));
        } else if ( this.TCAMERA.rawyaw < 0 && this.TCAMERA.rawyaw < ( 2 * Math.PI ) ) {
            this.TCAMERA.yaw = THREE.MathUtils.radToDeg(this.TCAMERA.rawyaw + ( 2 * Math.PI ));
        }

        if (this.TCAMERA.rawpitch > ( Math.PI / 2 ) ) {
            this.TCAMERA.pitch = THREE.MathUtils.radToDeg(( Math.PI / 2 ));
        } else if (this.TCAMERA.rawpitch < -( Math.PI / 2 )) {
            this.TCAMERA.pitch = - THREE.MathUtils.radToDeg(( Math.PI / 2 ));
        }

        if (this.TCAMERA.x > (1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TCAMERA.x = (1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TCAMERA.x < -(1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TCAMERA.x = -(1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TCAMERA.z > (1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TCAMERA.z = (1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TCAMERA.z < -(1.5*this.CCONFIG.getConfigValue("radius"))) {
            this.TCAMERA.z = -(1.5*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TCAMERA.y > (2*this.CCONFIG.getConfigValue("radius"))) {
            this.TCAMERA.y = (2*this.CCONFIG.getConfigValue("radius"));
        }
        if (this.TCAMERA.y < 1) {
            this.TCAMERA.y = 1;
        }

        this.countCycle()

        this.CCONFIG.setConfigValue("xpos", this.TCAMERA.x)
        this.CCONFIG.setConfigValue("ypos", this.TCAMERA.y)
        this.CCONFIG.setConfigValue("zpos", this.TCAMERA.z)
        this.CCONFIG.setConfigValue("yaw", this.TCAMERA.yaw);
        this.CCONFIG.setConfigValue("pitch", this.TCAMERA.pitch);

        this.CAMERA.position.set(this.TCAMERA.x, this.TCAMERA.y, this.TCAMERA.z);
        this.CAMERA.rotation.set(THREE.MathUtils.degToRad(this.TCAMERA.pitch), THREE.MathUtils.degToRad(this.TCAMERA.yaw), 0, 'YXZ');
    }

    applyVelocity(velocity) {
        this.TCAMERA.x += velocity.x;
        this.TCAMERA.z += velocity.z;
    }


    countCycle() {
        this.CYCLE += 1;
    }

    getCycle() {
        return this.CYCLE;
    }
}