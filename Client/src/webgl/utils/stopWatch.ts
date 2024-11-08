/* -------------------------------------------------------------------------- */
/*                           Stopwatch utility class                          */
/* -------------------------------------------------------------------------- */

import Experience from "../experience";
import Time from "./time";

export default class Stopwatch {
  private experience: Experience;
  private time: Time;

  private isRunning: boolean;
  public startTime: number;
  public elapsedTime: number;

  constructor() {
    // Experience fields
    this.experience = Experience.getInstance();
    this.time = this.experience.time;

    // Class fields
    this.startTime = 0;
    this.elapsedTime = 0;
    this.isRunning = false;

    this.reset();
  }

  /* ------------------------------ Tick methods ------------------------------ */
  public start() {
    if (!this.isRunning) {
      this.startTime = this.time.elapsed;
      this.isRunning = true;
    }
  }

  public stop() {
    if (this.isRunning) {
      this.isRunning = false;
    }
  }

  public reset() {
    if (this.isRunning) {
      this.stop();
    }

    this.startTime = 0;
    this.elapsedTime = 0;
  }

  public update() {
    if (this.isRunning) {
      this.elapsedTime = this.time.elapsed - this.startTime;
    }
  }
}
