import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import firebaseConfig from '@/firebase-applet-config.json';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function verifyFirebaseIdToken(idToken: string): Promise<boolean> {
  if (!idToken || !firebaseConfig.apiKey) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      users?: Array<{ localId?: string; emailVerified?: boolean }>;
    };
    return Boolean(data.users?.[0]?.localId && data.users[0]?.emailVerified);
  } catch {
    return false;
  }
}

interface VideoRequestBody {
  mode: 'video';
  idea: string;
  style: string;
  duration: string;
  imageBase64?: string;
  imageMimeType?: string;
}

interface HeadlinesRequestBody {
  mode: 'headlines';
  subject: string;
  goal: string;
}

interface CustomRequestBody {
  mode: 'custom';
  subject: string;
  style: string;
  scene?: string;
  lighting: string;
  format: string;
  details?: string;
}

type GenerateRequestBody =
  | VideoRequestBody
  | HeadlinesRequestBody
  | CustomRequestBody;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || '';
    const isVerifiedCaller = await verifyFirebaseIdToken(idToken);
    if (!isVerifiedCaller) {
      return NextResponse.json(
        { error: 'Acesso não autorizado. Entre com uma conta assinante.' },
        { status: 401 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Chave da API Gemini não configurada no servidor (GEMINI_API_KEY).',
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as GenerateRequestBody;

    if (body.mode === 'video') {
      const idea = (body.idea || '').trim();
      if (!idea) {
        return NextResponse.json(
          { error: 'Descreva o produto ou objetivo do vídeo.' },
          { status: 400 }
        );
      }

      const promptText = `Você é um diretor criativo especialista em vídeos curtos de alta conversão e geração de vídeo por IA (Veo / Sora / Kling).
Crie UM único prompt detalhado e pronto para copiar em português do Brasil para gerar um vídeo no estilo "${body.style}", com duração de "${body.duration}".
Objetivo / descrição do produto: "${idea}".
${
  body.imageBase64
    ? 'Analise cuidadosamente a imagem de referência enviada: descreva com precisão as cores, textura, embalagem, proporções, rótulos e material do produto para que a IA preserve 100% da fidelidade visual sem inventar elementos.'
    : 'Estruture a cena mantendo consistência visual rigorosa com qualquer imagem de referência que o criador anexar na ferramenta de vídeo.'
}
Inclua:
1. Direção de câmera e enquadramento (ex.: vertical 9:16, movimento suave de mão ou travelling).
2. Sequência natural de ações ao longo dos ${body.duration}.
3. Iluminação, textura realista e ritmo autêntico.
4. Instrução explícita para preservar fielmente o produto original sem deformar texto ou embalagem.
Responda APENAS com o texto final do prompt, sem introduções ou saudações.`;

      const contents =
        body.imageBase64 && body.imageMimeType
          ? {
              parts: [
                {
                  inlineData: {
                    mimeType: body.imageMimeType,
                    data: body.imageBase64,
                  },
                },
                { text: promptText },
              ],
            }
          : promptText;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Resposta vazia do modelo.');
      }

      return NextResponse.json({ text });
    }

    if (body.mode === 'headlines') {
      const subject = (body.subject || '').trim();
      if (!subject) {
        return NextResponse.json(
          { error: 'Informe o produto ou assunto.' },
          { status: 400 }
        );
      }

      const promptText = `Você é um copywriter sênior especializado em ganchos visuais (hooks) e headlines para Reels, TikTok e anúncios no Brasil.
Produto ou assunto: "${subject}".
Objetivo principal: "${body.goal}".
Crie exatamente 6 headlines numeradas (1 a 6), curtas, naturais, diretas e persuasivas em português do Brasil, sem clichês exagerados nem promessas irreais.
Responda apenas com a lista numerada (1. ... até 6. ...).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Resposta vazia do modelo.');
      }

      return NextResponse.json({ text: `Objetivo: ${body.goal}\n\n${text}` });
    }

    if (body.mode === 'custom') {
      const subject = (body.subject || '').trim();
      if (!subject) {
        return NextResponse.json(
          { error: 'Descreva o que deseja criar.' },
          { status: 400 }
        );
      }

      const promptText = `Você é um engenheiro de prompts fotográficos e diretor de arte editorial.
Crie um prompt profissional, rico e pronto para copiar em português do Brasil com as seguintes especificações:
- Assunto principal: ${subject}
- Estilo visual: ${body.style}
- Cenário: ${body.scene?.trim() || 'ambiente harmonioso e coerente com a estética editorial'}
- Iluminação: ${body.lighting}
- Formato / proporção: ${body.format}
- Detalhes adicionais: ${body.details?.trim() || 'composição equilibrada, textura realista de pele e materiais, nitidez de lente prime'}

Inclua instrução clara para preservar fielmente a identidade e as características caso o criador utilize uma foto de referência.
Responda APENAS com o prompt final pronto para copiar.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Resposta vazia do modelo.');
      }

      return NextResponse.json({ text });
    }

    return NextResponse.json(
      { error: 'Modo de geração inválido.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro na rota /api/gemini/generate:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Falha ao gerar conteúdo com a IA.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
