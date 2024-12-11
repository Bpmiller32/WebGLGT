import ClipBox from "../../gtComponents/clipBox";

export const debugClipBox = (clipBox: ClipBox) => {
  const clipBoxDebug = clipBox.debug?.ui?.addFolder("clipBox");

  clipBoxDebug?.open();

  clipBoxDebug?.add(clipBox.clipBoxes0, "length").name("# of group 0").listen();
  clipBoxDebug?.add(clipBox.clipBoxes1, "length").name("# of group 1").listen();
  clipBoxDebug?.add(clipBox.clipBoxes2, "length").name("# of group 2").listen();
  clipBoxDebug
    ?.add(clipBox, "activeClipBoxGroup")
    .name("active group")
    .listen();
};
