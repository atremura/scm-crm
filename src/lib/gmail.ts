import { google, gmail_v1, Auth } from 'googleapis';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env`);
  return v;
}

export function getRedirectUri(): string {
  // AUTH_URL is already in .env (NextAuth) — reuse it as the canonical app URL
  const base = process.env.AUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/auth/gmail/callback`;
}

/** Build an OAuth2 client with our app's credentials. */
export function oauthClient(): Auth.OAuth2Client {
  return new google.auth.OAuth2(
    envOrThrow('GOOGLE_CLIENT_ID'),
    envOrThrow('GOOGLE_CLIENT_SECRET'),
    getRedirectUri()
  );
}

/** URL the user is sent to in order to authorize Gmail access. */
export function buildAuthUrl(userId: string): string {
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // need a refresh_token
    prompt: 'consent', // force consent screen so we always get a refresh_token
    scope: SCOPES,
    state: userId, // we use this to know which DB row to attach the token to
    include_granted_scopes: true,
  });
}

/** Exchange the auth code (from the callback) for tokens + the user's email. */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
  email: string;
  expiresAt: Date | null;
}> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. Make sure prompt=consent is used and the app is configured for offline access.'
    );
  }
  if (!tokens.access_token) {
    throw new Error('Google did not return an access_token.');
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const me = await oauth2.userinfo.get();

  if (!me.data.email) {
    throw new Error('Could not read the user email from Google.');
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    email: me.data.email,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

/** Build a Gmail API client for an existing user (uses their refresh token). */
export function gmailClientFromRefresh(refreshToken: string): gmail_v1.Gmail {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client });
}

/** Decode a Gmail-base64url string. Gmail uses URL-safe base64 with no padding. */
function decodeBase64Url(data: string): string {
  const padded = data
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(data.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

export type GmailAttachment = {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

type ParsedMessage = {
  id: string;
  threadId: string;
  subject: string | null;
  from: string | null;
  date: Date | null;
  snippet: string | null;
  /** Best-effort plain-text body. Falls back to stripped HTML when only HTML exists. */
  body: string;
  attachments: GmailAttachment[];
};

/** Construction file types we care about — same allowlist as direct uploads. */
const ATTACHMENT_EXTENSIONS = [
  'pdf', 'dwg', 'rvt', 'xls', 'xlsx', 'doc', 'docx', 'png', 'jpg', 'jpeg',
];

function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  if (i === -1) return '';
  return filename.slice(i + 1).toLowerCase();
}

/** Walks the MIME tree collecting attachment parts (parts with a filename + attachmentId). */
function collectAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
  messageId: string
): GmailAttachment[] {
  if (!payload) return [];
  const out: GmailAttachment[] = [];
  const queue: gmail_v1.Schema$MessagePart[] = [payload];
  while (queue.length) {
    const p = queue.shift()!;
    if (p.parts) queue.push(...p.parts);
    const filename = p.filename;
    const attachmentId = p.body?.attachmentId;
    if (!filename || !attachmentId) continue;
    if (!ATTACHMENT_EXTENSIONS.includes(getExtension(filename))) continue;
    out.push({
      messageId,
      attachmentId,
      filename,
      mimeType: p.mimeType ?? 'application/octet-stream',
      sizeBytes: p.body?.size ?? 0,
    });
  }
  return out;
}

/** Download an attachment by id and return its raw bytes. */
export async function downloadAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  const data = res.data.data;
  if (!data) throw new Error('Empty attachment payload');
  // Gmail returns URL-safe base64
  const padded = data
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(data.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  const h = headers.find((x) => x.name?.toLowerCase() === lower);
  return h?.value ?? null;
}

/** Walks the MIME parts looking for text/plain, falling back to text/html (stripped). */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // Walk all parts breadth-first, prefer text/plain, otherwise text/html
  const parts: gmail_v1.Schema$MessagePart[] = [];
  const queue: gmail_v1.Schema$MessagePart[] = [payload];
  while (queue.length) {
    const p = queue.shift()!;
    parts.push(p);
    if (p.parts) queue.push(...p.parts);
  }

  const plain = parts.find((p) => p.mimeType === 'text/plain' && p.body?.data);
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = parts.find((p) => p.mimeType === 'text/html' && p.body?.data);
  if (html?.body?.data) {
    const raw = decodeBase64Url(html.body.data);
    // Cheap HTML → text: strip tags + collapse whitespace
    return raw
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return '';
}

export async function listRecentMatching(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults = 10
): Promise<{ id: string; threadId: string }[]> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  return (res.data.messages ?? []).map((m) => ({
    id: m.id!,
    threadId: m.threadId!,
  }));
}

export async function fetchMessage(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<ParsedMessage> {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const m = res.data;
  const headers = m.payload?.headers;
  const dateHeader = getHeader(headers, 'Date');
  return {
    id: m.id!,
    threadId: m.threadId!,
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    date: dateHeader ? new Date(dateHeader) : null,
    snippet: m.snippet ?? null,
    body: extractBody(m.payload),
    attachments: collectAttachments(m.payload, m.id!),
  };
}

/**
 * Default Gmail query string for finding bid-related emails.
 * - last 30 days
 * - body OR subject mentions bid / RFP / invitation / estimate / proposal
 * - excludes emails the user already sent (from:me)
 * - excludes spam / trash
 */
export const DEFAULT_BID_QUERY =
  'newer_than:30d -from:me -in:spam -in:trash ' +
  '(subject:(bid OR rfp OR invitation OR estimate OR proposal) ' +
  'OR (bid OR "request for proposal" OR "invitation to bid" OR estimating))';
