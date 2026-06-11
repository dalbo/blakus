class Input {
  constructor() {
    this.keys = {};
    this._justPressed = {};

    window.addEventListener('keydown', e => {
      if (!this.keys[e.code]) this._justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (document.activeElement.tagName !== 'INPUT' &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
           'KeyE', 'KeyR', 'KeyM', 'KeyP', 'Enter', 'KeyS', 'KeyQ',
           'ShiftLeft', 'ShiftRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
  }

  isDown(code) {
    return !!this.keys[code];
  }

  justPressed(code) {
    return !!this._justPressed[code];
  }

  clearFrame() {
    this._justPressed = {};
  }
}
