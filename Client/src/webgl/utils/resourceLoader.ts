/* -------------------------------------------------------------------------- */
/*          Used to centralize all asset loading in a dedicated class         */
/* -------------------------------------------------------------------------- */

import Emitter from "./eventEmitter";
import * as THREE from "three";
import delimiterImageUrl from "../../assets/delimiterImage.png";
import gridImageUrl from "../../assets/gridImage.png";

export default class ResourceLoader {
  public items: { [key: string]: any };
  public apiKey: string;
  public currentImageUrl?: string;
  public currentImageBlob?: Blob;

  private textureLoader?: THREE.TextureLoader;

  constructor() {
    // Class fields
    this.items = {};
    this.apiKey = "";
    this.textureLoader = new THREE.TextureLoader();
  }

  // Loads a texture from the local assets directory
  private pendingLoads: Set<string> = new Set();

  private loadLocalTexture(assetName: string, assetUrl: string) {
    // Add to pending loads
    this.pendingLoads.add(assetName);
    
    this.textureLoader?.load(
      assetUrl,
      (file) => {
        this.items[assetName] = file;
        // Ensure the image is fully loaded
        const completeLoad = () => {
          this.pendingLoads.delete(assetName);
          // Only emit when all pending loads are complete
          if (this.pendingLoads.size === 0) {
            Emitter.emit("loadedFromFile");
          }
        };

        if (file.image && file.image.complete) {
          completeLoad();
        } else {
          file.image.onload = completeLoad;
        }
      },
      undefined, // onProgress callback
      (error) => {
        console.error(`Error loading ${assetName}:`, error);
        this.pendingLoads.delete(assetName);
      }
    );
  }

  public loadDelimiterImage() {
    this.loadLocalTexture("delimiterImage", delimiterImageUrl);
  }

  public loadGridImage() {
    this.loadLocalTexture("gridImage", gridImageUrl);
  }

  public loadGtImageFromApi(
    imageUrl?: string,
    blob?: Blob,
    resetGui: boolean = true,
    rotation?: number
  ) {
    // Store both URL and blob for later use in disposal and potential download in debug
    this.currentImageUrl = imageUrl;
    this.currentImageBlob = blob;

    // Load the texture
    this.textureLoader?.load(imageUrl!, (image) => {
      this.items["apiImage"] = image;
      Emitter.emit("loadedFromApi", { resetGui, rotation });
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
