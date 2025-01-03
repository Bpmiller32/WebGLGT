import * as THREE from "three";
import Camera from "../../camera";

export const debugCamera = (camera: Camera) => {
  const cameraDebug = camera.debug?.ui?.addFolder("camera");

  cameraDebug?.open();

  cameraDebug?.add(camera, "cameraType").name("currentCamera").listen();
  cameraDebug
    ?.add(camera.instance.position, "x")
    .name("positionX")
    .step(0.01)
    .listen();
  cameraDebug
    ?.add(camera.instance.position, "y")
    .step(0.01)
    .name("positionY")
    .listen();
  cameraDebug
    ?.add(camera.instance.position, "z")
    .name("positionZ")
    .step(0.01)
    .listen();
  if (camera.instance instanceof THREE.OrthographicCamera) {
    cameraDebug?.add(camera.instance, "zoom").name("zoom").step(0.01).listen();
  }
};

export const debugCameraControls = (camera: Camera) => {
  if (!camera.instance) {
    console.error("Camera instance is not initialized for controls.");
    return;
  }

  // Move forward/back
  if (camera.input.isKeyPressed("KeyW")) {
    camera.instance.translateZ(-0.03);
  }
  if (camera.input.isKeyPressed("KeyS")) {
    camera.instance.translateZ(0.03);
  }

  // Strafe left/right
  if (camera.input.isKeyPressed("KeyA")) {
    camera.instance.translateX(-0.03);
  }
  if (camera.input.isKeyPressed("KeyD")) {
    camera.instance.translateX(0.03);
  }

  // Rotate left/right
  if (camera.input.isKeyPressed("KeyQ")) {
    camera.instance.rotation.y += 0.03;
  }
  if (camera.input.isKeyPressed("KeyE")) {
    camera.instance.rotation.y -= 0.03;
  }

  // Height
  if (camera.input.isKeyPressed("Space")) {
    camera.instance.translateY(0.03);
  }
  if (camera.input.isKeyPressed("ControlLeft")) {
    camera.instance.translateY(-0.03);
  }
};
