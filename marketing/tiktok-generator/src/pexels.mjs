// Foto dari Pexels (gratis untuk pemakaian komersial, tanpa atribusi wajib —
// tetap kita catat fotografernya di credits.md sebagai sopan santun).
export async function findPhoto(query, { orientation = 'portrait' } = {}) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY belum diisi di .env (atau taruh foto sendiri di folder photos/).');
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status} untuk "${query}"`);
  const { photos } = await res.json();
  if (!photos?.length) {
    if (orientation !== 'landscape') return findPhoto(query, { orientation: 'landscape' });
    throw new Error(`Tidak ada foto Pexels untuk "${query}". Ganti photo_query di script.json atau taruh foto sendiri.`);
  }
  const p = photos[0];
  const img = await fetch(p.src.large2x || p.src.large);
  if (!img.ok) throw new Error(`Gagal mengunduh foto Pexels ${p.id}`);
  return { data: Buffer.from(await img.arrayBuffer()), credit: `${p.photographer} — ${p.url}` };
}
