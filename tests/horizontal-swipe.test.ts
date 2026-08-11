import { describe, expect, it } from "vitest";
import { consumeHorizontalSwipe, createHorizontalSwipeTracker } from "../src/lib/horizontal-swipe";

describe("horizontal trackpad swipe", () => {
  it("emits only one step for a swipe and its momentum tail", () => {
    const tracker = createHorizontalSwipeTracker();

    expect(consumeHorizontalSwipe(tracker, 12, 0, 0)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 12, 0, 16)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 12, 0, 32)).toBe(1);
    expect(consumeHorizontalSwipe(tracker, 18, 0, 48)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 9, 0, 64)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 3, 0, 80)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 1, 0, 96)).toBe(0);
  });

  it("recognizes a consecutive swipe when its impulse rises above the momentum tail", () => {
    const tracker = createHorizontalSwipeTracker();

    consumeHorizontalSwipe(tracker, 12, 0, 0);
    consumeHorizontalSwipe(tracker, 12, 0, 16);
    expect(consumeHorizontalSwipe(tracker, 12, 0, 32)).toBe(1);
    consumeHorizontalSwipe(tracker, 6, 0, 48);
    consumeHorizontalSwipe(tracker, 3, 0, 64);
    consumeHorizontalSwipe(tracker, 2, 0, 80);

    expect(consumeHorizontalSwipe(tracker, 14, 0, 96)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 20, 0, 112)).toBe(1);
  });

  it("recognizes a consecutive swipe after a quiet gap", () => {
    const tracker = createHorizontalSwipeTracker();

    consumeHorizontalSwipe(tracker, -18, 0, 0);
    expect(consumeHorizontalSwipe(tracker, -18, 0, 16)).toBe(-1);
    expect(consumeHorizontalSwipe(tracker, -18, 0, 100)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, -18, 0, 116)).toBe(-1);
  });

  it("ignores vertical scrolling", () => {
    const tracker = createHorizontalSwipeTracker();

    expect(consumeHorizontalSwipe(tracker, 20, 24, 0)).toBe(0);
    expect(consumeHorizontalSwipe(tracker, 20, 24, 16)).toBe(0);
  });
});
