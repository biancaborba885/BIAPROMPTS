'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  Heart,
  Search,
  Wand2,
  X,
} from 'lucide-react';
import {
  CAKTO_CHECKOUT_URL,
  PROMPT_CATEGORIES,
  PromptItem,
  UserProfile,
} from '@/lib/prompts-seed';
import { MediaPreview } from './MediaPreview';

interface PromptGalleryProps {
  prompts: PromptItem[];
  loadingPrompts: boolean;
  favoriteIds: Set<string>;
  onToggleFavorite: (prompt: PromptItem) => Promise<void>;
  onUseAsTemplate?: (prompt: PromptItem) => void;
  onlyFavorites?: boolean;
  profile: UserProfile | null;
  isAdmin: boolean;
  onNotify: (msg: string, variant?: 'success' | 'error') => void;
}

export function PromptGallery({
  prompts,
  loadingPrompts,
  favoriteIds,
  onToggleFavorite,
  onUseAsTemplate,
  onlyFavorites = false,
  profile,
  isAdmin,
  onNotify,
}: PromptGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<'recent' | 'az'>('recent');
  const [activePrompt, setActivePrompt] = useState<PromptItem | null>(null);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!activePrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePrompt(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePrompt]);

  const filterOptions = useMemo(
    () => ['Todos', ...PROMPT_CATEGORIES, 'Favoritos'],
    []
  );

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const effectiveFilter = onlyFavorites ? 'Favoritos' : selectedCategory;

    const list = prompts.filter((p) => {
      const matchesCategory =
        effectiveFilter === 'Todos'
          ? true
          : effectiveFilter === 'Favoritos'
            ? favoriteIds.has(p.id)
            : p.category === effectiveFilter || p.typeLabel === effectiveFilter;

      if (!matchesCategory) return false;
      if (!q) return true;

      return `${p.title} ${p.category} ${p.typeLabel} ${p.promptText}`
        .toLowerCase()
        .includes(q);
    });

    if (sortBy === 'az') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return list;
  }, [prompts, searchQuery, selectedCategory, onlyFavorites, favoriteIds, sortBy]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('Prompt copiado com sucesso.');
    } catch {
      onNotify('Não foi possível copiar automaticamente.', 'error');
    }
  };

  const daysRemaining = profile
    ? Math.max(
        0,
        Math.ceil((profile.accessExpiresAt.getTime() - nowMs) / 86400000)
      )
    : 0;
  const progressPercent = Math.min(100, Math.round((daysRemaining / 90) * 100));

  const statusText =
    profile?.planStatus === 'active' && daysRemaining > 0
      ? 'Ativa'
      : 'Expirada';

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#f12b3d]">
            Biblioteca Criativa
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mt-1">
            {onlyFavorites ? 'Seus prompts salvos' : 'Galeria de Prompts'}
          </h1>
          <p className="text-sm text-[#a39ca0] mt-1.5">
            {onlyFavorites
              ? 'Acesse rapidamente os estilos que você marcou como favoritos.'
              : 'Escolha uma referência visual, copie o prompt com um toque ou gere variações personalizadas.'}
          </p>
        </div>

        {/* Subscription summary strip for non-admin members */}
        {!isAdmin && profile && !onlyFavorites && (
          <div className="w-full md:w-80 rounded-xl bg-[#131112] border border-white/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#d5cdd0]">
                Minha assinatura
              </span>
              <span className="font-semibold text-white">{statusText}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold tabular-nums text-white">
                {daysRemaining} dias restantes
              </span>
              <span className="text-xs tabular-nums text-[#a39ca0]">
                até {profile.accessExpiresAt.toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[#f12b3d] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <a
              href={CAKTO_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f12b3d] hover:text-[#ff5364] transition-colors"
            >
              <span>Renovar por R$ 45,00 (90 dias)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Search, Sort & Segmented Category Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8f888c] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar prompts por tema, estilo ou palavra-chave..."
              aria-label="Buscar prompts"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#131112] border border-white/10 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#8f888c] focus:outline-none transition-colors"
            />
          </div>
          <select
            aria-label="Ordenar prompts"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'az')}
            className="sm:w-48 px-4 py-3 rounded-xl bg-[#131112] border border-white/10 focus:border-[#f12b3d] text-xs font-semibold text-[#f5f2f3] focus:outline-none"
          >
            <option value="recent">Mais recentes</option>
            <option value="az">Ordem alfabética (A–Z)</option>
          </select>
        </div>

        {!onlyFavorites && (
          <div
            role="tablist"
            aria-label="Filtrar por categoria"
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
          >
            {filterOptions.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#f12b3d] text-white'
                      : 'bg-[#131112] border border-white/10 text-[#b8b0b4] hover:text-white hover:border-white/25'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="text-base font-semibold text-white">
          {onlyFavorites
            ? 'Favoritos'
            : selectedCategory === 'Todos'
              ? 'Explorar prompts'
              : selectedCategory}
        </h2>
        <span className="text-xs tabular-nums text-[#a39ca0]">
          {filteredPrompts.length}{' '}
          {filteredPrompts.length === 1 ? 'prompt' : 'prompts'}
        </span>
      </div>

      {/* Grid */}
      {loadingPrompts ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="rounded-2xl bg-[#131112] border border-white/10 overflow-hidden animate-pulse"
            >
              <div className="aspect-[3/4] bg-white/5" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 w-20 bg-white/10 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-9 w-full bg-white/10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="rounded-2xl bg-[#131112] border border-white/10 p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-white">
            Nenhum prompt encontrado
          </p>
          <p className="text-xs text-[#a39ca0] max-w-md mx-auto">
            {onlyFavorites
              ? 'Você ainda não salvou nenhum prompt. Clique em "Salvar" nos cartões da biblioteca para acessá-los aqui.'
              : 'Tente limpar a busca ou selecionar outra categoria acima.'}
          </p>
          {(searchQuery || selectedCategory !== 'Todos') && !onlyFavorites && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Todos');
              }}
              className="px-4 py-2 rounded-lg bg-[#1c1719] border border-white/15 text-xs font-semibold text-white hover:border-white/30"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredPrompts.map((item) => {
            const isFav = favoriteIds.has(item.id);
            return (
              <article
                key={item.id}
                className="group rounded-2xl bg-[#131112] border border-white/10 overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setActivePrompt(item)}
                  className="relative aspect-[3/4] w-full bg-[#1a1618] overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-[#f12b3d]"
                >
                  <MediaPreview
                    src={item.mediaUrl}
                    alt={item.title}
                    mediaType={item.mediaType}
                    className="transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>

                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-[#a39ca0]">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.typeLabel}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-1 leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.promptText)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#f12b3d] hover:bg-[#d92031] text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span>Copiar prompt</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePrompt(item)}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-lg bg-[#1c1719] border border-white/10 hover:border-white/25 text-xs font-medium text-[#e5dfe2] transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>Detalhes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item)}
                        aria-pressed={isFav}
                        className={`inline-flex items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                          isFav
                            ? 'bg-[#2a1418] border-[#f12b3d]/50 text-[#ff8792]'
                            : 'bg-[#1c1719] border-white/10 hover:border-white/25 text-[#e5dfe2]'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isFav ? 'fill-[#f12b3d] text-[#f12b3d]' : ''
                          }`}
                        />
                        <span>{isFav ? 'Salvo' : 'Salvar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Prompt Detail Modal */}
      {activePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivePrompt(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-modal-title"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[#131112] border border-white/15 p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#a39ca0]">
                  <span>{activePrompt.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activePrompt.typeLabel}</span>
                </div>
                <h2
                  id="prompt-modal-title"
                  className="text-xl font-bold text-white mt-1"
                >
                  {activePrompt.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePrompt(null)}
                aria-label="Fechar janela"
                className="p-2 rounded-lg text-[#a39ca0] hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
              <div className="sm:col-span-5 relative aspect-[3/4] rounded-xl overflow-hidden bg-[#1a1618] border border-white/10">
                <MediaPreview
                  src={activePrompt.mediaUrl}
                  alt={activePrompt.title}
                  mediaType={activePrompt.mediaType}
                  sizes="300px"
                />
              </div>

              <div className="sm:col-span-7 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#d5cdd0] mb-2">
                    Prompt completo
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#f5f2f3] bg-[#0a090a] border border-white/10 rounded-xl p-4 max-h-72 overflow-y-auto">
                    {activePrompt.promptText}
                  </pre>
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(activePrompt.promptText)}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] text-xs font-semibold text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copiar prompt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(activePrompt)}
                      className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          favoriteIds.has(activePrompt.id)
                            ? 'fill-[#f12b3d] text-[#f12b3d]'
                            : ''
                        }`}
                      />
                      <span>
                        {favoriteIds.has(activePrompt.id) ? 'Salvo' : 'Salvar'}
                      </span>
                    </button>
                  </div>

                  {onUseAsTemplate && (
                    <button
                      type="button"
                      onClick={() => {
                        const selected = activePrompt;
                        setActivePrompt(null);
                        onUseAsTemplate(selected);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#e5dfe2] transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-[#f12b3d]" />
                      <span>Criar variação personalizada com IA</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
