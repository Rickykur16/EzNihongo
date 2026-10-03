// "Slot" foto yang dibutuhkan sebuah naskah: "3" = foto adegan 3, "6-2" = thumbnail
// item ke-2 adegan 6. Nama slot = nama file di photos/ yang dibaca build.mjs.
import { existsSync } from 'node:fs';
import path from 'node:path';

const EXT = ['jpg', 'jpeg', 'png', 'webp'];

export function photoSlots(script) {
  const slots = [];
  script.scenes.forEach((sc, i) => {
    if (sc.photo_query) slots.push({ slot: String(i + 1), query: sc.photo_query, vo: sc.vo });
    if (sc.type === 'list') {
      sc.items.forEach((it, j) => {
        if (it.photo_query) slots.push({ slot: `${i + 1}-${j + 1}`, query: it.photo_query, vo: it.label });
      });
    }
  });
  return slots;
}

export const hasOwnPhoto = (dir, slot) => EXT.some((e) => existsSync(path.join(dir, 'photos', `${slot}.${e}`)));

// Caption "1" / "6-2" (boleh "adegan 1", "#1") → slot itu. Tanpa caption → slot kosong pertama.
export function pickSlot(caption, slots, dir) {
  const m = /(\d+(?:-\d+)?)/.exec(caption || '');
  if (m) {
    const s = slots.find((x) => x.slot === m[1]);
    if (!s) throw new Error(`Slot "${m[1]}" tidak ada. Slot yang tersedia: ${slots.map((x) => x.slot).join(', ')}`);
    return s;
  }
  const empty = slots.find((x) => !hasOwnPhoto(dir, x.slot));
  if (!empty) throw new Error('Semua slot sudah ada fotonya. Kirim dengan caption nomor slot untuk mengganti.');
  return empty;
}

export function photoStatus(slots, dir) {
  const L = ['📷 Foto yang dibutuhkan (kirim foto ke sini, caption = nomor slot):', ''];
  for (const s of slots) L.push(`${hasOwnPhoto(dir, s.slot) ? '✅' : '⬜'} ${s.slot} — ${s.query}`);
  if (!slots.length) L.push('(naskah ini tidak butuh foto)');
  L.push('', 'Slot ⬜ yang belum diisi akan diambil dari foto stok saat /render (kalau key-nya ada).');
  return L.join('\n');
}
