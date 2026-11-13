export const CAKTO_CHECKOUT_URL = 'https://pay.cakto.com.br/vmuox3d_1278008';

export const ADMIN_EMAILS = [
  'biancaborbado123@gmail.com',
  'luanasantosarodrigues@gmail.com',
  'biancabordado@gmail.com',
] as const;

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(
    email.trim().toLowerCase()
  );
}

// Unlimited admin validity timestamp (Dec 31, 2099 UTC)
export const UNLIMITED_ADMIN_EXPIRY_MS = Date.UTC(2099, 11, 31, 23, 59, 59);

export const PROMPT_CATEGORIES = [
  'POV',
  'UGC',
  'Celular',
  'Movimentos',
  'Feminino',
  'Moda',
  'Casa',
  'Cenários',
  'Kids',
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export type MediaType = 'image' | 'video';

export type PlanStatus = 'pending' | 'active' | 'expired';

export function emailToKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export const FIELD_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  TITLE_MIN: 2,
  TITLE_MAX: 120,
  TYPE_LABEL_MIN: 1,
  TYPE_LABEL_MAX: 40,
  MEDIA_URL_MAX: 500,
  PROMPT_MIN: 10,
  PROMPT_MAX: 4000,
  DISPLAY_NAME_MAX: 100,
  GENERATION_OUTPUT_MAX: 6000,
} as const;

export const HERO_STUDIO_IMAGE = '/images/hero_creative_studio_1794584099418.jpg';

