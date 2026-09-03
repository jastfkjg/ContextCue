import { randomUUID } from "node:crypto";
import type { AskHistoryMessage, GenerateRequest, GenerationResult } from "../../src/shared/types";
import type { QuickContext } from "./quick-context";

/** All transient content belongs to one invocation, never to an app or channel. */
export interface PageSession extends QuickContext {
  id: string;
  hasSuggestions: boolean;
  createdAt: number;
  history: AskHistoryMessage[];
  result?: GenerationResult;
}

export function createPageSession(context: QuickContext): PageSession {
  return { ...context, id: randomUUID(), hasSuggestions: false, createdAt: Date.now(), history: [] };
}

export function rememberPageTurn(session: PageSession, question: string, answer: string): void {
  session.history = [...session.history,
    { role: "user" as const, content: question },
    { role: "assistant" as const, content: answer }
  ].slice(-6);
}

export function pageRequest(session: PageSession, locale: GenerateRequest["locale"]): GenerateRequest {
  return {
    sourceId: session.source?.id,
    channel: session.source?.channel ?? "other",
    locale,
    quick: true,
    scenario: "auto",
    contextPolicy: "page-only",
    target: session.target ?? undefined,
    pageContext: {
      applicationName: session.frontmost.applicationName,
      windowTitle: session.frontmost.windowTitle,
      nearbyText: [session.target?.label, session.target?.placeholder].filter((value): value is string => Boolean(value))
    }
  };
}
