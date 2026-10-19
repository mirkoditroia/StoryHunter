import { DEFAULT_MODEL, providerOf, resolveModel } from "./meta.js";
import { HttpError } from "./errors.js";
import { findBanned, findMeasures } from "./transfiguration.js";
import {
  buildClosingPrompt,
  buildExpansionPrompt,
  buildMeasurePrompt,
  buildRepairPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompts.js";
import { readSettings } from "./store.js";

const ENDINGS = new Set(["AT_HOME_RESTING", "OUTSIDE_CLIFFHANGER", "OUTSIDE_AWAY"]);

export async function llmStatus() {
  const settings = await readSettings();
  const openaiFile = settings.api_key || "";
  const openaiEnv = process.env.OPENAI_API_KEY || "";
  const googleFile = settings.google_api_key || "";
  const googleEnv = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const model = resolveModel(settings.model || process.env.OPENAI_MODEL || DEFAULT_MODEL);
  const provider = providerOf(model);
  const openaiKey = openaiFile || openaiEnv;
  const googleKey = googleFile || googleEnv;
  const activeKey = provider === "google" ? googleKey : openaiKey;
  const activeFile = provider === "google" ? googleFile : openaiFile;
  const activeEnv = provider === "google" ? googleEnv : openaiEnv;
  return {
    provider,
    provider_label: provider === "google" ? "Google" : "OpenAI",
    configured: Boolean(activeKey),
    source: activeFile ? "file" : activeEnv ? "env" : "missing",
    model,
    hint: mask(activeKey),
    openai: keyStatus(openaiKey, openaiFile, openaiEnv),
    google: keyStatus(googleKey, googleFile, googleEnv),
  };
}

export async function writeChapter(payload) {
  const system = buildSystemPrompt(payload);
  const first = await askJson(
    [
      { role: "system", content: system },
      { role: "user", content: buildUserPrompt(payload) },
    ],
    0.85,
    7000
  );

  let draft = normalizeDraft(first, payload);
  const warnings = [];

  if (countWords(draft.chapter_text) < 750) {
    try {
      const expanded = await askJson(
        [
          { role: "system", content: system },
          { role: "user", content: buildExpansionPrompt(payload, draft) },
        ],
        0.7,
        7000
      );
      const next = normalizeDraft(expanded, payload);
      if (countWords(next.chapter_text) > countWords(draft.chapter_text)) draft = next;
    } catch (error) {
      warnings.push(`Espansione non riuscita: ${error.message}`);
    }
  }

  const banned = bannedInDraft(draft);
  if (banned.length) {
    try {
      const repaired = await askJson(
        [
          { role: "system", content: system },
          { role: "user", content: buildRepairPrompt(payload, draft, banned) },
        ],
        0.4,
        7000
      );
      draft = normalizeDraft(repaired, payload);
    } catch (error) {
      warnings.push(`Pulizia del lessico non riuscita: ${error.message}`);
    }
  }

  const stillBanned = bannedInDraft(draft);
  if (stillBanned.length) {
    warnings.push(`Restano parole da non pubblicare: ${stillBanned.join(", ")}.`);
  }

  const measures = measuresInDraft(draft);
  if (measures.length) {
    try {
      const repaired = await askJson(
        [
          { role: "system", content: system },
          { role: "user", content: buildMeasurePrompt(payload, draft, measures) },
        ],
        0.4,
        7000
      );
      draft = normalizeDraft(repaired, payload);
    } catch (error) {
      warnings.push(`Trasfigurazione delle misure non riuscita: ${error.message}`);
    }
  }

  const stillMeasured = measuresInDraft(draft);
  if (stillMeasured.length) {
    warnings.push(`Restano misure da non leggere come bollettino: ${stillMeasured.join(", ")}.`);
  }
  if (countWords(draft.chapter_text) < 800) {
    warnings.push(`Il capitolo è di ${countWords(draft.chapter_text)} parole, sotto le 800 richieste.`);
  }

  const status = await llmStatus();
  return {
    chapter_title: draft.chapter_title,
    chapter_subtitle: draft.chapter_subtitle,
    chapter_text: draft.chapter_text,
    state: forceEnding(draft.updated_story_state, payload),
    words: countWords(draft.chapter_text),
    model: status.model,
    warnings,
    system_prompt: system,
  };
}

export async function composeVolume(book) {
  const prompts = buildClosingPrompt(book);
  const raw = await askJson(
    [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user },
    ],
    0.8,
    2500
  );
  const closing = {
    book_title: clean(raw.book_title, 140) || "Senza titolo",
    subtitle: clean(raw.subtitle, 180),
    epigraph: clean(raw.epigraph, 280),
    back_cover: clean(raw.back_cover, 2500),
  };
  const banned = findBanned(Object.values(closing).join("\n"));
  if (banned.length) {
    throw new HttpError(502, `Il frontespizio contiene parole vietate (${banned.join(", ")}). Riprova.`);
  }
  if (!closing.back_cover) {
    throw new HttpError(502, "Manca la quarta di copertina.");
  }
  return closing;
}

