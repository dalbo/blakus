class Door {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 30;
    this.height = 50;
  }

  isNear(player) {
    // Distance from player center to door center — generous enough that
    // pressing into the level's end wall still counts as "at the door".
    const pcx = player.x + player.width / 2;
    const dcx = this.x + this.width / 2;
    const py  = player.y + player.height;
    return Math.abs(pcx - dcx) < 80 &&
           py > this.y && py < this.y + this.height + 10;
  }

  draw(ctx, showPrompt) {
    // Frame
    ctx.fillStyle = '#7a5910';
    ctx.fillRect(this.x - 3, this.y - 4, this.width + 6, this.height + 4);
    // Panel
    ctx.fillStyle = '#c4902a';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    // Inner panels
    ctx.fillStyle = '#d4a040';
    ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, this.height / 2 - 6);
    ctx.fillRect(this.x + 4, this.y + this.height / 2 + 2, this.width - 8, this.height / 2 - 6);
    // Knob
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(this.x + this.width - 7, this.y + this.height * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();

    if (showPrompt) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x + this.width / 2 - 14, this.y - 22, 28, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[E]', this.x + this.width / 2, this.y - 10);
      ctx.restore();
    }
  }
}
