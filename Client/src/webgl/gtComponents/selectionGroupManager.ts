/* -------------------------------------------------------------------------- */
/*   Handler for creating and joining clipping boxes, cropping to image box   */
/* -------------------------------------------------------------------------- */

import Emitter from "../utils/eventEmitter";
import * as THREE from "three";
import Experience from "../experience";
import Camera from "../camera";
import Sizes from "../utils/sizes";
import Time from "../utils/time";
import Input from "../utils/input";
import World from "../levels/world";
import { CSG } from "three-csg-ts";
import Debug from "../utils/debug";
import { debugSelectionGroupManager } from "../utils/debug/debugClipBox";
import GtUtils from "../utils/gtUtils";

interface SelectionGroup {
  selections: THREE.Mesh[];
  croppedMesh: THREE.Mesh;
  croppedMeshHeight: number;
}

export default class SelectionGroupManager {
  private experience!: Experience;
  private scene!: THREE.Scene;
  private camera!: Camera;
  private sizes!: Sizes;
  private time!: Time;
  private input!: Input;
  private world!: World;
  public debug?: Debug;

  private hasMovedMouseOnce!: boolean;
  private worldStartMousePosition!: THREE.Vector3;
  private worldEndMousePosition!: THREE.Vector3;
  private activeMesh!: THREE.Mesh;
  private visualCueMesh!: THREE.Mesh;
  public activeSelectionGroup!: number;
  public selectionGroup0!: THREE.Mesh[];
  public selectionGroup1!: THREE.Mesh[];
  public selectionGroup2!: THREE.Mesh[];
  private boxSizeThreshold!: number;

  public combinedBoundingBox!: THREE.Box3;

  private areSelectionGroupsJoined!: boolean;

  private targetRotation!: THREE.Vector2;

  constructor() {
    // Init
    this.initializeFields();
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
    Emitter.on("changeSelectionGroup", (groupNumber) => {
      this.changeSelectionGroup(groupNumber);
    });
    Emitter.on("stitchBoxes", () => {
      this.stitchBoxes();
    });
    Emitter.on("resetImage", () => {
      this.destroy();
      this.world.delimiterImages.forEach((delimiterImage) => {
        delimiterImage.resetPosition();
      });
    });

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
    this.activeSelectionGroup = 2;
    this.selectionGroup0 = [];
    this.selectionGroup1 = [];
    this.selectionGroup2 = [];
    this.boxSizeThreshold = 0.025;
    this.combinedBoundingBox = new THREE.Box3();

    this.areSelectionGroupsJoined = false;

    this.targetRotation = new THREE.Vector2(0, 0);
  }

