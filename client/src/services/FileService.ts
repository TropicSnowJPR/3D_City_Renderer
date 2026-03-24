import { getScene } from "../core/App.js";
import { ConfigService } from "../services/ConfigService.js";
import type * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";

export class FileService {
  private readonly CCONFIG: ConfigService;
  private SCENE: THREE.Scene | undefined;
  private JSON_SPACING: number;
  constructor() {
    this.CCONFIG = new ConfigService();
    this.SCENE = undefined;
    this.JSON_SPACING = 2;
  }

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
