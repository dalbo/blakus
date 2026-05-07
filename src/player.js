const GRAVITY        = 1500;  // px/s²
const JUMP_SPEED     = -720;  // px/s (gives ~172px max rise)
const MOVE_SPEED     = 260;   // px/s
const TERMINAL_VEL   = 900;   // px/s downward cap

// Sprite — 441x441 pixel-art character. Loaded once; draw() falls back to
// rectangles until it's ready (typically one frame).
const PLAYER_IMG = new Image();
PLAYER_IMG.src = 'assets/player_sprite.png';

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width  = 28;
    this.height = 36;
    this.vx = 0;
    this.vy = 0;
    this.onGround   = false;
    this.facingRight = true;
    this.hasCrown   = true; // flawless-run cosmetic
    this.invincible = false; // secret fly/god mode (Enter)
    // coyote time: allow jump for a few frames after walking off a ledge
    this._coyoteFrames = 0;
    // variable-height jump: tracks whether jump was held last frame
    this._jumpHeld = false;
  }

  update(dt, input, platforms) {
    if (this.invincible) { this._flyUpdate(dt, input); return; }

    // Horizontal (arrows or WASD)
    const left  = input.isDown('ArrowLeft')  || input.isDown('KeyA');
    const right = input.isDown('ArrowRight') || input.isDown('KeyD');
    if (left) {
      this.vx = -MOVE_SPEED;
      this.facingRight = false;
    } else if (right) {
      this.vx = MOVE_SPEED;
      this.facingRight = true;
    } else {
      this.vx = 0;
    }

    // Jump (coyote window: 6 frames ≈ 100ms)
    const canJump = this.onGround || this._coyoteFrames > 0;
    const jumpDown = input.isDown('ArrowUp') ||
                     input.isDown('KeyW')    ||
                     input.isDown('Space');
    const jumpPressed = input.justPressed('ArrowUp') ||
                        input.justPressed('KeyW')    ||
                        input.justPressed('Space');
    if (jumpPressed && canJump) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
      this._coyoteFrames = 0;
    }

    // Variable-height jump: if the player releases the jump button while
    // still moving up, cut the upward velocity. Short tap = tiny hop,
    // long hold = full height.
    if (this._jumpHeld && !jumpDown && this.vy < 0) {
      this.vy *= 0.4;
    }
    this._jumpHeld = jumpDown;

    // Gravity
    this.vy = Math.min(this.vy + GRAVITY * dt, TERMINAL_VEL);

    // Move X then resolve, move Y then resolve (split-axis)
    this.x += this.vx * dt;
    this._resolveX(platforms);

    const wasOnGround = this.onGround;
    this.onGround = false;
    this.y += this.vy * dt;
    this._resolveY(platforms);

    // Coyote countdown
    if (wasOnGround && !this.onGround) {
      this._coyoteFrames = 6;
    } else if (this.onGround) {
      this._coyoteFrames = 0;
    } else {
      this._coyoteFrames = Math.max(0, this._coyoteFrames - 1);
    }
  }

  _resolveX(platforms) {
    for (const p of platforms) {
      if (!this._overlaps(p)) continue;
      if (this.vx > 0) {
        this.x = p.x - this.width;
      } else if (this.vx < 0) {
        this.x = p.x + p.width;
      }
      this.vx = 0;
    }
  }

  _resolveY(platforms) {
    for (const p of platforms) {
      if (!this._overlaps(p)) continue;
      if (this.vy >= 0) {
        this.y = p.y - this.height;
        this.onGround = true;
      } else {
        this.y = p.y + p.height;
      }
      this.vy = 0;
    }
  }

  _flyUpdate(dt, input) {
    const FLY_SPEED = 380;
    const up    = input.isDown('ArrowUp')    || input.isDown('KeyW') || input.isDown('Space');
    const down  = input.isDown('ArrowDown')  || input.isDown('KeyS');
    const left  = input.isDown('ArrowLeft')  || input.isDown('KeyA');
    const right = input.isDown('ArrowRight') || input.isDown('KeyD');

    this.vx = 0; this.vy = 0;
    if (right) this.vx += FLY_SPEED;
    if (left)  this.vx -= FLY_SPEED;
    if (up)    this.vy -= FLY_SPEED;
    if (down)  this.vy += FLY_SPEED;

    if (this.vx > 0) this.facingRight = true;
    else if (this.vx < 0) this.facingRight = false;

    // Ghost movement — fly through platforms and spikes
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.onGround = false;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y - 25;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this._coyoteFrames = 0;
  }

  _overlaps(p) {
    return this.x < p.x + p.width  &&
           this.x + this.width  > p.x &&
           this.y < p.y + p.height &&
           this.y + this.height > p.y;
  }

  draw(ctx) {
    // Pulsing aura (drawn behind the sprite)
    if (this.invincible) {
      const pulse = 0.25 + 0.2 * Math.sin(performance.now() / 120);
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.fillRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
    }

    if (PLAYER_IMG.complete && PLAYER_IMG.naturalWidth > 0) {
      this._drawSprite(ctx);
    } else {
      this._drawFallback(ctx);
    }

    if (this.hasCrown) this._drawCrown(ctx);
  }

  _drawSprite(ctx) {
    // Sprite is slightly larger than hitbox so the visual has presence
    // without inflating the collision box.
    const vw = 40, vh = 44;
    const dx = this.x + (this.width  - vw) / 2;  // -6
    const dy = this.y + (this.height - vh) / 2;  // -4

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this.facingRight) {
      ctx.drawImage(PLAYER_IMG, dx, dy, vw, vh);
      if (this.invincible) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 220, 70, 0.55)';
        ctx.fillRect(dx, dy, vw, vh);
      }
    } else {
      ctx.translate(dx + vw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(PLAYER_IMG, 0, 0, vw, vh);
      if (this.invincible) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 220, 70, 0.55)';
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    ctx.restore();
  }

  _drawFallback(ctx) {
    // Used while the sprite image is still loading (first frame or two).
    ctx.fillStyle = this.invincible ? '#ffd700' : '#c22030';
    ctx.fillRect(this.x, this.y + 8, this.width, this.height - 8);
    ctx.fillStyle = this.invincible ? '#ffe255' : '#e8d890';
    ctx.fillRect(this.x + 3, this.y, this.width - 6, 10);
    ctx.fillStyle = '#0d0d1a';
    const eyeX = this.facingRight ? this.x + this.width - 9 : this.x + 5;
    ctx.fillRect(eyeX, this.y + 2, 4, 4);
  }

  _drawCrown(ctx) {
    const baseY = this.y - 6;
    // Rim (darker gold)
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(this.x + 3, baseY, this.width - 6, 2);
    // Three peaks (bright gold)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(this.x + 4,                   baseY - 3, 3, 3);  // left
    ctx.fillRect(this.x + this.width / 2 - 2,  baseY - 5, 4, 5);  // middle (tall)
    ctx.fillRect(this.x + this.width - 7,      baseY - 3, 3, 3);  // right
    // Ruby gem on middle peak
    ctx.fillStyle = '#ff3355';
    ctx.fillRect(this.x + this.width / 2 - 1, baseY - 3, 2, 2);
  }
}
