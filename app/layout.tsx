import type { Metadata } from 'next';
import {
  Bricolage_Grotesque,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bia Prompts IA — Biblioteca Criativa & Geradores',
  description:
    'Biblioteca criativa de prompts, referências visuais e geradores de IA para criadores e marcas.',
  openGraph: {
    title: 'Bia Prompts IA — Biblioteca Criativa & Geradores',
    description:
      'Biblioteca criativa de prompts, referências visuais e geradores de IA para criadores e marcas.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bia Prompts IA — Biblioteca Criativa & Geradores',
    description:
      'Biblioteca criativa de prompts, referências visuais e geradores de IA para criadores e marcas.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#080808] text-[#f5f2f3] antialiased selection:bg-[#f12b3d] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
