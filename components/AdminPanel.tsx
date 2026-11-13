'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  CheckCircle2,
  Copy,
  Film,
  ImageIcon,
  Loader2,
  MailPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
} from '@/lib/firebase';
import {
  ApprovedPurchase,
  FIELD_LIMITS,
  MediaType,
  PROMPT_CATEGORIES,
  PromptCategory,
  PromptItem,
  SEED_PROMPTS,
  UserProfile,
  emailToKey,
  isAdminEmail,
} from '@/lib/prompts-seed';
import { useAuth } from './AuthProvider';
import { MediaPreview } from './MediaPreview';

const emptySubscribe = () => () => {};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MEDIA_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
]);

function detectMediaTypeFromFile(file: File): MediaType {
  if (file.type.toLowerCase().startsWith('video/')) return 'video';
  if (/\.(mp4|webm|mov|ogv)$/i.test(file.name)) return 'video';
  return 'image';
}

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

interface AdminPanelProps {
  adminUid: string;
  prompts: PromptItem[];
  onClose: () => void;
  onNotify: (msg: string, variant?: 'success' | 'error') => void;
}

export function AdminPanel({
  adminUid,
  prompts,
  onClose,
  onNotify,
}: AdminPanelProps) {
  const { getIdToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PromptCategory>('POV');
  const [typeLabel, setTypeLabel] = useState('Moda');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string>('');
  const [existingMediaType, setExistingMediaType] =
    useState<MediaType>('image');
  const [promptText, setPromptText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [preapproveEmail, setPreapproveEmail] = useState('');
  const [grantingEmail, setGrantingEmail] = useState(false);
  const [approvedList, setApprovedList] = useState<ApprovedPurchase[]>([]);

  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const usersPath = 'users';
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            uid: raw.uid,
            email: raw.email,
            displayName: raw.displayName,
            planStatus: raw.planStatus,
            accessExpiresAt: raw.accessExpiresAt?.toDate
              ? raw.accessExpiresAt.toDate()
              : new Date(0),
            createdAt: raw.createdAt?.toDate
              ? raw.createdAt.toDate()
              : undefined,
          };
        });
        setMembers(list);
        setLoadingMembers(false);
      },
      (error) => {
        setLoadingMembers(false);
        handleFirestoreError(error, OperationType.LIST, usersPath);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const apPath = 'approved_purchases';
    const q = query(
      collection(db, 'approved_purchases'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: ApprovedPurchase[] = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            emailKey: d.id,
            email: raw.email,
            planStatus: raw.planStatus,
            durationDays: raw.durationDays,
            grantedBy: raw.grantedBy,
            createdAt: raw.createdAt?.toDate
              ? raw.createdAt.toDate()
              : undefined,
          };
        });
        setApprovedList(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, apPath);
      }
    );

    return () => unsub();
  }, []);

  const webhookUrl = useSyncExternalStore(
    emptySubscribe,
    () => `${window.location.origin}/api/webhooks/cakto`,
    () => '/api/webhooks/cakto'
  );

  // Sync any Cakto webhook purchases stored on the server ledger into Firestore
  useEffect(() => {
    let active = true;
    const syncWebhookLedger = async () => {
      const token = await getIdToken();
      if (!token || !active) return;
      try {
        const res = await fetch('/api/webhooks/cakto', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          purchases?: Array<{
            emailKey: string;
            email: string;
            status: 'active' | 'revoked';
            durationDays: number;
            firestoreSynced: boolean;
          }>;
        };
        for (const item of data.purchases || []) {
          if (!active) return;
          if (item.status === 'active' && !item.firestoreSynced) {
            await setDoc(doc(db, 'approved_purchases', item.emailKey), {
              email: item.email.toLowerCase(),
              planStatus: 'active',
              durationDays: item.durationDays || 90,
              grantedBy: adminUid,
              createdAt: serverTimestamp(),
            });
            await fetch('/api/webhooks/cakto', {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ emailKey: item.emailKey }),
            });
          }
        }
      } catch {
        // Non-blocking sync
      }
    };
    syncWebhookLedger();
    return () => {
      active = false;
    };
  }, [adminUid, getIdToken]);

  const clearSelectedFile = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewObjectUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('POV');
    setTypeLabel('Moda');
    clearSelectedFile();
    setExistingMediaUrl('');
    setExistingMediaType('image');
    setPromptText('');
  };

  const handleStartEdit = (item: PromptItem) => {
    clearSelectedFile();
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setTypeLabel(item.typeLabel);
    setExistingMediaUrl(item.mediaUrl);
    setExistingMediaType(item.mediaType);
    setPromptText(item.promptText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGalleryFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type.toLowerCase();
    if (mime && !ALLOWED_MEDIA_MIMES.has(mime)) {
      onNotify(
        'Formato não suportado. Escolha JPG, PNG, WebP, GIF, MP4, WebM ou MOV.',
        'error'
      );
      e.target.value = '';
      return;
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      onNotify(
        'O arquivo da galeria deve ter no máximo 25 MB.',
        'error'
      );
      e.target.value = '';
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setSelectedFile(file);
    setPreviewObjectUrl(nextUrl);
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanType = typeLabel.trim() || 'Criativo';
    const cleanPrompt = promptText.trim();

    if (
      cleanTitle.length < FIELD_LIMITS.TITLE_MIN ||
      cleanTitle.length > FIELD_LIMITS.TITLE_MAX
    ) {
      onNotify('O título deve ter entre 2 e 120 caracteres.', 'error');
      return;
    }

    if (
      cleanPrompt.length < FIELD_LIMITS.PROMPT_MIN ||
      cleanPrompt.length > FIELD_LIMITS.PROMPT_MAX
    ) {
      onNotify('O texto do prompt deve ter entre 10 e 4000 caracteres.', 'error');
      return;
    }

    if (!selectedFile && (!editingId || !existingMediaUrl)) {
      onNotify('Escolha uma foto ou vídeo da galeria.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      let finalMediaUrl = existingMediaUrl;
      let finalMediaType: MediaType = existingMediaType;

      if (selectedFile) {
        setUploadingMedia(true);
        const token = await getIdToken();
        if (!token) {
          onNotify(
            'Sessão expirada. Entre novamente para enviar a mídia.',
            'error'
          );
          return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const uploadData = (await uploadRes.json().catch(() => ({}))) as {
          url?: string;
          mediaType?: MediaType;
          error?: string;
        };

        if (!uploadRes.ok || !uploadData.url || !uploadData.mediaType) {
          onNotify(
            uploadData.error || 'Falha ao enviar a foto ou vídeo da galeria.',
            'error'
          );
          return;
        }

        finalMediaUrl = uploadData.url;
        finalMediaType = uploadData.mediaType;
        setUploadingMedia(false);
      }

      if (finalMediaUrl.length > FIELD_LIMITS.MEDIA_URL_MAX) {
        onNotify('Referência da mídia excede o limite permitido.', 'error');
        return;
      }

      if (editingId) {
        await updateDoc(doc(db, 'prompts', editingId), {
          title: cleanTitle,
          category,
          typeLabel: cleanType.slice(0, FIELD_LIMITS.TYPE_LABEL_MAX),
          mediaUrl: finalMediaUrl,
          mediaType: finalMediaType,
          promptText: cleanPrompt,
          updatedAt: serverTimestamp(),
        });
        onNotify('Prompt atualizado com sucesso.');
      } else {
        const promptRef = doc(collection(db, 'prompts'));
        await setDoc(promptRef, {
          title: cleanTitle,
          category,
          typeLabel: cleanType.slice(0, FIELD_LIMITS.TYPE_LABEL_MAX),
          mediaUrl: finalMediaUrl,
          mediaType: finalMediaType,
          promptText: cleanPrompt,
          authorId: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onNotify('Prompt publicado na biblioteca compartilhada.');
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `prompts/${editingId}` : 'prompts'
      );
    } finally {
      setUploadingMedia(false);
      setSubmitting(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    const promptPath = `prompts/${id}`;
    try {
      await deleteDoc(doc(db, 'prompts', id));
      if (editingId === id) resetForm();
      onNotify('Prompt removido da biblioteca.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, promptPath);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      for (const item of SEED_PROMPTS) {
        await setDoc(doc(db, 'prompts', item.id), {
          title: item.title,
          category: item.category,
          typeLabel: item.typeLabel,
          mediaUrl: item.mediaUrl,
          mediaType: item.mediaType,
          promptText: item.promptText,
          authorId: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onNotify('8 prompts iniciais sincronizados no Firestore.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'prompts');
    } finally {
      setSeeding(false);
    }
  };

  const handleUpdateSubscription = async (
    member: UserProfile,
    action: 'activate90' | 'expire'
  ) => {
    const userPath = `users/${member.uid}`;
    try {
      const baseMs = Timestamp.now().toMillis();
      const nextExpiry =
        action === 'activate90'
          ? Timestamp.fromMillis(baseMs + 90 * 86400000)
          : Timestamp.fromMillis(baseMs - 60000);

      await updateDoc(doc(db, 'users', member.uid), {
        planStatus: action === 'activate90' ? 'active' : 'expired',
        accessExpiresAt: nextExpiry,
        updatedAt: serverTimestamp(),
      });
      onNotify(
        action === 'activate90'
          ? `Acesso de ${member.email} liberado por 90 dias.`
          : `Acesso de ${member.email} expirado.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  };

  const handlePreapproveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = preapproveEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      onNotify('Informe um e-mail válido do comprador.', 'error');
      return;
    }

    setGrantingEmail(true);
    const key = emailToKey(cleanEmail);
    const apPath = `approved_purchases/${key}`;

    try {
      await setDoc(doc(db, 'approved_purchases', key), {
        email: cleanEmail,
        planStatus: 'active',
        durationDays: 90,
        grantedBy: adminUid,
        createdAt: serverTimestamp(),
      });

      // Also immediately activate if the user has already signed in before
      const existingMember = members.find(
        (m) => m.email.toLowerCase() === cleanEmail
      );
      if (existingMember) {
        await handleUpdateSubscription(existingMember, 'activate90');
      }

      setPreapproveEmail('');
      onNotify(`E-mail ${cleanEmail} liberado para acesso de 90 dias.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, apPath);
    } finally {
      setGrantingEmail(false);
    }
  };

  const handleRevokeApproved = async (emailKey: string) => {
    const apPath = `approved_purchases/${emailKey}`;
    try {
      await deleteDoc(doc(db, 'approved_purchases', emailKey));
      onNotify('Pré-aprovação removida.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, apPath);
    }
  };

  const activeMembersCount = members.filter(
    (m) =>
      isAdminEmail(m.email) ||
      (m.planStatus === 'active' && m.accessExpiresAt.getTime() > nowMs)
  ).length;
  const pendingOrExpiredCount = members.length - activeMembersCount;

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#f12b3d]">
            Administração
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mt-1">
            Painel administrador
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161315] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
            <span>Sincronizar catálogo base</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#1c1719] border border-white/10 hover:border-white/25 text-xs font-semibold text-[#d5cdd0] transition-colors whitespace-nowrap"
          >
            Voltar à galeria
          </button>
        </div>
      </div>

      {/* Admin KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#131112] border border-white/10 p-4">
          <p className="text-xs text-[#a39ca0]">Prompts publicados</p>
          <p className="text-2xl font-bold tabular-nums text-white mt-1">
            {prompts.length}
          </p>
        </div>
        <div className="rounded-xl bg-[#131112] border border-white/10 p-4">
          <p className="text-xs text-[#a39ca0]">Assinantes ativos</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-400 mt-1">
            {activeMembersCount}
          </p>
        </div>
        <div className="rounded-xl bg-[#131112] border border-white/10 p-4">
          <p className="text-xs text-[#a39ca0]">Pendentes ou expirados</p>
          <p className="text-2xl font-bold tabular-nums text-[#ff7682] mt-1">
            {pendingOrExpiredCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Publish or Edit Prompt Form */}
        <form
          onSubmit={handleSavePrompt}
          className="lg:col-span-6 rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              {editingId ? (
                <Pencil className="w-4 h-4 text-[#f12b3d]" />
              ) : (
                <Plus className="w-4 h-4 text-[#f12b3d]" />
              )}
              <h2 className="text-base font-bold text-white">
                {editingId ? 'Editar prompt' : 'Publicar novo prompt'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-[#a39ca0] hover:text-white underline"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <div>
            <label
              htmlFor="admin-title"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Nome do prompt
            </label>
            <input
              id="admin-title"
              type="text"
              maxLength={FIELD_LIMITS.TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Editorial café da manhã ao sol"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="admin-cat"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Categoria
              </label>
              <select
                id="admin-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as PromptCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              >
                {PROMPT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="admin-type"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Estilo / etiqueta
              </label>
              <input
                id="admin-type"
                type="text"
                maxLength={FIELD_LIMITS.TYPE_LABEL_MAX}
                value={typeLabel}
                onChange={(e) => setTypeLabel(e.target.value)}
                placeholder="Ex.: Moda"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-gallery-file"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Foto ou vídeo da galeria
            </label>

            <input
              ref={fileInputRef}
              id="admin-gallery-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg,image/*,video/*"
              onChange={handleGalleryFileChange}
              className="sr-only"
            />

            {(() => {
              const activePreviewSrc =
                previewObjectUrl || (editingId ? existingMediaUrl : '');
              const activePreviewType: MediaType = selectedFile
                ? detectMediaTypeFromFile(selectedFile)
                : existingMediaType;

              if (activePreviewSrc) {
                return (
                  <div className="flex flex-col sm:flex-row items-start gap-4 p-3.5 rounded-xl bg-[#0a090a] border border-white/15">
                    <div className="relative w-28 sm:w-24 aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1618] shrink-0 border border-white/10">
                      <MediaPreview
                        src={activePreviewSrc}
                        alt={title || 'Pré-visualização da mídia'}
                        mediaType={activePreviewType}
                        sizes="128px"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        {activePreviewType === 'video' ? (
                          <Film className="w-3.5 h-3.5 text-[#f12b3d] shrink-0" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-[#f12b3d] shrink-0" />
                        )}
                        <span>
                          {activePreviewType === 'video'
                            ? 'Vídeo selecionado'
                            : 'Foto selecionada'}
                        </span>
                      </div>

                      {selectedFile ? (
                        <div className="text-[11px] text-[#a39ca0] space-y-0.5">
                          <p className="truncate text-[#d5cdd0]">
                            {selectedFile.name}
                          </p>
                          <p className="tabular-nums">
                            {formatFileSizeMb(selectedFile.size)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#a39ca0]">
                          Mídia atual publicada neste prompt.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Trocar na galeria</span>
                        </button>

                        {selectedFile && (
                          <button
                            type="button"
                            onClick={clearSelectedFile}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-[#a39ca0] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-7 px-4 rounded-xl bg-[#0a090a] border border-dashed border-white/20 hover:border-[#f12b3d]/70 hover:bg-[#100d0f] transition-colors text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1a1517] border border-white/10 flex items-center justify-center text-[#f12b3d]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">
                      Escolher foto ou vídeo da galeria
                    </p>
                    <p className="text-[11px] text-[#a39ca0]">
                      JPG, PNG, WebP, GIF, MP4, WebM ou MOV (até 25 MB)
                    </p>
                  </div>
                </button>
              );
            })()}
          </div>

          <div>
            <label
              htmlFor="admin-prompt"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Texto completo do prompt
            </label>
            <textarea
              id="admin-prompt"
              rows={5}
              maxLength={FIELD_LIMITS.PROMPT_MAX}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Escreva o prompt completo com instruções de iluminação, lente, pose e fidelidade..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {uploadingMedia
                ? 'Enviando mídia da galeria...'
                : submitting
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar alterações'
                    : 'Publicar prompt para assinantes'}
            </span>
          </button>
        </form>

        {/* Published Prompts List */}
        <div className="lg:col-span-6 rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-base font-bold text-white">
              Prompts publicados
            </h2>
            <span className="text-xs tabular-nums text-[#a39ca0]">
              {prompts.length} itens
            </span>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {prompts.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0a090a] border border-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-[#1a1618] shrink-0">
                    <MediaPreview
                      src={item.mediaUrl}
                      alt={item.title}
                      mediaType={item.mediaType}
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#a39ca0]">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.typeLabel}</span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-0.5">
                      {item.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    aria-label={`Editar ${item.title}`}
                    className="p-2 rounded-lg text-[#8f888c] hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(item.id)}
                    aria-label={`Excluir ${item.title}`}
                    className="p-2 rounded-lg text-[#8f888c] hover:text-[#f12b3d] hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pre-approve buyer by email & Cakto Webhook */}
      <section className="rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MailPlus className="w-4 h-4 text-[#f12b3d]" />
            <h2 className="text-base font-bold text-white">
              Liberação automática Cakto e pré-aprovação
            </h2>
          </div>
          <span className="text-xs text-[#a39ca0]">
            O e-mail usado na compra é liberado ao entrar com Google
          </span>
        </div>

        <div className="rounded-xl bg-[#0a090a] border border-white/10 p-4 space-y-2">
          <p className="text-xs font-semibold text-white">
            Webhook da Cakto (evento: Compra aprovada / purchase_approved)
          </p>
          <p className="text-[11px] text-[#a39ca0] leading-relaxed">
            Cole este endereço em Webhooks na sua conta Cakto para liberar
            automaticamente o e-mail do comprador por 90 dias assim que o
            pagamento for aprovado:
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              aria-label="URL do webhook Cakto"
              className="flex-1 px-3 py-2 rounded-lg bg-[#131112] border border-white/15 text-xs font-mono text-[#d5cdd0] focus:outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(webhookUrl);
                  onNotify('URL do webhook copiada.');
                } catch {
                  onNotify('Não foi possível copiar a URL.', 'error');
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar URL</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handlePreapproveEmail}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="email"
            value={preapproveEmail}
            onChange={(e) => setPreapproveEmail(e.target.value)}
            placeholder="email.do.comprador@gmail.com"
            aria-label="E-mail do comprador para liberar acesso"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
          />
          <button
            type="submit"
            disabled={grantingEmail}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            {grantingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Liberar 90 dias</span>
          </button>
        </form>

        {approvedList.length > 0 && (
          <div className="divide-y divide-white/10 border-t border-white/10 pt-2">
            {approvedList.map((ap) => (
              <div
                key={ap.emailKey}
                className="py-2.5 flex items-center justify-between gap-4 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{ap.email}</p>
                  <p className="text-[11px] text-[#a39ca0] tabular-nums">
                    Plano trimestral ({ap.durationDays} dias)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeApproved(ap.emailKey)}
                  className="text-xs text-[#ff7682] hover:text-[#f12b3d] whitespace-nowrap"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Member Subscriptions Table */}
      <section className="rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f12b3d]" />
            <h2 className="text-base font-bold text-white">
              Contas e assinaturas
            </h2>
          </div>
          <span className="text-xs tabular-nums text-[#a39ca0]">
            {members.length} contas
          </span>
        </div>

        {loadingMembers ? (
          <p className="text-xs text-[#a39ca0]">Carregando contas...</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-[#a39ca0]">
            Nenhuma conta registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#a39ca0]">
                  <th className="py-2.5 pr-4 font-semibold">Membro</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Vencimento</th>
                  <th className="py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {members.map((m) => {
                  const memberIsAdmin = isAdminEmail(m.email);
                  const days = Math.max(
                    0,
                    Math.ceil(
                      (m.accessExpiresAt.getTime() - nowMs) / 86400000
                    )
                  );
                  const statusLabel = memberIsAdmin
                    ? 'Administrador'
                    : m.planStatus === 'active' && days > 0
                      ? 'Ativo'
                      : m.planStatus === 'pending'
                        ? 'Pendente'
                        : 'Expirado';

                  return (
                    <tr key={m.uid} className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-white">
                          {m.displayName}
                        </p>
                        <p className="text-[#a39ca0]">{m.email}</p>
                      </td>
                      <td className="py-3 pr-4 font-medium text-white">
                        {statusLabel}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-[#d5cdd0]">
                        {memberIsAdmin ? (
                          <span className="text-emerald-400 font-semibold">
                            Acesso ilimitado
                          </span>
                        ) : m.planStatus === 'pending' ? (
                          'Aguardando pagamento'
                        ) : (
                          `${m.accessExpiresAt.toLocaleDateString('pt-BR')} (${days}d)`
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {memberIsAdmin ? (
                          <span className="text-[11px] font-semibold text-[#a39ca0]">
                            Acesso completo
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSubscription(m, 'activate90')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c1719] border border-white/15 hover:border-emerald-500/50 text-[11px] font-semibold text-emerald-400 whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>+90 dias</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSubscription(m, 'expire')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c1719] border border-white/15 hover:border-[#f12b3d]/50 text-[11px] font-semibold text-[#ff7682] whitespace-nowrap"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Expirar</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
