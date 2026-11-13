import { NextRequest, NextResponse } from 'next/server';
import { emailToKey, isAdminEmail } from '@/lib/prompts-seed';
import {
  activateUserInFirestoreByEmail,
  markCaktoLedgerSynced,
  readCaktoLedger,
  revokeApprovedPurchaseInFirestore,
  upsertApprovedPurchaseInFirestore,
  upsertCaktoLedgerRecord,
  verifyFirebaseCaller,
} from '@/lib/firestore-server';

const APPROVAL_EVENTS = new Set([
  'purchase_approved',
  'order_approved',
  'subscription_created',
  'subscription_renewed',
  'subscription_active',
  'paid',
  'approved',
  'active',
]);

const REVOCATION_EVENTS = new Set([
  'refund',
  'refunded',
  'chargeback',
  'purchase_refused',
  'subscription_canceled',
  'canceled',
]);

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as {
      secret?: string;
      event?: string;
      status?: string;
      id?: string;
      email?: string;
      customer?: { email?: string; name?: string };
      data?: {
        id?: string;
        status?: string;
        email?: string;
        customer?: { email?: string; name?: string };
      };
    };

    const configuredSecret = process.env.CAKTO_WEBHOOK_SECRET?.trim();
    const incomingSecret =
      req.headers.get('x-cakto-secret')?.trim() ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
      payload.secret?.trim();

    if (configuredSecret && incomingSecret !== configuredSecret) {
      return NextResponse.json(
        { ok: false, error: 'Assinatura do webhook inválida.' },
        { status: 401 }
      );
    }

    const rawEvent = (
      payload.event ||
      payload.data?.status ||
      payload.status ||
      'unknown'
    )
      .trim()
      .toLowerCase();

    const rawStatus = (payload.data?.status || payload.status || '')
      .trim()
      .toLowerCase();

    const rawEmail =
      payload.data?.customer?.email ||
      payload.customer?.email ||
      payload.data?.email ||
      payload.email ||
      '';
    const cleanEmail = rawEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'E-mail do comprador não encontrado no webhook.' },
        { status: 400 }
      );
    }

    const customerName =
      payload.data?.customer?.name || payload.customer?.name || undefined;
    const orderId = payload.data?.id || payload.id || undefined;
    const key = emailToKey(cleanEmail);

    const isApproved =
      APPROVAL_EVENTS.has(rawEvent) || APPROVAL_EVENTS.has(rawStatus);
    const isRevoked =
      REVOCATION_EVENTS.has(rawEvent) || REVOCATION_EVENTS.has(rawStatus);

    if (isApproved && !isRevoked) {
      const firestoreApproved = await upsertApprovedPurchaseInFirestore(
        cleanEmail,
        90,
        'cakto_webhook'
      );
      await activateUserInFirestoreByEmail(cleanEmail, 90);

      await upsertCaktoLedgerRecord({
        emailKey: key,
        email: cleanEmail,
        customerName,
        status: 'active',
        event: rawEvent,
        orderId,
        durationDays: 90,
        receivedAt: new Date().toISOString(),
        firestoreSynced: firestoreApproved,
      });

      return NextResponse.json({
        ok: true,
        action: 'approved',
        email: cleanEmail,
        durationDays: 90,
        firestoreSynced: firestoreApproved,
      });
    }

    if (isRevoked) {
      await revokeApprovedPurchaseInFirestore(cleanEmail);
      await upsertCaktoLedgerRecord({
        emailKey: key,
        email: cleanEmail,
        customerName,
        status: 'revoked',
        event: rawEvent,
        orderId,
        durationDays: 0,
        receivedAt: new Date().toISOString(),
        firestoreSynced: true,
      });

      return NextResponse.json({
        ok: true,
        action: 'revoked',
        email: cleanEmail,
      });
    }

    return NextResponse.json({
      ok: true,
      action: 'ignored',
      event: rawEvent,
      email: cleanEmail,
    });
  } catch (error) {
    console.error('Erro no webhook Cakto:', error);
    return NextResponse.json(
      { ok: false, error: 'Payload inválido no webhook.' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
  const caller = await verifyFirebaseCaller(idToken);

  if (!caller || !caller.emailVerified || !isAdminEmail(caller.email)) {
    return NextResponse.json(
      { error: 'Apenas administradores podem consultar compras da Cakto.' },
      { status: 403 }
    );
  }

  const purchases = await readCaktoLedger();
  return NextResponse.json({ purchases });
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
  const caller = await verifyFirebaseCaller(idToken);

  if (!caller || !caller.emailVerified || !isAdminEmail(caller.email)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { emailKey?: string };
  if (body.emailKey) {
    await markCaktoLedgerSynced(body.emailKey);
  }
  return NextResponse.json({ ok: true });
}
