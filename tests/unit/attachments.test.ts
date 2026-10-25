import { expect, test } from "playwright/test";

import {
  allowedAttachmentAccept,
  attachmentContentType,
  attachmentDownloadPath,
  AttachmentRejection,
  formatFileSize,
  MaxAttachmentBytes,
  MaxAttachmentNameLength,
  rejectAttachment,
  sanitizeAttachmentName,
} from "../../src/functions/attachments";

/*
 * The guards the attachment API and upload form share: what may be uploaded, and
 * how a file name is made safe to store and hand back as a download name.
 */

test.describe("attachment guards", () => {
  test("maps allowed extensions to a content type, case-insensitively", () => {
    expect(attachmentContentType("rapport.pdf")).toBe("application/pdf");
    expect(attachmentContentType("Budget.XLSX")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(attachmentContentType("karta.PNG")).toBe("image/png");
  });

  test("refuses markup, scripts and extensionless files", () => {
    for (const name of ["index.html", "logo.svg", "run.exe", "script.js", "README", ".pdf", "archive.tar.gz"]) {
      expect(attachmentContentType(name), name).toBeNull();
    }
  });

  test("rejects empty, oversized and disallowed files, in that order", () => {
    expect(rejectAttachment({ name: "a.pdf", size: 0 })).toBe(AttachmentRejection.Empty);
    expect(rejectAttachment({ name: "a.pdf", size: MaxAttachmentBytes + 1 })).toBe(AttachmentRejection.TooLarge);
    expect(rejectAttachment({ name: "a.exe", size: 10 })).toBe(AttachmentRejection.TypeNotAllowed);
    expect(rejectAttachment({ name: "a.pdf", size: MaxAttachmentBytes })).toBeNull();
  });

  test("the file input's accept list covers every allowed extension", () => {
    expect(allowedAttachmentAccept.split(",")).toContain(".pdf");
    expect(allowedAttachmentAccept.split(",")).toContain(".docx");
    expect(allowedAttachmentAccept).not.toContain(".html");
  });
});

test.describe("attachment names", () => {
  test("strips path separators and control characters", () => {
    expect(sanitizeAttachmentName("../../etc/passwd.pdf")).toBe("etcpasswd.pdf");
    expect(sanitizeAttachmentName("C:\\Users\\x\\rapport.pdf")).toBe("CUsersxrapport.pdf");
    // Control characters (newlines included) are dropped rather than turned into spaces
    expect(sanitizeAttachmentName("ra\u0000pport\n2026.pdf")).toBe("rapport2026.pdf");
  });

  test("keeps Swedish letters and collapses whitespace", () => {
    expect(sanitizeAttachmentName("  Åtgärdsplan   för  Enköping.docx ")).toBe("Åtgärdsplan för Enköping.docx");
  });

  test("falls back to a name when nothing is left", () => {
    expect(sanitizeAttachmentName("...")).toBe("file");
    expect(sanitizeAttachmentName("")).toBe("file");
  });

  test("cuts long names but keeps the extension", () => {
    const long = `${"x".repeat(500)}.pdf`;
    const cut = sanitizeAttachmentName(long);
    expect(cut.length).toBeLessThanOrEqual(MaxAttachmentNameLength);
    expect(cut.endsWith(".pdf")).toBe(true);
  });
});

test.describe("attachment presentation", () => {
  test("formats sizes with sensible units", () => {
    expect(formatFileSize(12, "en-SE")).toMatch(/12 ?byte/);
    expect(formatFileSize(340_000, "en-SE")).toMatch(/340 ?kB/);
    // en-SE keeps the Swedish decimal comma
    expect(formatFileSize(1_234_567, "en-SE")).toMatch(/1[.,]2 ?MB/);
  });

  test("download path encodes the id", () => {
    expect(attachmentDownloadPath("abc/def")).toBe("/api/attachment/abc%2Fdef");
  });
});
