'use client';

import { useState } from 'react';
import { ExternalLink, Lock, LogOut, RefreshCw } from 'lucide-react';
import { CAKTO_CHECKOUT_URL, UserProfile } from '@/lib/prompts-seed';

interface PaywallGateProps {
  profile: UserProfile;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (msg: string, variant?: 'success' | 'error') => void;
}

export function PaywallGate({
  profile,
  onRefresh,
  onLogout,
  onNotify,
}: PaywallGateProps) {
  const [checking, setChecking] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const isExpired = profile.planStatus === 'expired' ||
    (profile.planStatus === 'active' && profile.accessExpiresAt.getTime() <= nowMs);

  const handleCheckAccess = async () => {
    setChecking(true);
    try {
      await onRefresh();
      onNotify('Status da assinatura verificado.');
    } catch {
      onNotify('Não foi possível verificar agora.', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#080808] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl bg-[#131112] border border-white/15 p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#f12b3d]">
            <Lock className="w-4 h-4" />
            <span>Acesso exclusivo para assinantes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {isExpired
              ? 'Sua assinatura foi encerrada'
              : 'Confirme seu acesso para entrar'}
          </h1>
          <p className="text-sm text-[#b8b0b4] leading-relaxed">
            {isExpired
              ? 'O ciclo de 90 dias desta conta expirou. Renove sua assinatura para voltar a acessar a biblioteca de prompts e os geradores.'
              : 'A biblioteca completa e os geradores de IA ficam disponíveis apenas após a confirmação do pagamento na Cakto.'}
          </p>
        </div>

        <div className="rounded-xl bg-[#0a090a] border border-white/10 p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#a39ca0]">Conta conectada</span>
            <span className="font-medium text-white truncate">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#a39ca0]">Status atual</span>
            <span className="font-semibold text-[#ff7682]">
              {isExpired ? 'Expirada' : 'Pagamento pendente'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href={`${CAKTO_CHECKOUT_URL}?email=${encodeURIComponent(profile.email)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] text-sm font-semibold text-white transition-colors"
          >
            <span>
              {isExpired
                ? 'Renovar assinatura — R$ 45,00 / 90 dias'
                : 'Comprar acesso — R$ 45,00 / 90 dias'}
            </span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={handleCheckAccess}
            disabled={checking}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>
              {checking
                ? 'Verificando pagamento...'
                : 'Já comprei — verificar liberação'}
            </span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-[#d5cdd0] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair e entrar com outro e-mail</span>
          </button>
        </div>

        <p className="text-[11px] text-[#8f888c] leading-relaxed">
          Importante: utilize na compra da Cakto o mesmo e-mail desta conta
          Google para que a liberação ocorra sem demora.
        </p>
      </div>
    </main>
  );
}
