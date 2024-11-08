/* -------------------------------------------------------------------------- */
/*             The camera and camera controls for the webgl scene             */
/* -------------------------------------------------------------------------- */

import Emitter from "../eventEmitter";
import * as THREE from "three";
import Experience from "./experience";
import Sizes from "./utils/sizes";
import Time from "./utils/time";
import Input from "./utils/input";
import Debug from "./utils/debug";

export default class Camera {
  private experience: Experience;
  private scene: THREE.Scene;
  private sizes: Sizes;
  private time: Time;
  private input: Input;
  private debug?: Debug;

  public instance: THREE.Camera;
  public orthographicCamera!: THREE.OrthographicCamera;
  public perspectiveCamera!: THREE.PerspectiveCamera;

  public targetPostion: THREE.Vector3;
  public targetZoom: number;
  private sensitivityMovement: number;
  private sensitivityZoom: number;
  private maximumZoomLevel: number;

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.sizes = this.experience.sizes;
    this.scene = this.experience.scene;
    this.time = this.experience.time;
    this.input = this.experience.input;

    // Class fields
    this.targetPostion = new THREE.Vector3();
    this.targetZoom = 1;
    this.sensitivityMovement = 0.1;
    this.sensitivityZoom = 0.1;
    this.maximumZoomLevel = 10;

    this.setOrthographicInstance();
    // this.setPerspectiveInstance();

    // Default use the orthographic camera
    this.instance = this.orthographicCamera;

    // Events
    Emitter.on("mouseDown", (event) => {
      this.mouseDown(event);
    });
    Emitter.on("mouseMove", (event) => {
      this.mouseMove(event);
    });
    Emitter.on("mouseUp", (event) => {
      this.mouseUp(event);
    });
    Emitter.on("mouseWheel", (event) => {
      this.mouseWheel(event);
    });
    Emitter.on("switchCamera", () => {
      this.switchCamera();
    });

    // Debug GUI
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;

      this.setPerspectiveInstance();

      const cameraDebug = this.debug.ui?.addFolder("cameraDebug");
      cameraDebug?.open();
      cameraDebug
        ?.add(this.instance.position, "x")
        .name("xPosition")
        .step(0.01)
        .listen();
      cameraDebug
        ?.add(this.instance.position, "y")
        .step(0.01)
        .name("yPosition")
        .listen();
      cameraDebug
        ?.add(this.instance.position, "z")
        .name("zPosition")
        .step(0.01)
        .listen();
      if (this.instance instanceof THREE.OrthographicCamera) {
        cameraDebug
          ?.add(this.instance, "zoom")
          .name("zoom")
          .step(0.01)
          .listen();
      }
    }
  }
  /* ---------------------- Instance methods and controls --------------------- */
  private setOrthographicInstance() {
    const aspectRatio = this.sizes.width / this.sizes.height;
    const frustumSize = this.maximumZoomLevel;

    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspectRatio) / 2, // left
      (frustumSize * aspectRatio) / 2, // right
      frustumSize / 2, // top
      -frustumSize / 2, // bottom
      0.1, // near
      500 // far
    );

    // Set initial camera position, initialize targetPosition to the same initial position as the camera
    this.orthographicCamera.position.z = 10;
    this.targetPostion.z = 10;

    this.scene.add(this.orthographicCamera);
  }

  private setPerspectiveInstance() {
    this.perspectiveCamera = new THREE.PerspectiveCamera(
      35,
      this.sizes.width / this.sizes.height,
      0.1,
      500
    );

    this.perspectiveCamera.position.z = 10;
    this.scene.add(this.perspectiveCamera);
  }

  private debugCameraControls() {
    // Move forward/back
    if (this.input.isWKeyPressed) {
      this.instance.translateZ(-0.03);
    }
    if (this.input.isSKeyPressed) {
      this.instance.translateZ(0.03);
    }

    // Strafe left/right
    if (this.input.isAKeyPressed) {
      this.instance.translateX(-0.03);
    }
    if (this.input.isDKeyPressed) {
      this.instance.translateX(0.03);
    }

    // Rotate left/right
    if (this.input.isQKeyPressed) {
      this.instance.rotation.y += 0.03;
    }
    if (this.input.isEKeyPressed) {
      this.instance.rotation.y -= 0.03;
    }

    // Height
    if (this.input.isSpacePressed) {
      this.instance.translateY(0.03);
    }
    if (this.input.isControlLeftPressed) {
      this.instance.translateY(-0.03);
    }
  }

  /* ------------------------------ Event methods ----------------------------- */
  private mouseDown(event: MouseEvent) {
    if (event.button !== 2) {
      return;
    }

    this.input.isRightClickPressed = true;
  }

  private mouseMove(event: MouseEvent) {
    if (!this.input.isRightClickPressed) {
      return;
    }

    const deltaMove = new THREE.Vector2(event.movementX, event.movementY);

    // Move the camera in the opposite direction of the drag
    this.targetPostion.x -= deltaMove.x * this.time.delta;
    this.targetPostion.y += deltaMove.y * this.time.delta;
  }

  private mouseUp(event: MouseEvent) {
    if (event.button === 2 && this.input.isRightClickPressed) {
      this.input.isRightClickPressed = false;
    }
  }

  private mouseWheel(event: WheelEvent) {
    // Zoom in and out
    this.targetZoom += event.deltaY * -this.sensitivityZoom * this.time.delta;
    // Clamp the zoom level to prevent inverting the view or zooming too far out
    this.targetZoom = Math.max(
      0.5,
      Math.min(this.maximumZoomLevel, this.targetZoom)
    );
  }

  private switchCamera() {
    if (!this.experience.debug?.isActive) {
      return;
    }

    if (this.instance instanceof THREE.OrthographicCamera) {
      this.instance = this.perspectiveCamera;
    } else {
      this.instance = this.orthographicCamera;
    }
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public resize() {
    // Needed for both cameras
    const aspectRatio = this.sizes.width / this.sizes.height;

    // Orthographic camera
    if (this.instance instanceof THREE.OrthographicCamera) {
      const frustumSize = 10;

      this.instance.left = (-frustumSize * aspectRatio) / 2;
      this.instance.right = (frustumSize * aspectRatio) / 2;
      this.instance.top = frustumSize / 2;
      this.instance.bottom = -frustumSize / 2;

      this.instance.updateProjectionMatrix();
      return;
    }

    // Debug perspective camera
    if (this.instance instanceof THREE.PerspectiveCamera) {
      this.instance.updateProjectionMatrix();
      return;
    }
  }

  public update() {
    if (!(this.instance instanceof THREE.OrthographicCamera)) {
      this.debugCameraControls();

      return;
    }

    // Camera position update
    this.instance.position.lerp(this.targetPostion, this.sensitivityMovement);

    // Camera zoom update
    this.instance.zoom +=
      (this.targetZoom - this.instance.zoom) * this.sensitivityZoom;

    // Called to make zoom work
    this.instance.updateProjectionMatrix();
  }

  public destroy() {
    this.scene.remove(this.instance);
  }
}
