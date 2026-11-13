import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import firebaseConfig from '@/firebase-applet-config.json';
import { emailToKey } from '@/lib/prompts-seed';

export interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface CaktoPurchaseRecord {
  emailKey: string;
  email: string;
  customerName?: string;
  status: 'active' | 'revoked';
  event: string;
  orderId?: string;
  durationDays: number;
  receivedAt: string;
  firestoreSynced: boolean;
}

const LEDGER_DIR = path.join(process.cwd(), 'data');
const LEDGER_FILE = path.join(LEDGER_DIR, 'cakto-purchases.json');

export async function verifyFirebaseCaller(
  idToken: string
): Promise<VerifiedCaller | null> {
  if (!idToken || !firebaseConfig.apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };
    const u = data.users?.[0];
    if (!u?.localId || !u.email) return null;
    return {
      uid: u.localId,
      email: u.email.toLowerCase(),
      emailVerified: Boolean(u.emailVerified),
    };
  } catch {
    return null;
  }
}

export async function readCaktoLedger(): Promise<CaktoPurchaseRecord[]> {
  try {
    const raw = await readFile(LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CaktoPurchaseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCaktoLedger(records: CaktoPurchaseRecord[]): Promise<void> {
  await mkdir(LEDGER_DIR, { recursive: true });
  await writeFile(LEDGER_FILE, JSON.stringify(records, null, 2), 'utf8');
}

export async function upsertCaktoLedgerRecord(
  record: CaktoPurchaseRecord
): Promise<void> {
  const list = await readCaktoLedger();
  const idx = list.findIndex((r) => r.emailKey === record.emailKey);
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.unshift(record);
  }
  await writeCaktoLedger(list);
}

export async function markCaktoLedgerSynced(emailKey: string): Promise<void> {
  const list = await readCaktoLedger();
  const idx = list.findIndex((r) => r.emailKey === emailKey);
  if (idx >= 0 && !list[idx].firestoreSynced) {
    list[idx] = { ...list[idx], firestoreSynced: true };
    await writeCaktoLedger(list);
  }
}

export async function getApprovedCaktoRecord(
  email: string
): Promise<CaktoPurchaseRecord | null> {
  const key = emailToKey(email);
  const list = await readCaktoLedger();
  const match = list.find((r) => r.emailKey === key);
  if (!match || match.status !== 'active') return null;
  return match;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleFirestoreAccessToken(): Promise<string | null> {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (saJson) {
    try {
      const sa = JSON.parse(saJson) as {
        client_email?: string;
        private_key?: string;
        token_uri?: string;
      };
      if (sa.client_email && sa.private_key) {
        const nowSec = Math.floor(Date.now() / 1000);
        const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
        const header = base64UrlEncode(
          JSON.stringify({ alg: 'RS256', typ: 'JWT' })
        );
        const claim = base64UrlEncode(
          JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/datastore',
            aud: tokenUri,
            exp: nowSec + 3600,
            iat: nowSec,
          })
        );
        const unsigned = `${header}.${claim}`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsigned);
        const signature = base64UrlEncode(signer.sign(sa.private_key));
        const jwt = `${unsigned}.${signature}`;

        const res = await fetch(tokenUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
          }).toString(),
        });
        if (res.ok) {
          const data = (await res.json()) as { access_token?: string };
          if (data.access_token) return data.access_token;
        }
      }
    } catch (err) {
      console.warn('Falha ao obter token via FIREBASE_SERVICE_ACCOUNT_KEY:', err);
    }
  }

  // Try Cloud Run / GCE metadata server access token if running on Google Cloud
  try {
    const metaRes = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https://www.googleapis.com/auth/datastore',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (metaRes.ok) {
      const data = (await metaRes.json()) as { access_token?: string };
      if (data.access_token) return data.access_token;
    }
  } catch {
    // Metadata server unavailable in local environment
  }

  return null;
}

function getFirestoreBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents`;
}

export async function upsertApprovedPurchaseInFirestore(
  email: string,
  durationDays = 90,
  grantedBy = 'cakto_webhook'
): Promise<boolean> {
  const token = await getGoogleFirestoreAccessToken();
  if (!token) return false;

  const cleanEmail = email.trim().toLowerCase();
  const key = emailToKey(cleanEmail);
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch(
      `${getFirestoreBaseUrl()}/approved_purchases/${encodeURIComponent(key)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            email: { stringValue: cleanEmail },
            planStatus: { stringValue: 'active' },
            durationDays: { integerValue: String(durationDays) },
            grantedBy: { stringValue: grantedBy },
            createdAt: { timestampValue: nowIso },
          },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function activateUserInFirestoreByEmail(
  email: string,
  durationDays = 90
): Promise<boolean> {
  const token = await getGoogleFirestoreAccessToken();
  if (!token) return false;

  const cleanEmail = email.trim().toLowerCase();
  const baseUrl = getFirestoreBaseUrl();

  try {
    const queryRes = await fetch(`${baseUrl}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: cleanEmail },
            },
          },
          limit: 5,
        },
      }),
    });

    if (!queryRes.ok) return false;
    const rows = (await queryRes.json()) as Array<{
      document?: { name?: string };
    }>;

    const nowMs = Date.now();
    const expiryIso = new Date(nowMs + durationDays * 86400000).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    let updatedAny = false;
    for (const row of rows) {
      const docName = row.document?.name;
      if (!docName) continue;
      const patchRes = await fetch(
        `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=planStatus&updateMask.fieldPaths=accessExpiresAt&updateMask.fieldPaths=updatedAt`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              planStatus: { stringValue: 'active' },
              accessExpiresAt: { timestampValue: expiryIso },
              updatedAt: { timestampValue: nowIso },
            },
          }),
        }
      );
      if (patchRes.ok) updatedAny = true;
    }

    return updatedAny;
  } catch {
    return false;
  }
}

export async function revokeApprovedPurchaseInFirestore(
  email: string
): Promise<void> {
  const token = await getGoogleFirestoreAccessToken();
  if (!token) return;
  const key = emailToKey(email);
  try {
    await fetch(
      `${getFirestoreBaseUrl()}/approved_purchases/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch {
    // ignore
  }
}

export async function checkCaktoApiForPaidEmail(
  email: string
): Promise<{ paid: boolean; orderId?: string; customerName?: string }> {
  const clientId = process.env.CAKTO_CLIENT_ID?.trim();
  const clientSecret = process.env.CAKTO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { paid: false };

  try {
    const tokenRes = await fetch('https://api.cakto.com.br/public_api/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!tokenRes.ok) return { paid: false };
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return { paid: false };

    const ordersRes = await fetch(
      `https://api.cakto.com.br/public_api/orders/?search=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!ordersRes.ok) return { paid: false };

    const ordersData = (await ordersRes.json()) as {
      results?: Array<{
        id?: string;
        status?: string;
        customer?: { email?: string; name?: string };
      }>;
    };

    const target = email.trim().toLowerCase();
    const paidStatuses = new Set(['paid', 'approved', 'active', 'completed']);
    const match = ordersData.results?.find(
      (o) =>
        o.customer?.email?.trim().toLowerCase() === target &&
        paidStatuses.has((o.status || '').toLowerCase())
    );

    if (!match) return { paid: false };
    return {
      paid: true,
      orderId: match.id,
      customerName: match.customer?.name,
    };
  } catch {
    return { paid: false };
  }
}
