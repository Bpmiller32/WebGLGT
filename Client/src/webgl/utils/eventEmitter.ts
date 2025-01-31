/* -------------------------------------------------------------------------- */
/*             Typescript event emitter using Mitt and events list            */
/* -------------------------------------------------------------------------- */

import mitt from "mitt";

type EventMap = {
  // app state
  appReady: void;
  appSuccess: string;
  appLoading: string;
  appWarning: string;
  appError: string;
  // time
  tick: void;
  // sizes
  resize: void;
  // mouse events
  mouseDown: MouseEvent;
  mouseMove: MouseEvent;
  mouseUp: MouseEvent;
  mouseWheel: WheelEvent;
  lockPointer: boolean;

  // world events
  changeSelectionGroup: number;
  switchCamera: void;
  stitchBoxes: void;
  screenshotImage: void;
  resetImage: void;
  toggleGrid: void;
  fastImageClassify: "mp" | "hw" | "bad";
  // api events/template events
  loadedFromApi: { resetGui: boolean; rotation?: number };
  loadedFromFile: void;
  fillInForm: void;
  setEditorDashboard: { numberOfSelectionGroups: number; tags: string[] };
  gotoNextImage: void;
  gotoPrevImage: void;
  setGroupType: { groupId: number; type: "MP" | "HW" | "Bad" | "" };
};

// Create an emitter instance
const Emitter = mitt<EventMap>();

export default Emitter;
