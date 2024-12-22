import * as THREE from "three";
import ImageContainer from "../gtComponents/imageContainer";
import Experience from "../experience";

export default class GtUtils {
  public static disposeMaterialHelper(
    material: THREE.Material | THREE.Material[]
  ) {
    if (Array.isArray(material)) {
      for (const mat of material) {
        mat.dispose();
      }
    } else {
      material.dispose();
    }
  }

  public static disposeMeshHelper(object: THREE.Object3D) {
    if (object instanceof THREE.Mesh) {
      // Remove from scene
      Experience.getInstance().scene.remove(object);

      // Dispose geometry
      object.geometry?.dispose();

      // Dispose material(s)
      let materials: THREE.Material[];
      if (Array.isArray(object.material)) {
        materials = object.material;
      } else {
        materials = [object.material];
      }
      materials.forEach((material) => material?.dispose());
    }
  }

  public static isInteractingWithGUI(event: MouseEvent) {
    return (
      (Experience.getInstance().input.dashboardGuiGlobal?.contains(
        event.target as HTMLElement
      ) ??
        false) ||
      (Experience.getInstance().input.loginGuiGlobal?.contains(
        event.target as HTMLElement
      ) ??
        false)
    );
  }

  public static screenToSceneCoordinates(
    mouseX: number,
    mouseY: number,
    selectionZPosition: number
  ) {
    // Normalize mouse coordinates (-1 to 1)
    const ndcX = (mouseX / Experience.getInstance().sizes.width) * 2 - 1;
    const ndcY = -(mouseY / Experience.getInstance().sizes.height) * 2 + 1;

    // Create a vector in NDC space
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);

    // Unproject the vector to scene coordinates
    vector.unproject(Experience.getInstance().camera.instance);

    // Adjust the z-coordinate to match the camera's z-plane
    vector.z = selectionZPosition;

    return vector;
  }

  public static getPixelCoordinatesFromSelectionMesh(
    croppedSelectionMesh: THREE.Mesh,
    imageContainer: ImageContainer
  ) {
    if (!imageContainer?.mesh) {
      throw new Error("ImageContainer mesh is not available.");
    }

    // Ensure bounding boxes are computed
    croppedSelectionMesh.geometry.computeBoundingBox();
    imageContainer.mesh.geometry.computeBoundingBox();

    const boundingBox = croppedSelectionMesh.geometry.boundingBox;
    const imageBoundingBox = imageContainer.mesh.geometry.boundingBox;
    if (!boundingBox || !imageBoundingBox) {
      throw new Error("Bounding boxes are not defined properly.");
    }

    // Define corner points for the bounding box (currently using 4 corners, all 8 unnessasary in orthographic view)
    const min = boundingBox.min;
    const max = boundingBox.max;
    const corners: THREE.Vector3[] = [
      new THREE.Vector3(min.x, min.y, 0.5),
      new THREE.Vector3(max.x, min.y, 0.5),
      new THREE.Vector3(min.x, max.y, 0.5),
      new THREE.Vector3(max.x, max.y, 0.5),
    ];

    // Transform corners to world coordinates
    const worldCorners = corners.map((corner) =>
      corner.clone().applyMatrix4(croppedSelectionMesh.matrixWorld)
    );

    // Convert world coordinates to UV
    const uvCoords: THREE.Vector2[] = [];
    for (const worldCorner of worldCorners) {
      const uvCoord = imageContainer.worldToUV(
        worldCorner,
        imageContainer.mesh,
        imageBoundingBox
      );

      if (uvCoord) {
        uvCoords.push(uvCoord);
      }
    }

    // Convert UV to pixel coordinates
    const pixelCoordinates = GtUtils.convertUvToPixelCoordinates(
      uvCoords,
      imageContainer
    );

    // Flips the Y coordinates of pixel points based on the image height and sorts them first by X, then by Y.
    const flippedSortedPixelCoordinates = GtUtils.flipAndSortPixelCoordinates(
      pixelCoordinates,
      imageContainer
    );

    return flippedSortedPixelCoordinates;
  }

  public static convertUvToPixelCoordinates(
    textureCoordinates: THREE.Vector2[],
    imageContainer: ImageContainer
  ) {
    // Get the texture dimensions, assuming correct texture is the front face on Z axis
    const texture = imageContainer.materials[4].map;
    const textureWidth = texture?.image.width;
    const textureHeight = texture?.image.height;

    // Convert UV coordinates to pixel coordinates
    const pixelCoordinates = textureCoordinates.map((uv) => {
      // Map UV x to pixel x
      const pixelX = uv.x * textureWidth;
      // Map UV y to pixel y
      const pixelY = uv.y * textureHeight;
      // Return the pixel coordinates
      return new THREE.Vector2(pixelX, pixelY);
    });

    return pixelCoordinates;
  }

  public static flipAndSortPixelCoordinates(
    pixelCoordinates: THREE.Vector2[],
    imageContainer: ImageContainer
  ) {
    const imageHeight = imageContainer.image.image.height;
    const imageYOrigin = imageHeight / 2;

    const flipped = pixelCoordinates.map((pixelCoordinate) => {
      const distanceFromYOrigin = Math.abs(pixelCoordinate.y - imageYOrigin);

      // Flip logic: If the coordinate is above the origin, move it down, and vice versa
      const flippedY = pixelCoordinate.y - distanceFromYOrigin * 2;

      return new THREE.Vector2(pixelCoordinate.x, flippedY);
    });

    // Sort by x, then by y
    flipped.sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

    return flipped;
  }

  public static isEmptyObject(obj: any): boolean {
    return (
      typeof obj === "object" &&
      obj !== null &&
      Object.keys(obj).length === 0 &&
      Object.getPrototypeOf(obj) === Object.prototype
    );
  }

  public static isArrayOfEmptyObjects(arr: any[]): boolean {
    return arr.length > 0 && arr.every(GtUtils.isEmptyObject);
  }

  public static isResponseEmpty(responses: any): boolean {
    // Check if it's strictly [{}]
    if (
      Array.isArray(responses) &&
      responses.length === 1 &&
      GtUtils.isEmptyObject(responses[0])
    ) {
      return true;
    }

    // Check if it's an array of empty objects
    if (Array.isArray(responses) && GtUtils.isArrayOfEmptyObjects(responses)) {
      return true;
    }

    // Check if it's an empty array
    if (Array.isArray(responses) && responses.length === 0) {
      return true;
    }

    return false;
  }
}
