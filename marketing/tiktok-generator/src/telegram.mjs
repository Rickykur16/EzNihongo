// Pengiriman ke Telegram (bot yang sama dengan notifikasi admin EzNihongo boleh dipakai).
import fs from 'node:fs/promises';
import path from 'node:path';

const token = () => process.env.TELEGRAM_BOT_TOKEN;
export const adminChat = () => String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');
export const telegramEnabled = () => Boolean(token() && adminChat());

async function api(method, body, isForm = false) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    ...(isForm ? { body } : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description || res.status}`);
  return json.result;
}

export const sendText = (text, chatId = adminChat()) => api('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000) });

export async function sendFile(file, { chatId = adminChat(), kind = 'document', caption = '' } = {}) {
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption.slice(0, 1000));
  form.append(kind, new Blob([await fs.readFile(file)]), path.basename(file));
  return api(kind === 'video' ? 'sendVideo' : kind === 'photo' ? 'sendPhoto' : 'sendDocument', form, true);
}

export const getUpdates = (offset) => api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });

// Unduh file yang dikirim ke bot (foto/dokumen). Batas Bot API: 20 MB.
export async function downloadFile(fileId) {
  const { file_path } = await api('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${file_path}`);
  if (!res.ok) throw new Error(`Gagal mengunduh file Telegram (${res.status})`);
  return { data: Buffer.from(await res.arrayBuffer()), ext: path.extname(file_path).slice(1).toLowerCase() || 'jpg' };
}
