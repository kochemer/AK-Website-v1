/**
 * ElevenLabs text-to-speech for video voiceover.
 * Requires ELEVENLABS_API_KEY and optional ELEVENLABS_VOICE_ID.
 */

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/** Default voice (Rachel) if ELEVENLABS_VOICE_ID not set. */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export interface ElevenLabsOptions {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_44100';
}

/**
 * Generate speech from text via ElevenLabs API.
 * Returns audio as a Buffer (mp3 or pcm depending on outputFormat).
 */
export async function textToSpeech(
  text: string,
  options: ElevenLabsOptions = {}
): Promise<Buffer> {
  const apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set. Get an API key from https://elevenlabs.io (Profile → API key).'
    );
  }

  const voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? 'eleven_multilingual_v2';
  const outputFormat = options.outputFormat ?? 'mp3_44100_128';

  const url = `${ELEVENLABS_TTS_URL}/${voiceId}?output_format=${outputFormat}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
