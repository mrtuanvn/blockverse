// Shared input state for both keyboard and mobile touch
// Both Player and ThirdPersonCamera read from this single source of truth

export interface InputState {
  // Movement (normalized -1 to 1)
  moveX: number;
  moveZ: number;

  // Actions
  jump: boolean;
  attack: boolean;
  interact: boolean;

  // Camera rotation (deltas from touch/mouse)
  cameraDeltaX: number;
  cameraDeltaY: number;

  // Request pointer lock (desktop only)
  requestPointerLock: boolean;
}

const inputState: InputState = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  attack: false,
  interact: false,
  cameraDeltaX: 0,
  cameraDeltaY: 0,
  requestPointerLock: false,
};

// Consumed each frame — read-then-reset pattern for deltas
export function consumeCameraDelta(): { dx: number; dy: number } {
  const dx = inputState.cameraDeltaX;
  const dy = inputState.cameraDeltaY;
  inputState.cameraDeltaX = 0;
  inputState.cameraDeltaY = 0;
  return { dx, dy };
}

export function setMovement(x: number, z: number) {
  inputState.moveX = x;
  inputState.moveZ = z;
}

export function setJump(v: boolean) {
  inputState.jump = v;
}

export function setAttack(v: boolean) {
  inputState.attack = v;
}

export function setInteract(v: boolean) {
  inputState.interact = v;
}

export function addCameraDelta(dx: number, dy: number) {
  inputState.cameraDeltaX += dx;
  inputState.cameraDeltaY += dy;
}

export function requestPointerLock() {
  inputState.requestPointerLock = true;
}

export function consumePointerLockRequest(): boolean {
  const v = inputState.requestPointerLock;
  inputState.requestPointerLock = false;
  return v;
}

export function getInputState(): Readonly<InputState> {
  return inputState;
}

// ─── Keyboard side ───
let keyboardMoveX = 0;
let keyboardMoveZ = 0;

export function initKeyboardInput() {
  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keyboardMoveZ = -1;
    if (key === 's' || key === 'arrowdown') keyboardMoveZ = 1;
    if (key === 'a' || key === 'arrowleft') keyboardMoveX = -1;
    if (key === 'd' || key === 'arrowright') keyboardMoveX = 1;
    if (key === ' ' || key === 'space') inputState.jump = true;
    if (key === 'e') inputState.attack = true;
    updateKeyboardMovement();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keyboardMoveZ = keyboardMoveZ === -1 ? 0 : keyboardMoveZ;
    if (key === 's' || key === 'arrowdown') keyboardMoveZ = keyboardMoveZ === 1 ? 0 : keyboardMoveZ;
    if (key === 'a' || key === 'arrowleft') keyboardMoveX = keyboardMoveX === -1 ? 0 : keyboardMoveX;
    if (key === 'd' || key === 'arrowright') keyboardMoveX = keyboardMoveX === 1 ? 0 : keyboardMoveX;
    if (key === ' ' || key === 'space') inputState.jump = false;
    if (key === 'e') inputState.attack = false;
    updateKeyboardMovement();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

function updateKeyboardMovement() {
  // Only apply keyboard movement if touch isn't active
  // Touch movement is set directly via setMovement()
  // We use a flag: if touch recently set values, keyboard is ignored
  if (!touchActive) {
    const len = Math.sqrt(keyboardMoveX * keyboardMoveX + keyboardMoveZ * keyboardMoveZ);
    if (len > 0) {
      inputState.moveX = keyboardMoveX / len;
      inputState.moveZ = keyboardMoveZ / len;
    } else {
      inputState.moveX = 0;
      inputState.moveZ = 0;
    }
  }
}

let touchActive = false;

export function setTouchActive(v: boolean) {
  touchActive = v;
  if (!v) {
    // Touch released — let keyboard take over again
    inputState.moveX = keyboardMoveX;
    inputState.moveZ = keyboardMoveZ;
    updateKeyboardMovement();
  }
}

// Check if device is likely mobile
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // iPad detection
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}