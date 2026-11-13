'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { MediaType } from '@/lib/prompts-seed';

interface MediaPreviewProps {
  src?: string;
  alt: string;
  mediaType?: MediaType;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function MediaPreview({
  src,
  alt,
  mediaType,
  className = '',
  sizes = '(max-width: 768px) 50vw, 25vw',
  priority = false,
}: MediaPreviewProps) {
  const [failed, setFailed] = useState(false);

  const isVideo =
    mediaType === 'video' ||
    (src
      ? /\.(mp4|webm|mov|ogv)(\?|$)/i.test(src) || src.startsWith('data:video/')
      : false);

  if (!src || failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1d1719] via-[#121011] to-[#0a090a] text-[#9b9698] p-4 text-center ${className}`}
      >
        <ImageOff className="w-6 h-6 text-[#f12b3d]/70" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={src}
        muted
        loop
        autoPlay
        playsInline
        controls
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  const isDynamicUpload =
    src.startsWith('/api/media/') ||
    src.startsWith('blob:') ||
    src.startsWith('data:');

  if (isDynamicUpload) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
