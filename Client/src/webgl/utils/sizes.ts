/* -------------------------------------------------------------------------- */
/*    Used to pass all window/dom element sizes to Element and its children   */
/* -------------------------------------------------------------------------- */

import Emitter from "./eventEmitter";

export default class Sizes {
  public width: number;
  public height: number;
  public pixelRatio: number;

  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);

    // Resize event
    window.addEventListener("resize", () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.pixelRatio = Math.min(window.devicePixelRatio, 2);

      Emitter.emit("resize");
    });
  }

  public destroy() {
    // Clear event listeners
    Emitter.off("resize");
    window.addEventListener("resize", () => {});
  }
}
