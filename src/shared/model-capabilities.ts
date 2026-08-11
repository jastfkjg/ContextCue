export function inferImageInputSupport(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return true;

  // DeepSeek text/reasoning/coder models may be exposed through OpenAI-compatible
  // endpoints that accept a multimodal-shaped request but silently ignore images.
  // Explicit visual variants remain opt-in through common capability markers.
  if (/(?:^|[/_.:-])deepseek/.test(normalized)) {
    return /(?:^|[-_.:/])(vl\d*|vision|visual|multimodal|omni|ocr)(?:$|[-_.:/])/.test(normalized);
  }

  return true;
}
