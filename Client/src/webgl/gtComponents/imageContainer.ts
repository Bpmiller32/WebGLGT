/* -------------------------------------------------------------------------- */
/*   Handler for creating and joining clipping boxes, cropping to image box   */
/* -------------------------------------------------------------------------- */

import Emitter from "../utils/eventEmitter";
import * as THREE from "three";
import Experience from "../experience";
import ResourceLoader from "../utils/resourceLoader";
import Renderer from "../renderer";
import Camera from "../camera";
import Sizes from "../utils/sizes";
import Input from "../utils/input";
import Debug from "../utils/debug";
import Stopwatch from "../utils/stopWatch";
import { debugImageContainer } from "../utils/debug/debugImageContainer";
import GtUtils from "../utils/gtUtils";
import World from "../levels/world";

export default class ImageContainer {
  private experience!: Experience;
  private resources!: ResourceLoader;
  private renderer!: Renderer;
  private scene!: THREE.Scene;
  private camera!: Camera;
  private sizes!: Sizes;
  public input!: Input;
  private world!: World;
  public debug?: Debug;
  public isDownloadEnabled!: boolean;

  public geometry!: THREE.BoxGeometry;
  public materials!: THREE.MeshBasicMaterial[];
  public mesh?: THREE.Mesh;
  public image: any;

  private rotationSpeed!: number;
  private isRotationDisabled!: boolean;
  private lerpFactor!: number;
  public targetRotation!: THREE.Vector2;

  public imageRotation!: number;
  public stopwatch!: Stopwatch;
  public imageDownloadCount!: number;

  public selectionGroupsUsed: boolean[] = [false, false, false];

