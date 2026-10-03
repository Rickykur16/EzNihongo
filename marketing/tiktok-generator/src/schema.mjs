// Skema naskah video. Dipakai sebagai structured output Claude dan sebagai
// kontrak data untuk template render (template/index.html).

export const SCENE_TYPES = ['hook', 'statement', 'photo', 'compare', 'list', 'timeline', 'level', 'cta'];
export const CUE_TARGETS = ['kicker', 'headline', 'highlight', 'badge', 'photo', 'item0', 'item1', 'item2'];

const str = (description) => ({ type: 'string', description });

const item = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'sub', 'good', 'photo_query'],
  properties: {
    label: str('Teks utama item (pendek, maks ~22 karakter).'),
    sub: str('Teks kecil di bawah label, boleh kosong.'),
    good: { type: 'boolean', description: 'compare: true = sisi positif (centang merah), false = sisi lama (silang abu).' },
    photo_query: str('list: kata kunci foto stok (bahasa Inggris) untuk thumbnail item; kosongkan untuk tipe lain.'),
  },
};

const scene = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'vo', 'kicker', 'headline', 'highlight', 'badge', 'stamp', 'items', 'photo_query', 'cues'],
  properties: {
    type: { type: 'string', enum: SCENE_TYPES },
    vo: str('Kalimat yang diucapkan pengisi suara untuk adegan ini, ditulis sesuai cara baca (mis. "en lima", "es es we", "dua ribu dua puluh tujuh").'),
    kicker: str('Teks kecil di atas judul. Boleh kosong.'),
    headline: str('Judul utama (hitam).'),
    highlight: str('Bagian yang ditekankan (merah, besar).'),
    badge: str('Chip/label/bubble: tanggal, level (mis. "N5"), atau teks CTA (mis. Komen "N5" 👇).'),
    stamp: str('hook: teks Jepang pendek untuk cap di foto (mis. 技能実習). Boleh kosong.'),
    items: { type: 'array', items: item, description: 'compare: tepat 2 (lama lalu baru). list: 2-3. timeline: tepat 2 (awal lalu tujuan). Tipe lain: kosong.' },
    photo_query: str('Kata kunci foto stok (bahasa Inggris, spesifik, mis. "japan factory worker"). Kosongkan untuk statement/cta.'),
    cues: {
      type: 'array',
      description: 'Kapan elemen muncul: frasa PERSIS (substring) dari vo adegan ini saat elemen target harus tampil.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'phrase'],
        properties: { target: { type: 'string', enum: CUE_TARGETS }, phrase: { type: 'string' } },
      },
    },
  },
};

export const SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'scenes', 'caption', 'pinned_comment', 'facts', 'sources'],
  properties: {
    title: str('Judul internal video.'),
    slug: str('Nama folder: huruf kecil, angka, tanda hubung.'),
    scenes: { type: 'array', items: scene },
    caption: str('Caption TikTok, PENDEK (1-2 kalimat + 4-6 hashtag).'),
    pinned_comment: str('Komentar sematan berupa pertanyaan yang memancing diskusi, tanpa jualan.'),
    facts: {
      type: 'array',
      description: 'Setiap klaim faktual di video, dengan sumbernya.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'source_url', 'confidence'],
        properties: {
          claim: { type: 'string' },
          source_url: { type: 'string' },
          confidence: { type: 'string', enum: ['terkonfirmasi', 'perlu_dicek'] },
        },
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
};
