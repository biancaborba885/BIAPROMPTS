'use client';

import { LogIn, User } from 'lucide-react';

export type MemberTab = 'library' | 'generators' | 'favorites' | 'admin';

interface TopNavProps {
  isAuthenticated: boolean;
  hasActiveAccess: boolean;
  isAdmin: boolean;
  activeTab: MemberTab;
  onSelectTab: (tab: MemberTab) => void;
  onOpenAccount: () => void;
  onSignIn: () => void;
  signingIn?: boolean;
}

export function TopNav({
  isAuthenticated,
  hasActiveAccess,
  isAdmin,
  activeTab,
  onSelectTab,
  onOpenAccount,
  onSignIn,
  signingIn,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#080808]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => {
            if (isAuthenticated && hasActiveAccess) {
              onSelectTab('library');
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-[#f5f2f3] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f12b3d]"
        >
          Bia Prompts IA
        </button>

        {/* Zone 2: Clean single-line text nav links */}
        {isAuthenticated && hasActiveAccess ? (
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => onSelectTab('library')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeTab === 'library'
                  ? 'text-white border-[#f12b3d]'
                  : 'text-[#a39ca0] border-transparent hover:text-white'
              }`}
            >
              Biblioteca
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('generators')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeTab === 'generators'
                  ? 'text-white border-[#f12b3d]'
                  : 'text-[#a39ca0] border-transparent hover:text-white'
              }`}
            >
              Geradores
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('favorites')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeTab === 'favorites'
                  ? 'text-white border-[#f12b3d]'
                  : 'text-[#a39ca0] border-transparent hover:text-white'
              }`}
            >
              Favoritos
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onSelectTab('admin')}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activeTab === 'admin'
                    ? 'text-white border-[#f12b3d]'
                    : 'text-[#a39ca0] border-transparent hover:text-white'
                }`}
              >
                Admin
              </button>
            )}
          </nav>
        ) : !isAuthenticated ? (
          <nav
            aria-label="Navegação da página"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#a39ca0]"
          >
            <a
              href="#recursos"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Recursos
            </a>
            <a
              href="#ferramentas"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Geradores
            </a>
            <a
              href="#plano"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Assinatura
            </a>
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onOpenAccount}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#161315] border border-white/15 hover:border-white/30 text-xs sm:text-sm font-semibold text-[#f5f2f3] transition-colors whitespace-nowrap shrink-0"
            >
              <User className="w-4 h-4 text-[#f12b3d]" />
              <span>Minha conta</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{signingIn ? 'Entrando...' : 'Entrar com Google'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
