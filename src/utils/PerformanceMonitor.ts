export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  public fps = 60;

  constructor() {
    this.update();
  }

  private update() {
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
    }
    requestAnimationFrame(() => this.update());
  }
}
