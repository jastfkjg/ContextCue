import type { ReactNode } from "react";

interface Props {
  content: string;
  className?: string;
  emptyFallback?: ReactNode;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

function startsBlock(line: string): boolean {
  return !line.trim()
    || /^\s*```/.test(line)
    || /^\s*[-*]\s+/.test(line)
    || /^\s*\d+\.\s+/.test(line)
    || /^#{1,3}\s+/.test(line)
    || /^>\s?/.test(line)
    || /^\s*---+\s*$/.test(line);
}

function renderMarkdownBlocks(content: string): ReactNode[] {
  const lines = content.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    if (/^\s*```/.test(line)) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(
        <pre key={`code-${index}`} data-language={language || undefined}>
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ul key={`unordered-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ol key={`ordered-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const children = renderInlineMarkdown(heading[2]);
      if (heading[1].length === 1) blocks.push(<h1 key={index}>{children}</h1>);
      else if (heading[1].length === 2) blocks.push(<h2 key={index}>{children}</h2>);
      else blocks.push(<h3 key={index}>{children}</h3>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push(<blockquote key={`quote-${index}`}>{renderInlineMarkdown(quote.join("\n"))}</blockquote>);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      blocks.push(<hr key={index}/>);
      continue;
    }

    const paragraph = [line];
    while (index + 1 < lines.length && !startsBlock(lines[index + 1])) {
      paragraph.push(lines[index + 1]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(paragraph.join("\n"))}</p>);
  }

  return blocks;
}

export function MarkdownContent({ content, className = "", emptyFallback = null }: Props) {
  const blocks = renderMarkdownBlocks(content);
  return (
    <div className={["markdown-content", className].filter(Boolean).join(" ")}>
      {blocks.length ? blocks : emptyFallback}
    </div>
  );
}
