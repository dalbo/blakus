class Camera {
  constructor(canvasWidth, canvasHeight, levelWidth, levelHeight) {
    this.x = 0;
    this.y = 0;
    this.width  = canvasWidth;
    this.height = canvasHeight;
    this.levelWidth  = levelWidth;
    this.levelHeight = levelHeight;
    this.lerp = 8; // higher = snappier
  }

  update(target, dt) {
    const targetX = target.x + target.width  / 2 - this.width  / 2;
    const targetY = target.y + target.height / 2 - this.height / 2;

    this.x += (targetX - this.x) * Math.min(this.lerp * dt, 1);
    this.y += (targetY - this.y) * Math.min(this.lerp * dt, 1);

    this.x = Math.max(0, Math.min(this.x, this.levelWidth  - this.width));
    this.y = Math.max(0, Math.min(this.y, this.levelHeight - this.height));
  }

  apply(ctx) {
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }
}
