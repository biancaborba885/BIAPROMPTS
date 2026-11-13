import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    if (!filename || !/^[a-zA-Z0-9_.\-]+$/.test(filename)) {
      return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'uploads', filename);
    const fileStats = await stat(filePath).catch(() => null);
    if (!fileStats || !fileStats.isFile()) {
      return NextResponse.json(
        { error: 'Mídia não encontrada.' },
        { status: 404 }
      );
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = EXT_TO_MIME[ext] || 'application/octet-stream';
    const fileBuffer = await readFile(filePath);
    const total = fileBuffer.length;

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
        if (start <= end && start < total) {
          const chunk = fileBuffer.subarray(start, end + 1);
          return new NextResponse(chunk, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Range': `bytes ${start}-${end}/${total}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunk.length),
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Erro ao servir mídia:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar mídia.' },
      { status: 500 }
    );
  }
}
