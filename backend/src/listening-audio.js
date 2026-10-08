// ElevenLabs pcm_24000 is signed 16-bit little-endian mono PCM. Assemble the
// assessment timeline ourselves: model-generated pause tags are not reliable.
export const LISTENING_SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2;
export const MAX_LISTENING_PCM_BYTES = LISTENING_SAMPLE_RATE * BYTES_PER_SAMPLE * 600;

export function listeningTurnGaps(turns, voices) {
  return turns.map((turn, index) => index === turns.length - 1
    || turn.speaker === turns[index + 1].speaker ? 0
    : voices[index].role === 'narrator' ? 1800 : 1200);
}

export function stripListeningMarkup(text) {
  // Old authored SSML is never spoken literally or sent as unsupported v4
  // pause control. V4's square-bracket audio tags remain intact.
  return String(text).replace(/<[^>]*>/g, ' ').trim();
}

export function validateListeningPcm(audio, contentType = '') {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type && !['audio/pcm', 'audio/x-pcm', 'audio/raw', 'audio/l16', 'application/octet-stream'].includes(type)) {
    throw new Error('listening_pcm_content_type');
  }
  if (!Buffer.isBuffer(audio) || !audio.length || audio.length % BYTES_PER_SAMPLE
      || audio.length > MAX_LISTENING_PCM_BYTES) throw new Error('listening_pcm_invalid');
  if ((audio.toString('ascii', 0, 4) === 'RIFF' && audio.toString('ascii', 8, 12) === 'WAVE')
      || audio.toString('ascii', 0, 3) === 'ID3' || audio.toString('ascii', 0, 4) === 'OggS') {
    throw new Error('listening_pcm_encoded_audio');
  }
  return audio;
}

export function assembleListeningWav(clips, gaps) {
  if (!clips.length || clips.length !== gaps.length) throw new Error('listening_timeline_invalid');
  const parts = [];
  clips.forEach((clip, index) => {
    parts.push(validateListeningPcm(clip));
    const gap = gaps[index];
    if (!Number.isInteger(gap) || gap < 0 || gap > 5000 || (index === clips.length - 1 && gap !== 0)) {
      throw new Error('listening_gap_invalid');
    }
    if (gap) parts.push(Buffer.alloc(LISTENING_SAMPLE_RATE * gap / 1000 * BYTES_PER_SAMPLE));
  });
  const byteLength = parts.reduce((total, part) => total + part.length, 0);
  if (byteLength > MAX_LISTENING_PCM_BYTES) throw new Error('listening_audio_too_long');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + byteLength, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(LISTENING_SAMPLE_RATE, 24);
  header.writeUInt32LE(LISTENING_SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
  header.writeUInt16LE(BYTES_PER_SAMPLE, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(byteLength, 40);
  return Buffer.concat([header, ...parts]);
}
