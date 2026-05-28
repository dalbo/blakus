class Platform {
  constructor(x, y, width, height, color = '#3d3d5c') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    // top-edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(this.x, this.y, this.width, 3);
  }
}

class MovingPlatform extends Platform {
  // Oscillates sinusoidally between origin ± range on the given axis.
  // phase (seconds) staggers platforms so they don't all move in lockstep.
  constructor(x, y, width, height, color, axis, range, speed, phase = 0) {
    super(x, y, width, height, color);
    this._originX = x;
    this._originY = y;
    this.axis  = axis;   // 'x' or 'y'
    this.range = range;  // amplitude in px
    this.speed = speed;  // peak speed in px/s
    this._t = phase;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt) {
    this._t += dt;
    const omega  = this.speed / this.range;
    const offset = this.range * Math.sin(this._t * omega);
    if (this.axis === 'x') {
      const newX = this._originX + offset;
      this.vx = newX - this.x;  // exact frame delta, not approximated velocity
      this.vy = 0;
      this.x  = newX;
    } else {
      const newY = this._originY + offset;
      this.vx = 0;
      this.vy = newY - this.y;  // exact frame delta
      this.y  = newY;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    // Pulsing top edge signals this platform is moving
    const pulse = 0.3 + 0.2 * Math.sin(performance.now() / 250);
    ctx.fillStyle = `rgba(255,255,180,${pulse})`;
    ctx.fillRect(this.x, this.y, this.width, 3);
  }
}
