/* -------------------------------------------------------------------------- */
/*     Overall handler that mounts a webgl render to a dom canvas element     */
/* -------------------------------------------------------------------------- */

import Emitter from "../eventEmitter";
import * as THREE from "three";
import Sizes from "./utils/sizes";
import Time from "./utils/time";
import Input from "./utils/input";
import ResourceLoader from "./utils/resourceLoader";
import Camera from "./camera";
import Renderer from "./renderer";
import World from "./levels/world";
import Debug from "./utils/debug";

export default class Experience {
  // Class prop instance and "new" blocking constructor for Singleton
  private static instance: Experience;
  private constructor() {}

  public debug?: Debug;
  public sizes!: Sizes;
  public time!: Time;
  public input!: Input;
  public resources!: ResourceLoader;

  public targetElement!: HTMLCanvasElement | null;

  public scene!: THREE.Scene;
  public camera!: Camera;
  public renderer!: Renderer;
  public world!: World;

  // Singleton check/constructor
  public static getInstance(): Experience {
    if (!Experience.instance) {
      Experience.instance = new Experience();
    }
    return Experience.instance;
  }

  // Replacement public constructor
  public async configure(canvas: HTMLCanvasElement | null) {
    // Class fields
    this.debug = new Debug();
    this.sizes = new Sizes();
    this.time = new Time();
    this.input = new Input();
    this.resources = new ResourceLoader();

    this.targetElement = canvas;

    this.scene = new THREE.Scene();
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.world = new World();

    // Sizes resize event
    Emitter.on("resize", () => {
      this.camera.resize();
      this.renderer.resize();
    });

    // Time tick event
    Emitter.on("tick", () => {
      if (this.debug?.isActive) {
        this.debug.stats?.begin();
      }

      this.camera.update();
      this.renderer.update();
      this.world.update();

      if (this.debug?.isActive) {
        this.debug.stats?.end();
      }
    });
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public destroy() {
    // Clear event listeners
    this.sizes.destroy();
    this.time.destroy();
    this.input.destroy();

    // Scene items first
    this.world.destroy();

    // Camera then physics then renderer then resources
    this.camera.destroy();
    this.renderer.destroy();
    this.resources.destroy();

    // Debug menu
    if (this.debug && this.debug.isActive) {
      this.debug.destroy();
    }
  }
}
