const GRAVITY        = 1500;  // px/s²
const JUMP_SPEED     = -720;  // px/s (gives ~172px max rise)
const MOVE_SPEED     = 260;   // px/s
const TERMINAL_VEL   = 900;   // px/s downward cap

const PLAYER_IMG = new Image();
PLAYER_IMG.src = 'assets/player_sprite.png';

const PLAYER2_IMG = new Image();
PLAYER2_IMG.src = 'assets/player2_sprite.png';

class Player {
  constructor(x, y, controls, tintColor = null) {
    this.x = x;
    this.y = y;
    this.width  = 28;
    this.height = 36;
    this.vx = 0;
    this.vy = 0;
    this.onGround    = false;
    this.facingRight = true;
    this.hasCrown    = true;
    this.invincible  = false;
    this.tintColor   = tintColor;
    this.sprite      = null; // override with PLAYER2_IMG for P2
    this._coyoteFrames    = 0;
    this._jumpHeld        = false;
    this._ridingPlatform  = null;
    this.controls = controls || {
      left:  ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up:    ['ArrowUp', 'KeyW', 'Space'],
      down:  ['ArrowDown', 'KeyS'],
    };
  }

  update(dt, input, platforms) {
    if (this.invincible) { this._flyUpdate(dt, input); return; }

    // Carry the player by the exact pixel delta the platform moved this frame
    if (this.onGround && this._ridingPlatform && this._ridingPlatform.vx !== undefined) {
      this.x += this._ridingPlatform.vx;
      this.y += this._ridingPlatform.vy;
    }
    this._ridingPlatform = null;

    const left  = this.controls.left.some(k  => input.isDown(k));
    const right = this.controls.right.some(k => input.isDown(k));
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
    const canJump    = this.onGround || this._coyoteFrames > 0;
    const jumpDown   = this.controls.up.some(k => input.isDown(k));
    const jumpPressed = this.controls.up.some(k => input.justPressed(k));
    if (jumpPressed && canJump) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
      this._coyoteFrames = 0;
    }

    // Variable-height jump: tap = small hop, hold = full height
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
        this._ridingPlatform = p;
      } else {
        this.y = p.y + p.height;
      }
      this.vy = 0;
    }
  }

  _flyUpdate(dt, input) {
    const FLY_SPEED = 380;
    const up    = this.controls.up.some(k   => input.isDown(k));
    const down  = this.controls.down.some(k => input.isDown(k));
    const left  = this.controls.left.some(k => input.isDown(k));
    const right = this.controls.right.some(k => input.isDown(k));

    this.vx = 0; this.vy = 0;
    if (right) this.vx += FLY_SPEED;
    if (left)  this.vx -= FLY_SPEED;
    if (up)    this.vy -= FLY_SPEED;
    if (down)  this.vy += FLY_SPEED;

    if (this.vx > 0) this.facingRight = true;
    else if (this.vx < 0) this.facingRight = false;

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
    this._ridingPlatform = null;
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

    const img = this.sprite || PLAYER_IMG;
    if (img.complete && img.naturalWidth > 0) {
      this._drawSprite(ctx, img);
    } else {
      this._drawFallback(ctx);
    }

    if (this.hasCrown) this._drawCrown(ctx);
  }

  _drawSprite(ctx, img) {
    const vw = 40, vh = 44;
    const dx = this.x + (this.width  - vw) / 2;  // -6
    const dy = this.y + (this.height - vh) / 2;  // -4

    const overlay = this.invincible ? 'rgba(255, 220, 70, 0.55)' : null;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (!this.facingRight) {
      ctx.drawImage(img, dx, dy, vw, vh);
      if (overlay) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = overlay;
        ctx.fillRect(dx, dy, vw, vh);
      }
    } else {
      ctx.translate(dx + vw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, vw, vh);
      if (overlay) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    ctx.restore();
  }

  _drawFallback(ctx) {
    ctx.fillStyle = this.invincible ? '#ffd700' : (this.tintColor ? '#1a55cc' : '#c22030');
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
