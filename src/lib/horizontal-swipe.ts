export interface HorizontalSwipeTracker {
  distance: number;
  locked: boolean;
  lockedAt: number;
  lastEventAt: number;
  minimumLockedMagnitude: number;
}

const SWIPE_DISTANCE = 32;
const NEW_GESTURE_GAP_MS = 70;
const IMPULSE_RESET_AFTER_MS = 60;
const IMPULSE_MINIMUM = 10;
const IMPULSE_MULTIPLIER = 2.5;

export function createHorizontalSwipeTracker(): HorizontalSwipeTracker {
  return {
    distance: 0,
    locked: false,
    lockedAt: 0,
    lastEventAt: Number.NEGATIVE_INFINITY,
    minimumLockedMagnitude: Number.POSITIVE_INFINITY
  };
}

/**
 * Turns a stream of macOS trackpad wheel events into one carousel step per
 * physical swipe. Momentum events keep arriving after the fingers lift, so a
 * debounce timer cannot reliably mark the end of a gesture. A quiet gap or a
 * renewed impulse after the momentum tail instead starts the next gesture.
 */
export function consumeHorizontalSwipe(
  tracker: HorizontalSwipeTracker,
  deltaX: number,
  deltaY: number,
  timestamp: number
): -1 | 0 | 1 {
  const magnitude = Math.abs(deltaX);
  if (magnitude <= Math.abs(deltaY) || magnitude < 1) return 0;

  if (tracker.locked) {
    const gap = timestamp - tracker.lastEventAt;
    const lockAge = timestamp - tracker.lockedAt;
    const renewedImpulse = lockAge >= IMPULSE_RESET_AFTER_MS
      && magnitude >= IMPULSE_MINIMUM
      && magnitude >= tracker.minimumLockedMagnitude * IMPULSE_MULTIPLIER;

    if (gap >= NEW_GESTURE_GAP_MS || renewedImpulse) {
      tracker.locked = false;
      tracker.distance = 0;
      tracker.minimumLockedMagnitude = Number.POSITIVE_INFINITY;
    } else {
      tracker.minimumLockedMagnitude = Math.min(tracker.minimumLockedMagnitude, magnitude);
      tracker.lastEventAt = timestamp;
      return 0;
    }
  }

  tracker.distance += deltaX;
  tracker.lastEventAt = timestamp;
  if (Math.abs(tracker.distance) < SWIPE_DISTANCE) return 0;

  const direction = tracker.distance > 0 ? 1 : -1;
  tracker.distance = 0;
  tracker.locked = true;
  tracker.lockedAt = timestamp;
  tracker.minimumLockedMagnitude = magnitude;
  return direction;
}
