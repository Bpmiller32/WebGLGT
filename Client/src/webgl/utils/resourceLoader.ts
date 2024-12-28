/* -------------------------------------------------------------------------- */
/*          Used to centralize all asset loading in a dedicated class         */
/* -------------------------------------------------------------------------- */

import Emitter from "./eventEmitter";
import * as THREE from "three";

export default class ResourceLoader {
  public items: { [key: string]: any };
  public apiKey: string;
  public currentImageUrl?: string;
  public currentImageBlob?: Blob;

  private textureLoader?: THREE.TextureLoader;

  constructor() {
    this.items = {};
    this.apiKey = "";
    this.textureLoader = new THREE.TextureLoader();
  }

  public loadDelimiterImage() {
    this.textureLoader?.load("/delimiterImage.png", (file) => {
      this.items["delimiterImage"] = file;
      Emitter.emit("loadedFromFile");
    });
  }

  public loadGtImageFromApi(imageUrl?: string, blob?: Blob) {
    // Store both URL and blob for later use
    this.currentImageUrl = imageUrl;
    this.currentImageBlob = blob;

    // Load the texture
    this.textureLoader?.load(imageUrl!, (image) => {
      this.items["apiImage"] = image;
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
