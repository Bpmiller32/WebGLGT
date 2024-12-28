import ImageContainer from "../../gtComponents/imageContainer";

export const debugImageContainer = (imageContainer: ImageContainer) => {
  const imageContainerDebug =
    imageContainer.debug?.ui?.addFolder("imageContainer");

  imageContainerDebug?.open();

  imageContainerDebug
    ?.add(imageContainer, "imageDownloadCount")
    .name("# of images DL'd")
    .listen();
  imageContainerDebug
    ?.add(imageContainer.stopwatch, "elapsedTime")
    .name("time on image")
    .listen();
  imageContainerDebug
    ?.add(imageContainer.input, "isShiftLeftPressed")
    .name("image adjust mode")
    .listen();
  imageContainerDebug
    ?.add(imageContainer, "imageRotation")
    .name("image rotation")
    .step(0.01)
    .listen();
  imageContainerDebug
    ?.add(imageContainer, "isScreenshotDownloadEnabled")
    .name("dlScreenshotImage?")
    .listen();
  imageContainerDebug
    ?.add(imageContainer, "isOriginalDownloadEnabled")
    .name("dlOriginalImage?")
    .listen();
};
