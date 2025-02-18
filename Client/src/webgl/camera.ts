/* -------------------------------------------------------------------------- */
/*             The camera and camera controls for the webgl scene             */
/* -------------------------------------------------------------------------- */

import Emitter from "./utils/eventEmitter";
import * as THREE from "three";
import Experience from "./experience";
import Sizes from "./utils/sizes";
import Time from "./utils/time";
import Input from "./utils/input";
import Debug from "./utils/debug";
import { debugCamera, debugCameraControls } from "./utils/debug/debugCamera";

// Constants for configuration
const CAMERA_DEFAULTS = {
  SENSITIVITY: {
    MOVEMENT: 0.1,
    ZOOM: 0.1,
    ROTATION: 0.03,
    TRANSLATION: 0.03,
  },
  ZOOM: {
    DEFAULT: 1,
    MIN: 0.5,
    MAX: 10,
  },
  POSITION: {
    Z: 10,
  },
} as const;

export default class Camera {
  private experience: Experience;
  private scene: THREE.Scene;
  private sizes: Sizes;
  private time: Time;
  public input: Input;
  public debug?: Debug;

  public instance!: THREE.Camera;
  public orthographicCamera!: THREE.OrthographicCamera;
  public perspectiveCamera!: THREE.PerspectiveCamera;
  public cameraType!: string;

  public targetPostion: THREE.Vector3;
  public targetZoom: number;
  private sensitivityMovement: number;
  private defaultSensitivityMovement: number;
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
    this.targetPostion = new THREE.Vector3(0, 0, CAMERA_DEFAULTS.POSITION.Z);
    this.targetZoom = CAMERA_DEFAULTS.ZOOM.DEFAULT;
    this.sensitivityMovement = CAMERA_DEFAULTS.SENSITIVITY.MOVEMENT;
    this.defaultSensitivityMovement = CAMERA_DEFAULTS.SENSITIVITY.MOVEMENT;
    this.sensitivityZoom = CAMERA_DEFAULTS.SENSITIVITY.ZOOM;
    this.maximumZoomLevel = CAMERA_DEFAULTS.ZOOM.MAX;
    this.cameraType = "orthographic";

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

    this.initializeCameras();
  }

  /* ---------------------- Instance methods and controls --------------------- */
  private initializeCameras() {
    this.setOrthographicInstance();
    this.instance = this.orthographicCamera;

    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      this.setPerspectiveInstance();
      debugCamera(this);
    }
  }

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

  /* ------------------------------ Event methods ----------------------------- */
  private mouseDown(event: MouseEvent) {
    if (event.button !== 2) {
      return;
    }

    this.input.isRightClickPressed = true;
  }

  private mouseMove(event: MouseEvent): void {
    // Prevent camera movement if right click is not pressed
    if (!this.input.isRightClickPressed) {
      return;
    }

    // Calculate the movement delta based on the mouse movement and sensitivity
    const deltaMove = new THREE.Vector2(event.movementX, event.movementY);
    const delta = this.time.delta;

    // Update the target position based on the movement delta
    this.targetPostion.x -= deltaMove.x * delta;
    this.targetPostion.y += deltaMove.y * delta;
  }

  private mouseUp(event: MouseEvent) {
    if (event.button === 2 && this.input.isRightClickPressed) {
      this.input.isRightClickPressed = false;
    }
  }

  private mouseWheel(event: WheelEvent): void {
    // Prevent zooming in/out on text areas
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Calculate new zoom level based on mouse wheel movement and sensitivity
    const newZoom =
      this.targetZoom + event.deltaY * -this.sensitivityZoom * this.time.delta;

    // Clamp the new zoom level to the minimum and maximum zoom levels
    this.targetZoom = THREE.MathUtils.clamp(
      newZoom,
      CAMERA_DEFAULTS.ZOOM.MIN,
      CAMERA_DEFAULTS.ZOOM.MAX
    );
  }

  public switchCamera(): void {
    // Only allow camera switch if debug is active
    if (!this.experience.debug?.isActive) {
      return;
    }

    // If instance is Orthographic => switch to Perspective, else vice versa
    const newType =
      this.instance instanceof THREE.OrthographicCamera
        ? "perspective"
        : "orthographic";

    this.instance =
      newType === "perspective"
        ? this.perspectiveCamera
        : this.orthographicCamera;

    // Update cameraType string
    this.cameraType = newType;
  }

  /* ------------------------------ Tick methods ------------------------------ */
  // Methods to temporarily adjust movement sensitivity
  public setTemporarySensitivity(sensitivity: number) {
    this.defaultSensitivityMovement = this.sensitivityMovement;
    this.sensitivityMovement = sensitivity;
  }

  public restoreDefaultSensitivity() {
    this.sensitivityMovement = this.defaultSensitivityMovement;
  }

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
    // Debug controls only
    if (!(this.instance instanceof THREE.OrthographicCamera)) {
      debugCameraControls(this);
      return;
    }

    // Camera position update
    this.instance.position.lerp(this.targetPostion, this.sensitivityMovement);

    // Camera zoom update
    this.instance.zoom +=
      (this.targetZoom - this.instance.zoom) * this.sensitivityZoom;

    // Called to make zoom work, updates the projection matrix after frustum changes
    this.instance.updateProjectionMatrix();
  }

  public destroy(): void {
    // Remove event listeners
    Emitter.off("mouseDown");
    Emitter.off("mouseMove");
    Emitter.off("mouseUp");
    Emitter.off("mouseWheel");
    Emitter.off("switchCamera");

    // Remove cameras from the scene
    if (this.orthographicCamera) {
      this.scene.remove(this.orthographicCamera);
    }
    if (this.perspectiveCamera) {
      this.scene.remove(this.perspectiveCamera);
    }
  }
}
