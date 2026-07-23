import { logError } from './logger.js';
import * as db from './db.js';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || '';
}

export async function askAI(prompt: string, system?: string, opts?: OpenRouterOptions): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('OPENROUTER_API_KEY غير مضبوط في البيئة');

  const res = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer': process.env.SITE_URL || 'https://aman-eg.com',
      'X-Title': 'Aman Platform'
    },
    body: JSON.stringify({
      model: opts?.model || 'openai/gpt-4o-mini',
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.maxTokens || 500
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('OpenRouter API error: ' + res.status + ' ' + errText);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function describeImage(imageUrl: string): Promise<string> {
  const system = 'أنت مساعد متخصص في تحليل صور المفقودين. قدم وصفاً دقيقاً للصورة يشمل: الوجه، الشعر، الملابس، الألوان، الإكسسوارات، وأي ملامح مميزة. كن موضوعياً ودقيقاً.';
  return await askAI('قم بوصف هذه الصورة بالتفصيل: ' + imageUrl, system);
}

export async function compareImages(imageUrl1: string, imageUrl2: string): Promise<{ match: boolean; confidence: number; reason: string }> {
  const system = 'أنت خبير في التعرف على الوجوه ومقارنة الصور. قارن بين الصورتين وحدد إذا كانا لنفس الشخص مع نسبة الثقة. أجب بـ JSON فقط: {"match": true/false, "confidence": 0-100, "reason": "السبب بالعربية"}';
  const result = await askAI('قارن بين هاتين الصورتين:\nالصورة 1: ' + imageUrl1 + '\nالصورة 2: ' + imageUrl2, system, { temperature: 0.1 });
  try { return JSON.parse(result); } catch { return { match: false, confidence: 0, reason: 'فشل تحليل المقارنة' }; }
}

export async function searchByImageWithAI(imageUrl: string): Promise<any[]> {
  try {
    const description = await describeImage(imageUrl);
    const allMissing = db.getMissingReports();
    const results: any[] = [];

    for (const person of allMissing.slice(0, 30)) {
      const personDescription = `${person.name}: ${person.description} ${person.features} ${person.health}`;
      const system = 'أنت خبير في مقارنة بيانات المفقودين. أجب بـ JSON فقط: {"score": 0-100, "reason": "السبب"}';
      const answer = await askAI(
        `بيانات المفقود: ${personDescription}\nوصف الصورة المرفوعة: ${description}\nهل هذا هو نفس الشخص؟`,
        system, { temperature: 0.1, model: 'openai/gpt-4o-mini' }
      );
      try {
        const parsed = JSON.parse(answer);
        results.push({ ...person, aiScore: parsed.score, aiReason: parsed.reason, matchImage: person.image });
      } catch {}
    }

    return results.filter(r => r.aiScore > 60).sort((a, b) => b.aiScore - a.aiScore).slice(0, 10);
  } catch (err: any) {
    logError('AI-SEARCH', err);
    return [];
  }
}