async function askJson(messages, temperature, maxTokens) {
  const client = await clientOrThrow();
  const content = client.provider === "google"
    ? await askGoogle(client, messages, temperature, maxTokens)
    : await askOpenAI(client, messages, temperature, maxTokens);
  return parseModelJson(content, client.provider === "google" ? "Google" : "OpenAI");
}

async function askOpenAI({ apiKey, model }, messages, temperature, maxTokens) {
  const response = await llmFetch("https://api.openai.com/v1/chat/completions", {
    vendor: "OpenAI",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model,
      temperature,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || "Errore OpenAI";
    if (response.status === 401) throw new HttpError(401, "OpenAI ha rifiutato la chiave API.");
    if (response.status === 429) throw new HttpError(429, "OpenAI ha limitato le richieste. Attendi un minuto e riprova.");
    throw new HttpError(response.status === 400 ? 400 : 502, `OpenAI: ${detail}`);
  }
  return data?.choices?.[0]?.message?.content;
}

async function askGoogle({ apiKey, model }, messages, temperature, maxTokens) {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const generationConfig = {
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json",
  };
  if (model.startsWith("gemini-2.")) {
    generationConfig.temperature = temperature;
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else {
    generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
  }

  const response = await llmFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      vendor: "Google",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig,
      },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || "Errore Google";
    if (response.status === 400 && /API key/i.test(detail)) throw new HttpError(401, "Google ha rifiutato la chiave API.");
    if (response.status === 401 || response.status === 403) throw new HttpError(401, "Google ha rifiutato la chiave API.");
    if (response.status === 429) throw new HttpError(429, "Google ha limitato le richieste. Attendi un minuto e riprova.");
    if (response.status === 404 && /no longer available/i.test(detail)) {
      throw new HttpError(400, `Google: il modello ${model} non è più disponibile. Scegline un altro dalle impostazioni.`);
    }
    throw new HttpError(response.status === 400 ? 400 : 502, `Google: ${detail}`);
  }

  const block = data?.promptFeedback?.blockReason;
  if (block) throw new HttpError(502, `Google ha bloccato la richiesta (${block}).`);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part) => part?.text && !part.thought).map((part) => part.text).join("");
}

async function llmFetch(url, { vendor, headers, body }) {
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    throw translateFetchError(error, vendor);
  }
}

function translateFetchError(error, vendor) {
  const cause = error?.cause;
  const code = cause?.code || error?.code || "";
  const timedOut =
    error?.name === "TimeoutError" ||
    cause?.name === "TimeoutError" ||
    error?.name === "AbortError";
  if (timedOut) {
    return new HttpError(504, `${vendor} non ha risposto in tempo. Riprova tra un momento.`);
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return new HttpError(
      503,
      `Impossibile raggiungere ${vendor}: il DNS non risolve il server. Controlla la connessione e riavvia il simulatore da un terminale normale (npm start).`
    );
  }
  if (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new HttpError(503, `Connessione a ${vendor} interrotta. Riprova.`);
  }
  const detail = cause?.message || error?.message || "errore di rete";
  if (detail === "fetch failed") {
    return new HttpError(503, `${vendor} irraggiungibile. Controlla la rete e riprova.`);
  }
  return new HttpError(503, `${vendor} irraggiungibile: ${detail}`);
}

