/* -------------------------------------------------------------------------- */
/*         The "World" in which all resources for the webgl scene live        */
/* -------------------------------------------------------------------------- */

import Emitter from "../utils/eventEmitter.ts";
import * as THREE from "three";
import Experience from "../experience.ts";
import Camera from "../camera.ts";
import Debug from "../utils/debug.ts";
import SelectionGroupManager from "../gtComponents/selectionGroupManager.ts";
import ImageContainer from "../gtComponents/imageContainer.ts";
import { debugWorld, debugWorldUpdate } from "../utils/debug/debugWorld.ts";
import DelimiterImage from "../gtComponents/delimiterImage.ts";

export default class World {
  public experience!: Experience;
  public camera!: Camera;
  public scene!: THREE.Scene;
  public debug?: Debug;
  public renderObjectCount!: number;

  public imageContainer?: ImageContainer;
  public selectionGroupManager?: SelectionGroupManager;
  public delimiterImages!: DelimiterImage[];

  constructor() {
    // Init
    this.initializeFields();

    // Events
    Emitter.on("appReady", () => {
      this.imageContainer = new ImageContainer();
      this.selectionGroupManager = new SelectionGroupManager();
    });

    Emitter.on("loadedFromFile", () => {
      this.delimiterImages.push(new DelimiterImage());
      this.delimiterImages.push(new DelimiterImage());
    });

    Emitter.on("loadedFromApi", () => {
      this.imageContainer?.destroy();
      this.imageContainer?.setNewImage();

      this.selectionGroupManager?.destroyVisualCueMesh();
      this.selectionGroupManager?.destroy();
      this.selectionGroupManager?.setVisualCueMesh();

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
    this.delimiterImages = [];
  }

  public update() {
    // Run debug physics logic if needed
    if (this.debug) {
      debugWorldUpdate(this);
    }

    this.imageContainer?.update();
    this.selectionGroupManager?.update();
  }

  public destroy() {
    this.imageContainer?.destroy();
    this.selectionGroupManager?.destroy();
    this.delimiterImages.forEach((delimiterImage) => {
      delimiterImage.destroy();
    });
  }
}
