/* -------------------------------------------------------------------------- */
/*    Image with delimited text, used to separate groups in vision response   */
/* -------------------------------------------------------------------------- */

import * as THREE from "three";
import Experience from "../experience";
import ResourceLoader from "../utils/resourceLoader";
import GtUtils from "../utils/gtUtils";

export default class DelimiterImage {
  private experience!: Experience;
  private resources!: ResourceLoader;
  private scene!: THREE.Scene;

  public geometry!: THREE.BoxGeometry;
  public materials!: THREE.MeshBasicMaterial[];
  public mesh?: THREE.Mesh;

  constructor() {
    // Init
    this.initializeFields();

    this.setGeometry();
    this.setMaterial();
    this.setMesh();
  }

  private initializeFields() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.resources = this.experience.resources;
    this.scene = this.experience.scene;
  }

  /* ---------------------------- Instance methods ---------------------------- */
  private setGeometry() {
    const textureAspectRatio =
      this.resources.items.delimiterImage.image.width /
      this.resources.items.delimiterImage.image.height;

    const boxDepth = 1;
    const boxHeight = 1;
    let boxWidth = 1;

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
    this.materials = [
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // Right face
      new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Left face
      new THREE.MeshBasicMaterial({ color: 0x0000ff }), // Top face
      new THREE.MeshBasicMaterial({ color: 0xffff00 }), // Bottom face
      new THREE.MeshBasicMaterial({ map: this.resources.items.delimiterImage }), // Front face with texture
      new THREE.MeshBasicMaterial({ color: 0xffffff }), // Back face
    ];
  }

  private setMesh() {
    // Create mesh, add to scene, update matrix local position for CSG
    this.mesh = new THREE.Mesh(this.geometry, this.materials);

    // Move mesh behind the camera
    this.mesh.position.setY(2);
    // this.mesh.position.setZ(20);

    this.scene.add(this.mesh);

    // // Fix for debug since mesh is not always set
    // this.imageRotation = this.convertRotation(this.mesh.rotation.z);
  }

  public destroy() {
    if (!this.mesh) {
      return;
    }

    // Mesh disposal
    GtUtils.disposeMeshHelper(this.mesh);

    // Deconstucted mesh components disposal
    this.geometry.dispose();
    this.materials.forEach((texture) => {
      texture.dispose();
    });
  }
}
