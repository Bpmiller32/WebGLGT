import * as THREE from "three";

export default class GtUtils {
  public static disposeMeshHelper(object: THREE.Object3D) {
    if (object instanceof THREE.Mesh) {
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
}
