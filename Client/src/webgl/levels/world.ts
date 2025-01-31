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
import VisualCueManager from "../gtComponents/visualCueManager.ts";
import GridImage from "../gtComponents/gridImage.ts";

export default class World {
  public experience: Experience;
  public camera: Camera;
  public scene: THREE.Scene;
  public debug?: Debug;
  public renderObjectCount: number;

  public imageContainer?: ImageContainer;
  public selectionGroupManager?: SelectionGroupManager;
  public visualCueManager?: VisualCueManager;
  public delimiterImages: DelimiterImage[];
  public gridImage: GridImage[];

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.camera = this.experience.camera;
    this.scene = this.experience.scene;

    // Class fields
    this.renderObjectCount = 0;
    this.delimiterImages = [];
    this.gridImage = [];

    // Events
    Emitter.on("appReady", () => {
      this.imageContainer = new ImageContainer();
      this.selectionGroupManager = new SelectionGroupManager();
      this.visualCueManager = new VisualCueManager();
    });

    Emitter.on("loadedFromFile", () => {
      this.delimiterImages.push(new DelimiterImage());
      this.delimiterImages.push(new DelimiterImage());

      this.gridImage.push(new GridImage());
      if (this.gridImage[0].mesh) {
        this.camera.instance.add(this.gridImage[0].mesh);
        this.gridImage[0].mesh.position.set(0, 0, -1);
      }
    });

    Emitter.on("toggleGrid", () => {
      if (this.gridImage[0].isVisible) {
        this.gridImage[0]?.hide();
      } else {
        this.gridImage[0]?.show();
      }

      this.gridImage[0].isVisible = !this.gridImage[0].isVisible;
    });

    Emitter.on("mouseDown", (event: MouseEvent) => {
      this.selectionGroupManager?.mouseDown(event);
      this.visualCueManager?.setPositionAndShow(event);
    });

    Emitter.on("mouseMove", (event: MouseEvent) => {
      this.imageContainer?.mouseMove(event);
      this.selectionGroupManager?.mouseMove(event);
    });

    Emitter.on("mouseUp", (event: MouseEvent) => {
      this.selectionGroupManager?.mouseUp(event);
    });

    Emitter.on(
      "loadedFromApi",
      (event: { resetGui: boolean; rotation?: number }) => {
        this.imageContainer?.destroy();
        this.imageContainer?.setNewImage(event.resetGui);

        this.selectionGroupManager?.destroy();

        this.visualCueManager?.destroy();
        this.visualCueManager?.createVisualCueMesh();

        this.camera.targetPostion.set(0, 0, 10);
        this.camera.targetZoom = 1;

        this.delimiterImages.forEach((delimiterImage) => {
          delimiterImage.resetPosition();
        });
      }
    );

    Emitter.on("changeSelectionGroup", (groupNumber) => {
      this.visualCueManager?.changeColor(groupNumber);
      this.selectionGroupManager?.changeSelectionGroup(groupNumber);
    });

    Emitter.on("stitchBoxes", () => {
      this.selectionGroupManager?.stitchBoxes();

      // TODO: messy, probably should go somewhere else
      if (
        this.selectionGroupManager!.areSelectionGroupsJoined &&
        this.selectionGroupManager!.preStitchState
      ) {
        this.imageContainer!.isRotationDisabled = true;
        return;
      }

      this.imageContainer!.isRotationDisabled = false;
    });

    Emitter.on("resetImage", () => {
      this.imageContainer?.resetImage();
      this.imageContainer!.isRotationDisabled = false;

      this.selectionGroupManager?.destroy();

      this.visualCueManager?.changeColor(0);

      this.delimiterImages.forEach((delimiterImage) => {
        delimiterImage.resetPosition();
      });
    });
    Emitter.on("screenshotImage", () => {
      this.imageContainer?.screenshotImage();
    });

    Emitter.on("lockPointer", (event) => {
      this.imageContainer?.lockPointer(event);
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

    this.imageContainer?.update();
    this.visualCueManager?.update();
  }

  public destroy() {
    this.imageContainer?.destroy();
    this.selectionGroupManager?.destroy();
    this.visualCueManager?.destroy();
    this.delimiterImages.forEach((delimiterImage) => {
      delimiterImage.destroy();
    });
    this.gridImage.forEach((gridImage) => {
      if (gridImage.mesh) {
        this.camera.instance.remove(gridImage.mesh);
      }
      gridImage.destroy();
    });
  }
}
