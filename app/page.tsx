'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Heart,
  Home,
  Loader2,
  Settings,
  Wand2,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
} from '@/lib/firebase';
import { PromptItem, SEED_PROMPTS } from '@/lib/prompts-seed';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { MemberTab, TopNav } from '@/components/TopNav';
import { SalesLanding } from '@/components/SalesLanding';
import { PaywallGate } from '@/components/PaywallGate';
import { PromptGallery } from '@/components/PromptGallery';
import { AiGenerators, GeneratorTemplateSeed } from '@/components/AiGenerators';
import { AdminPanel } from '@/components/AdminPanel';
import { AccountModal } from '@/components/AccountModal';
import { Toast, ToastState } from '@/components/Toast';

function BiaPromptsWorkspace() {
  const {
    user,
    profile,
    isAdmin,
    hasActiveAccess,
    loading,
    signingIn,
    authError,
    signInWithGoogle,
    logout,
    updateDisplayName,
    refreshProfile,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<MemberTab>('library');
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [templateSeed, setTemplateSeed] =
    useState<GeneratorTemplateSeed | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loadedPromptsForUid, setLoadedPromptsForUid] = useState<string | null>(
    null
  );
  const [firestoreHasPrompts, setFirestoreHasPrompts] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const seededOnceRef = useRef(false);

  const notify = useCallback(
    (message: string, variant: 'success' | 'error' = 'success') => {
      setToast({ message, variant });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 2400);
    },
    []
  );

  // Real-time prompts subscription ONLY when authenticated AND paid/admin
  useEffect(() => {
    if (!user || !hasActiveAccess) return;
    const currentUid = user.uid;

    const q = query(collection(db, 'prompts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          setFirestoreHasPrompts(false);
          if (isAdmin && !seededOnceRef.current) {
            seededOnceRef.current = true;
            try {
              for (const item of SEED_PROMPTS) {
                await setDoc(doc(db, 'prompts', item.id), {
                  title: item.title,
                  category: item.category,
                  typeLabel: item.typeLabel,
                  mediaUrl: item.mediaUrl,
                  mediaType: item.mediaType,
                  promptText: item.promptText,
                  authorId: currentUid,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'prompts');
            }
          } else {
            setPrompts([]);
          }
        } else {
          setFirestoreHasPrompts(true);
          const list: PromptItem[] = snapshot.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              title: raw.title,
              category: raw.category,
              typeLabel: raw.typeLabel,
              mediaUrl: raw.mediaUrl,
              mediaType: raw.mediaType || 'image',
              promptText: raw.promptText,
              authorId: raw.authorId,
              createdAt: raw.createdAt,
              updatedAt: raw.updatedAt,
            };
          });
          setPrompts(list);
        }
        setLoadedPromptsForUid(currentUid);
      },
      (error) => {
        setLoadedPromptsForUid(currentUid);
        handleFirestoreError(error, OperationType.LIST, 'prompts');
      }
    );

    return () => unsub();
  }, [user, hasActiveAccess, isAdmin]);

  // Real-time user favorites subscription ONLY when authenticated AND paid/admin
  useEffect(() => {
    if (!user || !hasActiveAccess) return;

    const favPath = `users/${user.uid}/favorites`;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'favorites'),
      (snapshot) => {
        const nextSet = new Set<string>();
        snapshot.docs.forEach((d) => nextSet.add(d.id));
        setFavoriteIds(nextSet);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );

    return () => unsub();
  }, [user, hasActiveAccess]);

  const visiblePrompts = user && hasActiveAccess ? prompts : [];
  const visibleFavorites =
    user && hasActiveAccess ? favoriteIds : new Set<string>();
  const loadingPrompts =
    Boolean(user && hasActiveAccess) && loadedPromptsForUid !== user?.uid;

  const handleToggleFavorite = useCallback(
    async (prompt: PromptItem) => {
      if (!user || !hasActiveAccess) return;
      if (!firestoreHasPrompts) {
        notify('Aguardando sincronização inicial do catálogo.', 'error');
        return;
      }

      const favPath = `users/${user.uid}/favorites/${prompt.id}`;
      const favRef = doc(db, 'users', user.uid, 'favorites', prompt.id);

      try {
        if (favoriteIds.has(prompt.id)) {
          await deleteDoc(favRef);
          notify('Removido dos favoritos.');
        } else {
          await setDoc(favRef, {
            promptId: prompt.id,
            userId: user.uid,
            savedAt: serverTimestamp(),
          });
          notify('Prompt salvo nos favoritos.');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, favPath);
      }
    },
    [user, hasActiveAccess, firestoreHasPrompts, favoriteIds, notify]
  );

  const handleUseAsTemplate = useCallback((prompt: PromptItem) => {
    setTemplateSeed({
      subject: prompt.title,
      details: `Baseado no estilo ${prompt.category} (${prompt.typeLabel}): ${prompt.promptText}`,
      nonce: Date.now(),
    });
    setActiveTab('generators');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center gap-3 text-[#d5cdd0]">
        <Loader2 className="w-6 h-6 animate-spin text-[#f12b3d]" />
        <p className="text-xs font-medium">Carregando Bia Prompts IA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f2f3]">
      <TopNav
        isAuthenticated={Boolean(user)}
        hasActiveAccess={hasActiveAccess}
        isAdmin={isAdmin}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAccount={() => setAccountOpen(true)}
        onSignIn={signInWithGoogle}
        signingIn={signingIn}
      />

      {!user ? (
        <SalesLanding
          onSignIn={signInWithGoogle}
          signingIn={signingIn}
          authError={authError}
        />
      ) : !hasActiveAccess && profile ? (
        <>
          <PaywallGate
            profile={profile}
            onRefresh={refreshProfile}
            onLogout={logout}
            onNotify={notify}
          />
          {accountOpen && (
            <AccountModal
              open={accountOpen}
              onClose={() => setAccountOpen(false)}
              profile={profile}
              isAdmin={isAdmin}
              onUpdateName={updateDisplayName}
              onLogout={logout}
              onNotify={notify}
            />
          )}
        </>
      ) : (
        <>
          <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-24 md:pb-14">
            {(activeTab === 'library' || activeTab === 'favorites') && (
              <PromptGallery
                prompts={visiblePrompts}
                loadingPrompts={loadingPrompts}
                favoriteIds={visibleFavorites}
                onToggleFavorite={handleToggleFavorite}
                onUseAsTemplate={handleUseAsTemplate}
                onlyFavorites={activeTab === 'favorites'}
                profile={profile}
                isAdmin={isAdmin}
                onNotify={notify}
              />
            )}

            {activeTab === 'generators' && (
              <AiGenerators
                key={templateSeed?.nonce ?? 0}
                userId={user.uid}
                initialTemplate={templateSeed}
                onNotify={notify}
              />
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminPanel
                adminUid={user.uid}
                prompts={visiblePrompts}
                onClose={() => setActiveTab('library')}
                onNotify={notify}
              />
            )}
          </main>

          {/* Compact mobile bottom navigation (< 15% viewport height cap) */}
          <nav
            aria-label="Navegação móvel"
            className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#0d0b0c]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around px-2"
          >
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium whitespace-nowrap ${
                activeTab === 'library' ? 'text-[#f12b3d]' : 'text-[#a39ca0]'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('generators')}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium whitespace-nowrap ${
                activeTab === 'generators' ? 'text-[#f12b3d]' : 'text-[#a39ca0]'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>Geradores</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium whitespace-nowrap ${
                activeTab === 'favorites' ? 'text-[#f12b3d]' : 'text-[#a39ca0]'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Salvos</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium whitespace-nowrap ${
                  activeTab === 'admin' ? 'text-[#f12b3d]' : 'text-[#a39ca0]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {accountOpen && profile && (
            <AccountModal
              open={accountOpen}
              onClose={() => setAccountOpen(false)}
              profile={profile}
              isAdmin={isAdmin}
              onUpdateName={updateDisplayName}
              onLogout={logout}
              onNotify={notify}
            />
          )}
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <BiaPromptsWorkspace />
    </AuthProvider>
  );
}
