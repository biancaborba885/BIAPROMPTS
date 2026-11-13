'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  Film,
  ImagePlus,
  Loader2,
  Sliders,
  Trash2,
  Type as TypeIcon,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
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
import { FIELD_LIMITS, GenerationItem } from '@/lib/prompts-seed';
import { useAuth } from './AuthProvider';

export interface GeneratorTemplateSeed {
  subject: string;
  details: string;
  nonce: number;
}

interface AiGeneratorsProps {
  userId: string;
  initialTemplate?: GeneratorTemplateSeed | null;
  onNotify: (msg: string, variant?: 'success' | 'error') => void;
}

export function AiGenerators({
  userId,
  initialTemplate,
  onNotify,
}: AiGeneratorsProps) {
  const { getIdToken } = useAuth();

  // Video Generator state
  const [productImagePreview, setProductImagePreview] = useState<string | null>(
    null
  );
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(
    undefined
  );
  const [videoIdea, setVideoIdea] = useState('');
  const [videoStyle, setVideoStyle] = useState('UGC realista para TikTok Shop');
  const [videoDuration, setVideoDuration] = useState('8 segundos');
  const [videoOutput, setVideoOutput] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Headlines Generator state
  const [headlineSubject, setHeadlineSubject] = useState('');
  const [headlineGoal, setHeadlineGoal] = useState('Despertar curiosidade');
  const [headlineOutput, setHeadlineOutput] = useState('');
  const [loadingHeadline, setLoadingHeadline] = useState(false);

  // Custom Generator state
  const [customSubject, setCustomSubject] = useState(
    initialTemplate?.subject ?? ''
  );
  const [customStyle, setCustomStyle] = useState('Fotorrealista');
  const [customScene, setCustomScene] = useState('');
  const [customLight, setCustomLight] = useState('Luz natural suave');
  const [customFormat, setCustomFormat] = useState('Vertical 9:16');
  const [customDetails, setCustomDetails] = useState(
    initialTemplate?.details ?? ''
  );
  const [customOutput, setCustomOutput] = useState('');
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Firestore history
  const [history, setHistory] = useState<GenerationItem[]>([]);

  useEffect(() => {
    if (!userId) return;
    const genPath = `users/${userId}/generations`;
    const q = query(
      collection(db, 'users', userId, 'generations'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: GenerationItem[] = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            userId: raw.userId,
            generatorType: raw.generatorType,
            title: raw.title,
            outputText: raw.outputText,
            createdAt: raw.createdAt?.toDate ? raw.createdAt.toDate() : undefined,
          };
        });
        setHistory(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, genPath);
      }
    );

    return () => unsub();
  }, [userId]);

  const callGeminiApi = async (payload: Record<string, unknown>) => {
    const token = await getIdToken();
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { text?: string; error?: string };
    if (!res.ok || !data.text) {
      throw new Error(data.error || 'Erro ao gerar conteúdo.');
    }
    return data.text;
  };

  const saveGeneration = async (
    generatorType: GenerationItem['generatorType'],
    title: string,
    outputText: string
  ) => {
    const genId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const genPath = `users/${userId}/generations/${genId}`;
    try {
      await setDoc(doc(db, 'users', userId, 'generations', genId), {
        userId,
        generatorType,
        title: title.slice(0, 120),
        outputText: outputText.slice(0, FIELD_LIMITS.GENERATION_OUTPUT_MAX),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, genPath);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    const genPath = `users/${userId}/generations/${id}`;
    try {
      await deleteDoc(doc(db, 'users', userId, 'generations', id));
      onNotify('Item removido do histórico.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, genPath);
    }
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProductImagePreview(null);
      setImageBase64(undefined);
      setImageMimeType(undefined);
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      onNotify('Escolha uma imagem de até 4 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setProductImagePreview(result);
      const commaIdx = result.indexOf(',');
      if (commaIdx !== -1) {
        setImageBase64(result.slice(commaIdx + 1));
        setImageMimeType(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('Copiado com sucesso.');
    } catch {
      onNotify('Não foi possível copiar.', 'error');
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoIdea.trim()) {
      onNotify('Descreva o produto ou objetivo do vídeo.', 'error');
      return;
    }

    setLoadingVideo(true);
    try {
      const text = await callGeminiApi({
        mode: 'video',
        idea: videoIdea,
        style: videoStyle,
        duration: videoDuration,
        imageBase64,
        imageMimeType,
      });
      setVideoOutput(text);
      await saveGeneration('video', `Vídeo · ${videoIdea.trim()}`, text);
      onNotify('Prompt de vídeo gerado e salvo no histórico.');
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : 'Falha na geração.',
        'error'
      );
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleGenerateHeadlines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headlineSubject.trim()) {
      onNotify('Informe o produto ou assunto.', 'error');
      return;
    }

    setLoadingHeadline(true);
    try {
      const text = await callGeminiApi({
        mode: 'headlines',
        subject: headlineSubject,
        goal: headlineGoal,
      });
      setHeadlineOutput(text);
      await saveGeneration(
        'headlines',
        `Headlines · ${headlineSubject.trim()}`,
        text
      );
      onNotify('Headlines geradas e salvas no histórico.');
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : 'Falha na geração.',
        'error'
      );
    } finally {
      setLoadingHeadline(false);
    }
  };

  const handleGenerateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSubject.trim()) {
      onNotify('Descreva o que deseja criar.', 'error');
      return;
    }

    setLoadingCustom(true);
    try {
      const text = await callGeminiApi({
        mode: 'custom',
        subject: customSubject,
        style: customStyle,
        scene: customScene,
        lighting: customLight,
        format: customFormat,
        details: customDetails,
      });
      setCustomOutput(text);
      await saveGeneration(
        'custom',
        `Personalizado · ${customSubject.trim()}`,
        text
      );
      onNotify('Prompt personalizado gerado e salvo no histórico.');
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : 'Falha na geração.',
        'error'
      );
    } finally {
      setLoadingCustom(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#f12b3d]">
          Estúdio Criativo
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-1">
          Geradores de IA
        </h1>
        <p className="text-sm text-[#a39ca0] mt-1.5 max-w-2xl">
          Monte roteiros visuais para vídeo, ganchos de conversão e prompts
          fotográficos sob medida. Suas criações ficam salvas automaticamente no
          seu histórico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 1. Video Prompt Generator */}
        <form
          onSubmit={handleGenerateVideo}
          className="rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Film className="w-4 h-4 text-[#f12b3d]" />
            <h2 className="text-base font-bold text-white">
              Gerador de prompt para vídeo
            </h2>
          </div>

          <div>
            <label
              htmlFor="product-image-upload"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Imagem do produto (opcional — analisada pela IA)
            </label>
            <label
              htmlFor="product-image-upload"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0a090a] border border-dashed border-white/20 hover:border-white/40 cursor-pointer transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-[#f12b3d] shrink-0" />
              <span className="text-xs text-[#b8b0b4] truncate">
                {productImagePreview
                  ? 'Imagem carregada — clique para trocar'
                  : 'Selecionar foto do produto (JPG ou PNG até 4 MB)'}
              </span>
              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                onChange={handleProductImageChange}
                className="sr-only"
              />
            </label>
            {productImagePreview && (
              <div className="mt-2.5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImagePreview}
                  alt="Prévia do produto"
                  className="w-16 h-16 rounded-lg object-cover border border-white/15"
                />
                <button
                  type="button"
                  onClick={() => {
                    setProductImagePreview(null);
                    setImageBase64(undefined);
                    setImageMimeType(undefined);
                  }}
                  className="text-xs text-[#a39ca0] hover:text-white underline"
                >
                  Remover imagem
                </button>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="video-idea"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Descreva o produto ou objetivo
            </label>
            <textarea
              id="video-idea"
              rows={3}
              value={videoIdea}
              onChange={(e) => setVideoIdea(e.target.value)}
              placeholder="Ex.: vídeo UGC mostrando o sérum facial sendo aplicado antes da maquiagem..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="video-style"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Estilo do vídeo
              </label>
              <select
                id="video-style"
                value={videoStyle}
                onChange={(e) => setVideoStyle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              >
                <option>UGC realista para TikTok Shop</option>
                <option>Comercial cinematográfico</option>
                <option>POV natural de celular</option>
                <option>Vídeo demonstrativo de produto</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="video-duration"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Duração desejada
              </label>
              <select
                id="video-duration"
                value={videoDuration}
                onChange={(e) => setVideoDuration(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              >
                <option>8 segundos</option>
                <option>15 segundos</option>
                <option>30 segundos</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingVideo}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
          >
            {loadingVideo && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {loadingVideo ? 'Gerando roteiro visual...' : 'Gerar prompt para vídeo'}
            </span>
          </button>

          {videoOutput && (
            <div className="pt-2 space-y-2.5">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#f5f2f3] bg-[#0a090a] border border-white/10 rounded-xl p-4">
                {videoOutput}
              </pre>
              <button
                type="button"
                onClick={() => copyText(videoOutput)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar prompt</span>
              </button>
            </div>
          )}
        </form>

        {/* 2. Headlines Generator */}
        <form
          onSubmit={handleGenerateHeadlines}
          className="rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <TypeIcon className="w-4 h-4 text-[#f12b3d]" />
            <h2 className="text-base font-bold text-white">
              Gerador de headlines
            </h2>
          </div>

          <div>
            <label
              htmlFor="headline-subject"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Produto ou assunto
            </label>
            <input
              id="headline-subject"
              type="text"
              value={headlineSubject}
              onChange={(e) => setHeadlineSubject(e.target.value)}
              placeholder="Ex.: organizador de cozinha modular"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="headline-goal"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Objetivo do gancho
            </label>
            <select
              id="headline-goal"
              value={headlineGoal}
              onChange={(e) => setHeadlineGoal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
            >
              <option>Despertar curiosidade</option>
              <option>Gerar desejo de compra</option>
              <option>Destacar um benefício</option>
              <option>Criar urgência sem exageros</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loadingHeadline}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
          >
            {loadingHeadline && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {loadingHeadline ? 'Escrevendo headlines...' : 'Gerar headlines'}
            </span>
          </button>

          {headlineOutput && (
            <div className="pt-2 space-y-2.5">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#f5f2f3] bg-[#0a090a] border border-white/10 rounded-xl p-4">
                {headlineOutput}
              </pre>
              <button
                type="button"
                onClick={() => copyText(headlineOutput)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar headlines</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 3. Custom Prompt Builder */}
      <form
        onSubmit={handleGenerateCustom}
        className="rounded-2xl bg-[#131112] border border-white/10 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
          <Sliders className="w-4 h-4 text-[#f12b3d]" />
          <h2 className="text-base font-bold text-white">
            Gerador personalizado de imagem
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="custom-subject"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              O que deseja criar?
            </label>
            <input
              id="custom-subject"
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Ex.: foto de modelo usando uma bolsa estruturada"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="custom-scene"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Cenário
            </label>
            <input
              id="custom-scene"
              type="text"
              value={customScene}
              onChange={(e) => setCustomScene(e.target.value)}
              placeholder="Ex.: cafeteria minimalista, praia ao entardecer, estúdio..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="custom-style"
              className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
            >
              Estilo visual
            </label>
            <select
              id="custom-style"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
            >
              <option>Fotorrealista</option>
              <option>Editorial de moda</option>
              <option>UGC espontâneo</option>
              <option>Minimalista</option>
              <option>Cinematográfico</option>
              <option>Publicidade premium</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="custom-light"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Iluminação
              </label>
              <select
                id="custom-light"
                value={customLight}
                onChange={(e) => setCustomLight(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              >
                <option>Luz natural suave</option>
                <option>Luz dourada</option>
                <option>Iluminação de estúdio</option>
                <option>Luz cinematográfica</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="custom-format"
                className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
              >
                Formato
              </label>
              <select
                id="custom-format"
                value={customFormat}
                onChange={(e) => setCustomFormat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 text-sm text-white focus:outline-none focus:border-[#f12b3d]"
              >
                <option>Vertical 9:16</option>
                <option>Quadrado 1:1</option>
                <option>Horizontal 16:9</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="custom-details"
            className="block text-xs font-semibold text-[#d5cdd0] mb-1.5"
          >
            Detalhes adicionais
          </label>
          <textarea
            id="custom-details"
            rows={2}
            value={customDetails}
            onChange={(e) => setCustomDetails(e.target.value)}
            placeholder="Descreva pose, lente, movimento, paleta de cores e atmosfera..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a090a] border border-white/15 focus:border-[#f12b3d] text-sm text-white placeholder:text-[#736c70] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loadingCustom}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#f12b3d] hover:bg-[#d92031] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
        >
          {loadingCustom && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{loadingCustom ? 'Criando prompt...' : 'Criar meu prompt'}</span>
        </button>

        {customOutput && (
          <div className="pt-2 space-y-2.5">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#f5f2f3] bg-[#0a090a] border border-white/10 rounded-xl p-4">
              {customOutput}
            </pre>
            <button
              type="button"
              onClick={() => copyText(customOutput)}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#1c1719] border border-white/15 hover:border-white/30 text-xs font-semibold text-white transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar prompt</span>
            </button>
          </div>
        )}
      </form>

      {/* Recent Saved Generations */}
      {history.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              Histórico recente de criações
            </h2>
            <span className="text-xs tabular-nums text-[#a39ca0]">
              {history.length} salvos
            </span>
          </div>

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#131112] border border-white/10 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </p>
                    {item.createdAt && (
                      <p className="text-[11px] text-[#8f888c] tabular-nums">
                        {item.createdAt.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyText(item.outputText)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1c1719] border border-white/10 hover:border-white/25 text-xs font-medium text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(item.id)}
                      aria-label="Excluir do histórico"
                      className="p-1.5 rounded-lg text-[#8f888c] hover:text-[#f12b3d] hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs text-[#d5cdd0] bg-[#0a090a] border border-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {item.outputText}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
