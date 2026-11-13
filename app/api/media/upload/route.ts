import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import firebaseConfig from '@/firebase-applet-config.json';
import { ADMIN_EMAILS } from '@/lib/prompts-seed';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_EXT: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/jpg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/ogg': { ext: 'ogv', kind: 'video' },
};

async function verifyAdminCaller(idToken: string): Promise<boolean> {
  if (!idToken || !firebaseConfig.apiKey) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.email || !user.emailVerified) return false;
    return (ADMIN_EMAILS as readonly string[]).includes(
      user.email.toLowerCase()
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
    const isAllowed = await verifyAdminCaller(idToken);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Apenas administradores podem enviar mídias.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de foto ou vídeo foi enviado.' },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'O arquivo deve ter entre 1 byte e 25 MB.' },
        { status: 400 }
      );
    }

    const EXT_FALLBACK: Record<string, { ext: string; kind: 'image' | 'video' }> = {
      '.jpg': { ext: 'jpg', kind: 'image' },
      '.jpeg': { ext: 'jpg', kind: 'image' },
      '.png': { ext: 'png', kind: 'image' },
      '.webp': { ext: 'webp', kind: 'image' },
      '.gif': { ext: 'gif', kind: 'image' },
      '.mp4': { ext: 'mp4', kind: 'video' },
      '.webm': { ext: 'webm', kind: 'video' },
      '.mov': { ext: 'mov', kind: 'video' },
      '.ogv': { ext: 'ogv', kind: 'video' },
    };

    const mime = file.type.toLowerCase();
    const fileExt = path.extname(file.name).toLowerCase();
    const spec =
      ALLOWED_MIME_EXT[mime] || (!mime ? EXT_FALLBACK[fileExt] : undefined);
    if (!spec) {
      return NextResponse.json(
        {
          error:
            'Formato não suportado. Use JPG, PNG, WebP, GIF, MP4, WebM ou MOV.',
        },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const safeName = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${spec.ext}`;
    const targetPath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    return NextResponse.json({
      url: `/api/media/${safeName}`,
      mediaType: spec.kind,
    });
  } catch (error) {
    console.error('Erro no upload de mídia:', error);
    return NextResponse.json(
      { error: 'Falha ao salvar a foto ou vídeo enviado.' },
      { status: 500 }
    );
  }
}
