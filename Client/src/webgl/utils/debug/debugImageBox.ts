import ImageBox from "../../gtComponents/imageBox";

export const debugImageBox = (imageBox: ImageBox) => {
  const imageBoxDebug = imageBox.debug?.ui?.addFolder("imageBox");

  imageBoxDebug?.open();

  imageBoxDebug
    ?.add(imageBox, "imageDownloadCount")
    .name("# of images DL'd")
    .listen();
  imageBoxDebug
    ?.add(imageBox.stopwatch, "elapsedTime")
    .name("time on image")
    .listen();
  imageBoxDebug
    ?.add(imageBox.input, "isShiftLeftPressed")
    .name("Image adjust mode")
    .listen();
  imageBoxDebug
    ?.add(imageBox, "debugRotation")
    .name("Image rotation")
    .step(0.01)
    .listen();
};
