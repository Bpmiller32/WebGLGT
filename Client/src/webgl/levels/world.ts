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
  public experience!: Experience;
  public camera!: Camera;
  public scene!: THREE.Scene;
  public debug?: Debug;
  public renderObjectCount!: number;

  public imageBox?: ImageBox;
  public clipBox?: ClipBox;

  constructor() {
    // Init
    this.initializeFields();

    // Events
    Emitter.on("appReady", () => {
      this.imageBox = new ImageBox();
      this.clipBox = new ClipBox();
    });

    Emitter.on("loadedFromApi", () => {
      this.imageBox?.destroy();
      this.imageBox?.setNewImage();

      this.clipBox?.destroyVisualCueMesh();
      this.clipBox?.destroy();
      this.clipBox?.setVisualCueMesh();

      this.camera.targetPostion.set(0, 0, 10);
      this.camera.targetZoom = 1;
    });

    // Debug
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      debugWorld(this);
    }
  }

  private initializeFields() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.camera = this.experience.camera;
    this.scene = this.experience.scene;

    // Class fields
    this.renderObjectCount = 0;
  }

  public update() {
    // Run debug physics logic if needed
    if (this.debug) {
      debugWorldUpdate(this);
    }

    this.imageBox?.update();
    this.clipBox?.update();
  }

  public destroy() {
    this.imageBox?.destroy();
    this.clipBox?.destroy();
  }
}
