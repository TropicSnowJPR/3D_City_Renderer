import * as THREE from 'three';

export class CameraController {
    constructor(RENDERER, CONFIG) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.RENDERER = RENDERER
        this.CAMERA = null;
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
        this.CAMERA.position.set(0, 10, 20);
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
        } else {
            console.warn('Pointer lock: no canvas element found (RENDERER.domElement or #c).');
        }
    }

    onUpdate() {
        this.CAMERA.fov  = this.CCONFIG.getConfigValue("fov");
        this.CAMERA.near = this.CCONFIG.getConfigValue("near");
        this.CAMERA.far  = this.CCONFIG.getConfigValue("far");
        this.CAMERA.updateProjectionMatrix();

        this.CCONFIG.setConfigValue("xpos", this.CAMERA.position.x)
        this.CCONFIG.setConfigValue("ypos", this.CAMERA.position.y)
        this.CCONFIG.setConfigValue("zpos", this.CAMERA.position.z)

        this.MOVE_SPEED = this.CCONFIG.getConfigValue("movespeed");
        this.MAX_VELOCITY = this.MOVE_SPEED;
        this.MOUSE_SENSITIVITY = this.CCONFIG.getConfigValue("mousesensitivity");

        const FORWARD = new THREE.Vector3();
        this.CAMERA.getWorldDirection(FORWARD);
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

        if (this.KEY_QUEUE["Space"])     this.CAMERA.position.y += this.MOVE_SPEED;
        if (this.KEY_QUEUE["ShiftLeft"]) this.CAMERA.position.y -= this.MOVE_SPEED;

        this.IS_MOVING = INPUT.lengthSq() > 0;

        if (this.IS_MOVING) {
            INPUT.normalize();
            this.VELOCITY.x += INPUT.x * this.ACCELERATION;
            this.VELOCITY.z += INPUT.z * this.ACCELERATION;
            const SPEED = Math.hypot(this.VELOCITY.x, this.VELOCITY.z);
            if (SPEED > this.MAX_VELOCITY) {
                this.VELOCITY.x = (this.VELOCITY.x / SPEED) * this.MAX_VELOCITY;
                this.VELOCITY.z = (this.VELOCITY.z / SPEED) * this.MAX_VELOCITY;
            }
        } else {
            this.VELOCITY.x *= this.DAMPING;
            this.VELOCITY.z *= this.DAMPING;
            if (Math.abs(this.VELOCITY.x) < 0.001) this.VELOCITY.x = 0;
            if (Math.abs(this.VELOCITY.z) < 0.001) this.VELOCITY.z = 0;
        }
        this.applyVelocity(this.VELOCITY);


        if ( this.CAMERA.rotation.y > ( 2 * Math.PI ) ) {
            this.CAMERA.rotation.y = this.CAMERA.rotation.y - ( 2 * Math.PI );
        } else if ( this.CAMERA.rotation.y < 0 && this.CAMERA.rotation.y < ( 2 * Math.PI ) ) {
            this.CAMERA.rotation.y = this.CAMERA.rotation.y + ( 2 * Math.PI );
        }
        this.YAW = ( this.CAMERA.rotation.y * ( 180 / Math.PI ) ).toFixed(3);
        this.CCONFIG.setConfigValue("yaw", this.YAW);

        if (this.CAMERA.rotation.x > ( Math.PI / 2 ) ) {
            this.CAMERA.rotation.x = ( Math.PI / 2 );
        } else if (this.CAMERA.rotation.x < -( Math.PI / 2 )) {
            this.CAMERA.rotation.x = - ( Math.PI / 2 );
        }
        this.PITCH = ( this.CAMERA.rotation.x * ( 180 / Math.PI ) ).toFixed(3);
        this.CCONFIG.setConfigValue("pitch", this.PITCH);

        this.countCycle()
    }

    applyVelocity(velocity) {
        this.CAMERA.position.x += velocity.x;
        this.CAMERA.position.z += velocity.z;
    }


    countCycle() {
        this.CYCLE += 1;
    }

    getCycle() {
        return this.CYCLE;
    }
}