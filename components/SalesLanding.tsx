'use client';

import { Check, ExternalLink, Lock, LogIn } from 'lucide-react';
import {
  CAKTO_CHECKOUT_URL,
  HERO_STUDIO_IMAGE,
  PROMPT_CATEGORIES,
} from '@/lib/prompts-seed';
import { MediaPreview } from './MediaPreview';

interface SalesLandingProps {
  onSignIn: () => void;
  signingIn: boolean;
  authError: string | null;
}

export function SalesLanding({
  onSignIn,
  signingIn,
  authError,
}: SalesLandingProps) {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f2f3]">
      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-16 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between gap-8">
            <div className="space-y-5">
              <p className="text-xs font-semibold tracking-widest text-[#f12b3d]">
                Acesso Exclusivo para Assinantes
              </p>
              <h1 className="text-[clamp(2.25rem,4vw,3.75rem)] font-bold leading-[1.06] tracking-tight text-white">
                Entre no universo dos{' '}
                <span className="text-[#f12b3d]">prompts</span> que geram
                resultados reais
              </h1>
              <p className="text-base text-[#b8b0b4] leading-relaxed max-w-[60ch]">
                Biblioteca fechada para membros com prompts testados,
                referências visuais completas e geradores de IA para criar fotos
                e vídeos de alta conversão.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={CAKTO_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] text-sm font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <span>Comprar acesso — R$ 45,00</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#161315] border border-white/15 hover:border-white/30 text-sm font-semibold text-[#f5f2f3] transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4 text-[#f12b3d]" />
                  <span>
                    {signingIn
                      ? 'Conectando...'
                      : 'Já comprei? Entrar com Google'}
                  </span>
                </button>
              </div>

              {authError && (
                <p className="text-xs text-[#ff6b78]" role="alert">
                  {authError}
                </p>
              )}

              <p className="text-xs text-[#9b9698] leading-relaxed max-w-[58ch]">
                Compre na Cakto informando o mesmo e-mail da sua conta Google:
                assim que o pagamento for confirmado, esse e-mail é liberado
                automaticamente para você entrar.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[280px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-white/10 bg-[#121011]">
            <MediaPreview
              src={HERO_STUDIO_IMAGE}
              alt="Estúdio editorial Bia Prompts IA"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="lg:h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#d5cdd0]">
                  Acervo fechado para membros
                </p>
                <p className="text-base font-semibold text-white mt-1">
                  Direção visual e engenharia de prompt para criadores e marcas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column deliverables strip */}
        <div
          id="recursos"
          className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-white/10"
        >
          <div className="p-4 rounded-xl bg-[#121011] border border-white/10">
            <p className="text-xs font-semibold text-[#f12b3d] tabular-nums">
              01
            </p>
            <h2 className="text-sm font-semibold text-white mt-1">
              Biblioteca selecionada
            </h2>
            <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
              Acervo fechado organizado em {PROMPT_CATEGORIES.length} categorias
              práticas para copiar em segundos.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#121011] border border-white/10">
            <p className="text-xs font-semibold text-[#f12b3d] tabular-nums">
              02
            </p>
            <h2 className="text-sm font-semibold text-white mt-1">
              Referências reais
            </h2>
            <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
              Fotos e vídeos de referência dentro da área de membros para guiar
              cada criação.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#121011] border border-white/10">
            <p className="text-xs font-semibold text-[#f12b3d] tabular-nums">
              03
            </p>
            <h2 className="text-sm font-semibold text-white mt-1">
              Geradores com IA
            </h2>
            <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
              Crie prompts de vídeo com foto do produto, headlines e roteiros
              personalizados.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#121011] border border-white/10">
            <p className="text-xs font-semibold text-[#f12b3d] tabular-nums">
              04
            </p>
            <h2 className="text-sm font-semibold text-white mt-1">
              Atualizações contínuas
            </h2>
            <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
              Novos estilos e composições adicionados durante os 90 dias de
              assinatura.
            </p>
          </div>
        </div>
      </section>

      {/* Member Workflow + Quarterly Plan */}
      <section
        id="ferramentas"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-white/10"
      >
        <div
          id="plano"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#f12b3d] mb-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Conteúdo protegido para assinantes</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                O que você desbloqueia ao confirmar sua assinatura
              </h2>
              <p className="text-sm text-[#a39ca0] mt-2 leading-relaxed max-w-[62ch]">
                Sem amostras públicas: todo o acervo de prompts, referências e
                ferramentas de IA fica reservado exclusivamente para quem possui
                assinatura ativa.
              </p>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              <div className="py-4">
                <h3 className="text-sm font-semibold text-white">
                  01. Acervo completo por categoria ({PROMPT_CATEGORIES.join(' · ')})
                </h3>
                <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
                  Pesquisa rápida, lista de favoritos sincronizada na conta e
                  cópia imediata de cada prompt completo.
                </p>
              </div>
              <div className="py-4">
                <h3 className="text-sm font-semibold text-white">
                  02. Gerador de prompt para vídeo com referência do produto
                </h3>
                <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
                  Envie a foto do produto para a IA analisar embalagem, cores e
                  detalhes, gerando um prompt fiel para UGC, comercial ou POV.
                </p>
              </div>
              <div className="py-4">
                <h3 className="text-sm font-semibold text-white">
                  03. Gerador de headlines e construtor personalizado
                </h3>
                <p className="text-xs text-[#a39ca0] mt-1 leading-relaxed">
                  Ganchos persuasivos para anúncios e criação guiada com cenário,
                  iluminação, proporção e histórico salvo na conta.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#131112] border border-white/15 p-6 sm:p-7 space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#f12b3d]">
                Plano Trimestral
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold tabular-nums text-white">
                  R$ 45,00
                </span>
                <span className="text-sm text-[#a39ca0]">/ 90 dias</span>
              </div>
            </div>

            <ul className="space-y-2.5 text-sm text-[#d5cdd0]">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#f12b3d] shrink-0" />
                <span>Acesso integral à biblioteca de prompts</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#f12b3d] shrink-0" />
                <span>Fotos e vídeos de referência visual</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#f12b3d] shrink-0" />
                <span>3 geradores com IA e histórico pessoal</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#f12b3d] shrink-0" />
                <span>Atualizações de acervo durante os 90 dias</span>
              </li>
            </ul>

            <div className="space-y-3 pt-2">
              <a
                href={CAKTO_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] text-sm font-semibold text-white transition-colors"
              >
                <span>Comprar acesso por R$ 45,00</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={onSignIn}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1b1719] border border-white/10 hover:border-white/25 text-xs font-semibold text-[#f5f2f3] transition-colors"
              >
                <span>Já comprei — entrar com Google</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8f888c]">
        <span>Bia Prompts IA — Sua criatividade sem limites</span>
        <span>Pagamento processado com segurança via Cakto</span>
      </footer>
    </div>
  );
}
