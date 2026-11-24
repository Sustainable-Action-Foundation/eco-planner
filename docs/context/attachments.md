# Attachments

Documents can be attached to roadmap versions, goals and actions. Environment variables and deployment notes are in [`README.md`](../../README.md#setup).

## Model
- `Attachments` holds the metadata; the file lives in a private S3-compatible bucket (`src/lib/objectStorage.ts`), never in the database.
- An attachment belongs to exactly one of an action, a goal or a version. Prisma cannot express that, so the API enforces it.
- **Not on the roadmap itself**: the roadmap page is a menu people should not linger on. Not on effects either: an effect has no id of its own.
- Attachments have no access control of their own. Whoever may see the parent may download; whoever may edit it may upload and delete (`visibleAttachmentsWHERE`, `editableAttachmentsWHERE`).

## API
- `POST /api/attachment` (multipart) and `DELETE /api/attachment`.
- `GET /api/attachment/[id]` checks access, then redirects to a presigned link that lives five minutes and forces a download.
- Guards, in `src/functions/attachments.ts`: 25 MB per file, 25 files per object, an extension allowlist, a sanitised file name. Uploads are also rate-limited per user (in memory, single-instance like the other limiters).
- The upload route checks that storage is configured **last**, so every other refusal behaves the same with or without a bucket and can be tested without one.
- The download route first checks that the object still exists. If someone removed it from the bucket by hand it answers 404 (`api:attachment.file_missing`) and the row stays for an editor to remove. The list fetches the link with `redirect: "manual"` and shows a toast, so nobody lands on the bucket's XML error.
- `experimental.proxyClientMaxBodySize` in `next.config.ts` must stay above the file limit plus multipart overhead; so must any reverse proxy in front of the app.

## UI
- `src/components/attachments/`. Uploading is one action: a hidden file input, a button and a drop zone, and the upload starts on pick or drop. A pick-then-commit two-step was confusing.
- Create forms (goal, action, version) use `CreateAttachmentsFieldset`: files are chosen in the form and posted right after the object is created (`uploadAttachments`). The roadmap create form defers to the version form.
- Never rely on a bare `<input type="file">` being visible. The global stylesheet hides the file selector button, and in WebKit a file input without it is a zero-height box. Use the hidden input plus button pattern.

## Backups
The bucket is separate from the database: a database backup does not cover the files. Whoever operates a deployment needs a safety net for the bucket itself, such as bucket versioning.

## Testing
- The docker test stack has an `s3` service (an S3 gateway over a directory) and `S3_PUBLIC_ENDPOINT` for the address browsers use.
- Specs: `tests/api/attachment.spec.ts`, `tests/e2e/attachments.spec.ts`, `tests/unit/attachments.test.ts`.
- In Playwright Test, `browser.newContext()` inherits the describe block's storage state. Pass `storageState: { cookies: [], origins: [] }` for a truly anonymous context.
