// No `server-only` marker: pure, shared by server and client components, and unit tested.

/** A node of the rich-text editor's stored document (tiptap JSON), as far as rendering it needs */
export type RichTextNode = {
  type?: string,
  text?: string,
  content?: RichTextNode[],
  marks?: { type?: string, attrs?: Record<string, unknown> }[],
  attrs?: Record<string, unknown>,
};

/**
 * A stored description is either the editor's document as a JSON string or, for imported
 * and older content, plain text. Gives the document, the trimmed text, or null when there
 * is nothing to show.
 */
export function parseRichText(content: string | null | undefined): { document: RichTextNode } | { text: string } | null {
  const trimmed = content?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && (parsed as RichTextNode).type === "doc") {
        const document = parsed as RichTextNode;
        return richTextIsEmpty(document) ? null : { document };
      }
    }
    catch {
      // Not JSON after all: text that happens to start with a brace
    }
  }
  return { text: trimmed };
}

function richTextIsEmpty(node: RichTextNode): boolean {
  if (node.type === "text") return !node.text?.trim();
  return (node.content ?? []).every(richTextIsEmpty);
}

/** The protocols a link in a description may use (the editor's own list) */
const linkProtocols = ["http:", "https:", "mailto:", "callto:", "tel:"];

/** The href of a link mark if it is safe to render, else null (the text then renders without a link) */
export function richTextHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  try {
    return linkProtocols.includes(new URL(href).protocol) ? href : null;
  }
  catch {
    return null;
  }
}
