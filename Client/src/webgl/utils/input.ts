/* -------------------------------------------------------------------------- */
/*               Used to handle keyboard and mouse input events               */
/* -------------------------------------------------------------------------- */

import Emitter from "./eventEmitter";

const KEY_EVENT_MAP: {
  [keyCode: string]: { onDown?: () => void; onUp?: () => void };
} = {
  KeyW: {},
  KeyA: {},
  KeyS: {},
  KeyD: {},

  KeyQ: {},
  KeyE: {},

  Backquote: {},

  // Number keys
  Digit1: {},
  Digit2: {},
  Digit3: {},

  // Function keys
  F1: { onDown: () => Emitter.emit("changeSelectionGroup", 0) },
  F2: { onDown: () => Emitter.emit("changeSelectionGroup", 1) },
  F3: { onDown: () => Emitter.emit("changeSelectionGroup", 2) },
  F4: {
    onDown: () => {
      Emitter.emit("stitchBoxes");
      Emitter.emit("screenshotImage");
    },
  },
  F5: {
    onDown: () => {
      Emitter.emit("fastImageClassify", "mp");
      Emitter.emit("gotoNextImage");
    },
  },
  F6: {
    onDown: () => {
      Emitter.emit("fastImageClassify", "hw");
      Emitter.emit("gotoNextImage");
    },
  },
  F7: {
    onDown: () => {
      Emitter.emit("fastImageClassify", "bad");
      Emitter.emit("gotoNextImage");
    },
  },
  F8: {},
  F9: {},
  F10: {
    onDown: () => Emitter.emit("switchCamera"),
  },

  // Modifier keys
  ControlLeft: {},
  ShiftLeft: {
    onDown: () => Emitter.emit("lockPointer", true),
    onUp: () => Emitter.emit("lockPointer", false),
  },
  Space: {},

  // Arrow keys
  ArrowUp: {},
  ArrowDown: {},
  ArrowLeft: {},
  ArrowRight: {},
};

export default class Input {
  // Track the pressed state of any key. True if pressed, false if not. Using a simple index signature here to store states by event.code.
  public keyStates: { [keyCode: string]: boolean } = {};

  // Mouse pressed states
  public isLeftClickPressed = false;
  public isRightClickPressed = false;
  public isMouseBackPressed = false;
  public isMouseForwardPressed = false;

  // References to DOM elements
  public dashboardGuiGlobal: HTMLElement | null;
  public loginGuiGlobal: HTMLElement | null;
  public dashboardTextarea0: HTMLTextAreaElement | null;
  public dashboardTextarea1: HTMLTextAreaElement | null;
  public dashboardTextarea2: HTMLTextAreaElement | null;

  public currentDashboardImageName: string | null;
  public previousDashboardImageName: string | null;

  constructor() {
    // Initialize keyStates to false for each known key in KEY_DEFINITIONS
    for (const code in KEY_EVENT_MAP) {
      this.keyStates[code] = false;
    }

    // Grab references to DOM elements
    this.dashboardGuiGlobal = document.getElementById("gui");
    this.loginGuiGlobal = document.getElementById("loginPage");

    this.dashboardTextarea0 = document.getElementById(
      "dashboardTextarea0"
    ) as HTMLTextAreaElement;
    this.dashboardTextarea1 = document.getElementById(
      "dashboardTextarea1"
    ) as HTMLTextAreaElement;
    this.dashboardTextarea2 = document.getElementById(
      "dashboardTextarea2"
    ) as HTMLTextAreaElement;

    this.currentDashboardImageName = "";
    this.previousDashboardImageName = "";

    // Events
    window.addEventListener("keydown", this.handleKeyDown, false);
    window.addEventListener("keyup", this.handleKeyUp, false);

    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);

