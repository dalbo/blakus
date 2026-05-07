class Spike {
  constructor(x, y, count = 1) {
    this.x      = x;
    this.y      = y;
    this.count  = count;
    this.width  = count * 16;
    this.height = 14;
  }

  collides(player) {
    const i = 3; // inset for fairness
    return player.x + player.width - i > this.x + i &&
           player.x + i              < this.x + this.width - i &&
           player.y + player.height - i > this.y + i &&
           player.y + i              < this.y + this.height;
  }

  draw(ctx) {
    for (let n = 0; n < this.count; n++) {
      const sx = this.x + n * 16;
      ctx.fillStyle = '#cc2244';
      ctx.beginPath();
      ctx.moveTo(sx,      this.y + this.height);
      ctx.lineTo(sx + 8,  this.y);
      ctx.lineTo(sx + 16, this.y + this.height);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff4466';
      ctx.beginPath();
      ctx.moveTo(sx + 3,  this.y + this.height - 2);
      ctx.lineTo(sx + 8,  this.y + 3);
      ctx.lineTo(sx + 10, this.y + this.height - 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}
