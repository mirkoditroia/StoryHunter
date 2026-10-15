import { DEFAULT_MODEL, resolveModel } from "./meta.js";
import { HttpError } from "./errors.js";
import { findBanned } from "./transfiguration.js";
import {
  buildClosingPrompt,
  buildExpansionPrompt,
  buildRepairPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompts.js";
import { readSettings } from "./store.js";

const ENDINGS = new Set(["AT_HOME_RESTING", "OUTSIDE_CLIFFHANGER", "OUTSIDE_AWAY"]);

export async function llmStatus() {
  const settings = await readSettings();
  const envKey = process.env.OPENAI_API_KEY || "";
  const fileKey = settings.api_key || "";
  const apiKey = fileKey || envKey;
  const model = resolveModel(settings.model || process.env.OPENAI_MODEL || DEFAULT_MODEL);
  return {
    configured: Boolean(apiKey),
    source: fileKey ? "file" : envKey ? "env" : "missing",
    model,
    hint: mask(apiKey),
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
  if (countWords(draft.chapter_text) < 800) {
    warnings.push(`Il capitolo è di ${countWords(draft.chapter_text)} parole, sotto le 800 richieste.`);
  }

  const status = await llmStatus();
  return {
    chapter_title: draft.chapter_title,
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
  const { apiKey, model } = await clientOrThrow();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }),
    signal: AbortSignal.timeout(120000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || "Errore OpenAI";
    if (response.status === 401) throw new HttpError(401, "OpenAI ha rifiutato la chiave API.");
    if (response.status === 429) throw new HttpError(429, "OpenAI ha limitato le richieste. Attendi un minuto e riprova.");
    throw new HttpError(response.status === 400 ? 400 : 502, `OpenAI: ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  return parseModelJson(content);
}

async function clientOrThrow() {
  const settings = await readSettings();
  const apiKey = settings.api_key || process.env.OPENAI_API_KEY || "";
  const model = resolveModel(settings.model || process.env.OPENAI_MODEL || DEFAULT_MODEL);
  if (!apiKey) {
    throw new HttpError(
      400,
      "Manca la chiave API OpenAI. Inseriscila dalle impostazioni, oppure in OPENAI_API_KEY nel file .env."
    );
  }
  return { apiKey, model };
}

function parseModelJson(content) {
  if (!content || !String(content).trim()) {
    throw new HttpError(502, "OpenAI ha risposto vuoto.");
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
    throw new HttpError(502, "OpenAI non ha restituito un JSON valido.");
  }
}

function normalizeDraft(raw, payload) {
  const source = raw?.chapter_text ? raw : raw?.chapter || raw?.result || raw;
  const text = String(source?.chapter_text || "").trim();
  if (!text) throw new HttpError(502, "Manca il testo del capitolo.");
  const previous = payload.story_state_memory || {};
  return {
    chapter_title: clean(source.chapter_title, 140) || `Capitolo ${payload.book_config.current_day}`,
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

function bannedInDraft(draft) {
  const blob = [
    draft.chapter_title,
    draft.chapter_text,
    draft.updated_story_state.previous_chapter_summary,
    ...(draft.updated_story_state.recurring_motifs || []),
    ...(draft.updated_story_state.unresolved_tensions || []),
    ...Object.values(draft.updated_story_state.established_locations || {}),
  ].join("\n");
  return findBanned(blob);
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
