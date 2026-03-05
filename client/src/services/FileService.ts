import type * as THREE from "three";
import { ConfigService } from "../services/ConfigService.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import { REQUESTED_DATA } from "../core/App.js";

export class FileService {
  private readonly CCONFIG: ConfigService;
  private readonly SCENE: THREE.Scene;
  constructor(SCENE: THREE.Scene) {
    this.CCONFIG = new ConfigService();
    this.SCENE = SCENE;
  }

  downloadSceneAsOBJ(): void {
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
    const exporter = new GLTFExporter();

    exporter.parse(
      this.SCENE,
      (result) => {
        const json = JSON.stringify(result, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const elementGltf = document.createElement("a");
        elementGltf.href = url;
        elementGltf.download = "scene.gltf";
        elementGltf.click();

        URL.revokeObjectURL(url);

      },
      // oxlint-disable-next-line typescript/ban-ts-comment
      //@ts-expect-error
      { binary: false }
    );
  }

  downloadSceneAsPLY(): void {
    const exporter = new PLYExporter();

    //@ts-expect-error
    const plyData = exporter.parse(this.SCENE, { binary: true });
    if (!plyData) {
      return;
    }
    const blob = new Blob([plyData], { type: "application/octet-stream" });

    const elementPly = document.createElement("a");
    elementPly.href = URL.createObjectURL(blob);
    elementPly.download = "scene.ply";
    elementPly.click();

    URL.revokeObjectURL(URL.createObjectURL(blob));
  }

  downloadSceneAsJSON(): void {
    const jsonString = JSON.stringify(REQUESTED_DATA, null, 2);

    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "scene.json";
    a.click();

    URL.revokeObjectURL(url);
  }
}
