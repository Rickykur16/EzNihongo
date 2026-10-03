// Sumber foto stok. Pixabay dipakai bila PIXABAY_API_KEY terisi, lalu Pexels
// (pendaftaran key baru Pexels sempat ditutup). Keduanya gratis untuk komersial.
import { findPhoto as findPexels } from './pexels.mjs';

export function photoProvider() {
  if (process.env.PIXABAY_API_KEY) return 'pixabay';
  if (process.env.PEXELS_API_KEY) return 'pexels';
  return null;
}

async function findPixabay(query, { orientation = 'vertical' } = {}) {
  const key = process.env.PIXABAY_API_KEY;
  const q = encodeURIComponent(String(query).slice(0, 100));
  const url = `https://pixabay.com/api/?key=${key}&q=${q}&image_type=photo&orientation=${orientation}&safesearch=true&per_page=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay ${res.status} untuk "${query}"`);
  const { hits } = await res.json();
  if (!hits?.length) {
    if (orientation !== 'all') return findPixabay(query, { orientation: 'all' });
    throw new Error(`Tidak ada foto Pixabay untuk "${query}". Ganti photo_query di script.json atau taruh foto sendiri.`);
  }
  const h = hits[0];
  // Pixabay melarang hotlink permanen: unduh ke server, jangan tautkan URL-nya.
  const img = await fetch(h.largeImageURL);
  if (!img.ok) throw new Error(`Gagal mengunduh foto Pixabay ${h.id}`);
  return { data: Buffer.from(await img.arrayBuffer()), credit: `${h.user} — ${h.pageURL}` };
}

export async function findPhoto(query) {
  const p = photoProvider();
  if (p === 'pixabay') return { ...(await findPixabay(query)), provider: 'pixabay' };
  if (p === 'pexels') return { ...(await findPexels(query)), provider: 'pexels' };
  throw new Error('Isi PIXABAY_API_KEY (atau PEXELS_API_KEY) di .env, atau taruh foto sendiri di folder photos/.');
}
