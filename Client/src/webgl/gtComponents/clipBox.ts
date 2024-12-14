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
import { debugClipBox } from "../utils/debug/debugClipBox";
import GtUtils from "../utils/gtUtils";

interface ClipBoxGroup {
  clipBoxes: THREE.Mesh[];
  croppedMesh: THREE.Mesh;
  croppedMeshHeight: number;
}

export default class ClipBox {
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
  public activeClipBoxGroup!: number;
  public clipBoxes0!: THREE.Mesh[];
  public clipBoxes1!: THREE.Mesh[];
  public clipBoxes2!: THREE.Mesh[];
  private boxSizeThreshold!: number;

  public combinedBoundingBox!: THREE.Box3;

  private isImagesJoined!: boolean;

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
    Emitter.on("changeClipBoxGroup", (groupNumber) => {
      this.changeClipBoxGroup(groupNumber);
    });
    Emitter.on("stitchBoxes", () => {
      this.stitchBoxes();
    });
    Emitter.on("resetImage", () => {
      this.destroy();
    });

    // TODO: remove after debug
    Emitter.on("test", () => {
      this.clipBoxes2[0].position.z -= 5;
    });

    // Debug
    if (this.experience.debug?.isActive) {
      this.debug = this.experience.debug;
      debugClipBox(this);
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
    this.activeClipBoxGroup = 2;
    this.clipBoxes0 = [];
    this.clipBoxes1 = [];
    this.clipBoxes2 = [];
    this.boxSizeThreshold = 0.025;
    this.combinedBoundingBox = new THREE.Box3();

    this.isImagesJoined = false;

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
      this.isImagesJoined
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
    // TODO: debug
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
      (this.clipBoxes0.length === 0 &&
        this.clipBoxes1.length === 0 &&
        this.clipBoxes2.length === 0) ||
      this.isImagesJoined
    ) {
      return;
    }

    // Create MeshGroups, filter out groups with no clipBoxes. The order of the array determines which group order when stacking
    const meshGroups = [
      { clipBoxes: this.clipBoxes0 } as ClipBoxGroup,
      { clipBoxes: this.clipBoxes1 } as ClipBoxGroup,
      { clipBoxes: this.clipBoxes2 } as ClipBoxGroup,
    ].filter((group) => group.clipBoxes.length > 0);

    // Initialize the total height to be added
    let totalHeightToAdd = 0;
    // Initialize the combined mesh (starting with the first mesh)
    let combinedMesh: THREE.Mesh | null = null;

    // Stack the meshes of the groups
    meshGroups.forEach((group) => {
      // Create the cropped mesh and calculate its height
      group.croppedMesh = this.createCroppedMeshFromClipBoxes(group.clipBoxes);
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
    });

    // Remove the old imageBox so it doesn't overlap with the combined croppedMesh, set combined croppedMesh to imageBox
    this.scene.remove(this.world.imageBox!.mesh!);
    this.world.imageBox!.mesh = combinedMesh!;
    this.scene.add(combinedMesh!);

    // Center and adjust the camera to fit the combined mesh
    this.centerCameraOnMesh(this.world.imageBox!.mesh);

    // Reset clipboxGroup and visual cue
    this.changeClipBoxGroup(2);

