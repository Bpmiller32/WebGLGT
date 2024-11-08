/* -------------------------------------------------------------------------- */
/*         The "World" in which all resources for the webgl scene live        */
/* -------------------------------------------------------------------------- */

import Emitter from "../../eventEmitter.ts";
import * as THREE from "three";
import Experience from "../experience";
import Camera from "../camera.ts";
import Debug from "../utils/debug.ts";
// import ClipBoxHandler from "./clipBoxHandler.ts";
import ClipBoxHandlerTjx from "./clipBoxHandlerTjx.ts";
// import ImageBoxHandler from "./imageBoxHandler.ts";
import ImageBoxHandlerTjx from "./imageBoxHandlerTjx.ts";

export default class World {
  private experience: Experience;
  private camera: Camera;
  private scene: THREE.Scene;
  private debug?: Debug;

  public imageBoxHandler?: ImageBoxHandlerTjx;
  public clipBoxHandler?: ClipBoxHandlerTjx;

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.camera = this.experience.camera;
    this.scene = this.experience.scene;

    // Events
    Emitter.on("appReady", () => {
      this.imageBoxHandler = new ImageBoxHandlerTjx();
      this.clipBoxHandler = new ClipBoxHandlerTjx();
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

      const worldDebug = this.debug.ui?.addFolder("worldDebug");
      worldDebug?.open();
      worldDebug
        ?.add(this.scene.children, "length")
        .name("# of scene children")
        .listen();
      worldDebug
        ?.add(this.experience.sizes, "width")
        .name("renderer width")
        .listen();
      worldDebug
        ?.add(this.experience.sizes, "height")
        .name("renderer height")
        .listen();
    }
  }

  public update() {
    this.camera.update();
    this.imageBoxHandler?.update();
    this.clipBoxHandler?.update();
  }

  public destroy() {
    this.camera.destroy();
    this.imageBoxHandler?.destroy();
    this.clipBoxHandler?.destroy();
  }
}
