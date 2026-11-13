'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, LogOut, Check } from 'lucide-react';
import { CAKTO_CHECKOUT_URL, UserProfile } from '@/lib/prompts-seed';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  isAdmin: boolean;
  onUpdateName: (name: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function AccountModal({
  open,
  onClose,
  profile,
  isAdmin,
  onUpdateName,
  onLogout,
  onNotify,
}: AccountModalProps) {
  const [nameInput, setNameInput] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !profile) return null;

  const daysRemaining = Math.max(
    0,
    Math.ceil((profile.accessExpiresAt.getTime() - nowMs) / 86400000)
  );

  const statusLabel = isAdmin
    ? 'Administrador'
    : profile.planStatus === 'active' && daysRemaining > 0
      ? 'Plano Trimestral Ativo'
      : profile.planStatus === 'pending'
        ? 'Pagamento Pendente'
        : 'Assinatura Expirada';

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await onUpdateName(nameInput);
      onNotify('Nome atualizado com sucesso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#131112] border border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2
              id="account-modal-title"
              className="text-lg font-bold text-white"
            >
              Minha conta
            </h2>
            <p className="text-xs text-[#a39ca0] mt-0.5">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 rounded-lg text-[#a39ca0] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveName} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="account-name"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Nome de exibição
            </label>
            <div className="flex gap-2">
              <input
                id="account-name"
                type="text"
                maxLength={100}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#090809] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#221a1d] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Salvando' : 'Salvar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a39ca0]">Status do acesso</span>
              <span className="font-semibold text-white">{statusLabel}</span>
            </div>
            {isAdmin ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a39ca0]">Validade</span>
                <span className="font-semibold text-emerald-400">
                  Acesso ilimitado (sem expiração)
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#a39ca0]">Dias restantes</span>
                  <span className="font-semibold tabular-nums text-white">
                    {daysRemaining} dias
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#a39ca0]">Vencimento</span>
                  <span className="tabular-nums text-[#d5cdd0]">
                    {profile.accessExpiresAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </>
            )}
          </div>

          {!isAdmin && (
            <a
              href={CAKTO_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] text-sm font-semibold text-white transition-colors"
            >
              <span>Renovar assinatura — R$ 45,00</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            onClick={async () => {
              await onLogout();
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#d5cdd0] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta</span>
          </button>
        </form>
      </div>
    </div>
  );
}
