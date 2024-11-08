/* -------------------------------------------------------------------------- */
/*                 The webgl renderer, its settings and events                */
/* -------------------------------------------------------------------------- */

import * as THREE from "three";
import Experience from "./experience";
import Sizes from "./utils/sizes";
import Camera from "./camera";

export default class Renderer {
  private experience: Experience;
  private canvas: HTMLElement;
  private sizes: Sizes;
  private scene: THREE.Scene;
  private camera: Camera;

  public instance!: THREE.WebGLRenderer;

  constructor() {
    this.experience = Experience.getInstance();
    this.canvas = this.experience.targetElement as HTMLElement;
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;

    this.setInstance();
    this.resize();
  }

  private setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });

    this.instance.setClearColor("#211d20");
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  public resize() {
    this.instance?.setSize(this.sizes.width, this.sizes.height);
    this.instance?.setPixelRatio(this.sizes.pixelRatio);
  }

  public update() {
    this.instance?.render(this.scene, this.camera.instance);
  }

  public destroy() {
    this.instance?.dispose();
  }
}
