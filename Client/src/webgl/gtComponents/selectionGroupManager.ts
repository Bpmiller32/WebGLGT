/* -------------------------------------------------------------------------- */
/*          Handler for creating, joining, managing selection groups          */
/* -------------------------------------------------------------------------- */

import * as THREE from "three";
import Experience from "../experience";
import Camera from "../camera";
import Input from "../utils/input";
import World from "../levels/world";
import { CSG } from "three-csg-ts";
import Debug from "../utils/debug";
import { debugSelectionGroupManager } from "../utils/debug/debugClipBox";
import GtUtils from "../utils/gtUtils";

export default class SelectionGroupManager {
  private experience!: Experience;
  private scene!: THREE.Scene;
  private camera!: Camera;
  private input!: Input;
  private world!: World;
  public debug?: Debug;

  private hasMovedMouseOnce!: boolean;
  private worldStartMousePosition!: THREE.Vector3;
  private worldEndMousePosition!: THREE.Vector3;

  private activeMesh!: THREE.Mesh | null;

  public activeSelectionGroup!: number;
  public selectionGroup0!: THREE.Mesh[];
  public selectionGroup1!: THREE.Mesh[];
  public selectionGroup2!: THREE.Mesh[];
  private boxSizeThreshold!: number;

  public combinedBoundingBox!: THREE.Box3;
  public areSelectionGroupsJoined!: boolean;

  public selectionGroupPixelCoordinates0!: THREE.Vector2[];
  public selectionGroupPixelCoordinates1!: THREE.Vector2[];
  public selectionGroupPixelCoordinates2!: THREE.Vector2[];

  // Configuration
  private readonly defaultOpacity: number = 0.35;
  private readonly selectionZPosition: number = 5;
  // Padding between delimiter and cropped meshes, helps/fixes issue where text is skewed and Google Vision also skews delimiter text - breaking group delimiting
  private readonly delimiterPadding: number = 0.1;
  private selectionGroupsColorMap: { [key: number]: number } = {
    0: 0x00ff00,
    1: 0xff0000,
    2: 0x0000ff,
  };

