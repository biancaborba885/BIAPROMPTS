import { NextRequest, NextResponse } from 'next/server';
import { emailToKey, isAdminEmail } from '@/lib/prompts-seed';
import {
  activateUserInFirestoreByEmail,
  checkCaktoApiForPaidEmail,
  getApprovedCaktoRecord,
  upsertApprovedPurchaseInFirestore,
  upsertCaktoLedgerRecord,
  verifyFirebaseCaller,
} from '@/lib/firestore-server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const idToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
  const caller = await verifyFirebaseCaller(idToken);

  if (!caller || !caller.emailVerified) {
    return NextResponse.json(
      { error: 'Autenticação Google verificada necessária.' },
      { status: 401 }
    );
  }

  if (isAdminEmail(caller.email)) {
    return NextResponse.json({
      approved: true,
      isAdmin: true,
      unlimited: true,
    });
  }

  const cleanEmail = caller.email.toLowerCase();
  const ledgerRecord = await getApprovedCaktoRecord(cleanEmail);

  if (ledgerRecord) {
    const synced = await upsertApprovedPurchaseInFirestore(
      cleanEmail,
      ledgerRecord.durationDays,
      'cakto_webhook'
    );
    await activateUserInFirestoreByEmail(cleanEmail, ledgerRecord.durationDays);
    return NextResponse.json({
      approved: true,
      durationDays: ledgerRecord.durationDays,
      firestoreSynced: synced,
    });
  }

  const apiCheck = await checkCaktoApiForPaidEmail(cleanEmail);
  if (apiCheck.paid) {
    const synced = await upsertApprovedPurchaseInFirestore(
      cleanEmail,
      90,
      'cakto_api'
    );
    await activateUserInFirestoreByEmail(cleanEmail, 90);
    await upsertCaktoLedgerRecord({
      emailKey: emailToKey(cleanEmail),
      email: cleanEmail,
      customerName: apiCheck.customerName,
      status: 'active',
      event: 'api_verified',
      orderId: apiCheck.orderId,
      durationDays: 90,
      receivedAt: new Date().toISOString(),
      firestoreSynced: synced,
    });

    return NextResponse.json({
      approved: true,
      durationDays: 90,
      firestoreSynced: synced,
    });
  }

  return NextResponse.json({ approved: false });
}