    window.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });
    window.addEventListener("touchmove", this.handleTouchMove, {
      passive: false,
    });
    window.addEventListener("touchend", this.handleTouchEnd, {
      passive: false,
    });

    // Let mouse wheel be partially passive for performance, but also set a global wheel listener to selectively prevent scrolling outside of textareas.
    window.addEventListener("wheel", this.handleWheel, { passive: true });
    window.addEventListener("wheel", this.handleGlobalWheel, {
      passive: false,
    });

    // Disable context menu for custom right-click behavior
    window.addEventListener("contextmenu", this.handleContextMenu);

    // Doesn't really belong here but I don't want to put it in the DOM sections
    window.addEventListener("storage", this.handleStorageEvent);
  }

  /* -------------------------------------------------------------------------- */
  /*                               Event Handlers                               */
  /* -------------------------------------------------------------------------- */

  private handleKeyDown = (event: KeyboardEvent) => {
    // If it's a key we don't care about, ignore
    const keyDef = KEY_EVENT_MAP[event.code];
    if (!keyDef) {
      return;
    }

    // Prevent default behavior for specific keys, mainly function keys
    if (
      ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"].includes(
        event.code
      )
    ) {
      event.preventDefault();
    }

    // Mark as pressed
    this.keyStates[event.code] = true;
    // Call any "down" function
    keyDef.onDown?.();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    // If it's a key we don't care about, ignore
    const keyDef = KEY_EVENT_MAP[event.code];
    if (!keyDef) {
      return;
    }

    // Mark as not pressed
    this.keyStates[event.code] = false;
    // Call any "up" function
    keyDef.onUp?.();
  };

  private handleTouchStart = (event: TouchEvent) => {
    // Prevent default to avoid interfering with browser behaviors like scrolling
    event.preventDefault();

    // // Handle touch start
    // const touches = Array.from(event.touches).map((touch) => ({
    //   x: touch.clientX,
    //   y: touch.clientY,
    // }));

    // // Emit a touch start event with touch points
    // Emitter.emit("touchDown", touches);
  };

  private handleTouchMove = (event: TouchEvent) => {
    // Prevent default to avoid browser behavior
    event.preventDefault();

    // // Handle touch move
    // const touches = Array.from(event.touches).map((touch) => ({
    //   x: touch.clientX,
    //   y: touch.clientY,
    // }));

    // // Emit a touch move event with touch points
    // Emitter.emit("touchMove", touches);
  };

  private handleTouchEnd = (event: TouchEvent) => {
    // Prevent default if needed
    event.preventDefault();

    // // Handle touch end (no more touch points active)
    // const changedTouches = Array.from(event.changedTouches).map((touch) => ({
    //   x: touch.clientX,
    //   y: touch.clientY,
    // }));

    // // Emit a touch end event with touch points
    // Emitter.emit("touchUp", changedTouches);
  };

  private handleMouseDown = (event: MouseEvent) => {
    // Mouse button codes: 0 => left, 1 => middle, 2 => right, 3 => back, 4 => forward
    switch (event.button) {
      case 0:
        this.isLeftClickPressed = true;
        break;
      case 2:
        this.isRightClickPressed = true;
        break;
      case 3:
        this.isMouseBackPressed = true;
        break;
      case 4:
        this.isMouseForwardPressed = true;
        break;
      default:
        break;
    }

    Emitter.emit("mouseDown", event);
  };

  private handleMouseMove = (event: MouseEvent) => {
    Emitter.emit("mouseMove", event);
  };

  private handleMouseUp = (event: MouseEvent) => {
    switch (event.button) {
      case 0:
        this.isLeftClickPressed = false;
        break;
      case 2:
        this.isRightClickPressed = false;
        break;
      case 3:
        this.isMouseBackPressed = false;
        break;
      case 4:
        this.isMouseForwardPressed = false;
        break;
      default:
        break;
    }

    Emitter.emit("mouseUp", event);
  };

  private handleWheel = (event: WheelEvent) => {
    Emitter.emit("mouseWheel", event);
  };

  private handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  // Prevent default scrolling on wheel if it’s not within a textarea
  private handleGlobalWheel = (event: WheelEvent) => {
    // Allow scrolling inside the textarea
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    event.preventDefault();
  };

  private handleStorageEvent = (event: StorageEvent) => {
    // If the user has multiple tabs open and logs out of one, this causes all other tabs to react
    if (event.key === "loggedOut") {
      // Log the user out and refresh the page
      location.reload();
    }
  };

  /* ------------------------------ Tick methods ------------------------------ */
  public destroy() {
    // Properly remove all the event listeners
    window.removeEventListener("keydown", this.handleKeyDown, false);
    window.removeEventListener("keyup", this.handleKeyUp, false);

    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("wheel", this.handleGlobalWheel);

    window.removeEventListener("touchstart", this.handleTouchStart);
    window.removeEventListener("touchmove", this.handleTouchMove);
    window.removeEventListener("touchend", this.handleTouchEnd);

    window.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("storage", this.handleStorageEvent);
  }

  public isKeyPressed(code: string) {
    // Check if the key exists in keyStates and is pressed
    if (this.keyStates[code] === true) {
      return true;
    } else {
      return false;
    }
  }
}
