import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';

import { SCENE } from './script.js';

export function downloadSceneAsOBJ(scene, filename = 'scene.obj') {
    const exporter = new OBJExporter();
    const objData = exporter.parse(scene);

    const blob = new Blob([objData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

export function downloadSceneAsGLTF(filename = 'scene.gltf') {
    const exporter = new GLTFExporter();

    exporter.parse(SCENE, (result) => {
        const json = JSON.stringify(result, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    });
}

export function downloadSceneAsPLY(filename = 'scene.ply') {
    const exporter = new PLYExporter();

    const plyData = exporter.parse(SCENE, { binary: true });
    const blob = new Blob([plyData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}