  /* ------------------------------ Event methods ----------------------------- */
  private mouseDown(event: MouseEvent) {
    // Do not continue if interacting with gui/login page, are not a left click, are in image adjust mode, have already joined images once
    if (
      this.input.dashboardGuiGlobal?.contains(event.target as HTMLElement) ||
      this.input.loginGuiGlobal?.contains(event.target as HTMLElement) ||
      event.button !== 0 ||
      this.input.isShiftLeftPressed ||
      this.areSelectionGroupsJoined
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
    switch (this.activeSelectionGroup) {
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
      5 // z-coodinate of plane to work on, imageContainer is at 0 and clipBoxes are at 5
    );
    this.scene.add(this.activeMesh);

    // Create a visual cue on click by making new mesh at the starting position, separate from the activeMesh, that is added to the scene then faded out
    this.visualCueMesh.position.set(
      this.worldStartMousePosition.x,
      this.worldStartMousePosition.y,
      5 // z-coodinate of plane to work on, imageContainer is at 0 and clipBoxes are at 5
    );

    // New method teleports the same existing mesh and updates opacity instead of creating new meshes/materials
    const visualCueMaterial = this.visualCueMesh.material as THREE.Material;
    visualCueMaterial.opacity = 0.5;
  }

  private mouseMove(event: MouseEvent) {
    // TODO: debug
    // MoveEvent 1: Handle rotating of all existing clipBoxes when in move mode
    if (this.input.isShiftLeftPressed && !this.input.isRightClickPressed) {
      this.rotateAllSelectionGroups(event);
      return;
    }

    // MoveEvent 2: Handle drawing of new clipBoxes
    if (this.input.isLeftClickPressed) {
      this.drawNewSelection(event);
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
      GtUtils.disposeMeshHelper(this.activeMesh);
      return;
    }

    // If the activeMesh is large enough, add to the clipBoxes array here
    switch (this.activeSelectionGroup) {
      case 0:
        this.selectionGroup0.push(this.activeMesh!);
        break;
      case 1:
        this.selectionGroup1.push(this.activeMesh!);
        break;
      case 2:
        this.selectionGroup2.push(this.activeMesh!);
        break;

      default:
        break;
    }
  }

  private changeSelectionGroup(groupNumber: number) {
    // Change group number
    this.activeSelectionGroup = groupNumber;

    // Change visualCue color
    const currentMaterial = this.visualCueMesh.material as THREE.Material;
    currentMaterial.dispose();

    let newMaterial: THREE.MeshBasicMaterial;
    switch (this.activeSelectionGroup) {
      case 0:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x00ff00),
          wireframe: false,
          transparent: true,
          opacity: 0,
        });
        break;
      case 1:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xff0000),
          wireframe: false,
          transparent: true,
          opacity: 0,
        });
        break;
      case 2:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x0000ff),
          wireframe: false,
          transparent: true,
          opacity: 0,
        });
        break;

      default:
        newMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xffffff),
          wireframe: false,
          transparent: true,
          opacity: 0,
        });
        break;
    }

    this.visualCueMesh.material = newMaterial;
  }

  private stitchBoxes() {
    if (
      (this.selectionGroup0.length === 0 &&
        this.selectionGroup1.length === 0 &&
        this.selectionGroup2.length === 0) ||
      this.areSelectionGroupsJoined
    ) {
      return;
    }

    // Create MeshGroups, filter out groups with no clipBoxes. The order of the array determines which group order when stacking
    const meshGroups = [
      { selections: this.selectionGroup0 } as SelectionGroup,
      { selections: this.selectionGroup1 } as SelectionGroup,
      { selections: this.selectionGroup2 } as SelectionGroup,
    ].filter((group) => group.selections.length > 0);

    // Initialize the total height to be added
    let totalHeightToAdd = 0;
    // Initialize the combined mesh (starting with the first mesh)
    let combinedMesh: THREE.Mesh | null = null;

    // Stack the meshes of the groups
    meshGroups.forEach((group, index) => {
      // Create the cropped mesh and calculate its height
      group.croppedMesh = this.createCropFromSelectionGroup(group.selections);
      group.croppedMeshHeight = this.getMeshHeight(group.croppedMesh);

      // Update the position for each croppedMesh to stack them on top of each other
      group.croppedMesh.position.y +=
        totalHeightToAdd + group.croppedMeshHeight / 2;

      // Update total height for the next mesh
      totalHeightToAdd += group.croppedMeshHeight;

      // Combine the current mesh with the previous ones using CSG.union()
      if (combinedMesh === null) {
        // If it's the first mesh, initialize the combined mesh
        combinedMesh = group.croppedMesh;
      } else {
        // Union the current mesh with the combined mesh
        combinedMesh.updateMatrix();
        group.croppedMesh.updateMatrix();
        combinedMesh = CSG.union(combinedMesh, group.croppedMesh);
      }

      // Add a DelimiterImage mesh between croppedMeshes, if applicable
      if (index < meshGroups.length - 1) {
        const delimiterImage = this.world.delimiterImages[index];

        if (delimiterImage && delimiterImage.mesh) {
          // Calculate the delimiter image height
          const delimiterHeight = this.getMeshHeight(delimiterImage.mesh);

          // Position the delimiterImage mesh
          delimiterImage.mesh.position.y =
            totalHeightToAdd + delimiterHeight / 2;
          delimiterImage.mesh.position.z = 0;

          // Make mesh invisible until screenshot
          // delimiterImage.mesh.visible = false;

          // Update total height for the next mesh
          totalHeightToAdd += delimiterHeight;
        }
      }
    });

    // Remove the old imageContainer so it doesn't overlap with the combined croppedMesh, set combined croppedMesh to imageContainer
    this.scene.remove(this.world.imageContainer!.mesh!);
    GtUtils.disposeMeshHelper(this.world.imageContainer!.mesh!);
    this.world.imageContainer!.mesh = combinedMesh!;
    this.scene.add(combinedMesh!);

    // TODO: remove after debug
    console.log(meshGroups);

    // Center and adjust the camera to fit the combined mesh
    this.centerCameraOnMesh(this.world.imageContainer!.mesh);

    // Reset clipboxGroup and visual cue
    this.changeSelectionGroup(2);

    // Set gate for joining images only once
    this.areSelectionGroupsJoined = true;
  }

  /* ----------------------------- Helper methods ----------------------------- */
  private centerCameraOnMesh(mesh: THREE.Mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());

    // Calculate optimal zoom for orthographic camera
    const maxDim = Math.max(size.x, size.y);
    const padding = 0.55; // Add a bit of padding for aesthetics

    // Update camera position to center on the mesh
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

    // Adjust the zoom so the entire mesh fits within the view, with padding
    const aspect =
      this.camera.orthographicCamera.right / this.camera.orthographicCamera.top; // Assuming a symmetric frustum
    if (aspect >= 1) {
      // Wider than tall, fit to height
      this.camera.targetZoom =
        this.camera.orthographicCamera.top / (maxDim * padding);
      this.camera.orthographicCamera.zoom =
        this.camera.orthographicCamera.top / (maxDim * padding);
    } else {
      // Taller than wide, fit to width
      this.camera.targetZoom =
        this.camera.orthographicCamera.right / (maxDim * padding);
      this.camera.orthographicCamera.zoom =
        this.camera.orthographicCamera.right / (maxDim * padding);
    }
  }

  // Helper function to project a 3D point to 2D screen space
  private projectToScreen(
    point: THREE.Vector3,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    const ndc = point.clone().project(camera); // Convert to NDC
    return {
      x: (ndc.x + 1) * 0.5 * width, // Map NDC to pixel coordinates
      y: (ndc.y + 1) * 0.5 * height, // Map NDC to pixel coordinates, keeping top-left origin
    };
  }

  // Function to calculate screen-space bounding box for a mesh
  private getScreenBoundingBox(
    mesh: THREE.Mesh,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    const box = new THREE.Box3().setFromObject(mesh); // Get world bounding box
    const points = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    // Project each point to screen space with top-left origin
    const screenPoints = points.map((point) =>
      this.projectToScreen(point, camera, width, height)
    );

    // Calculate the 2D bounding box
    const xCoords = screenPoints.map((p) => p.x);
    const yCoords = screenPoints.map((p) => p.y);
    const screenBox = {
      minX: Math.min(...xCoords),
      minY: Math.min(...yCoords),
      maxX: Math.max(...xCoords),
      maxY: Math.max(...yCoords),
    };

    return screenBox;
  }

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

  private rotateAllSelectionGroups(event: MouseEvent) {
    // Target point and axis around which the mesh will rotate
    const rotationPoint = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);

    // Calculate the target angle incrementally based on mouse movement
    // Mouse moving on x-axis (Z-axis rotation in 3D)
    const currentZRotation = this.world.imageContainer!.mesh!.rotation.z;
    const targetZRotation = this.world.imageContainer!.targetRotation.y; // Assuming x maps to Z-axis
    // const rotationSpeed = 0.005; // Adjust speed as needed
    // const targetAngle = -event.movementX * rotationSpeed;

    // Interpolation factor (lerpFactor)
    const lerpFactor = 1; // Adjust for smoother or faster transitions

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
      // Step 1: Rotate the position of the mesh
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

      // Step 2: Rotate the mesh's orientation
      selection.quaternion.premultiply(rotationQuat); // Pre-multiply to apply the new rotation
    }
  }

  private drawNewSelection(event: MouseEvent) {
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
      2 // imageContainer is depth of 1 so this fully intersects through
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

  private createCropFromSelectionGroup(selections: THREE.Mesh[]) {
    let combinedMesh = selections[0];

    for (let i = 0; i < selections.length; i++) {
      combinedMesh = CSG.union(combinedMesh, selections[i]);

      this.scene.remove(selections[i]);
      GtUtils.disposeMeshHelper(selections[i]);
    }

    // Dispose of the references in clipBoxes, add the only existing clipBox in case of further clips
    selections.length = 0;

    // Push the combinedMesh back to the same plane as the imageContainer mesh, update it's local position matrix for CSG
    combinedMesh.position.z = 0;
    combinedMesh.updateMatrix();

    // Splice the new combined mesh to the imageContainer mesh
    const croppedMesh = CSG.intersect(
      this.world.imageContainer!.mesh!,
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

      // asdf

      // Create an array to hold the 8 corner points of the bounding box
      const corners: THREE.Vector3[] = [];
      const min = boundingBox.min;
      const max = boundingBox.max;

      // Define the 8 corner points of the bounding box
      corners.push(new THREE.Vector3(min.x, min.y, 0.5)); // 0
      corners.push(new THREE.Vector3(max.x, min.y, 0.5)); // 1
      corners.push(new THREE.Vector3(min.x, max.y, 0.5)); // 2
      corners.push(new THREE.Vector3(max.x, max.y, 0.5)); // 3

      // Optionally transform them to world coordinates
      const worldCorners = corners.map((corner) =>
        corner.clone().applyMatrix4(croppedMesh.matrixWorld)
      );
      console.log("World coordinates of bounding box corners:", worldCorners);

      const uvCoords: THREE.Vector2[] = [];

      worldCorners.forEach((corner) => {
        this.world.imageContainer?.mesh!.geometry.computeBoundingBox();

        const box = this.world.imageContainer?.mesh!.geometry.boundingBox;
        const uvCoord = this.world.imageContainer?.worldToUV(
          corner,
          this.world.imageContainer.mesh!,
          box!
        );
        // console.log("uvCoord:", uvCoord);
        uvCoords.push(uvCoord!);

        // this.sleepless(new THREE.Vector3(uvCoord?.x, uvCoord?.y, 0.5));
      });

      console.log(uvCoords);
      const pixelCoordinates = this.selene(uvCoords);
      console.log(pixelCoordinates);

      // Flip Y coordinates (invert along the Y axis)
      const flippedPixelCoordinates = pixelCoordinates.map(
        (pixelCoordinate) => {
          const imageHeight =
            this.experience.resources.items.apiImage.image.height;
          const imageYOrigin = imageHeight / 2;

          const distanceFromYOrigin = Math.abs(
            pixelCoordinate.y - imageYOrigin
          );

          let flippedY = 0;
          if (distanceFromYOrigin >= 0) {
            flippedY = pixelCoordinate.y - distanceFromYOrigin * 2;
          } else {
            flippedY = pixelCoordinate.y + distanceFromYOrigin * 2;
          }

          return new THREE.Vector2(pixelCoordinate.x, flippedY); // Return the flipped coordinates
        }
      );

      // Sort the flippedPixelCoordinates first by x and then by y
      flippedPixelCoordinates.sort((a, b) => {
        // First, compare by x coordinate
        if (a.x !== b.x) {
          return a.x - b.x; // If x values are different, sort by x
        }
        // If x values are the same, compare by y coordinate
        return a.y - b.y; // Sort by y
      });

      console.log("flipped Y: ", flippedPixelCoordinates);
    }

    return croppedMesh;
  }

  private selene(textureCoordinates: THREE.Vector2[]) {
    // Get the texture dimensions
    const texture = this.world.imageContainer?.materials[4].map; // Assuming you are using the correct texture
    const textureWidth = texture!.image.width;
    const textureHeight = texture!.image.height;

    // Convert UV coordinates to pixel coordinates
    const pixelCoordinates = textureCoordinates.map((uv) => {
      const pixelX = uv.x * textureWidth; // Map UV x to pixel x
      const pixelY = uv.y * textureHeight; // Map UV y to pixel y
      return new THREE.Vector2(pixelX, pixelY); // Return the pixel coordinates
    });

    return pixelCoordinates;
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

  public destroyVisualCueMesh() {
    this.scene.remove(this.visualCueMesh);
    GtUtils.disposeMeshHelper(this.visualCueMesh);
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
    GtUtils.disposeMeshHelper(this.activeMesh);

    // Remove all clipBoxes
    [this.selectionGroup0, this.selectionGroup1, this.selectionGroup2].forEach(
      (selectionGroup) => {
        selectionGroup.forEach((selection) => {
          this.scene.remove(selection);
          GtUtils.disposeMeshHelper(selection);
        });

        // Clear the group
        selectionGroup.length = 0;
      }
    );

    // Reset gate for joining images only once
    this.areSelectionGroupsJoined = false;
  }
}
