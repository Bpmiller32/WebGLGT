/* -------------------------------------------------------------------------- */
/*          Used to centralize all asset loading in a dedicated class         */
/* -------------------------------------------------------------------------- */

import Emitter from "../../eventEmitter";
import * as THREE from "three";

export default class ResourceLoader {
  public items: { [key: string]: any };
  public apiKey: string;

  private textureLoader?: THREE.TextureLoader;

  constructor() {
    this.items = {};
    this.apiKey = "";
    this.textureLoader = new THREE.TextureLoader();
  }

  public loadFromApi(imageUrl?: string) {
    this.textureLoader?.load(imageUrl!, (texture) => {
      this.items["apiImage"] = texture;
      Emitter.emit("loadedFromApi");
    });
  }

  public destroy() {
    // Dispose of loaded textures
    for (const key in this.items) {
      const item = this.items[key];

      if (item instanceof THREE.Texture) {
        // Dispose of texture
        item.dispose();
      } else if (item instanceof THREE.Mesh) {
        // Dispose of the meshes if loaded (to free geometries, materials, etc.)
        if (item.geometry) {
          item.geometry.dispose();
        }

        if (item.material) {
          item.material.dispose();
        }
      }
    }
  }
}