export interface PromptItem {
  id: string;
  title: string;
  category: PromptCategory;
  typeLabel: string;
  mediaUrl: string;
  mediaType: MediaType;
  promptText: string;
  authorId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  planStatus: PlanStatus;
  accessExpiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApprovedPurchase {
  emailKey: string;
  email: string;
  planStatus: 'active';
  durationDays: number;
  grantedBy: string;
  createdAt?: Date;
}

export interface GenerationItem {
  id: string;
  userId: string;
  generatorType: 'video' | 'headlines' | 'custom';
  title: string;
  outputText: string;
  createdAt?: Date;
}

export const PRESET_STUDIO_IMAGES = [
  {
    label: 'Selfie no espelho (Editorial)',
    url: '/images/prompt_mirror_selfie_1794584099634.jpg',
  },
  {
    label: 'Retrato lifestyle café',
    url: '/images/prompt_lifestyle_portrait_1794584100796.jpg',
  },
  {
    label: 'Look casual no espelho',
    url: '/images/prompt_casual_fashion_1794584099799.jpg',
  },
  {
    label: 'Pose editorial com movimento',
    url: '/images/prompt_editorial_motion_1794584100559.jpg',
  },
  {
    label: 'Retrato luz dourada',
    url: '/images/prompt_golden_hour_1794584100518.jpg',
  },
  {
    label: 'POV rotina matinal',
    url: '/images/prompt_pov_routine_1794584101323.jpg',
  },
  {
    label: 'Ensaio minimalista estúdio',
    url: '/images/prompt_minimal_studio_1794584101488.jpg',
  },
  {
    label: 'Passo e giro fashion',
    url: '/images/prompt_fashion_stride_1794584101790.jpg',
  },
] as const;

export const SEED_PROMPTS: Omit<PromptItem, 'authorId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'seed_selfie_espelho_elegante',
    title: 'Selfie no espelho — look elegante',
    category: 'POV',
    typeLabel: 'Feminino',
    mediaUrl: '/images/prompt_mirror_selfie_1794584099634.jpg',
    mediaType: 'image',
    promptText:
      'Crie uma fotografia ultrarrealista em estilo selfie no espelho, preservando fielmente a aparência da pessoa da imagem de referência. A modelo usa um look elegante com blazer estruturado, pose natural e expressão confiante. Ambiente moderno, iluminação suave de janela, textura realista da pele, fotografia vertical 9:16, alta definição.',
  },
  {
    id: 'seed_retrato_lifestyle_sofisticado',
    title: 'Retrato lifestyle sofisticado',
    category: 'UGC',
    typeLabel: 'Feminino',
    mediaUrl: '/images/prompt_lifestyle_portrait_1794584100796.jpg',
    mediaType: 'image',
    promptText:
      'Fotografia lifestyle ultrarrealista de uma mulher em café arquitetônico de travertino, pose espontânea segurando bebida gelada, luz natural lateral da manhã, composição editorial Leica 35mm, detalhes naturais e acabamento de câmera profissional. Manter identidade e características da referência. Formato vertical 9:16.',
  },
  {
    id: 'seed_look_casual_espelho',
    title: 'Look casual — foto no espelho',
    category: 'Celular',
    typeLabel: 'Moda',
    mediaUrl: '/images/prompt_casual_fashion_1794584099799.jpg',
    mediaType: 'image',
    promptText:
      'Recrie uma foto casual de moda feita com celular diante do espelho de estúdio. Preserve exatamente a roupa, bolsa estruturada e a identidade da referência. Enquadramento de corpo inteiro, ambiente clean, luz natural difusa, aparência espontânea e realista, formato vertical 9:16.',
  },
  {
    id: 'seed_pose_editorial_movimento',
    title: 'Pose editorial com movimento',
    category: 'Movimentos',
    typeLabel: 'Moda',
    mediaUrl: '/images/prompt_editorial_motion_1794584100559.jpg',
    mediaType: 'image',
    promptText:
      'Fotografia fashion editorial capturando um movimento natural da modelo em trench coat fluido, tecido e cabelo com movimento sutil, pose elegante, luz cinematográfica suave sobre fundo escuro minimalista e realismo fotográfico. Preservar rosto, corpo e roupa da referência. Vertical 9:16.',
  },
  {
    id: 'seed_retrato_luz_dourada',
    title: 'Retrato com luz dourada',
    category: 'UGC',
    typeLabel: 'Feminino',
    mediaUrl: '/images/prompt_golden_hour_1794584100518.jpg',
    mediaType: 'image',
    promptText:
      'Retrato fotográfico natural durante o pôr do sol em terraço urbano, luz dourada suave contornando o rosto e cabelos, expressão espontânea, pele com textura real, fundo desfocado e estética de fotografia feita em smartphone premium. Preservar a pessoa da imagem original.',
  },
  {
    id: 'seed_pov_rotina_lifestyle',
    title: 'POV — rotina e lifestyle',
    category: 'POV',
    typeLabel: 'Casa',
    mediaUrl: '/images/prompt_pov_routine_1794584101323.jpg',
    mediaType: 'image',
    promptText:
      'Imagem em primeira pessoa com estética UGC autêntica de rotina matinal, mãos organizando sérum facial, xícara de cerâmica e caderno de linho sobre mesa iluminada pelo sol, sombras naturais da manhã e detalhes realistas. Aparência de conteúdo capturado no dia a dia com smartphone, formato vertical 9:16.',
  },
  {
    id: 'seed_ensaio_minimalista',
    title: 'Ensaio minimalista de estúdio',
    category: 'Celular',
    typeLabel: 'Feminino',
    mediaUrl: '/images/prompt_minimal_studio_1794584101488.jpg',
    mediaType: 'image',
    promptText:
      'Ensaio fotográfico minimalista com parede neutra texturizada, composição limpa, pose delicada e natural com tricô claro estruturado, iluminação difusa de estúdio, alta fidelidade de pele e cabelo. Manter as características da pessoa de referência e resultado fotográfico realista.',
  },
  {
    id: 'seed_passo_giro_fashion',
    title: 'Passo e giro fashion',
    category: 'Movimentos',
    typeLabel: 'Moda',
    mediaUrl: '/images/prompt_fashion_stride_1794584101790.jpg',
    mediaType: 'image',
    promptText:
      'Cena fashion urbana com a modelo dando um passo e realizando um giro suave, movimento natural do casaco longo, câmera acompanhando discretamente, estética de campanha de moda em rua europeia, iluminação natural suave e realismo cinematográfico. Vertical 9:16.',
  },
];
