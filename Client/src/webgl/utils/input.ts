/* -------------------------------------------------------------------------- */
/*               Used to handle keyboard and mouse input events               */
/* -------------------------------------------------------------------------- */

import Emitter from "../../eventEmitter";

type Key = {
  keyCode: string;
  isPressed: (arg0: boolean) => void;
};

export default class Input {
  public isWKeyPressed: boolean;
  public isAKeyPressed: boolean;
  public isSKeyPressed: boolean;
  public isDKeyPressed: boolean;
  public isQKeyPressed: boolean;
  public isEKeyPressed: boolean;

  public isBackquotePressed: boolean;

  public is1KeyPressed: boolean;
  public is2KeyPressed: boolean;
  public is3KeyPressed: boolean;

  public isF1KeyPressed: boolean;
  public isF2KeyPressed: boolean;
  public isF3KeyPressed: boolean;

  public isF7KeyPressed: boolean;
  public isF8KeyPressed: boolean;
  public isF9KeyPressed: boolean;
  public isF10KeyPressed: boolean;

  public isControlLeftPressed: boolean;
  public isSpacePressed: boolean;
  public isShiftLeftPressed: boolean;

  public isArrowUpPressed: boolean;
  public isArrowDownPressed: boolean;
  public isArrowLeftPressed: boolean;
  public isArrowRightPressed: boolean;

  public isLeftClickPressed: boolean;
  public isRightClickPressed: boolean;
  public isMouseBackPressed: boolean;
  public isMouseForwardPressed: boolean;

  public dashboardGuiGlobal: HTMLElement | null;
  public loginGuiGlobal: HTMLElement | null;

  public dashboardTextarea: HTMLTextAreaElement | null;
  public dashboardImageName: HTMLLabelElement | null;

  public keys: Key[];

  constructor() {
    this.isWKeyPressed = false;
    this.isAKeyPressed = false;
    this.isSKeyPressed = false;
    this.isDKeyPressed = false;
    this.isQKeyPressed = false;
    this.isEKeyPressed = false;

    this.isBackquotePressed = false;

    this.is1KeyPressed = false;
    this.is2KeyPressed = false;
    this.is3KeyPressed = false;

    this.isF1KeyPressed = false;
    this.isF2KeyPressed = false;
    this.isF3KeyPressed = false;

    this.isF7KeyPressed = false;
    this.isF8KeyPressed = false;
    this.isF9KeyPressed = false;
    this.isF10KeyPressed = false;

    this.isControlLeftPressed = false;
    this.isSpacePressed = false;
    this.isShiftLeftPressed = false;

    this.isArrowUpPressed = false;
    this.isArrowDownPressed = false;
    this.isArrowLeftPressed = false;
    this.isArrowRightPressed = false;

    this.isLeftClickPressed = false;
    this.isRightClickPressed = false;
    this.isMouseBackPressed = false;
    this.isMouseForwardPressed = false;

    this.dashboardGuiGlobal = document.getElementById("gui");
    this.loginGuiGlobal = document.getElementById("loginPage");

    this.dashboardTextarea = document.getElementById(
      "guiTextArea"
    ) as HTMLTextAreaElement;
    this.dashboardImageName = document.getElementById(
      "gtImageName"
    ) as HTMLLabelElement;

    /* ------------------------------- Define keys ------------------------------ */
    this.keys = [
      // FPS keys
      {
        keyCode: "KeyW",
        isPressed: (eventResult: boolean) => {
          this.isWKeyPressed = eventResult;
        },
      },
      {
        keyCode: "KeyA",
        isPressed: (eventResult: boolean) => {
          this.isAKeyPressed = eventResult;
        },
      },
      {
        keyCode: "KeyS",
        isPressed: (eventResult: boolean) => {
          this.isSKeyPressed = eventResult;
        },
      },
      {
        keyCode: "KeyD",
        isPressed: (eventResult: boolean) => {
          this.isDKeyPressed = eventResult;
        },
      },
      {
        keyCode: "KeyQ",
        isPressed: (eventResult: boolean) => {
          this.isQKeyPressed = eventResult;
        },
      },
      {
        keyCode: "KeyE",
        isPressed: (eventResult: boolean) => {
          this.isEKeyPressed = eventResult;
        },
      },

      // Backquote
      {
        keyCode: "Backquote",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("badImage");
          }

          this.isBackquotePressed = eventResult;
        },
      },

      // Number keys
      {
        keyCode: "Digit1",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("changeClipBoxGroup", 2);
          }