  constructor() {
    // Init
    this.initializeFields();

    // Debug
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      debugSelectionGroupManager(this);
    }
  }

  private initializeFields() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;
    this.input = this.experience.input;
    this.world = this.experience.world;

    // Class fields
    this.hasMovedMouseOnce = false;
    this.worldStartMousePosition = new THREE.Vector3();
    this.worldEndMousePosition = new THREE.Vector3();
    this.activeMesh = null;

    this.activeSelectionGroup = 0;
    this.selectionGroup0 = [];
    this.selectionGroup1 = [];
    this.selectionGroup2 = [];
    this.boxSizeThreshold = 0.025;
    this.combinedBoundingBox = new THREE.Box3();
    this.areSelectionGroupsJoined = false;

    this.selectionGroupPixelCoordinates0 = [];
    this.selectionGroupPixelCoordinates1 = [];
    this.selectionGroupPixelCoordinates2 = [];
  }

  /* ------------------------------ Event methods ----------------------------- */
  public mouseDown(event: MouseEvent): void {
    // Do not continue if interacting with gui/login page, are not a left click, are in image adjust mode, have already joined images once
    if (
      GtUtils.isInteractingWithGUI(event) ||
      event.button !== 0 ||
      this.input.isShiftLeftPressed ||
      this.areSelectionGroupsJoined
    ) {
      return;
    }

    // Needed to fix bug with how browser events are fired (this.input is not readable until next tick without)
    this.input.isLeftClickPressed = true;

    // Convert the mouse position to world coordinates
    this.worldStartMousePosition = GtUtils.screenToSceneCoordinates(
      event.clientX,
      event.clientY,
      this.selectionZPosition
    );

    // Create a new mesh
    const geometry = new THREE.BoxGeometry(0, 0, 0);
    const material = this.createSelectionBoxMaterial(
      // Change the mesh's base color based on what clipBox group it will be placed in
      this.getGroupBaseColor(this.activeSelectionGroup)
    );
    this.activeMesh = new THREE.Mesh(geometry, material);

    // Position it at mouse coordinates, add to scene
    this.activeMesh.position.set(
      this.worldStartMousePosition.x,
      this.worldStartMousePosition.y,
      this.selectionZPosition
    );
    this.scene.add(this.activeMesh);
  }

  public mouseMove(event: MouseEvent): void {
    // MoveEvent 1: Handle rotating of all existing clipBoxes when in move mode
    if (this.input.isShiftLeftPressed && !this.input.isRightClickPressed) {
      this.rotateAllSelectionGroups();
      return;
    }

    // MoveEvent 2: Handle drawing of new clipBoxes
    if (this.input.isLeftClickPressed && this.activeMesh) {
      this.drawNewSelection(event);
    }
  }

  public mouseUp(event: MouseEvent): void {
    // Do not continue if interacting with gui/login page, are not a left click
    if (
      GtUtils.isInteractingWithGUI(event) ||
      event.button !== 0 ||
      !this.activeMesh
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
    if (this.isSelectionTooSmall(size)) {
      GtUtils.disposeMeshHelper(this.activeMesh);
      return;
    }

    // If the activeMesh is large enough, add to the clipBoxes array here
    this.addActiveMeshToGroup();
  }

  public changeSelectionGroup(groupNumber: number): void {
    // Change group number
    this.activeSelectionGroup = groupNumber;
  }

  public stitchBoxes(): void {
    // Do not continue if selectionGroups are already joined or are all empty
    if (
      this.areSelectionGroupsJoined ||
      (this.selectionGroup0.length === 0 &&
        this.selectionGroup1.length === 0 &&
        this.selectionGroup2.length === 0)
    ) {
      return;
    }

    // Store the number of selectionGroupsUsed for delimiting to the right textArea
    [this.selectionGroup0, this.selectionGroup1, this.selectionGroup2].forEach(
      (group, index) => {
        this.world.imageContainer!.selectionGroupsUsed[index] =
          group.length > 0;
      }
    );

    // Create selectionGroups, filter out groups with no clipBoxes. The order of the array determines which group order when stacking
    const selectionGroups = this.getNonEmptySelectionGroups();
    if (selectionGroups.length === 0) {
      return;
    }

    // Initialize the total height to be added and the combined mesh (starting with the first mesh)
    let totalHeightToAdd = 0;
    let combinedMesh: THREE.Mesh | null = null;

    // Reverse the order of the groups, fixes a mismatch when assigning to textAreas later + better visually
    selectionGroups.reverse();

    // Stack the meshes of the groups
    for (let i = 0; i < selectionGroups.length; i++) {
      const group = selectionGroups[i];

      // Create the cropped mesh and calculate its height
      group.croppedMesh = this.createCroppedSelectionMeshFromSelectionGroup(
        group.selections
      );
      group.croppedMeshHeight = this.getMeshHeight(group.croppedMesh);

      // Update the position for each croppedMesh to stack them on top of each other
      group.croppedMesh.position.y +=
        totalHeightToAdd + group.croppedMeshHeight / 2;

      // Update total height for the next mesh
      totalHeightToAdd += group.croppedMeshHeight;

      // Combine the current mesh with the previous ones using CSG.union()
      if (!combinedMesh) {
        // If it's the first mesh, initialize the combined mesh
        combinedMesh = group.croppedMesh;
      } else {
        // Union the current mesh with the combined mesh
        combinedMesh.updateMatrix();
        group.croppedMesh.updateMatrix();
        combinedMesh = CSG.union(combinedMesh, group.croppedMesh);
      }

      // Add a DelimiterImage mesh between croppedMeshes, if applicable
      if (i < selectionGroups.length - 1) {
        const delimiterImage = this.world.delimiterImages[i];

        if (delimiterImage?.mesh) {
          // Reset scale to original size before calculating new scale
          delimiterImage.resetScale();

          // Find the largest dimensions among all croppedMeshes
          const maxDimensions = new THREE.Vector2(0, 0);
          selectionGroups.forEach((group) => {
            const bbox = new THREE.Box3().setFromObject(group.croppedMesh);
            const size = bbox.getSize(new THREE.Vector3());
            maxDimensions.x = Math.max(maxDimensions.x, size.x);
            maxDimensions.y = Math.max(maxDimensions.y, size.y);
          });

          // Calculate scale factors to match the largest dimensions while maintaining aspect ratio
          const delimiterBBox = new THREE.Box3().setFromObject(
            delimiterImage.mesh
          );
          const delimiterSize = delimiterBBox.getSize(new THREE.Vector3());
          const scaleX = maxDimensions.x / delimiterSize.x;
          const scaleY = maxDimensions.y / delimiterSize.y;
          const scale = Math.min(scaleX, scaleY);

          // Apply the scale
          delimiterImage.setScale(scale);

          // Recalculate height after scaling
          const newDelimiterHeight = delimiterSize.y * scale;

          // Position the delimiterImage mesh with padding
          delimiterImage.mesh.position.y =
            totalHeightToAdd + this.delimiterPadding + newDelimiterHeight / 2;
          delimiterImage.mesh.position.z = 0;

          // Update total height including padding
          totalHeightToAdd += this.delimiterPadding * 2; // Add padding before and after delimiter

          // Make mesh invisible until screenshot
          delimiterImage.mesh.visible = false;

          // Update total height for the delimiter
          totalHeightToAdd += newDelimiterHeight;
        }
      }
    }

    if (!combinedMesh) {
      return;
    }

    // Remove the old imageContainer so it doesn't overlap with the combined croppedMesh, set combined croppedMesh to imageContainer
    if (this.world.imageContainer?.mesh) {
      GtUtils.disposeMeshHelper(this.world.imageContainer.mesh);
    }

    this.world.imageContainer!.mesh = combinedMesh;
    this.scene.add(combinedMesh);

    // Center and adjust the camera to fit the combined mesh
    this.centerCameraOnMesh(this.world.imageContainer!.mesh);

    // Reset clipboxGroup and visual cue
    this.changeSelectionGroup(0);

    // Set gate for joining images only once
    this.areSelectionGroupsJoined = true;
  }

  /* ----------------------------- Helper methods ----------------------------- */
  private getNonEmptySelectionGroups() {
    const allGroups = [
      {
        selections: this.selectionGroup0,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
      {
        selections: this.selectionGroup1,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
      {
        selections: this.selectionGroup2,
        croppedMesh: new THREE.Mesh(),
        croppedMeshHeight: 0,
      },
    ];

    return allGroups.filter((group) => group.selections.length > 0);
  }

  private addActiveMeshToGroup() {
    if (!this.activeMesh) {
      return;
    }

    switch (this.activeSelectionGroup) {
      case 0:
        this.selectionGroup0.push(this.activeMesh);
        break;
      case 1:
        this.selectionGroup1.push(this.activeMesh);
        break;
      case 2:
        this.selectionGroup2.push(this.activeMesh);
        break;
      default:
        break;
    }

    this.activeMesh = null;
  }

  private isSelectionTooSmall(size: THREE.Vector3) {
    return (
      size.x < this.boxSizeThreshold ||
      size.y < this.boxSizeThreshold ||
      size.z < this.boxSizeThreshold
    );
  }

  private getGroupBaseColor(groupNumber: number) {
    const colorHex = this.selectionGroupsColorMap[groupNumber] ?? 0xffffff;
    return new THREE.Color(colorHex);
  }

  private createSelectionBoxMaterial(baseColor: THREE.Color) {
    return new THREE.MeshBasicMaterial({
      color: this.getRandomShadeFromBaseColor(baseColor, 0.1),
      wireframe: false,
      transparent: true,
      opacity: this.defaultOpacity,
    });
  }

  private getRandomShadeFromBaseColor(baseColor: THREE.Color, variation = 0.1) {
    // Get the base green RGB values, clamp values within [0, 1]
    const red = THREE.MathUtils.clamp(
      baseColor.r + (Math.random() - 0.5) * variation,
      0,
      1
    );
    const green = THREE.MathUtils.clamp(
      baseColor.g + (Math.random() - 0.5) * variation,
      0,
      1
    );
    const blue = THREE.MathUtils.clamp(
      baseColor.b + (Math.random() - 0.5) * variation,
      0,
      1
    );

    return new THREE.Color(red, green, blue);
  }

  private drawNewSelection(event: MouseEvent) {
    if (!this.activeMesh) {
      return;
    }

    // Gate to have activeMesh ready on starting starting click
    if (!this.hasMovedMouseOnce) {
      this.hasMovedMouseOnce = true;
      this.activeMesh.geometry.dispose();
      // Switch from a zero-sized box to a 1x1x1, scaling will follow
      this.activeMesh.geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    // Convert the mouse position to world coordinates
    this.worldEndMousePosition = GtUtils.screenToSceneCoordinates(
      event.clientX,
      event.clientY,
      this.selectionZPosition
    );

    // Calculate the width and height based on world coordinates
    const size = new THREE.Vector3(
      Math.abs(this.worldEndMousePosition.x - this.worldStartMousePosition.x),
      Math.abs(this.worldEndMousePosition.y - this.worldStartMousePosition.y),
      // Annoying to find bugfix for CSG union later, this mesh must have depth to be 3d and intersect later....
      // Math.abs(this.worldEndMousePosition.z - this.worldStartMousePosition.z)
      2 // imageContainer is depth of 1 so this fully intersects through
    );

    // Scale the mesh
    this.activeMesh.scale.set(size.x, size.y, size.z);
    // Reposition the mesh to stay centered between start and end points
    this.activeMesh.position.copy(
      this.worldStartMousePosition
        .clone()
        .add(this.worldEndMousePosition)
        .divideScalar(2)
    );
  }

  private rotateAllSelectionGroups() {
    if (!this.world.imageContainer?.mesh) {
      return;
    }

    // Target point and axis around which the mesh will rotate
    const rotationPoint = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);

    // Mirror rotation with calculated imageContainer values
    const currentZRotation = this.world.imageContainer.mesh.rotation.z;
    const targetZRotation = this.world.imageContainer.targetRotation.y;
    // Adjust for smoother or faster transitions
    const lerpFactor = 1;

    this.rotateSelectionGroup(
      this.selectionGroup0,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );
    this.rotateSelectionGroup(
      this.selectionGroup1,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );
    this.rotateSelectionGroup(
      this.selectionGroup2,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );
  }

  private rotateSelectionGroup(
    selections: THREE.Mesh[],
    rotationPoint: THREE.Vector3,
    axis: THREE.Vector3,
    currentRotation: number,
    targetRotation: number,
    lerpFactor: number
  ) {
    // Compute the delta rotation to apply
    const deltaRotation =
      THREE.MathUtils.lerp(currentRotation, targetRotation, lerpFactor) -
      currentRotation;

    for (const selection of selections) {
      // Rotate the position of the mesh
      const relativePosition = selection.position.clone().sub(rotationPoint);
      // Create a quaternion to rotate around the axis
      const rotationQuat = new THREE.Quaternion().setFromAxisAngle(
        axis,
        deltaRotation
      );
      // Apply the quaternion to the relative position
      relativePosition.applyQuaternion(rotationQuat);
      // Update the mesh's position
      selection.position.copy(relativePosition.add(rotationPoint));
      // Rotate the mesh's orientation, pre-multiply to apply the new rotation
      selection.quaternion.premultiply(rotationQuat);
    }
  }

  private createCroppedSelectionMeshFromSelectionGroup(
    selectionMeshes: THREE.Mesh[]
  ) {
    if (!this.world.imageContainer?.mesh) {
      throw new Error("No imageContainer mesh available for cropping.");
    }

    // Determine which selection group these meshes belong to before any modifications
    const groupIndex = this.selectionGroup0.includes(selectionMeshes[0])
      ? 0
      : this.selectionGroup1.includes(selectionMeshes[0])
      ? 1
      : 2;

    // Combine all selections into one mesh
    let combinedMesh = selectionMeshes[0];
    for (let i = 1; i < selectionMeshes.length; i++) {
      combinedMesh = CSG.union(combinedMesh, selectionMeshes[i]);
    }

    // Clean up the original selection meshes, add the only existing clipBox in case of further clips
    for (const selection of selectionMeshes) {
      GtUtils.disposeMeshHelper(selection);
    }
    selectionMeshes.length = 0;

    // Push the combinedMesh back to the same plane as the imageContainer mesh, update it's local position matrix for CSG
    combinedMesh.position.z = 0;
    combinedMesh.updateMatrix();

    // Splice the new combined mesh to the imageContainer mesh
    const croppedMesh = CSG.intersect(
      this.world.imageContainer.mesh,
      combinedMesh
    );

    // Dispose of combinedMesh (not needed after intersection)
    GtUtils.disposeMeshHelper(combinedMesh);

    // Compute the bounding box of the resulting mesh
    croppedMesh.geometry.computeBoundingBox();
    const boundingBox = croppedMesh.geometry.boundingBox;

    // If the bounding box exists, calculate the center position
    if (boundingBox) {
      // Create a new vector for the center
      const center = new THREE.Vector3();

      // Transform the bounding box into world coordinates
      const worldBox = new THREE.Box3()
        .copy(boundingBox)
        .applyMatrix4(croppedMesh.matrixWorld);

      // Get the center of the transformed bounding box
      worldBox.getCenter(center);

      // Move the mesh so its center is at the origin
      croppedMesh.position.sub(center);

      // Extracts UV coordinates from the bounding box of a given mesh, converts them to pixel coordinates, then flips and sorts these pixel coordinates based on the associated image.
      const pixelCoordinates = GtUtils.getPixelCoordinatesFromSelectionMesh(
        croppedMesh,
        this.world.imageContainer
      );

      // Store coordinates in the appropriate array based on the group index we determined earlier
      switch (groupIndex) {
        case 0:
          this.selectionGroupPixelCoordinates0 = pixelCoordinates;
          break;
        case 1:
          this.selectionGroupPixelCoordinates1 = pixelCoordinates;
          break;
        case 2:
          this.selectionGroupPixelCoordinates2 = pixelCoordinates;
          break;
      }
    }

    return croppedMesh;
  }

  private getMeshHeight(mesh: THREE.Mesh) {
    // Ensure the geometry's bounding box is up to date
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;

    // Calculate the height by subtracting the min Y from the max Y, return 0 if no bounding box is available (unlikely)
    return boundingBox ? boundingBox.max.y - boundingBox.min.y : 0;
  }

  private centerCameraOnMesh(mesh: THREE.Mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());

    // Move camera to center
    this.camera.targetPostion.set(
      center.x,
      center.y,
      this.camera.instance.position.z
    );
    this.camera.instance.position.set(
      center.x,
      center.y,
      this.camera.instance.position.z
    );

    // Calculate optimal zoom for orthographic camera
    const maxDim = Math.max(size.x, size.y);
    // Add a bit of padding for aesthetics
    const padding = 0.55;
    // Assuming a symmetric frustum on orthographic camera
    const aspect =
      this.camera.orthographicCamera.right / this.camera.orthographicCamera.top;

    // Update camera position to center on the mesh based on aspect ratio
    if (aspect >= 1) {
      // Wider than tall, fit to height
      this.camera.targetZoom =
        this.camera.orthographicCamera.top / (maxDim * padding);
      this.camera.orthographicCamera.zoom = this.camera.targetZoom;
    } else {
      //  Taller than wide, fit to width
      this.camera.targetZoom =
        this.camera.orthographicCamera.right / (maxDim * padding);
      this.camera.orthographicCamera.zoom = this.camera.targetZoom;
    }
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public destroy() {
    // Remove activeMesh
    if (this.activeMesh) {
      GtUtils.disposeMeshHelper(this.activeMesh);
    }

    // Remove all clipBoxes
    [this.selectionGroup0, this.selectionGroup1, this.selectionGroup2].forEach(
      (selectionGroup) => {
        selectionGroup.forEach((selection) => {
          GtUtils.disposeMeshHelper(selection);
        });

        // Clear the group
        selectionGroup.length = 0;
      }
    );

    // Remove all coordinates
    [
      this.selectionGroupPixelCoordinates0,
      this.selectionGroupPixelCoordinates1,
      this.selectionGroupPixelCoordinates2,
    ].forEach((selectionGroup) => {
      // Clear the group
      selectionGroup.length = 0;
    });

    // Reset join state
    this.areSelectionGroupsJoined = false;
  }
}
