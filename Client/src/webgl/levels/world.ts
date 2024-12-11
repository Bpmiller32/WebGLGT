/* -------------------------------------------------------------------------- */
/*         The "World" in which all resources for the webgl scene live        */
/* -------------------------------------------------------------------------- */

import Emitter from "../utils/eventEmitter.ts";
import * as THREE from "three";
import Experience from "../experience.ts";
import Camera from "../camera.ts";
import Debug from "../utils/debug.ts";
import ClipBox from "../gtComponents/clipBox.ts";
import ImageBox from "../gtComponents/imageBox.ts";
import { debugWorld, debugWorldUpdate } from "../utils/debug/debugWorld.ts";

export default class World {
  public experience: Experience;
  public camera: Camera;
  public scene: THREE.Scene;
  public debug?: Debug;
  public renderObjectCount: number;

  public imageBoxHandler?: ImageBox;
  public clipBoxHandler?: ClipBox;

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.camera = this.experience.camera;
    this.scene = this.experience.scene;
    this.renderObjectCount = 0;

    // Events
    Emitter.on("appReady", () => {
      this.imageBoxHandler = new ImageBox();
      this.clipBoxHandler = new ClipBox();
    });

    Emitter.on("loadedFromApi", () => {
      this.imageBoxHandler?.destroy();
      this.imageBoxHandler?.setNewImage();

      this.clipBoxHandler?.destroy();
      this.clipBoxHandler?.setVisualCueMesh();

      this.camera.targetPostion.set(0, 0, 10);
      this.camera.targetZoom = 1;
    });

    // Debug
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      debugWorld(this);
    }
  }

  public update() {
    // Run debug physics logic if needed
    if (this.debug) {
      debugWorldUpdate(this);
    }

    this.imageBoxHandler?.update();
    this.clipBoxHandler?.update();
  }

  public destroy() {
    this.imageBoxHandler?.destroy();
    this.clipBoxHandler?.destroy();
  }
}
