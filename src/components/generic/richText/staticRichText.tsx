import { parseRichText, richTextHref } from "@/functions/richText";
import type { RichTextNode } from "@/functions/richText";
import type { ReactNode } from "react";

/**
 * A stored description rendered as plain HTML, without mounting the editor: for places
 * that must be complete in the server's response (print) or that show many descriptions
 * at once. Formatting that only makes sense on screen (text colour and size) is dropped.
 * No hooks, so it renders in server and client components alike. Renders nothing for
 * an empty description.
 */
export default function StaticRichText({ content, className }: { content: string | null | undefined, className?: string }) {
  const parsed = parseRichText(content);
  if (!parsed) return null;

  return (
    <div className={className} style={{ overflowWrap: 'anywhere' }}>
      {"text" in parsed
        ? <p className="margin-0" style={{ whiteSpace: 'pre-line' }}>{parsed.text}</p>
        : renderChildren(parsed.document)}
    </div>
  );
}

function renderChildren(node: RichTextNode): ReactNode {
  return node.content?.map((child, index) => <RichNode key={index} node={child} />);
}

/** How a mark wraps its text; marks that only make sense on screen (colour, size) are left out */
const markRenderers: Record<string, (children: ReactNode, attrs?: Record<string, unknown>) => ReactNode> = {
  bold: children => <strong>{children}</strong>,
  italic: children => <em>{children}</em>,
  underline: children => <u>{children}</u>,
  lineThrough: children => <s>{children}</s>,
  superscript: children => <sup>{children}</sup>,
  subscript: children => <sub>{children}</sub>,
  highlight: children => <mark>{children}</mark>,
  link: (children, attrs) => {
    const href = richTextHref(attrs?.href);
    return href ? <a href={href} rel="noopener noreferrer nofollow">{children}</a> : children;
  },
};

function RichNode({ node }: { node: RichTextNode }) {
  if (node.type === "text") {
    return (node.marks ?? []).reduce<ReactNode>(
      (children, mark) => (mark.type && Object.hasOwn(markRenderers, mark.type) ? markRenderers[mark.type](children, mark.attrs) : children),
      node.text ?? "",
    );
  }
  if (node.type === "paragraph") return <p>{renderChildren(node)}</p>;
  if (node.type === "hardBreak") return <br />;
  if (node.type === "bulletList") return <ul>{renderChildren(node)}</ul>;
  if (node.type === "orderedList") return <ol>{renderChildren(node)}</ol>;
  if (node.type === "listItem") return <li>{renderChildren(node)}</li>;
  // Anything else (a node type added to the editor later) still shows its text
  return renderChildren(node);
}