    // Set gate for joining images only once
    this.isImagesJoined = true;
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
    const rotationPoint = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);

    // Calculate the target angle incrementally based on mouse movement
    // Mouse moving on x-axis (Z-axis rotation in 3D)
    const currentZRotation = this.world.imageBox!.mesh!.rotation.z;
    const targetZRotation = this.world.imageBox!.targetRotation.y; // Assuming x maps to Z-axis
    const rotationSpeed = 0.005; // Adjust speed as needed
    const targetAngle = -event.movementX * rotationSpeed;

    // Interpolation factor (lerpFactor)
    const lerpFactor = 1; // Adjust for smoother or faster transitions

    this.rotateClipBoxGroup(
      this.clipBoxes0,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );
    this.rotateClipBoxGroup(
      this.clipBoxes1,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );
    this.rotateClipBoxGroup(
      this.clipBoxes2,
      rotationPoint,
      axis,
      currentZRotation,
      targetZRotation,
      lerpFactor
    );

    // TODO: debug
    // this.world.imageBox!.mesh!.updateMatrix();
  }

  private rotateClipBoxGroup(
    clipBoxes: THREE.Mesh[],
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

    for (const mesh of clipBoxes) {
      // Step 1: Rotate the position of the mesh
      const relativePosition = mesh.position.clone().sub(rotationPoint);

      // Create a quaternion to rotate around the axis
      const rotationQuat = new THREE.Quaternion().setFromAxisAngle(
        axis,
        deltaRotation
      );

      // Apply the quaternion to the relative position
      relativePosition.applyQuaternion(rotationQuat);

      // Update the mesh's position
      mesh.position.copy(relativePosition.add(rotationPoint));

      // Step 2: Rotate the mesh's orientation
      mesh.quaternion.premultiply(rotationQuat); // Pre-multiply to apply the new rotation
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

  private createCroppedMeshFromClipBoxes(clipBoxes: THREE.Mesh[]) {
    let combinedMesh = clipBoxes[0];

    for (let i = 0; i < clipBoxes.length; i++) {
      combinedMesh = CSG.union(combinedMesh, clipBoxes[i]);

      this.scene.remove(clipBoxes[i]);
      GtUtils.disposeMeshHelper(clipBoxes[i]);
    }

    // Dispose of the references in clipBoxes, add the only existing clipBox in case of further clips
    clipBoxes.length = 0;

    // Push the combinedMesh back to the same plane as the imageBox mesh, update it's local position matrix for CSG
    combinedMesh.position.z = 0;
    combinedMesh.updateMatrix();

    // Splice the new combined mesh to the imageBox mesh
    const croppedMesh = CSG.intersect(this.world.imageBox!.mesh!, combinedMesh);

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
        this.world.imageBox?.mesh!.geometry.computeBoundingBox();

        const box = this.world.imageBox?.mesh!.geometry.boundingBox;
        const uvCoord = this.world.imageBox?.worldToUV(
          corner,
          this.world.imageBox.mesh!,
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

      // flippedPixelCoordinates.splice(1, 2);

      console.log("flipped Y: ", flippedPixelCoordinates);

      // this.downloadCroppedTexture(
      //   flippedPixelCoordinates,
      //   this.experience.resources.items.apiImage,
      //   "pls"
      // );

      // // Assuming you want to crop the image based on the flipped coordinates
      // const minX = flippedPixelCoordinates[0].x;
      // const maxX = flippedPixelCoordinates[1].x;
      // const minY = flippedPixelCoordinates[0].y;
      // const maxY = flippedPixelCoordinates[1].y;

      // // Crop the image using these coordinates
      // const img = this.experience.resources.items.apiImage.image; // Assuming the image is already loaded
      // const canvas = document.createElement("canvas");
      // const context = canvas.getContext("2d");

      // // Set the canvas size to the cropped area
      // // canvas.width = maxX - minX;
      // // canvas.height = maxY - minY;
      // canvas.width = this.experience.resources.items.apiImage.image.width;
      // canvas.height = this.experience.resources.items.apiImage.image.height;

      // // Draw the cropped portion of the image to the canvas
      // // context!.drawImage(
      // //   img,
      // //   minX,
      // //   minY,
      // //   maxX - minX,
      // //   maxY - minY, // Source (x, y, width, height)
      // //   0,
      // //   0,
      // //   maxX - minX,
      // //   maxY - minY // Destination (x, y, width, height)
      // // );
      // context!.drawImage(
      //   img,
      //   0,
      //   0,
      //   this.experience.resources.items.apiImage.image.width,
      //   this.experience.resources.items.apiImage.image.height, // Source (x, y, width, height)
      //   0,
      //   0,
      //   this.experience.resources.items.apiImage.image.width,
      //   this.experience.resources.items.apiImage.image.height // Destination (x, y, width, height)
      // );

      // // Convert the cropped image to a Blob and trigger the download
      // canvas.toBlob(function (blob) {
      //   const link = document.createElement("a");
      //   link.href = URL.createObjectURL(blob!);
      //   link.download = "cropped-flipped-image.png"; // Set the filename
      //   link.click(); // Trigger the download
      //   URL.revokeObjectURL(link.href); // Clean up the object URL
      // }, "image/png");

      // // uvCoords.splice(1, 2);

      // // // Example Usage
      // // this.downloadCroppedTexture(
      // //   uvCoords,
      // //   this.experience.resources.items.apiImage,
      // //   "cropped-image.png"
      // // );
    }

    // this.serene();

    return croppedMesh;
  }

  public drawPoint(position: THREE.Vector3) {
    const geometry = new THREE.SphereGeometry(0.1, 32, 32); // Small sphere to represent the point
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position); // Set position to the given Vector3
    this.scene.add(sphere); // Add the sphere to the scene
  }

  public uvToPixel(
    uv: THREE.Vector2,
    texture: THREE.Texture
  ): { x: number; y: number } {
    const x = Math.round(uv.x * texture.image.width);
    const y = Math.round(uv.y * texture.image.height);
    return { x, y };
  }

  public getBoundingBox(uvs: THREE.Vector2[]): {
    min: THREE.Vector2;
    max: THREE.Vector2;
  } {
    const min = new THREE.Vector2(
      Math.min(...uvs.map((uv) => uv.x)),
      Math.min(...uvs.map((uv) => uv.y))
    );
    const max = new THREE.Vector2(
      Math.max(...uvs.map((uv) => uv.x)),
      Math.max(...uvs.map((uv) => uv.y))
    );
    return { min, max };
  }

  public selene(textureCoordinates: THREE.Vector2[]) {
    // Assuming you have texture coordinates (UVs)
    // const textureCoordinates = [
    //   new THREE.Vector2(0.1, 0.2), // Example UV coordinate 1
    //   new THREE.Vector2(0.5, 0.6), // Example UV coordinate 2
    //   new THREE.Vector2(0.9, 0.8), // Example UV coordinate 3
    //   new THREE.Vector2(0.3, 0.4), // Example UV coordinate 4
    // ];

    // Get the texture dimensions
    const texture = this.world.imageBox?.materials[4].map; // Assuming you are using the correct texture
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

  public serene() {
    // Assuming you have a THREE.Texture object (e.g., texture)
    const texture = this.experience.resources.items.apiImage; // Or any other texture

    // Check if the texture has a valid image
    if (texture && texture.image) {
      const img = texture.image; // This could be an Image object or a Canvas

      // Define the coordinates for cropping (top-left and bottom-right)

      const x1 = 2458.6855664062496,
        y2 = 1763.4383900280689,
        x2 = 2523.659655761719,
        y1 = 1708.1786085635154; // Example coordinates (adjust as needed)

      // Calculate the width and height for the cropped area
      const cropWidth = x2 - x1;
      const cropHeight = y2 - y1;

      // Create a canvas and context for cropping
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      // Set canvas size to the cropped area size
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw the image onto the canvas, but only the cropped part
      context!.drawImage(
        img,
        x1,
        y1,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      // Convert the canvas to a Blob (image format: PNG)
      canvas.toBlob(function (blob) {
        // Create a downloadable link
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob!);
        link.download = "cropped-texture-image.png"; // Set the desired filename

        // Trigger the download
        link.click();

        // Clean up the object URL
        URL.revokeObjectURL(link.href);
      }, "image/png");
    } else {
      console.log("Texture does not have an image.");
    }
  }

  public sleepless(worldCoord: THREE.Vector3) {
    const texture = this.world.imageBox!.materials[4]; // Assuming the texture is applied to the front face
    const textureWidth = this.experience.resources.items.apiImage.image.width;
    const textureHeight = this.experience.resources.items.apiImage.image.height;

    // Check if the local coordinates are close to the front face (z = depth / 2)
    const faceZ = 0.5;
    const threshold = 0.001; // Adjust threshold for precision

    // Step 1: Convert world space to local space
    const meshWorldMatrix = this.world.imageBox!.mesh!.matrixWorld;
    const inverseWorldMatrix = meshWorldMatrix.invert();
    const localCoords = new THREE.Vector3()
      .copy(worldCoord)
      .applyMatrix4(inverseWorldMatrix);

    console.log("womp");
    if (Math.abs(localCoords.z - faceZ) < threshold) {
      // Step 2: Map local coordinates to UV coordinates for the front face
      const uv = new THREE.Vector2();

      // The local coordinates x and y range from -width/2 to width/2, and -height/2 to height/2
      uv.x = (localCoords.x + 5 / 2) / 5;
      uv.y = (localCoords.y + 5.04 / 2) / 5.04;

      // Step 3: Map UV coordinates to pixel coordinates
      const pixelCoords = new THREE.Vector2();
      pixelCoords.x = uv.x * textureWidth;
      pixelCoords.y = (1 - uv.y) * textureHeight; // Y is flipped in textures

      console.log(pixelCoords); // This gives you the pixel coordinates on the texture
    }
  }

  public cropTexture(
    uvCoordinates: THREE.Vector2[],
    texture: THREE.Texture
  ): HTMLCanvasElement {
    // Assuming uvCoordinates is an array of two Vector2 instances, e.g., [uv1, uv2]
    const uv1 = uvCoordinates[0]; // (x1, y1)
    const uv2 = uvCoordinates[1]; // (x2, y2)

    // // Ensure texture has loaded and image is available
    if (!texture.image) {
      throw new Error("Texture image is not available");
    }

    texture.flipY = true;

    // Get the image from the texture
    const img = this.experience.resources.items.apiImage
      .image as HTMLImageElement;

    // Convert UV coordinates to pixel coordinates on the texture
    const x1 = uvCoordinates[0].x;
    const y1 = uvCoordinates[0].y;
    const x2 = uvCoordinates[1].x;
    const y2 = uvCoordinates[1].y;

    // Create a canvas to draw the cropped region
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to get canvas context");
    }

    // Set canvas size to the size of the cropped texture
    canvas.width = x2 - x1;
    canvas.height = y2 - y1;

    // Draw the cropped region from the texture onto the canvas
    ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1, 0, 0, x2 - x1, y2 - y1);

    // Return the cropped image as a new texture on a canvas
    return canvas;
  }

  public downloadCroppedTexture(
    uvs: THREE.Vector2[],
    texture: THREE.Texture,
    filename: string
  ): void {
    // Get the cropped canvas
    const canvas = this.cropTexture(uvs, texture);

    // Convert canvas to data URL
    const dataURL = canvas.toDataURL("image/png");

    // Create an anchor element and trigger the download
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    // Remove ActiveVisualCueMesh
    this.scene.remove(this.visualCueMesh);
    const visualCueMaterial = this.activeMesh.material as THREE.Material;
    visualCueMaterial.dispose();
    this.activeMesh.geometry.dispose();
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

    // Reset gate for joining images only once
    this.isImagesJoined = false;
  }
}
