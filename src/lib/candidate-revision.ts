import type { CandidateReply } from "../shared/types";

interface Selection {
  revised: CandidateReply[] | null;
  group: "original" | "revised";
  index: number;
}
export interface CandidateRevisionState extends Selection {
  original: CandidateReply[];
  pending: { id: string; before: Selection; received: number; action: CandidateReply["action"] } | null;
}
type Action =
  | { type: "start"; id: string }
  | { type: "candidate"; id: string; candidate: CandidateReply }
  | { type: "complete"; id: string; candidates: CandidateReply[] }
  | { type: "stop"; id: string }
  | { type: "fail"; id: string }
  | { type: "select"; index: number }
  | { type: "group"; group: Selection["group"] };

export function createCandidateRevisionState(original: CandidateReply[]): CandidateRevisionState {
  return { original, revised: null, group: "original", index: 0, pending: null };
}
export function visibleCandidates(state: CandidateRevisionState): CandidateReply[] {
  return state.group === "revised" && state.revised ? state.revised : state.original;
}

/** One original group plus the latest revision. A failed replacement is atomic;
 * Stop explicitly keeps finished alternatives. Request IDs reject late events.
 */
export function candidateRevisionReducer(state: CandidateRevisionState, action: Action): CandidateRevisionState {
  if (action.type === "select") return { ...state, index: (action.index + visibleCandidates(state).length) % visibleCandidates(state).length };
  if (action.type === "group") {
    if (state.pending || (action.group === "revised" && !state.revised)) return state;
    return { ...state, group: action.group, index: 0 };
  }
  if (action.type === "start") return {
    ...state,
    pending: { id: action.id, before: { revised: state.revised, group: state.group, index: state.index }, received: 0, action: visibleCandidates(state)[state.index]?.action }
  };
  const pending = state.pending;
  if (!pending || pending.id !== action.id) return state;
  if (action.type === "fail") return { ...state, ...pending.before, pending: null };
  if (action.type === "stop") return { ...state, pending: null };
  if (action.type === "candidate") {
    const candidates = pending.received ? state.revised! : [];
    if (candidates.some((item) => item.text === action.candidate.text)) return state;
    return {
      ...state, group: "revised", index: pending.received ? state.index : 0,
      revised: [...candidates, { ...action.candidate, action: pending.action }],
      pending: { ...pending, received: candidates.length + 1 }
    };
  }
  // JSON-only providers deliver the whole group here; streaming providers have
  // already shown it. Preserve the user's selection when the request completes.
  if (!action.candidates.length) return { ...state, ...pending.before, pending: null };
  return {
    ...state, group: "revised", pending: null,
    revised: action.candidates.map((candidate) => ({ ...candidate, action: pending.action })),
    index: pending.received ? Math.min(state.index, action.candidates.length - 1) : 0
  };
}
