/* -------------------------------------------------------------------------- */
/*                       Dat.Gui debug panel for ThreeJs                      */
/* -------------------------------------------------------------------------- */

import dat from "dat.gui";
import Stats from "stats.js";

export default class Debug {
  public isActive: boolean;
  public ui?: dat.GUI;
  public stats?: Stats;

  constructor() {
    this.isActive = window.location.hash === "#debug";

    if (this.isActive) {
      // Debug gui
      this.ui = new dat.GUI({ width: 300, hideable: false });

      // FPS counter
      this.stats = new Stats();
      this.stats.showPanel(0);

      // // CPU and memory counters
      // this.stats.addPanel(new Stats.Panel("CPU", "#ff8", "#221"));
      // this.stats.addPanel(new Stats.Panel("Memory", "#f08", "#201"));

      this.stats.dom.style.left = "";
      this.stats.dom.style.right = "315px";

      document.body.appendChild(this.stats.dom);
    }
  }

  public destroy() {
    this.ui?.destroy();
    this.stats?.dom.parentNode?.removeChild(this.stats.dom);
  }
}
