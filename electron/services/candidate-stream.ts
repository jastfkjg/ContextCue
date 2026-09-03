/** Read only complete array entries, never a half-written draft or JSON metadata.
 * Strings are tokenized so braces and candidate-like text inside a draft stay data.
 * The buffer is bounded by the model's output budget and rescanned on each delta.
 */
export function completeStreamCandidates(text: string): unknown[] {
  const entries: unknown[] = [];
  let depth = 0;
  let arrayDepth = -1;
  let stringStart = -1;
  let escaped = false;
  let key = "";
  let entryStart = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (stringStart >= 0) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') {
        if (depth === 1 && arrayDepth < 0 && /^\s*:/.test(text.slice(i + 1))) {
          try { key = JSON.parse(text.slice(stringStart, i + 1)); } catch { key = ""; }
        }
        if (depth === arrayDepth && entryStart === stringStart) {
          try { entries.push(JSON.parse(text.slice(entryStart, i + 1))); } catch { /* incomplete */ }
          entryStart = -1;
        }
        stringStart = -1;
      }
      continue;
    }
    if (char === '"') {
      stringStart = i;
      if (depth === arrayDepth && entryStart < 0) entryStart = i;
    } else if (char === "{" || char === "[") {
      if (depth === arrayDepth && entryStart < 0) entryStart = i;
      if (char === "[" && arrayDepth < 0 && (depth === 0 || (depth === 1 && ["candidates", "replies", "reply_candidates"].includes(key)))) {
        arrayDepth = depth + 1;
      }
      depth += 1;
      key = "";
    } else if (char === "}" || char === "]") {
      if (depth === arrayDepth && char === "]") break;
      depth -= 1;
      if (depth === arrayDepth && entryStart >= 0) {
        try { entries.push(JSON.parse(text.slice(entryStart, i + 1))); } catch { /* malformed entry */ }
        entryStart = -1;
      }
    } else if (char === ",") key = "";
  }
  return entries;
}
