import fs from 'node:fs';

export const dialogueCatalog = JSON.parse(fs.readFileSync(new URL('./dialogue-catalog.json', import.meta.url), 'utf8'));
const characters = new Set(dialogueCatalog.characters.map(c => c.key));
const backgrounds = new Set(dialogueCatalog.backgrounds.map(b => b.key));
const speakerPattern = /^(?:[A-Za-z0-9]{1,12}|[一-龥ぁ-んァ-ヶー]{1,12})$/;
const narratorPattern = /^(n|narrator|nasi|ナレーター|nrs)$/i;

export function normalizeDialogScene(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 ||
      typeof value.enabled !== 'boolean' || !backgrounds.has(value.backgroundKey) ||
      !Array.isArray(value.participants) || value.participants.length !== 2) {
    throw new Error('Pengaturan panggung dialog tidak valid.');
  }
  const positions = new Set(), keys = new Set(), speakers = new Set();
  const participants = value.participants.map(p => {
    if (!p || !characters.has(p.characterKey) || !['left', 'right'].includes(p.position) ||
        positions.has(p.position) || keys.has(p.characterKey) || speakers.has(p.speaker) ||
        typeof p.speaker !== 'string' || !speakerPattern.test(p.speaker) || narratorPattern.test(p.speaker) ||
        typeof p.displayName !== 'string' || !p.displayName.trim() || p.displayName.length > 40 ||
        (p.voiceId != null && (typeof p.voiceId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(p.voiceId))) ||
        (p.voiceName != null && (typeof p.voiceName !== 'string' || p.voiceName.length > 100)) ||
        !Number.isInteger(p.profileVersion) || p.profileVersion < 1) {
      throw new Error('Pemeran, nama tampilan, atau suara dialog tidak valid.');
    }
    positions.add(p.position); keys.add(p.characterKey); speakers.add(p.speaker);
    return { characterKey: p.characterKey, position: p.position, speaker: p.speaker,
      displayName: p.displayName.trim(), voiceId: p.voiceId || null, voiceName: p.voiceName || '',
      profileVersion: p.profileVersion, custom: p.custom === true };
  });
  return {schemaVersion: 1, enabled: value.enabled, backgroundKey: value.backgroundKey, participants};
}

// Voice references stay server-side; the student only needs the visual snapshot.
export function publicDialogScene(value) {
  try {
    const scene = normalizeDialogScene(value);
    return scene && {...scene, audioReady:scene.participants.every(p=>!!p.voiceId),
      participants: scene.participants.map(({voiceId, voiceName, ...p}) => p)};
  } catch { return null; }
}

export function sceneTurnVoices(turns, scene, fallback) {
  if (!scene) return turns.map(fallback);
  const normalized = normalizeDialogScene(scene);
  return turns.map((turn, i) => {
    if (narratorPattern.test(turn.speaker)) return fallback(turn, i);
    const participant = normalized.participants.find(p => p.speaker === turn.speaker);
    if (!participant?.voiceId) throw new Error('Suara pemeran belum diatur.');
    return {voiceId: participant.voiceId, role: 'dialogue'};
  });
}

export async function validateSceneVoices(scene, fetchVoices) {
  const ids = [...new Set((scene?.participants || []).map(p => p.voiceId).filter(Boolean))];
  if (!ids.length) return;
  const allowed = new Set((await fetchVoices()).map(v => v.voiceId));
  if (ids.some(id => !allowed.has(id))) throw new Error('Suara tidak tersedia di akun ElevenLabs. Pilih suara lain.');
}
