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
