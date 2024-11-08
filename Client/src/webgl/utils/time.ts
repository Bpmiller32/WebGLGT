/* -------------------------------------------------------------------------- */
/*    Used to pass all time and tick related to Experience and its children   */
/* -------------------------------------------------------------------------- */

import Emitter from "../../eventEmitter";
import * as THREE from "three";

export default class Time {
  public clock: THREE.Clock;
  public start: number;
  public elapsed: number;
  public delta: number;

  private previous: number;

  constructor() {
    this.clock = new THREE.Clock();
    this.start = this.clock.startTime;
    this.elapsed = this.clock.getElapsedTime();
    this.delta = 16; // 16 because at 60 fps delta for 1 frame is ~16. Avoid using 0 for bugs
    this.previous = 0;

    // Instead of calling tick() immediately, wait 1 frame for delta time subtraction
    window.requestAnimationFrame(() => {
      this.tick();
    });
  }

  private tick() {
    this.elapsed = this.clock.getElapsedTime();
    // Clamp this value to a minimum framerate, this way when tab is suspended the deltaTime does not get huge
    this.delta = Math.min(this.elapsed - this.previous, 1 / 30);
    this.previous = this.elapsed;

    Emitter.emit("tick");

    window.requestAnimationFrame(() => {
      this.tick();
    });
  }
}
