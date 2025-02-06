/* -------------------------------------------------------------------------- */
/*      Semi-transparent image with grid texture, used to align rotations     */
/* -------------------------------------------------------------------------- */

import * as THREE from "three";
import Experience from "../experience";
import ResourceLoader from "../utils/resourceLoader";
import GtUtils from "../utils/gtUtils";

export default class GridImage {
  private experience!: Experience;
  private resources!: ResourceLoader;
  private scene!: THREE.Scene;

  public geometry!: THREE.BoxGeometry;
  public materials!: THREE.MeshBasicMaterial[];
  public mesh?: THREE.Mesh;

  private initialPosition!: THREE.Vector3;
  public isVisible!: boolean;

  constructor() {
    // Init
    this.initializeFields();
  }

  public initialize() {
    if (!this.resources.items.gridImage) {
      console.error('Grid image resource not loaded');
      return;
    }
    
    this.setGeometry();
    this.setMaterial();
    this.setMesh();
  }

  private initializeFields() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.resources = this.experience.resources;
    this.scene = this.experience.scene;

    // Class fields
    this.initialPosition = new THREE.Vector3(0, 0, 0.5);
    this.isVisible = false;
  }

  /* ---------------------------- Instance methods ---------------------------- */
  private setGeometry() {
    const textureAspectRatio =
      this.resources.items.gridImage.image.width /
      this.resources.items.gridImage.image.height;

    // Adjust size of mesh in scene that texture will be applied to. This will effect spacing between selectionGroups
    const boxDepth = 0.01;
    const boxHeight = 5;
    let boxWidth = 5;

    if (textureAspectRatio >= 1) {
      // Landscape or square image, width is scaled by the aspect ratio
      boxWidth = boxHeight * textureAspectRatio;
    } else {
      // Portrait image, width is scaled down for taller images
      boxWidth = boxHeight / textureAspectRatio;
    }

    this.geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  }

  private setMaterial() {
    // Ensure the texture isn't blurry
    const texture = this.resources.items.gridImage;

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.anisotropy =
      this.experience.renderer.instance.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    this.materials = [
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // Right face
      new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Left face
      new THREE.MeshBasicMaterial({ color: 0x0000ff }), // Top face
      new THREE.MeshBasicMaterial({ color: 0xffff00 }), // Bottom face
      new THREE.MeshBasicMaterial({
        map: this.resources.items.gridImage, // Front face with texture
        transparent: true, // ✅ Enable transparency
        opacity: 0.25, // Transparency
        depthWrite: false, // Prevents z-sorting issues
      }),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), // Back face
    ];
  }

  private setMesh() {
    // Create mesh, set position, add to scene
    this.mesh = new THREE.Mesh(this.geometry, this.materials);

    // Move mesh just in front of image for initial position
    this.mesh.position.copy(this.initialPosition);

    // Default visibility
    this.mesh.visible = this.isVisible;

    this.scene.add(this.mesh);
  }

  public hide() {
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }

  public show() {
    if (this.mesh) {
      this.mesh.visible = true;
    }
  }

  public destroy() {
    if (!this.mesh) {
      return;
    }

    // Mesh disposal
    GtUtils.disposeMeshHelper(this.mesh);

    // Deconstucted mesh components disposal
    this.geometry.dispose();
    GtUtils.disposeMaterialHelper(this.materials);
  }
}