          this.is1KeyPressed = eventResult;
        },
      },
      {
        keyCode: "Digit2",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("changeClipBoxGroup", 1);
          }

          this.is2KeyPressed = eventResult;
        },
      },
      {
        keyCode: "Digit3",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("changeClipBoxGroup", 0);
          }

          this.is3KeyPressed = eventResult;
        },
      },

      // Function keys
      {
        keyCode: "F1",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("stitchBoxes");
            Emitter.emit("screenshotImage");
          }

          this.isF1KeyPressed = eventResult;
        },
      },
      {
        keyCode: "F2",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("fillInForm");
          }

          this.isF2KeyPressed = eventResult;
        },
      },
      {
        keyCode: "F3",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("gotoNextImage");
          }

          this.isF3KeyPressed = eventResult;
        },
      },

      {
        keyCode: "F7",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("stitchBoxes");
          }

          this.isF7KeyPressed = eventResult;
        },
      },
      {
        keyCode: "F8",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("screenshotImage");
          }

          this.isF8KeyPressed = eventResult;
        },
      },
      {
        keyCode: "F9",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("resetImage");
          }

          this.isF9KeyPressed = eventResult;
        },
      },
      {
        keyCode: "F10",
        isPressed: (eventResult: boolean) => {
          if (eventResult) {
            Emitter.emit("switchCamera");
          }

          this.isF10KeyPressed = eventResult;
        },
      },

      // Modifier keys
      {
        keyCode: "Space",
        isPressed: (eventResult: boolean) => {
          this.isSpacePressed = eventResult;
        },
      },
      {
        keyCode: "ControlLeft",
        isPressed: (eventResult: boolean) => {
          this.isControlLeftPressed = eventResult;
        },
      },
      {
        keyCode: "ShiftLeft",
        isPressed: (eventResult: boolean) => {
          Emitter.emit("lockPointer", eventResult);

          this.isShiftLeftPressed = eventResult;
        },
      },

      // Arrow keys
      {
        keyCode: "ArrowUp",
        isPressed: (eventResult: boolean) => {
          // if (eventResult) {
          //   Emitter.emit("fillInForm");
          // }

          this.isArrowUpPressed = eventResult;
        },
      },
      {
        keyCode: "ArrowDown",
        isPressed: (eventResult: boolean) => {
          // if (eventResult) {
          //   Emitter.emit("stitchBoxes");
          //   Emitter.emit("screenshotImage");
          // }

          this.isArrowUpPressed = eventResult;
        },
      },
      {
        keyCode: "ArrowLeft",
        isPressed: (eventResult: boolean) => {
          // if (eventResult) {
          //   Emitter.emit("resetImage");
          // }

          this.isArrowLeftPressed = eventResult;
        },
      },
      {
        keyCode: "ArrowRight",
        isPressed: (eventResult: boolean) => {
          // if (eventResult) {
          //   Emitter.emit("gotoNextImage");
          // }

          this.isArrowRightPressed = eventResult;
        },
      },
    ];

    /* ------------------------------ Event methods ----------------------------- */
    // Keyboard events
    window.addEventListener(
      "keydown",
      (event: KeyboardEvent) => {
        for (const keyIndex in this.keys) {
          if (event.code === this.keys[keyIndex].keyCode) {
            this.keys[keyIndex].isPressed(true);
          }
        }
      },
      false
    );

    window.addEventListener(
      "keyup",
      (event: KeyboardEvent) => {
        for (const keyIndex in this.keys) {
          if (event.code === this.keys[keyIndex].keyCode) {
            this.keys[keyIndex].isPressed(false);
          }
        }
      },
      false
    );

    // Mouse events
    window.addEventListener("mousedown", (event) => {
      if (event.button === 1) {
        this.isLeftClickPressed = true;
      }
      if (event.button === 2) {
        this.isRightClickPressed = true;
      }
      if (event.button === 3) {
        this.isMouseBackPressed = true;
      }
      if (event.button === 4) {
        this.isMouseForwardPressed = true;
      }

      Emitter.emit("mouseDown", event);
    });

    window.addEventListener("mousemove", (event) => {
      Emitter.emit("mouseMove", event);
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 1) {
        this.isLeftClickPressed = false;
      }
      if (event.button === 2) {
        this.isRightClickPressed = false;
      }
      if (event.button === 3) {
        this.isMouseBackPressed = false;
      }
      if (event.button === 4) {
        this.isMouseForwardPressed = false;
      }

      Emitter.emit("mouseUp", event);
    });

    window.addEventListener("wheel", (event) => {
      Emitter.emit("mouseWheel", event);
    });

    // Window events
    // Disable the browser's context menu (enables prefered right click behavior)
    window.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    // Prevent the window scrolling down when using mouse wheel
    window.addEventListener("wheel", (event) => event.preventDefault(), {
      passive: false,
    });
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public destroy() {
    window.addEventListener("keydown", () => {});
    window.addEventListener("keyup", () => {});

    window.addEventListener("mousedown", () => {});
    window.addEventListener("mousemove", () => {});
    window.addEventListener("mouseup", () => {});
    window.addEventListener("wheel", () => {});

    window.addEventListener("contextmenu", () => {});
  }
}
