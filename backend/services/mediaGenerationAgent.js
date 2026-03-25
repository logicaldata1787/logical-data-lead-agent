'use strict';

const HUGGING_FACE_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-dev';
const HUGGING_FACE_VIDEO_MODEL = process.env.HF_VIDEO_MODEL || 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers';

function sanitizePrompt(prompt) {
  return String(prompt || '').trim().replace(/\s+/g, ' ');
}

function normalizeLanguage(language) {
  const value = String(language || 'english').trim().toLowerCase();
  if (['hindi', 'hi'].includes(value)) return 'hindi';
  if (['english', 'en'].includes(value)) return 'english';
  if (['both', 'hi-en', 'hindi-english', 'bilingual'].includes(value)) return 'both';
  return 'english';
}

function buildLocalizedPrompt(prompt, language) {
  const normalized = normalizeLanguage(language);
  if (normalized === 'hindi') return `Hindi output only: ${prompt}`;
  if (normalized === 'both') return `Bilingual Hindi and English output: ${prompt}`;
  return `English output only: ${prompt}`;
}

function buildImageUrl(localizedPrompt, seed) {
  const encodedPrompt = encodeURIComponent(localizedPrompt);
  const normalizedSeed = Number.isFinite(Number(seed)) ? Number(seed) : Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${normalizedSeed}`;
}

async function generateWithHuggingFace(prompt, mediaType) {
  const token = process.env.HUGGING_FACE_TOKEN;
  if (!token) {
    return {
      ok: false,
      reason: 'missing_hf_token',
      message: 'Set HUGGING_FACE_TOKEN to enable hosted video generation.',
    };
  }

  const model = mediaType === 'video' ? HUGGING_FACE_VIDEO_MODEL : HUGGING_FACE_IMAGE_MODEL;
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: 'provider_error',
      message: `Hugging Face request failed with ${response.status}`,
      details: errorText.slice(0, 200),
    };
  }

  const contentType = response.headers.get('content-type') || '';
  const extension = contentType.includes('video') ? 'mp4' : contentType.includes('image') ? 'png' : 'bin';
  const binary = await response.arrayBuffer();
  const base64 = Buffer.from(binary).toString('base64');

  return {
    ok: true,
    provider: 'huggingface',
    model,
    contentType,
    base64,
    extension,
  };
}

function buildDownloadName(mediaType, language) {
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const lang = normalizeLanguage(language);
  return `${mediaType}-${lang}-${suffix}`;
}

module.exports = {
  sanitizePrompt,
  normalizeLanguage,
  buildLocalizedPrompt,
  buildImageUrl,
  generateWithHuggingFace,
  buildDownloadName,
};
