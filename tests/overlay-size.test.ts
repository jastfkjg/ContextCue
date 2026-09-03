import { describe, expect, it } from "vitest";
import { OverlaySizer } from "../electron/services/overlay-size";

function fixture() {
  let bounds = { x: 100, y: 100, width: 420, height: 140 };
  const window = { getBounds: () => ({ ...bounds }), setBounds: (next: typeof bounds) => { bounds = next; } };
  const sizer = new OverlaySizer(window, () => ({ x: 0, y: 0, width: 1200, height: 900 }));
  sizer.show("suggestions");
  return { window, sizer };
}

describe("resizable suggestion and Ask AI windows", () => {
  it("expands the editor, then fits the saved candidate again", () => {
    const { window, sizer } = fixture();
    sizer.fitContent(620, true, true);
    expect(window.getBounds().height).toBe(540);
    sizer.fitContent(180, true, false);
    expect(window.getBounds().height).toBe(180);
  });
  it("keeps manual height for the current candidate, then shrinks for a shorter candidate", () => {
    const { window, sizer } = fixture();
    sizer.fitContent(900);
    expect(window.getBounds().height).toBe(360);
    sizer.resizeBy("bottom-right", 200, 200);
    expect(window.getBounds()).toMatchObject({ width: 620, height: 560 });
    sizer.fitContent(150);
    expect(window.getBounds()).toMatchObject({ width: 620, height: 560 });
    sizer.fitContent(150, true);
    expect(window.getBounds()).toMatchObject({ width: 620, height: 150 });
    sizer.fitContent(900, true);
    expect(window.getBounds()).toMatchObject({ width: 620, height: 360 });
  });

  it("reopens with the preferred width and automatically fits the content height", () => {
    const { window, sizer } = fixture();
    sizer.resizeBy("bottom-right", 200, 400);
    sizer.fitContent(150);
    sizer.show("loading");
    sizer.show("suggestions");
    expect(window.getBounds()).toMatchObject({ width: 620, height: 150 });
    sizer.fitContent(170);
    expect(window.getBounds().height).toBe(170);
  });

  it("continues fitting reflowed text after changing only the width", () => {
    const { window, sizer } = fixture();
    sizer.fitContent(300);
    sizer.resizeBy("right", 200, 0);
    sizer.fitContent(180);
    expect(window.getBounds()).toMatchObject({ width: 620, height: 180 });
  });

  it("keeps separate preferred sizes for suggestions and Ask AI", () => {
    const { window, sizer } = fixture();
    sizer.resizeBy("bottom-right", 80, 120);
    sizer.show("ask");
    expect(window.getBounds()).toMatchObject({ width: 420, height: 336 });
    sizer.resizeBy("bottom", 0, 100);
    sizer.fitContent(180);
    expect(window.getBounds().height).toBe(436);
    sizer.show("suggestions");
    expect(window.getBounds()).toMatchObject({ width: 500, height: 140 });
    sizer.show("ask");
    expect(window.getBounds().height).toBe(436);
  });

  it("keeps the opposite corner stationary and clamps to minimum size and display bounds", () => {
    const { window, sizer } = fixture();
    sizer.resizeBy("top-left", 30, -40);
    expect(window.getBounds()).toEqual({ x: 130, y: 60, width: 390, height: 180 });
    sizer.resizeBy("bottom-right", -10000, -10000);
    expect(window.getBounds()).toMatchObject({ width: 340, height: 140 });
    sizer.resizeBy("bottom-right", 10000, 10000);
    expect(window.getBounds()).toEqual({ x: 18, y: 18, width: 1164, height: 864 });
  });

  it("ignores invalid dimensions and does not resize loading or error panels", () => {
    const { window, sizer } = fixture();
    const original = window.getBounds();
    sizer.resizeBy("right", NaN, 1);
    sizer.fitContent(Infinity);
    expect(window.getBounds()).toEqual(original);
    sizer.show("error");
    sizer.resizeBy("right", 200, 0);
    expect(window.getBounds()).toMatchObject({ width: 420, height: 150 });
  });
});
