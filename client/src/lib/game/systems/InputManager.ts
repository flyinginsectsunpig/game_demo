export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  mute: boolean;
  restart: boolean;
  pause: boolean;
  weapon1: boolean;
  weapon2: boolean;
  weapon3: boolean;
  weapon4: boolean;
  weapon5: boolean;
}

export class InputManager {
  private keys: { [key: string]: boolean } = {};
  private ignoreUntilRelease: Set<string> = new Set();
  private isPaused: boolean = false;
  private listenersAttached: boolean = false;

  constructor() {
    this.keys = {
      left: false,
      right: false,
      up: false,
      down: false,
      mute: false,
      restart: false,
      pause: false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
      weapon4: false,
      weapon5: false
    };
  }

  public addEventListeners() {
    if (this.listenersAttached) {
      return;
    }
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
    this.listenersAttached = true;
  }

  public removeEventListeners() {
    if (!this.listenersAttached) {
      return;
    }
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.listenersAttached = false;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const isMovementKey = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code);
    
    // Don't register movement keys if game is paused
    if (isMovementKey && this.isPaused) {
      e.preventDefault();
      return;
    }
    
    // Don't register key if we're ignoring it until release
    if (!this.ignoreUntilRelease.has(e.code)) {
      this.keys[e.code] = true;
    }
    
    // Prevent default behavior for game keys
    if (isMovementKey) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    // Remove from ignore list when key is released
    this.ignoreUntilRelease.delete(e.code);
  };

  public getInput(paused: boolean = false) {
    // If game is paused, return empty input to prevent any actions
    if (paused) {
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        weapon1: false,
        weapon2: false,
        weapon3: false,
        weapon4: false,
        weapon5: false,
        mute: false,
        restart: false,
        pause: false
      };
    }

    return {
      up: !!(this.keys["KeyW"] || this.keys["ArrowUp"]),
      down: !!(this.keys["KeyS"] || this.keys["ArrowDown"]),
      left: !!(this.keys["KeyA"] || this.keys["ArrowLeft"]),
      right: !!(this.keys["KeyD"] || this.keys["ArrowRight"]),
      weapon1: !!this.keys["1"],
      weapon2: !!this.keys["2"],
      weapon3: !!this.keys["3"],
      weapon4: !!this.keys["4"],
      weapon5: !!this.keys["5"],
      mute: !!(this.keys["m"] || this.keys["M"]),
      restart: !!(this.keys["r"] || this.keys["R"]),
      pause: !!this.keys["Escape"]
    };
  }

  private isKeyPressed(key: string): boolean {
    return this.keys[key] === true;
  }

  // Note: update() method removed as it was causing conflicts with event-driven key handling

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public clearMovementKeys() {
    // Only mark currently pressed movement keys to be ignored until released
    // This prevents stuck movement from keys held during pause
    const movementKeys = ["KeyW", "ArrowUp", "KeyS", "ArrowDown", "KeyA", "ArrowLeft", "KeyD", "ArrowRight"];
    movementKeys.forEach(key => {
      // Only add to ignore list if the key is currently pressed
      if (this.keys[key]) {
        this.ignoreUntilRelease.add(key);
      }
      // Clear the key state
      this.keys[key] = false;
    });
  }
}
