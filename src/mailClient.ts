
// This file allows us to use a single mail client instance across the entire application.
// Mail is sent through Microsoft Graph using an Entra app registration (client credentials flow),
// which requires the application permissions `Mail.Send` (and `Mail.ReadWrite` for the `verify()` mailbox check).

export type MailOptions = {
  /** Display name shown as the sender. The actual sender address is always the `MAIL_USER` mailbox. */
  from?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const tenantId = process.env.MAIL_TENANT_ID || "";
const clientId = process.env.MAIL_CLIENT_ID || "";
const clientSecret = process.env.MAIL_CLIENT_SECRET || "";
/** The mailbox mail is sent from, e.g. noreply@example.org. Must exist in the tenant. */
const senderMailbox = process.env.MAIL_USER || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken() {
  // Reuse the cached token until shortly before it expires
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to acquire Microsoft Graph token (${response.status}): ${await response.text()}`);
  }

  const data = await response.json() as { access_token: string, expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

const mailClient = {
  async sendMail(options: MailOptions) {
    const token = await getAccessToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderMailbox)}/sendMail`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: options.subject,
          body: {
            contentType: options.html ? "html" : "text",
            content: options.html ?? options.text ?? "",
          },
          toRecipients: [{ emailAddress: { address: options.to } }],
          ...(options.from ? { from: { emailAddress: { address: senderMailbox, name: options.from } } } : {}),
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send mail through Microsoft Graph (${response.status}): ${await response.text()}`);
    }
  },

  /** Checks that the credentials are valid and that the sender mailbox is reachable with the granted permissions. */
  async verify() {
    const token = await getAccessToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderMailbox)}/mailFolders/inbox`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to access mailbox '${senderMailbox}' through Microsoft Graph (${response.status}): ${await response.text()}`);
    }
  },
};

export default mailClient;