  constructor() {
    // Init
    this.initializeFields();

    // Events
    Emitter.on("stitchBoxes", () => {
      this.isRotationDisabled = true;
    });
    Emitter.on("screenshotImage", () => {
      this.screenshotImage();
    });
    Emitter.on("resetImage", () => {
      this.resetImage();
      this.isRotationDisabled = false;
    });
    Emitter.on("mouseMove", (event) => {
      // TODO: debug
      this.mouseMove(event);
    });
    Emitter.on("lockPointer", (event) => {
      this.lockPointer(event);
    });

    // Debug
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      debugImageContainer(this);
    }
  }
  private initializeFields() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.renderer = this.experience.renderer;
    this.resources = this.experience.resources;
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;
    this.sizes = this.experience.sizes;
    this.world = this.experience.world;
    this.input = this.experience.input;

    this.isDownloadEnabled = false;

    // Class fields
    this.rotationSpeed = 0.005;
    this.isRotationDisabled = false;
    this.lerpFactor = 1;
    // TODO: fix the rotation lerp on selectionGroupManager to sync with this
    // this.lerpFactor = 0.1;
    this.targetRotation = new THREE.Vector2();

    // Backend fields
    this.imageRotation = 0;
    this.stopwatch = new Stopwatch();
    this.imageDownloadCount = 0;
  }

  /* ---------------------------- Instance methods ---------------------------- */
  private setGeometry() {
    const textureAspectRatio =
      this.resources.items.apiImage.image.width /
      this.resources.items.apiImage.image.height;

    const boxDepth = 1;
    const boxHeight = 5;
    let boxWidth = 1;

    if (textureAspectRatio >= 1) {
      // Landscape or square image, width is scaled by the aspect ratio
      boxWidth = boxHeight * textureAspectRatio;
    } else {
      // Portrait image, width is scaled down for taller images
      boxWidth = boxHeight / textureAspectRatio;
    }

    this.geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  }

  private setMaterial() {
    this.materials = [
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // Right face
      new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Left face
      new THREE.MeshBasicMaterial({ color: 0x0000ff }), // Top face
      new THREE.MeshBasicMaterial({ color: 0xffff00 }), // Bottom face
      new THREE.MeshBasicMaterial({ map: this.resources.items.apiImage }), // Front face with texture
      new THREE.MeshBasicMaterial({ color: 0xffffff }), // Back face
    ];
  }

  private setMesh() {
    // Create mesh, add to scene, update matrix local position for CSG
    this.mesh = new THREE.Mesh(this.geometry, this.materials);
    this.scene.add(this.mesh);
    this.mesh.updateMatrix();

    // Fix for debug since mesh is not always set
    this.imageRotation = this.convertRotation(this.mesh.rotation.z);
  }

  /* ------------------------------ Event methods ----------------------------- */
  private async screenshotImage() {
    // Store the render's resolution
    const originalRendererSize = new THREE.Vector2();
    this.renderer.instance.getSize(originalRendererSize);

    // Calculate screenshot width and height based on renderer aspect ratio
    const desiredHeight = 1080;
    const desiredWidth = (desiredHeight * this.sizes.width) / this.sizes.height;

    // Unhide the delimiterImages if present in the frame
    this.world.delimiterImages.forEach((delimiterImage) => {
      delimiterImage.mesh!.visible = true;
    });

    // Render and take the screenshot
    this.renderer.instance.setSize(desiredWidth, desiredHeight); // Set the desired resolution
    this.renderer.instance.render(this.scene, this.camera.orthographicCamera);

    // Screenshot in base64
    const dataUrl = this.renderer.instance.domElement.toDataURL("image/png");
    const base64Image = dataUrl.split(",")[1]; // Remove the "data:image/png;base64," prefix

    // Download render screenshot
    this.debugDownloadImage(dataUrl);

    // Reset render to original size
    this.renderer.instance.setSize(
      originalRendererSize.width,
      originalRendererSize.height
    );

    // Rehide the delimiterImages if present in the frame
    this.world.delimiterImages.forEach((delimiterImage) => {
      delimiterImage.mesh!.visible = false;
    });

    // Send image to Google Vision at the end of the call to avoid zoom warp out effect caused by delay from response
    await this.sendImageToVisionAPI(base64Image);
  }

  private debugDownloadImage(dataUrl: string) {
    if (!this.isDownloadEnabled) {
      return;
    }

    // Debug, Automatically download the screenshot as a PNG file
    const renderScreenshotLink = document.createElement("a");
    renderScreenshotLink.id = "debugDownloadImage";
    renderScreenshotLink.href = dataUrl;
    // Specify the file name
    renderScreenshotLink.download = "renderScreenshot.png";
    // Not appending the element to the document, only creating, no need to clean up
    renderScreenshotLink.click();

    // const fullImageLink = document.createElement("a");
    // fullImageLink.id = "debugDownloadSecondImage";
    // fullImageLink.href = this.image.image.src;
    // fullImageLink.download = "originalImage.png";
    // fullImageLink.click();
  }

  private resetImage() {
    // Remove the existing mesh, recreate and add the original mesh back to the scene
    GtUtils.disposeMeshHelper(this.mesh!);
    this.mesh = new THREE.Mesh(this.geometry, this.materials);

    // Reset position and rotation before adding back to scene
    this.mesh.rotation.z = 0;
    this.targetRotation.x = 0;
    this.targetRotation.y = 0;
    this.scene.add(this.mesh);

    // Reset the camera
    this.camera.orthographicCamera.position.set(0, 0, 10);
    this.camera.targetPostion.set(0, 0, 10);
    this.camera.orthographicCamera.zoom = 1;
    this.camera.targetZoom = 1;

    // Reset the textAreas in the GUI
    this.input.dashboardTextarea0!.value = "";
    this.input.dashboardTextarea1!.value = "";
    this.input.dashboardTextarea2!.value = "";
  }

  private mouseMove(event: MouseEvent) {
    // Do not continue if not in image adjust mode or regardless if you in IAM are but pressing right click (move over rotate)
    if (
      !this.input.isShiftLeftPressed ||
      this.input.isRightClickPressed ||
      this.isRotationDisabled
    ) {
      return;
    }

    this.targetRotation.x -= event.movementY * this.rotationSpeed;
    this.targetRotation.y -= event.movementX * this.rotationSpeed;
  }

  private lockPointer(event: boolean) {
    if (event) {
      this.experience.targetElement?.requestPointerLock();
    } else {
      document.exitPointerLock();
    }
  }

  /* ----------------------------- Helper methods ----------------------------- */
  private async sendImageToVisionAPI(base64Image: string) {
    const requestBody = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    };

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.resources.apiKey}`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const result = await response.json();

      // TODO: remove after debug
      // console.log("vision result: ", result);

      // this.input.dashboardTextarea!.value =
      //   result.responses[0].fullTextAnnotation.text;

      this.separateResultByDelimiter(
        result.responses[0].fullTextAnnotation.text
      );
    } catch (error) {
      console.error("Error sending image to Vision API:", error);
    }
  }

  private separateResultByDelimiter(fullResultText: string) {
    // Define the delimiter in the image
    const delimiter = "###############";

    // Split the string into groups
    const groups = fullResultText.split(delimiter).map((group) => group.trim());

    // Reference dashboard text areas
    const dashboardTextAreas: HTMLTextAreaElement[] = [
      document.getElementById("dashboardTextarea0") as HTMLTextAreaElement,
      document.getElementById("dashboardTextarea1") as HTMLTextAreaElement,
      document.getElementById("dashboardTextarea2") as HTMLTextAreaElement,
    ];

    // Determine which groups are used
    const usedIndices = this.selectionGroupsUsed
      .map((used, index) => (used ? index : -1))
      .filter((index) => index !== -1);

    // If no selectionGroupsUsed, fill in activeSelctionGroup and return early
    if (usedIndices.length <= 0) {
      if (this.world.selectionGroupManager?.activeSelectionGroup == 0) {
        dashboardTextAreas[0].value = groups[0] ?? "";
        dashboardTextAreas[1].value = "";
        dashboardTextAreas[2].value = "";
      } else if (this.world.selectionGroupManager?.activeSelectionGroup == 1) {
        dashboardTextAreas[0].value = "";
        dashboardTextAreas[1].value = groups[0] ?? "";
        dashboardTextAreas[2].value = "";
      } else if (this.world.selectionGroupManager?.activeSelectionGroup == 2) {
        dashboardTextAreas[0].value = "";
        dashboardTextAreas[1].value = "";
        dashboardTextAreas[2].value = groups[0] ?? "";
      }

      return;
    }

    // Assign text to the corresponding text areas based on the order in usedIndices
    usedIndices.forEach((groupIndex, i) => {
      dashboardTextAreas[groupIndex].value = groups[i] ?? "";
    });

    // Clear any text areas that are not used
    dashboardTextAreas.forEach((textarea, index) => {
      if (!usedIndices.includes(index)) {
        textarea.value = "";
      }
    });
  }

  private convertRotation(rotationInRadians: number) {
    // Convert radians to degrees
    const radians = rotationInRadians;
    let degrees = radians * (180 / Math.PI);

    // Determine if the original value was negative
    const wasNegative = degrees < 0;

    // Normalize degrees to be within the range (-180, 180)
    degrees = ((((degrees + 180) % 360) + 360) % 360) - 180;

    // If the original value was negative, ensure the normalized value is negative
    if (wasNegative) {
      degrees = -Math.abs(degrees);
    }

    return degrees;
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public setNewImage() {
    this.image = this.resources.items.apiImage;

    this.setGeometry();
    this.setMaterial();
    this.setMesh();

    this.imageDownloadCount++;

    this.stopwatch.reset();
    this.stopwatch.start();

    this.input.dashboardTextarea0!.value = "";
    this.input.dashboardTextarea1!.value = "";
    this.input.dashboardTextarea2!.value = "";

    this.isRotationDisabled = false;
  }

  public update() {
    this.stopwatch.update();

    if (!this.mesh) {
      return;
    }

    // Mouse moving on y axis
    this.mesh.rotation.z = THREE.MathUtils.lerp(
      this.mesh.rotation.z,
      this.targetRotation.y,
      this.lerpFactor
    );

    // Fix for debug since mesh isn't always set, normalize degrees to be within the range [0, 360)
    this.imageRotation = this.convertRotation(this.mesh.rotation.z);
  }

  // TODO: work on removing
  public worldToUV(
    worldCoord: THREE.Vector3,
    mesh: THREE.Mesh,
    boundingBox: THREE.Box3
  ) {
    // Step 1: Transform world coordinates to local coordinates
    const worldToLocalMatrix = new THREE.Matrix4()
      .copy(mesh.matrixWorld)
      .invert();
    const localCoord = worldCoord.clone().applyMatrix4(worldToLocalMatrix);

    // Step 2: Normalize the local coordinates to UV space (0 to 1)
    const u =
      (localCoord.x - boundingBox.min.x) /
      (boundingBox.max.x - boundingBox.min.x);
    const v =
      (localCoord.y - boundingBox.min.y) /
      (boundingBox.max.y - boundingBox.min.y);

    return new THREE.Vector2(u, v);
  }

  public destroy() {
    if (!this.mesh) {
      return;
    }

    // Mesh disposal
    GtUtils.disposeMeshHelper(this.mesh);

    // Deconstucted mesh components disposal
    this.geometry.dispose();
    GtUtils.disposeMaterialHelper(this.materials);
  }
}
