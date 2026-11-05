/**
 * Text -> 384-dimension unit vector.
 *
 * Primary: Xenova/all-MiniLM-L6-v2 (a sentence-embedding model run locally via
 * transformers.js). It is used as is; nothing is trained here.
 *
 * Fallback: a deterministic hashing embedder so the project still runs offline.
 * It is LEXICAL (word and word-pair overlap), not semantic, so the "CNN vs
 * computer vision" style of match only works with the MiniLM provider.
 * The model name that produced each vector is stored next to it in the database.
 */
export const DIMS = 384;
const MINILM = 'Xenova/all-MiniLM-L6-v2';
const HASH = 'hash-384-v1';

type Embedder = { model: string; embed: (text: string) => Promise<number[]> };
let cached: Promise<Embedder> | null = null;

function l2(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashEmbedder(): Embedder {
  return {
    model: HASH,
    embed: async (text) => {
      const words = (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map((w) => w.replace(/\.+$/, ''));
      const feats = [...words, ...words.slice(1).map((w, i) => `${words[i]}_${w}`)];
      const v = new Array<number>(DIMS).fill(0);
      for (const f of feats) {
        const h = fnv1a(f);
        v[h % DIMS] += (h & 0x80000000) === 0 ? 1 : -1;   // signed hashing
      }
      return l2(v.map((x) => Math.sign(x) * Math.log1p(Math.abs(x))));
    },
  };
}

async function minilmEmbedder(): Promise<Embedder> {
  const { pipeline, env } = await import('@xenova/transformers');
  env.allowLocalModels = false;
  const extractor = await pipeline('feature-extraction', MINILM);
  return {
    model: MINILM,
    embed: async (text) => {
      const out = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(out.data as Float32Array);
    },
  };
}

async function build(): Promise<Embedder> {
  const mode = (process.env.EMBEDDING_PROVIDER ?? 'auto').toLowerCase();
  if (mode === 'hash') return hashEmbedder();
  try {
    return await minilmEmbedder();
  } catch (err) {
    if (mode === 'transformers') throw err;
    console.warn(
      `[embeddings] ${MINILM} unavailable (${(err as Error).message}); using offline hashing embedder. ` +
        'Matches will be lexical, not semantic.'
    );
    return hashEmbedder();
  }
}

export function getEmbedder(): Promise<Embedder> {
  if (!cached) cached = build();
  return cached;
}

export async function embedText(text: string): Promise<{ vector: number[]; model: string }> {
  const e = await getEmbedder();
  const clipped = text.slice(0, 4000);
  return { vector: await e.embed(clipped), model: e.model };
}
