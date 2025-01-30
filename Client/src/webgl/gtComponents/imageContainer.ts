/* -------------------------------------------------------------------------- */
/*   Handler for creating and joining clipping boxes, cropping to image box   */
/* -------------------------------------------------------------------------- */

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
import ApiHandler from "../../apiHandler";

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
  public isScreenshotDownloadEnabled!: boolean;
  public isOriginalDownloadEnabled!: boolean;

  public geometry!: THREE.BoxGeometry;
  public materials!: THREE.MeshBasicMaterial[];
  public mesh?: THREE.Mesh;
  public image: any;

  private rotationSpeed!: number;
  public isRotationDisabled!: boolean;
  private lerpFactor!: number;
  public targetRotation!: THREE.Vector2;

  public imageRotation!: number;
  public stopwatch!: Stopwatch;
  public imageDownloadCount!: number;

  public selectionGroupsUsed!: boolean[];

  constructor() {
    // Init
    this.initializeFields();

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

    // Class fields
    this.isScreenshotDownloadEnabled = false;
    this.isOriginalDownloadEnabled = false;

    this.rotationSpeed = 0.005;
    this.isRotationDisabled = false;
    this.lerpFactor = 1;
    this.targetRotation = new THREE.Vector2();

    this.selectionGroupsUsed = [false, false, false];

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
    let boxHeight = 5;
    let boxWidth = 5;

    if (textureAspectRatio >= 1) {
      // Landscape or square image, width is scaled by the aspect ratio
      boxHeight = boxWidth / textureAspectRatio;
    } else {
      // Portrait image, width is scaled down for taller images
      boxWidth = boxHeight * textureAspectRatio;
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
  public screenshotImage() {
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
    this.sendImageToVisionAPI(base64Image);
  }

  private debugDownloadImage(dataUrl: string) {
    if (this.isScreenshotDownloadEnabled) {
      // Debug, Automatically download the screenshot as a PNG file
      const renderScreenshotLink = document.createElement("a");
      renderScreenshotLink.id = "debugDownloadImageScreenshot";
      renderScreenshotLink.href = dataUrl;
      // Specify the file name
      renderScreenshotLink.download = "renderScreenshot.png";
      // Not appending the element to the document, only creating, no need to clean up
      renderScreenshotLink.click();

      // Wait a second before creating next link, simple workaround
      setTimeout(() => {}, 1000);
    }

    if (this.isOriginalDownloadEnabled && this.resources.currentImageBlob) {
      // Create new blob URL for download
      const url = URL.createObjectURL(this.resources.currentImageBlob);
      const fullImageLink = document.createElement("a");
      fullImageLink.id = "debugDownloadImageOriginal";
      fullImageLink.href = url;
      fullImageLink.download = "originalImage.jpg";
      fullImageLink.click();
    }
  }

  public resetImage() {
    // Remove the existing mesh, recreate and add the original mesh back to the scene
    GtUtils.disposeMeshHelper(this.mesh!);
    this.mesh = new THREE.Mesh(this.geometry, this.materials);

    // // Reset position and rotation before adding back to scene
    // this.mesh.rotation.z = 0;
    // this.targetRotation.x = 0;
    // this.targetRotation.y = 0;
    this.scene.add(this.mesh);

    // // Reset the camera
    // this.camera.orthographicCamera.position.set(0, 0, 10);
    // this.camera.targetPostion.set(0, 0, 10);
    // this.camera.orthographicCamera.zoom = 1;
    // this.camera.targetZoom = 1;

    // Reset the textAreas in the GUI
    this.input.dashboardTextarea0!.value = "";
    this.input.dashboardTextarea1!.value = "";
    this.input.dashboardTextarea2!.value = "";
  }

  public mouseMove(event: MouseEvent) {
    // Do not continue if not in image adjust mode or regardless if you in IAM are but pressing right click (move over rotate)
    if (
      !this.input.isKeyPressed("ShiftLeft") ||
      this.input.isRightClickPressed ||
      this.isRotationDisabled
    ) {
      return;
    }

    this.targetRotation.x -= event.movementY * this.rotationSpeed;
    this.targetRotation.y -= event.movementX * this.rotationSpeed;
  }

  public lockPointer(event: boolean) {
    if (event) {
      this.experience.targetElement?.requestPointerLock();
    } else {
      document.exitPointerLock();
    }
  }

  /* ----------------------------- Helper methods ----------------------------- */
  private async sendImageToVisionAPI(base64Image: string) {
    const fullResultText = await ApiHandler.sendToVisionAPI(
      this.resources.apiKey,
      base64Image
    );

    // Check if result has responses to use, response could come back empty - this is handled in ApiHandler
    if (!fullResultText) {
      return;
    }

    this.separateResultByDelimiter(fullResultText);
  }

  private separateResultByDelimiter(fullResultText: string) {
    // Define the delimiter in the image
    const delimiter = "#####";

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
  public setNewImage(resetGui: boolean = true) {
    // Clean up previous image's object URL if it exists
    if (this.resources.currentImageUrl) {
      URL.revokeObjectURL(this.resources.currentImageUrl);
      this.resources.currentImageUrl = undefined;
    }

    this.image = this.resources.items.apiImage;

    this.setGeometry();
    this.setMaterial();
    this.setMesh();

    this.imageDownloadCount++;

    this.stopwatch.reset();
    this.stopwatch.start();

    if (resetGui) {
      this.input.dashboardTextarea0!.value = "";
      this.input.dashboardTextarea1!.value = "";
      this.input.dashboardTextarea2!.value = "";
    }

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

  public worldToUV(
    worldCoord: THREE.Vector3,
    mesh: THREE.Mesh,
    boundingBox: THREE.Box3
  ) {
    // Transform world coordinates to local coordinates
    const worldToLocalMatrix = new THREE.Matrix4()
      .copy(mesh.matrixWorld)
      .invert();
    const localCoord = worldCoord.clone().applyMatrix4(worldToLocalMatrix);

    // Normalize the local coordinates to UV space (0 to 1)
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

    // Clean up any remaining object URL
    if (this.resources.currentImageUrl) {
      URL.revokeObjectURL(this.resources.currentImageUrl);
      this.resources.currentImageUrl = undefined;
    }

    // Mesh disposal
    GtUtils.disposeMeshHelper(this.mesh);

    // Deconstucted mesh components disposal
    this.geometry.dispose();
    GtUtils.disposeMaterialHelper(this.materials);
  }
}
