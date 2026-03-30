import { getScene } from "../core/App.js";
import type * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";

/**
 * The FileService class provides methods for exporting the current Three.js scene in various file formats, including OBJ, GLTF, and PLY.
 */
 export class FileService {
  private SCENE: THREE.Scene | undefined;
  private JSON_SPACING: number;

  constructor() {
    this.SCENE = undefined;
    this.JSON_SPACING = 2;
  }


  /**
   * Exports the current Three.js scene as an OBJ file and triggers a download in the browser.
   */
  downloadSceneAsOBJ(): void {
    this.SCENE = getScene();
    if (this.SCENE === undefined) {return;}
    const exporter = new OBJExporter();
    const objData = exporter.parse(this.SCENE);

    const blob = new Blob([objData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "scene.obj";
    link.click();

    URL.revokeObjectURL(url);
  }


  /**
   * Exports the current Three.js scene as an GLTF file and triggers a download in the browser.
   */
  downloadSceneAsGLTF(): void {
    this.SCENE = getScene();
    if (!this.SCENE) {return;}

    const exporter = new GLTFExporter();

    exporter.parse(
      this.SCENE,
      (result) => {

        const output = result instanceof ArrayBuffer
            ? result
            : JSON.stringify(result, undefined, this.JSON_SPACING);

        const blob = new Blob([output], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const elementGltf = document.createElement("a");
        elementGltf.href = url;
        elementGltf.download = "scene.gltf";

        document.body.append(elementGltf);
        elementGltf.click();
        elementGltf.remove();

        URL.revokeObjectURL(url);
      },
      (_) => {
        // Pass
      },
      { binary: false }
    );
  }


  /**
   * Exports the current Three.js scene as an PLY file and triggers a download in the browser.
   */
  downloadSceneAsPLY(): void {
    this.SCENE = getScene();
    if (!this.SCENE) {
      return;
    }

    const exporter = new PLYExporter();

    exporter.parse(
      this.SCENE,
      (plyData) => {
        if (!plyData) {
          return;
        }
        const blob = new Blob([plyData], { type: "application/octet-stream" });
        const objectUrl = URL.createObjectURL(blob);

        const elementPly = document.createElement("a");
        elementPly.href = objectUrl;
        elementPly.download = "scene.ply";

        document.body.append(elementPly);
        elementPly.click();
        elementPly.remove();

        URL.revokeObjectURL(objectUrl);
      },
      { binary: true }
    );
  }
}
