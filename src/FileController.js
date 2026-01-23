import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';

import {REQUESTED_DATA} from './Main.js';

export class FileController {
    constructor(CONFIG, SCENE) {
        this.CCONFIG = new CONFIG.ConfigManager();
        this.SCENE = SCENE;
    }

    async downloadSceneAsOBJ() {
        const exporter = new OBJExporter();
        const objData = exporter.parse(this.SCENE);

        const blob = new Blob([objData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'scene.obj';
        link.click();

        URL.revokeObjectURL(url);
    }

    async downloadSceneAsGLTF() {
        const exporter = new GLTFExporter();

        exporter.parse(this.SCENE, (result) => {
            const json = JSON.stringify(result, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'scene.gltf';
            a.click();

            URL.revokeObjectURL(url);
        });
    }

    async downloadSceneAsPLY() {
        const exporter = new PLYExporter();

        const plyData = exporter.parse(this.SCENE, { binary: true });
        const blob = new Blob([plyData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.ply';
        a.click();

        URL.revokeObjectURL(url);
    }

    async downloadSceneAsJSON() {
        const jsonString = JSON.stringify(REQUESTED_DATA, null, 2);

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.json';
        a.click();

        URL.revokeObjectURL(url);
    }
}

