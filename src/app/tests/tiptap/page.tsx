
"use client";

import { useMemo, useState } from "react";
import TextEditor from "@/components/form/elements/textEditor/editor";
import styles from "./tiptap.module.css" with { type: "css" };

type TipTapDoc = {
  type: "doc";
  content: Array<Record<string, unknown>>;
};

const sampleContent: TipTapDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Eco Planner TipTap test bed. " },
        {
          type: "text",
          text: "Bold",
          marks: [{ type: "textStyle", attrs: { fontWeight: "bold" } }],
        },
        { type: "text", text: ", " },
        {
          type: "text",
          text: "Italic",
          marks: [{ type: "textStyle", attrs: { fontStyle: "italic" } }],
        },
        { type: "text", text: ", " },
        {
          type: "text",
          text: "Underline",
          marks: [{ type: "textStyle", attrs: { textDecoration: "underline" } }],
        },
        { type: "text", text: ", " },
        {
          type: "text",
          text: "Strike",
          marks: [{ type: "textStyle", attrs: { textDecoration: "line-through" } }],
        },
        { type: "text", text: ", " },
        {
          type: "text",
          text: "Grey",
          marks: [{ type: "textStyle", attrs: { color: "grey" } }],
        },
        { type: "text", text: "." },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Superscript",
          marks: [{ type: "superscript" }],
        },
        { type: "text", text: " and " },
        {
          type: "text",
          text: "Subscript",
          marks: [{ type: "subscript" }],
        },
        { type: "text", text: " with " },
        { type: "text", text: "Highlight", marks: [{ type: "highlight" }] },
        { type: "text", text: "." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Link: " },
        {
          type: "text",
          text: "https://example.com",
          marks: [{ type: "link", attrs: { href: "https://example.com" } }],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Font size sample",
          marks: [{ type: "textStyle", attrs: { fontSize: "1.3rem" } }],
        },
        { type: "text", text: " and a hard break" },
        { type: "hardBreak" },
        { type: "text", text: "on the next line." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet one" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet two" }] }],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Ordered one" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Ordered two" }] }],
        },
      ],
    },
  ],
};

const emptyContent: TipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }],
};

export default function TipTapPage() {
  const [editable, setEditable] = useState(true);
  const [showMenu, setShowMenu] = useState(true);
  const [content, setContent] = useState<TipTapDoc>(sampleContent);
  const [lastUpdate, setLastUpdate] = useState<unknown>(sampleContent);
  const [contentVersion, setContentVersion] = useState(0);

  const contentString = useMemo(() => JSON.stringify(content), [content]);
  const outputString = useMemo(() => JSON.stringify(lastUpdate, null, 2), [lastUpdate]);

  const setEditorContent = (next: TipTapDoc) => {
    setContent(next);
    setContentVersion((value) => value + 1);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>TipTap integration test</h1>
      </header>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.editorArea}>
            <TextEditor
              key={contentVersion}
              id="tiptap-test"
              ariaLabelledBy="tiptap-test-heading"
              placeholder="Type here and use the toolbar or shortcuts..."
              content={contentString}
              editable={editable}
              defaultStyles={showMenu}
              onChange={setLastUpdate}
            />
          </div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.controls}>
            <h2 id="tiptap-test-heading">Controls</h2>
            <div className={styles.toggleRow}>
              <label>
                <input
                  type="checkbox"
                  checked={editable}
                  onChange={(event) => setEditable(event.target.checked)}
                />{" "}
                Editable
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showMenu}
                  onChange={(event) => setShowMenu(event.target.checked)}
                />{" "}
                Show menu + counter
              </label>
            </div>

            <div className={styles.buttonRow}>
              <button type="button" className="neutral-action" onClick={() => setEditorContent(sampleContent)}>
                Load sample content
              </button>
              <button type="button" className="neutral-action" onClick={() => setEditorContent(emptyContent)}>
                Clear content
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.panel}>
        <h2>Last editor update (JSON)</h2>
        <pre className={styles.jsonBox}>{outputString}</pre>
      </section>
    </div>
  );
}