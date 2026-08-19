import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "../src/components/MarkdownContent";

describe("MarkdownContent", () => {
  it("renders the lightweight markdown used by AI answers", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, {
      content: [
        "## Summary",
        "",
        "Use **bold**, *emphasis*, and `inline code`.",
        "",
        "- First item",
        "- Second item",
        "",
        "1. One",
        "2. Two",
        "",
        "```ts",
        "const ready = true;",
        "```"
      ].join("\n")
    }));

    expect(html).toContain("<h2>Summary</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<code>inline code</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("data-language=\"ts\"");
    expect(html).toContain("const ready = true;");
  });

  it("escapes raw HTML instead of injecting it", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, {
      content: "<script>alert('unsafe')</script>"
    }));

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
