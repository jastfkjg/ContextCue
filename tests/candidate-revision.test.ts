import { describe, expect, it } from "vitest";
import type { CandidateReply } from "../src/shared/types";
import { candidateRevisionReducer as reduce, createCandidateRevisionState, visibleCandidates } from "../src/lib/candidate-revision";

const candidate = (text: string): CandidateReply => ({ text, tone: "Natural", strategy: "Direct", action: "insert" });
const original = [candidate("Original one"), { ...candidate("Original two"), action: "replace-selection" as const }];

describe("revision candidate groups", () => {
  it("keeps the current suggestion until the first complete result, then preserves selection as more arrive", () => {
    let state = reduce(createCandidateRevisionState(original), { type: "select", index: 1 });
    state = reduce(state, { type: "start", id: "a" });
    expect(visibleCandidates(state)[state.index].text).toBe("Original two");
    state = reduce(state, { type: "candidate", id: "a", candidate: candidate("First") });
    expect(state).toMatchObject({ group: "revised", index: 0 });
    state = reduce(state, { type: "candidate", id: "a", candidate: candidate("Second") });
    state = reduce(state, { type: "select", index: 1 });
    state = reduce(state, { type: "candidate", id: "a", candidate: candidate("Third") });
    expect(visibleCandidates(state)[state.index].text).toBe("Second");
    state = reduce(state, { type: "complete", id: "a", candidates: [candidate("First"), candidate("Second"), candidate("Third")] });
    expect(state.index).toBe(1);
    expect(state.revised?.every((item) => item.action === "replace-selection")).toBe(true);
    state = reduce(state, { type: "group", group: "original" });
    expect(visibleCandidates(state)).toEqual(original);
    state = reduce(state, { type: "group", group: "revised" });
    expect(visibleCandidates(state)).toHaveLength(3);
  });

  it("rolls back a failed replacement, including a revision of a revised group", () => {
    let state = reduce(createCandidateRevisionState(original), { type: "start", id: "first" });
    state = reduce(state, { type: "complete", id: "first", candidates: [candidate("Kept version")] });
    state = reduce(state, { type: "start", id: "retry" });
    state = reduce(state, { type: "candidate", id: "retry", candidate: candidate("Temporary result") });
    state = reduce(state, { type: "fail", id: "retry" });
    expect(visibleCandidates(state).map((item) => item.text)).toEqual(["Kept version"]);
    expect(state.original).toEqual(original);
  });

  it("keeps completed candidates on Stop, rejects late events and replaces rather than appending groups", () => {
    let state = reduce(createCandidateRevisionState(original), { type: "start", id: "old" });
    state = reduce(state, { type: "candidate", id: "old", candidate: candidate("Partial group") });
    state = reduce(state, { type: "stop", id: "old" });
    expect(visibleCandidates(state)[0].text).toBe("Partial group");
    state = reduce(state, { type: "start", id: "new" });
    const current = state;
    expect(reduce(state, { type: "complete", id: "old", candidates: [candidate("Late")] })).toBe(current);
    expect(reduce(state, { type: "candidate", id: "old", candidate: candidate("Late") })).toBe(current);
    state = reduce(state, { type: "complete", id: "new", candidates: [candidate("New group")] });
    expect(visibleCandidates(state).map((item) => item.text)).toEqual(["New group"]);
    expect(state.original).toEqual(original);
  });

  it("preserves the current group when stopping before any result or receiving an empty response", () => {
    const initial = createCandidateRevisionState(original);
    const actions: Parameters<typeof reduce>[1][] = [{ type: "stop", id: "a" }, { type: "complete", id: "a", candidates: [] }];
    for (const action of actions) {
      const state = reduce(reduce(initial, { type: "start", id: "a" }), action);
      expect(visibleCandidates(state)).toEqual(original);
      expect(state.pending).toBeNull();
    }
  });
});
