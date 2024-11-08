/* -------------------------------------------------------------------------- */
/*   Handler for creating and joining clipping boxes, cropping to image box   */
/* -------------------------------------------------------------------------- */

import Emitter from "../../eventEmitter";
import * as THREE from "three";
import Experience from "../experience";
import Camera from "../camera";
import Sizes from "../utils/sizes";
import Time from "../utils/time";
import Input from "../utils/input";
import World from "./world";
import { CSG } from "three-csg-ts";

export default class ClipBoxHandlerTjx {
  private experience: Experience;
  private scene: THREE.Scene;
  private camera: Camera;
  private sizes: Sizes;
  private time: Time;
  private input: Input;
  private world: World;

  private hasMovedMouseOnce: boolean;
  private worldStartMousePosition: THREE.Vector3;
  private worldEndMousePosition: THREE.Vector3;
  private activeMesh: THREE.Mesh;
  private visualCueMesh: THREE.Mesh;
  private activeClipBoxGroup: number;
  private clipBoxes0: THREE.Mesh[];
  private clipBoxes1: THREE.Mesh[];
  private clipBoxes2: THREE.Mesh[];
  private boxSizeThreshold: number;

  public combinedBoundingBox: THREE.Box3;

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;
    this.time = this.experience.time;
    this.sizes = this.experience.sizes;
    this.input = this.experience.input;
    this.world = this.experience.world;

    // Class fields
    this.hasMovedMouseOnce = false;
    this.worldStartMousePosition = new THREE.Vector3();
    this.worldEndMousePosition = new THREE.Vector3();
    this.activeMesh = new THREE.Mesh();
    this.visualCueMesh = new THREE.Mesh();
    this.activeClipBoxGroup = 2;
    this.clipBoxes0 = [];
    this.clipBoxes1 = [];
    this.clipBoxes2 = [];
    this.boxSizeThreshold = 0.025;
    this.combinedBoundingBox = new THREE.Box3();

