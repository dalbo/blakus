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
