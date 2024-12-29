import * as THREE from "three";
import Experience from "../experience";
import Camera from "../camera";
import GtUtils from "../utils/gtUtils";
import Time from "../utils/time";
import Input from "../utils/input";
import World from "../levels/world";

export default class VisualCueManager {
  private experience: Experience;
  private scene: THREE.Scene;
  private camera: Camera;
  private input: Input;
  private time: Time;
  private world: World;

  private visualCueMesh!: THREE.Mesh;
  private selectionZPosition = 5;
  private readonly defaultVisualCueOpacity: number = 0.5;
  private fadeSpeed: number = 1; // How quickly the visual cue fades out
  private selectionGroupsColorMap: { [key: number]: number } = {
    0: 0x00ff00,
    1: 0xff0000,
    2: 0x0000ff,
  };

  constructor() {
    this.experience = Experience.getInstance();
    this.scene = this.experience.scene;
    this.camera = this.experience.camera;
    this.input = this.experience.input;
    this.time = this.experience.time;
    this.world = this.experience.world;

    this.createVisualCueMesh();

    // Fix for autoLoggingIn and visualCue being visible before ImageContainer has loaded, do it here on 1st construct only since CreateVisualCueMesh is called every time after
    this.visualCueMesh.visible = false;
  }

  public createVisualCueMesh() {
    const geometry = new THREE.SphereGeometry(0.2);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00ff00),
      wireframe: false,
      transparent: true,
      opacity: 0.35,
    });
    this.visualCueMesh = new THREE.Mesh(geometry, material);

    // Fix for 1st paint, scale is calculated in update after this
    const scaleVal = 1 / this.camera.orthographicCamera.zoom;
    this.visualCueMesh.scale.set(scaleVal, scaleVal, scaleVal);

    this.scene.add(this.visualCueMesh);
  }

  private getGroupBaseColor(groupNumber: number) {
    const colorHex = this.selectionGroupsColorMap[groupNumber] ?? 0xffffff;
    return new THREE.Color(colorHex);
  }

  public setPositionAndShow(event: MouseEvent) {
    if (
      GtUtils.isInteractingWithGUI(event) ||
      event.button !== 0 ||
      this.input.isShiftLeftPressed ||
      this.world.selectionGroupManager?.areSelectionGroupsJoined
    ) {
      return;
    }

    // Convert the mouse position to world coordinates
    const worldStartMousePosition = GtUtils.screenToSceneCoordinates(
      event.clientX,
      event.clientY,
      this.selectionZPosition
    );

    // Teleport existing visual cue, separate from the activeMesh, and updates opacity for fade out effect instead of creating new meshes/materials
    this.visualCueMesh.position.set(
      worldStartMousePosition.x,
      worldStartMousePosition.y,
      this.selectionZPosition
    );

    const mat = this.visualCueMesh.material as THREE.MeshBasicMaterial;
    mat.opacity = this.defaultVisualCueOpacity;
  }

  public changeColor(groupNumber: number) {
    // Dispose old material
    GtUtils.disposeMaterialHelper(this.visualCueMesh.material);

    // Assign new material with given color
    const baseColor = this.getGroupBaseColor(groupNumber);
    const newMaterial = new THREE.MeshBasicMaterial({
      color: baseColor,
      wireframe: false,
      transparent: true,
      opacity: 0,
    });

    // Apply the new material
    this.visualCueMesh.material = newMaterial;
  }

  public update() {
    // Fade out the visual cue
    const material = this.visualCueMesh.material as THREE.MeshBasicMaterial;

    // Scale the visual cue to match the camera zoom
    const scaleVal = 1 / this.camera.orthographicCamera.zoom;
    this.visualCueMesh.scale.set(scaleVal, scaleVal, scaleVal);

    // Fade out the visual cue
    if (material.opacity > -1) {
      material.opacity -= this.fadeSpeed * this.time.delta;
    }
  }

  public destroy() {
    GtUtils.disposeMeshHelper(this.visualCueMesh);
  }
}
