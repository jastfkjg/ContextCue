import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/lib/error-message";

describe("user-facing IPC errors", () => {
  it("removes the Electron transport wrapper without losing recovery instructions", () => {
    expect(errorMessage(new Error("Error invoking remote method 'ask:refresh': Error: Return to the original window.")))
      .toBe("Return to the original window.");
    expect(errorMessage("Error: Error invoking remote method 'ask:refresh': Error: Allow Screen Recording."))
      .toBe("Allow Screen Recording.");
  });
  it("preserves ordinary errors and provides a fallback for unknown failures", () => {
    expect(errorMessage(new Error("Try again."))).toBe("Try again.");
    expect(errorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});