async function clientOrThrow() {
  const settings = await readSettings();
  const model = resolveModel(settings.model || process.env.OPENAI_MODEL || DEFAULT_MODEL);
  const provider = providerOf(model);
  const apiKey = provider === "google"
    ? settings.google_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
    : settings.api_key || process.env.OPENAI_API_KEY || "";
  if (!apiKey && provider === "google") {
    throw new HttpError(
      400,
      "Manca la chiave API Google. Inseriscila dalle impostazioni, oppure in GEMINI_API_KEY nel file .env."
    );
  }
  if (!apiKey) {
    throw new HttpError(
      400,
      "Manca la chiave API OpenAI. Inseriscila dalle impostazioni, oppure in OPENAI_API_KEY nel file .env."
    );
  }
  return { provider, apiKey, model };
}

function keyStatus(key, fileKey, envKey) {
  return {
    configured: Boolean(key),
    source: fileKey ? "file" : envKey ? "env" : "missing",
    hint: mask(key),
  };
}

function parseModelJson(content, vendor = "OpenAI") {
  if (!content || !String(content).trim()) {
    throw new HttpError(502, `${vendor} ha risposto vuoto.`);
  }
  let text = String(content).trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* continua sotto */
      }
    }
    throw new HttpError(502, `${vendor} non ha restituito un JSON valido.`);
  }
}

function normalizeDraft(raw, payload) {
  const source = raw?.chapter_text ? raw : raw?.chapter || raw?.result || raw;
  const text = String(source?.chapter_text || "").trim();
  if (!text) throw new HttpError(502, "Manca il testo del capitolo.");
  const previous = payload.story_state_memory || {};
  return {
    chapter_title: clean(source.chapter_title, 140) || `Capitolo ${payload.book_config.current_day}`,
    chapter_subtitle: clean(source.chapter_subtitle, 180),
    chapter_text: text,
    updated_story_state: sanitizeState(source.updated_story_state, previous),
  };
}

export function sanitizeState(incoming, previous) {
  const source = incoming && typeof incoming === "object" ? incoming : {};
  const established = { ...(previous?.established_locations || {}) };
  const nextLocations =
    source.established_locations && typeof source.established_locations === "object"
      ? source.established_locations
      : {};
  for (const [key, value] of Object.entries(nextLocations)) {
    if (!/^loc_[a-z0-9_]+$/.test(key)) continue;
    const alias = clean(value, 160);
    if (alias) established[key] = alias;
  }

  let ending = source.last_chapter_ending_state;
  if (!ENDINGS.has(ending)) ending = previous?.last_chapter_ending_state || "AT_HOME_RESTING";

  return {
    previous_chapter_summary: clean(source.previous_chapter_summary, 2500) || previous?.previous_chapter_summary || "",
    last_chapter_ending_state: ending,
    established_locations: established,
    recurring_motifs: stringList(source.recurring_motifs),
    unresolved_tensions: stringList(source.unresolved_tensions),
  };
}

function forceEnding(state, payload) {
  const cutoff = payload.today_unified_telemetry?.midnight_cutoff_status;
  if (cutoff === "OUTSIDE_HIGH_ACTIVITY") state.last_chapter_ending_state = "OUTSIDE_CLIFFHANGER";
  else if (cutoff === "OUTSIDE_AWAY") state.last_chapter_ending_state = "OUTSIDE_AWAY";
  else if (cutoff === "AT_HOME_RESTING") state.last_chapter_ending_state = "AT_HOME_RESTING";
  return state;
}

function measuresInDraft(draft) {
  return findMeasures(draftBlob(draft));
}

function bannedInDraft(draft) {
  return findBanned(draftBlob(draft));
}

function draftBlob(draft) {
  const blob = [
    draft.chapter_title,
    draft.chapter_subtitle,
    draft.chapter_text,
    draft.updated_story_state.previous_chapter_summary,
    ...(draft.updated_story_state.recurring_motifs || []),
    ...(draft.updated_story_state.unresolved_tensions || []),
    ...Object.values(draft.updated_story_state.established_locations || {}),
  ].join("\n");
  return blob;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item, 240)).filter(Boolean).slice(0, 12);
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

export function countWords(text) {
  return (String(text || "").trim().match(/\S+/g) || []).length;
}

function mask(key) {
  if (!key) return "";
  if (key.length < 10) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