    this.setVisualCueMesh();

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
    Emitter.on("changeClipBoxGroup", (groupNumber) => {
      this.changeClipBoxGroup(groupNumber);
    });
    Emitter.on("stitchBoxes", () => {
      this.stitchBoxes();
    });
    Emitter.on("resetImage", () => {
      this.destroy();
    });
  }

  /* ------------------------------ Event methods ----------------------------- */
  private mouseDown(event: MouseEvent) {
    // Do not continue if interacting with gui/login page, are not a left click, or are in image adjust mode
    if (
      this.input.dashboardGuiGlobal?.contains(event.target as HTMLElement) ||
      this.input.loginGuiGlobal?.contains(event.target as HTMLElement) ||
      event.button !== 0 ||
      this.input.isShiftLeftPressed
    ) {
      return;
    }

    // Needed to fix bug with how browser events are fired (this.input is not readable until next tick without)
    this.input.isLeftClickPressed = true;

    // Convert the mouse position to world coordinates
    this.worldStartMousePosition = this.screenToSceneCoordinates(
      event.clientX,
      event.clientY
    );

    // Change the mesh's base color based on what clipBox group it will be placed in
    let materialColor: THREE.Color;
    switch (this.activeClipBoxGroup) {
      case 0:
        materialColor = new THREE.Color(0x00ff00);
        break;
      case 1:
        materialColor = new THREE.Color(0xff0000);
        break;
      case 2:
        materialColor = new THREE.Color(0x0000ff);
        break;

      default:
        materialColor = new THREE.Color(0xffffff);
        break;
    }

    // Create a new mesh at the starting position
    const geometry = new THREE.BoxGeometry(0, 0, 0);
    const material = new THREE.MeshBasicMaterial({
      color: this.getRandomShadeFromBaseColor(materialColor, 0.1), // Adjust '0.1' for stronger or weaker variation
      wireframe: false,
      transparent: true,
      opacity: 0.35,
    });
    this.activeMesh = new THREE.Mesh(geometry, material);

    this.activeMesh.position.set(
      this.worldStartMousePosition.x,
      this.worldStartMousePosition.y,
      5 // z-coodinate of plane to work on, ImageBox is at 0 and clipBoxes are at 5
    );
    this.scene.add(this.activeMesh);

    // Create a visual cue on click by making new mesh at the starting position, separate from the activeMesh, that is added to the scene then faded out
    this.visualCueMesh.position.set(
      this.worldStartMousePosition.x,
      this.worldStartMousePosition.y,
      5 // z-coodinate of plane to work on, ImageBox is at 0 and clipBoxes are at 5
    );

    // New method teleports the same existing mesh and updates opacity instead of creating new meshes/materials
    const visualCueMaterial = this.visualCueMesh.material as THREE.Material;
    visualCueMaterial.opacity = 0.5;
  }

  private mouseMove(event: MouseEvent) {
    // MoveEvent 1: Handle rotating of all existing clipBoxes when in move mode
    if (this.input.isShiftLeftPressed && !this.input.isRightClickPressed) {
      this.rotateAllClipBoxes(event);
      return;
    }

    // MoveEvent 2: Handle drawing of new clipBoxes
    if (this.input.isLeftClickPressed) {
      this.drawNewClipBox(event);
      return;
    }
  }

  private mouseUp(event: MouseEvent) {
    // Do not continue if interacting with gui/login page, are not a left click
    if (
      this.input.dashboardGuiGlobal?.contains(event.target as HTMLElement) ||
      this.input.loginGuiGlobal?.contains(event.target as HTMLElement) ||
      event.button !== 0
    ) {
      return;
    }

    // Reset gate for box size on starting click
    this.input.isLeftClickPressed = false;
    this.hasMovedMouseOnce = false;

    // Get the size of the activeMesh using its bounding box, if it's too small remove it from the scene
    const boundingBox = new THREE.Box3().setFromObject(this.activeMesh!);

    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // If box is too small, do not add to screen. Reduces misclicked and awkwardly placed boxes
    if (
      size.x < this.boxSizeThreshold ||
      size.y < this.boxSizeThreshold ||
      size.z < this.boxSizeThreshold
    ) {
      this.scene.remove(this.activeMesh!);
      return;
    }

    // If the activeMesh is large enough, add to the clipBoxes array here
    switch (this.activeClipBoxGroup) {
      case 0:
        this.clipBoxes0.push(this.activeMesh!);
        break;
      case 1:
        this.clipBoxes1.push(this.activeMesh!);
        break;
      case 2:
        this.clipBoxes2.push(this.activeMesh!);
        break;

      default:
        break;
    }
  }

  private changeClipBoxGroup(groupNumber: number) {
    // Change group number
    this.activeClipBoxGroup = groupNumber;

    // Change visualCue color
    const currentMaterial = this.visualCueMesh.material as THREE.Material;
    currentMaterial.dispose();

    let newMaterial: THREE.MeshBasicMaterial;
    switch (this.activeClipBoxGroup) {
      case 0:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x00ff00),
          wireframe: false,
          transparent: true,
          opacity: 0.35,
        });
        break;
      case 1:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xff0000),
          wireframe: false,
          transparent: true,
          opacity: 0.35,
        });
        break;
      case 2:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x0000ff),
          wireframe: false,
          transparent: true,
          opacity: 0.35,
        });
        break;

      default:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xffffff),
          wireframe: false,
          transparent: true,
          opacity: 0.35,
        });
        break;
    }

    this.visualCueMesh.material = newMaterial;
  }

  private stitchBoxes() {
    if (
      this.clipBoxes0.length === 0 &&
      this.clipBoxes1.length === 0 &&
      this.clipBoxes2.length === 0
    ) {
      return;
    }

    const potentialCroppedMeshes = [
      {
        clipBoxes: this.clipBoxes0,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
      {
        clipBoxes: this.clipBoxes1,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
      {
        clipBoxes: this.clipBoxes2,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
    ];

    // Filter out clipBoxGroups with no clipBoxes
    const croppedMeshes = potentialCroppedMeshes.filter(
      (mesh) => mesh.clipBoxes.length > 0
    );

    // Create a croppedMesh for each clipBoxGroup, determine it's boundingBox height
    croppedMeshes.forEach((mesh) => {
      mesh.croppedMesh = this.createCroppedMesh(mesh.clipBoxes);
      mesh.croppedMeshHeight = this.getMeshHeight(mesh.croppedMesh);
    });

    // Merge into one combined croppedMesh
    let combinedCropMesh = croppedMeshes[0].croppedMesh;
    let totalHeightToAdd = 0;

    croppedMeshes.forEach((mesh) => {
      // Update the position for each cropped mesh
      mesh.croppedMesh.position.setY(
        mesh.croppedMesh.position.y +
          totalHeightToAdd +
          mesh.croppedMeshHeight / 2
      );

      // const boundingBox = new THREE.BoxHelper(mesh.croppedMesh, 0xff0000); // Red bounding box
      // this.scene.add(boundingBox);

      // Update currentY for the next iteration
      totalHeightToAdd += mesh.croppedMeshHeight;

      // Combine the current croppedMesh into the combinedCropMesh
      mesh.croppedMesh.updateMatrix();
      combinedCropMesh = CSG.union(combinedCropMesh, mesh.croppedMesh);
    });

    // Remove the old imageBox so it doesn't overlap with the combined croppedMesh, set combined croppedMesh to imageBox
    this.scene.remove(this.world.imageBoxHandler!.mesh!);
    this.world.imageBoxHandler!.mesh = combinedCropMesh;
    this.scene.add(combinedCropMesh!);

    // Reset clipboxGroup and visual cue
    this.changeClipBoxGroup(2);
  }

  /* ----------------------------- Helper methods ----------------------------- */
  private screenToSceneCoordinates(
    mouseX: number,
    mouseY: number
  ): THREE.Vector3 {
    // Normalize mouse coordinates (-1 to 1)
    const ndcX = (mouseX / this.sizes.width) * 2 - 1;
    const ndcY = -(mouseY / this.sizes.height) * 2 + 1;

    // Create a vector in NDC space
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5); // z=0.5 to unproject at the center of the near and far planes

    // Unproject the vector to scene coordinates
    vector.unproject(this.camera.instance);

    // Adjust the z-coordinate to match the camera's z-plane
    vector.z = 5; // Set the z-coordinate to 0 or the plane you want to work on, in this case 5 since the gtImage is at z==0

    return vector;
  }

  private rotateAllClipBoxes(event: MouseEvent) {
    // Target point and axis around which the mesh will rotate
    const targetPoint = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);

    this.rotateClipBoxGroup(event, this.clipBoxes0, targetPoint, axis);
    this.rotateClipBoxGroup(event, this.clipBoxes1, targetPoint, axis);
    this.rotateClipBoxGroup(event, this.clipBoxes2, targetPoint, axis);

    this.world.imageBoxHandler!.mesh!.updateMatrix();
  }

  private rotateClipBoxGroup(
    event: MouseEvent,
    clipBoxes: THREE.Mesh[],
    targetPoint: THREE.Vector3,
    axis: THREE.Vector3
  ) {
    for (let i = 0; i < clipBoxes.length; i++) {
      // Translate object to the point
      clipBoxes[i].position.sub(targetPoint);

      // Create rotation matrix
      clipBoxes[i].position.applyAxisAngle(axis, -event.movementX * 0.005);

      // Translate back
      clipBoxes[i].position.add(targetPoint);

      // Apply rotation to the object's orientation
      clipBoxes[i].rotateOnAxis(axis, -event.movementX * 0.005);
    }
  }

  private drawNewClipBox(event: MouseEvent) {
    // Gate to add behavior of box size on starting click
    if (!this.hasMovedMouseOnce) {
      this.hasMovedMouseOnce = true;

      this.activeMesh?.geometry.dispose();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      this.activeMesh!.geometry = geometry;
    }

    // Convert the mouse position to world coordinates
    this.worldEndMousePosition = this.screenToSceneCoordinates(
      event.clientX,
      event.clientY
    );

    // Calculate the width and height based on world coordinates
    const size = new THREE.Vector3(
      Math.abs(this.worldEndMousePosition.x - this.worldStartMousePosition.x),
      Math.abs(this.worldEndMousePosition.y - this.worldStartMousePosition.y),
      // Annoying to find bugfix for CSG union later, this mesh must have depth to be 3d and intersect later....
      // Math.abs(this.worldEndMousePosition.z - this.worldStartMousePosition.z)
      2 // ImageBox is depth of 1 so this fully intersects through
    );

    // Scale the mesh
    this.activeMesh?.scale.set(size.x, size.y, size.z);

    // Reposition the mesh to stay centered between start and end points
    this.activeMesh?.position.copy(
      this.worldStartMousePosition
        .clone()
        .add(this.worldEndMousePosition)
        .divideScalar(2)
    );
  }

  private getRandomShadeFromBaseColor(baseColor: THREE.Color, variation = 0.1) {
    // Get the base green RGB values
    const r = baseColor.r + (Math.random() - 0.5) * variation;
    const g = baseColor.g + (Math.random() - 0.5) * variation;
    const b = baseColor.b + (Math.random() - 0.5) * variation;

    // Ensure RGB values are within [0, 1]
    return new THREE.Color(
      THREE.MathUtils.clamp(r, 0, 1),
      THREE.MathUtils.clamp(g, 0, 1),
      THREE.MathUtils.clamp(b, 0, 1)
    );
  }

  private createCroppedMesh(clipBoxes: THREE.Mesh[]): THREE.Mesh {
    let combinedMesh = clipBoxes[0];

    for (let i = 0; i < clipBoxes.length; i++) {
      combinedMesh = CSG.union(combinedMesh, clipBoxes[i]);

      this.scene.remove(clipBoxes[i]);
      clipBoxes[i].geometry.dispose();
    }

    // Dispose of the references in clipBoxes, add the only existing clipBox in case of further clips
    clipBoxes.length = 0;

    // Push the combinedMesh back to the same plane as the imageBox mesh, update it's local position matrix for CSG
    combinedMesh.position.z = 0;
    combinedMesh.updateMatrix();

    // Splice the new combined mesh to the imageBox mesh
    const croppedMesh = CSG.intersect(
      this.world.imageBoxHandler!.mesh!,
      combinedMesh
    );

    // Compute the bounding box of the resulting mesh
    croppedMesh.geometry.computeBoundingBox();
    const boundingBox = croppedMesh.geometry.boundingBox;

    // If the bounding box exists, calculate the center position
    if (boundingBox) {
      // Create a new vector for the center
      const center = new THREE.Vector3();

      // Transform the bounding box into world coordinates
      const worldBox = new THREE.Box3();
      worldBox.copy(boundingBox).applyMatrix4(croppedMesh.matrixWorld);

      // Get the center of the transformed bounding box
      worldBox.getCenter(center);

      // Move the mesh so its center is at the origin
      croppedMesh.position.sub(center);
    }

    return croppedMesh;
  }

  private getMeshHeight(mesh: THREE.Mesh): number {
    // Ensure the geometry's bounding box is up to date
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;

    if (boundingBox) {
      // Calculate the height by subtracting the min Y from the max Y
      return boundingBox.max.y - boundingBox.min.y;
    }

    return 0; // Return 0 if no bounding box is available (unlikely)
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public setVisualCueMesh() {
    const geometry = new THREE.SphereGeometry(0.2);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x0000ff),
      wireframe: false,
      transparent: true,
      opacity: 0.35,
    });

    this.visualCueMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.visualCueMesh);
  }

  public update() {
    const visualCueMaterial = this.visualCueMesh.material as THREE.Material;

    if (visualCueMaterial.opacity > -1) {
      this.visualCueMesh.scale.set(
        1 / this.camera.orthographicCamera.zoom,
        1 / this.camera.orthographicCamera.zoom,
        1 / this.camera.orthographicCamera.zoom
      );

      visualCueMaterial.opacity =
        visualCueMaterial.opacity - 1 * this.time.delta;
    }
  }

  public destroy() {
    // Remove activeMesh
    this.scene.remove(this.activeMesh);
    const activeMaterial = this.activeMesh.material as THREE.Material;
    activeMaterial.dispose();
    this.activeMesh.geometry.dispose();

    // Remove ActiveVisualCueMesh
    this.scene.remove(this.visualCueMesh);
    const visualCueMaterial = this.activeMesh.material as THREE.Material;
    visualCueMaterial.dispose();
    this.activeMesh.geometry.dispose();

    // Remove all clipBoxes
    const clipBoxGroups = [this.clipBoxes0, this.clipBoxes1, this.clipBoxes2];

    clipBoxGroups.forEach((clipBoxGroup) => {
      clipBoxGroup.forEach((clipBox) => {
        this.scene.remove(clipBox);
        const material = clipBox.material as THREE.Material;
        material.dispose();
        clipBox.geometry.dispose();
      });

      clipBoxGroup.length = 0;
    });
  }
}
