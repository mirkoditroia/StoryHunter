import { DEFAULT_MODEL, providerOf, resolveModel } from "./meta.js";
import { HttpError } from "./errors.js";
import {
  clockPhrase,
  countChronicleParagraphs,
  countDeviceMentions,
  countHeartbeats,
  countTimeLedParagraphs,
  findBanned,
  findDataLeaks,
  findDetailHype,
  findEchoes,
  findMeasures,
  findOveruse,
  findProfileLabels,
  findProvisionalLeaks,
  findScaffolding,
  findSentenceEcho,
  findWakeCliches,
  firstSentence,
  fixPrepositions,
  coerceTradeName,
  isProvisionalAlias,
  lastSentence,
  opensWithWakeUp,
  sharedRun,
  titleOverlap,
} from "./transfiguration.js";
import {
  buildClosingLinePrompt,
  buildClosingPrompt,
  buildExpansionPrompt,
  buildMeasurePrompt,
  buildPlanPrompt,
  buildRepairPrompt,
  buildStylePrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompts.js";
import { hasStrongEvent, lastSceneOf, strongEventsOf, threadSeed } from "./dramaturgy.js";
import { readSettings } from "./store.js";

const ENDINGS = new Set(["AT_HOME_RESTING", "OUTSIDE_CLIFFHANGER", "OUTSIDE_AWAY"]);
// Sotto questa soglia tre atti con scene vere non ci stanno: si chiede un'espansione.
const MIN_WORDS = 450;

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
  const warnings = [];
  const context = styleContext(payload);

  // 1. Il Drammaturgo progetta il capitolo. Se fallisce, il Narratore scrive
  //    lo stesso, pianificando da sé (peggio, ma il capitolo arriva).
  // Un secondo tentativo: senza copione il capitolo perde atti e finale.
  let plan = null;
  const planPrompt = buildPlanPrompt(payload);
  let planError = "";
  for (let attempt = 0; attempt < 2 && !plan; attempt += 1) {
    try {
      const rawPlan = await askJson(
        [
          { role: "system", content: planPrompt.system },
          { role: "user", content: planPrompt.user },
        ],
        { temperature: 0.9, maxTokens: 6000, think: true }
      );
      plan = normalizePlan(rawPlan, payload);
      if (!plan) planError = "il copione del drammaturgo era incompleto";
    } catch (error) {
      planError = error.message;
    }
  }
  if (!plan) warnings.push(`Copione non riuscito (${planError}): capitolo scritto senza copione.`);

  // 2. Il Narratore scrive seguendo il copione.
  const system = buildSystemPrompt(payload, plan);
  const ask = (user, temperature) =>
    askJson(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature, maxTokens: 8000 }
    );

  // La prima stesura ragiona un poco (rispetta meglio copione e misura);
  // le riparazioni restano veloci.
  let draft = normalizeDraft(
    await askJson(
      [
        { role: "system", content: system },
        { role: "user", content: buildUserPrompt(payload) },
      ],
      { temperature: 0.85, maxTokens: 9000, think: true }
    ),
    payload
  );

  // 3. Riparazioni mirate, una per famiglia di problemi.
  if (countWords(draft.chapter_text) < MIN_WORDS) {
    try {
      const expanded = await askJson(
        [
          { role: "system", content: system },
          { role: "user", content: buildExpansionPrompt(payload, draft) },
        ],
        { temperature: 0.75, maxTokens: 9000, think: true }
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
      draft = normalizeDraft(await ask(buildRepairPrompt(payload, draft, banned), 0.4), payload);
    } catch (error) {
      warnings.push(`Pulizia del lessico non riuscita: ${error.message}`);
    }
  }
  const stillBanned = bannedInDraft(draft);
  if (stillBanned.length) warnings.push(`Restano parole da non pubblicare: ${stillBanned.join(", ")}.`);

  const measures = measuresInDraft(draft);
  if (measures.length) {
    try {
      draft = normalizeDraft(await ask(buildMeasurePrompt(payload, draft, measures), 0.4), payload);
    } catch (error) {
      warnings.push(`Trasfigurazione delle misure non riuscita: ${error.message}`);
    }
  }
  const stillMeasured = measuresInDraft(draft);
  if (stillMeasured.length) warnings.push(`Restano misure da non leggere come bollettino: ${stillMeasured.join(", ")}.`);

  const styleIssues = styleIssuesInDraft(draft, context);
  if (styleIssues.length) {
    try {
      const repaired = normalizeDraft(await ask(buildStylePrompt(payload, draft, styleIssues), 0.5), payload);
      // Una correzione di stile non deve mutilare il capitolo.
      if (countWords(repaired.chapter_text) >= Math.min(MIN_WORDS, countWords(draft.chapter_text) * 0.85)) draft = repaired;
    } catch (error) {
      warnings.push(`Correzione di stile non riuscita: ${error.message}`);
    }
  }
  // Finale ricalcato sui capitoli precedenti: si riscrive solo l'ultima frase.
  const ignore = [context.protagonist?.name, ...context.places].filter(Boolean);
  if (findSentenceEcho(lastSentence(draft.chapter_text), context.closings, ignore)) {
    try {
      const raw = await askJson(
        [
          { role: "system", content: system },
          { role: "user", content: buildClosingLinePrompt(payload, draft, plan, context.closings) },
        ],
        { temperature: 0.9, maxTokens: 800 }
      );
      const line = clean(fixPrepositions(raw?.ultima_frase), 320);
      if (line && !findSentenceEcho(line, context.closings, ignore)) {
        draft = { ...draft, chapter_text: replaceLastSentence(draft.chapter_text, line) };
      }
    } catch (error) {
      warnings.push(`Riscrittura del finale non riuscita: ${error.message}`);
    }
  }

  const remainingStyle = styleIssuesInDraft(draft, context);
  if (remainingStyle.length) warnings.push(`Restano problemi di stile: ${remainingStyle.join("; ")}.`);
  if (countWords(draft.chapter_text) < MIN_WORDS) {
    warnings.push(`Il capitolo è di ${countWords(draft.chapter_text)} parole, corto per tre atti (minimo ${MIN_WORDS}).`);
  }

  // 4. Memoria del romanzo: ciò che restituisce il modello, più ciò che il codice sa meglio.
  const state = forceEnding(draft.updated_story_state, payload);
  const memory = payload.story_state_memory || {};
  adoptPlannedPlaces(state, plan);
  // Il filo resta provvisorio finché la vita non offre un evento forte
  // (l'incidente scatenante); da lì non si riscrive più.
  // Se il modello si limita a ricopiare il filo provvisorio nel giorno
  // dell'incidente scatenante, vale il seme concreto calcolato dai dati.
  const seed = fixPrepositions(threadSeed(payload));
  const copiedProvisional = !plan?.through_line || plan.through_line === memory.through_line;
  state.through_line = memory.through_line_locked
    ? memory.through_line
    : hasStrongEvent(payload) && seed && copiedProvisional
      ? seed
      : plan?.through_line || memory.through_line || state.through_line || "";
  state.through_line_locked = Boolean(memory.through_line_locked || (state.through_line && hasStrongEvent(payload)));
  state.used_titles = [...(memory.used_titles || []), draft.chapter_title].filter(Boolean).slice(-12);
  state.openings = [...(memory.openings || []), firstSentence(draft.chapter_text)].filter(Boolean).slice(-4);
  state.closings = [...(memory.closings || []), lastSentence(draft.chapter_text)].filter(Boolean).slice(-4);
  state.event_log = [...(memory.event_log || []), ...strongEventsOf(payload)].slice(-30);
  state.prodigies = [...(memory.prodigies || []), plan?.prodigio].filter(Boolean).slice(-6);
  state.seen_locations = [
    ...new Set([
      ...(memory.seen_locations || []),
      ...(payload.today_unified_telemetry?.unified_scenes || []).map((scene) => scene.location_id).filter(Boolean),
    ]),
  ];
  state.last_scene = lastSceneOf(payload, state.established_locations);

  const status = await llmStatus();
  return {
    chapter_title: draft.chapter_title,
    chapter_subtitle: draft.chapter_subtitle,
    chapter_text: draft.chapter_text,
    dramaturgy: plan,
    state,
    words: countWords(draft.chapter_text),
    model: status.model,
    warnings,
    system_prompt: system,
  };
}

function styleContext(payload) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  const memory = payload.story_state_memory || {};
  return {
    currentDay: Number(payload.book_config?.current_day) || 1,
    protagonist: payload.book_config?.protagonist || null,
    usedTitles: memory.used_titles || [],
    openings: memory.openings || [],
    closings: memory.closings || [],
    // L'ora di un appunto si può dire al minuto: è l'unico orario esatto ammesso.
    noteClocks: scenes.flatMap((scene) => (scene.user_notes || []).map((note) => clockPhrase(note.time))),
    places: [
      ...Object.values(payload.story_state_memory?.established_locations || {}),
      ...scenes.map((scene) => scene.location_alias),
    ],
    peakAtRest: scenes.some((scene) => /tachicardia da fermo/i.test(scene.biometric_vibe || "")),
  };
}

// Il copione serve solo se ha le parti che reggono il dramma.
export function normalizePlan(raw, payload) {
  if (!raw || typeof raw !== "object") return null;
  const text = (value, max = 400) => clean(fixPrepositions(value), max);
  const scenes = Array.isArray(raw.atto_2?.scene) ? raw.atto_2.scene : [];
  const plan = {
    through_line: text(raw.through_line),
    desiderio: text(raw.desiderio),
    paura: text(raw.paura),
    nuovi_luoghi: {},
    atto_1: pick(raw.atto_1, ["apertura", "luogo", "momento", "ritratto", "innesco"], text),
    atto_2: {
      scene: scenes
        .slice(0, 3)
        .map((scene) => pick(scene, ["luogo", "momento", "obiettivo", "ostacolo", "gesto", "pensiero", "presenza", "esito"], text)),
      svolta: text(raw.atto_2?.svolta),
    },
    atto_3: pick(raw.atto_3, ["luogo", "momento", "culmine", "domanda_finale"], text),
    prodigio: text(raw.prodigio),
    immagini: stringList(raw.immagini).slice(0, 2),
    titolo: text(raw.titolo, 140),
    sottotitolo: text(raw.sottotitolo, 180),
  };
  const ids = new Set((payload.today_unified_telemetry?.unified_scenes || []).map((scene) => scene.location_id));
  if (raw.nuovi_luoghi && typeof raw.nuovi_luoghi === "object") {
    for (const [id, value] of Object.entries(raw.nuovi_luoghi)) {
      // Mestieri non documentati («Officina», «Ufficio») non diventano nomi di
      // luogo: si sostituiscono col sostantivo di funzione, tenendo l'epiteto.
      const name = coerceTradeName(clean(fixPrepositions(value), 120), id);
      if (ids.has(id) && name && !isProvisionalAlias(name)) plan.nuovi_luoghi[id] = name;
    }
  }
  if (!plan.prodigio) delete plan.prodigio;
  const usable = plan.desiderio && plan.atto_2.scene.length >= 1 && plan.atto_3.domanda_finale;
  return usable ? plan : null;
}

function pick(source, keys, transform) {
  const out = {};
  for (const key of keys) {
    const value = transform(source?.[key]);
    if (value) out[key] = value;
  }
  return out;
}

// Se il Narratore dimentica di registrare un nome scelto dal copione, lo si registra qui.
function adoptPlannedPlaces(state, plan) {
  if (!plan?.nuovi_luoghi) return;
  const known = state.established_locations || {};
  for (const [id, name] of Object.entries(plan.nuovi_luoghi)) {
    if (!known[id] || isProvisionalAlias(known[id])) known[id] = name;
  }
  state.established_locations = known;
}

export async function composeVolume(book) {
  const prompts = buildClosingPrompt(book);
  const messages = [
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ];
  let closing = closingFrom(await askJson(messages, { temperature: 0.8, maxTokens: 4000 }));
  // Il titolo del libro non può essere il titolo di un capitolo.
  const chapterTitles = book.days.map((day) => String(day.chapter?.chapter_title || "").trim().toLowerCase());
  if (chapterTitles.includes(closing.book_title.trim().toLowerCase())) {
    const retry = closingFrom(
      await askJson(
        [
          ...messages,
          {
            role: "user",
            content: `«${closing.book_title}» è già il titolo di un capitolo. Rifai il JSON con un book_title nuovo, nato dal filo conduttore, senza parole piene dei titoli dei capitoli.`,
          },
        ],
        { temperature: 0.9, maxTokens: 4000 }
      )
    );
    if (!chapterTitles.includes(retry.book_title.trim().toLowerCase())) closing = retry;
  }
  // La quarta non ricopia i capitoli e non parla il gergo del copione.
  const chapterTexts = book.days.map((day) => day.chapter?.chapter_text || "");
  const copied = sharedRun(closing.back_cover, chapterTexts);
  const jargon = closing.back_cover.match(/\b(?:tensione|picco|climax|svolta|salita|posta|prodigio|sobbalzo da fermo|corpo fermo)\b/gi) || [];
  if (copied || jargon.length) {
    const problems = [
      copied ? `ricopia una frase dei capitoli («${copied}…»)` : "",
      jargon.length ? `usa parole da copione (${[...new Set(jargon.map((w) => w.toLowerCase()))].join(", ")})` : "",
    ].filter(Boolean).join(" e ");
    try {
      const retry = closingFrom(
        await askJson(
          [
            ...messages,
            {
              role: "user",
              content: `La back_cover ${problems}. Rifai l'intero JSON: la quarta apre su una scena del libro scritta di nuovo, con parole tue, e fa sentire che la posta sale attraverso un fatto, mai nominando tensione, picco, salita, svolta o posta.`,
            },
          ],
          { temperature: 0.85, maxTokens: 4000 }
        )
      );
      if (retry.back_cover && !sharedRun(retry.back_cover, chapterTexts)) closing = { ...retry, book_title: closing.book_title };
    } catch {
      /* resta la prima versione */
    }
  }
  const banned = findBanned(Object.values(closing).join("\n"));
  if (banned.length) {
    throw new HttpError(502, `Il frontespizio contiene parole vietate (${banned.join(", ")}). Riprova.`);
  }
  if (!closing.back_cover) {
    throw new HttpError(502, "Manca la quarta di copertina.");
  }
  return closing;
}

function closingFrom(raw) {
  return {
    book_title: clean(fixPrepositions(raw?.book_title), 140) || "Senza titolo",
    subtitle: clean(fixPrepositions(raw?.subtitle), 180),
    epigraph: clean(fixPrepositions(raw?.epigraph), 280),
    back_cover: clean(fixPrepositions(raw?.back_cover), 2500),
  };
}

// think: un po' di ragionamento in più, per il Drammaturgo; la prosa resta veloce.
async function askJson(messages, { temperature = 0.8, maxTokens = 7000, think = false } = {}) {
  const client = await clientOrThrow();
  const content = client.provider === "google"
    ? await askGoogle(client, messages, temperature, maxTokens, think)
    : await askOpenAI(client, messages, temperature, maxTokens, think);
  return parseModelJson(content, client.provider === "google" ? "Google" : "OpenAI");
}

async function askOpenAI({ apiKey, model }, messages, temperature, maxTokens, think) {
  // I modelli GPT-5 ragionano e accettano solo la temperatura predefinita.
  const tuning = model.startsWith("gpt-5")
    ? { reasoning_effort: think ? "low" : "minimal" }
    : { temperature };
  const response = await llmFetch("https://api.openai.com/v1/chat/completions", {
    vendor: "OpenAI",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model,
      ...tuning,
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

async function askGoogle({ apiKey, model }, messages, temperature, maxTokens, think) {
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
    generationConfig.thinkingConfig = { thinkingBudget: think ? 2048 : 0 };
  } else {
    generationConfig.thinkingConfig = { thinkingLevel: think ? "low" : "minimal" };
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
  // Le preposizioni davanti ai nomi propri («de La Casa», «a Il Tavolo») si
  // correggono qui: è un errore ricorrente e non vale una chiamata in più.
  const state = sanitizeState(source.updated_story_state, previous);
  state.previous_chapter_summary = fixPrepositions(state.previous_chapter_summary);
  state.character_portrait = fixPrepositions(state.character_portrait);
  return {
    chapter_title: clean(fixPrepositions(source.chapter_title), 140) || `Capitolo ${payload.book_config.current_day}`,
    chapter_subtitle: clean(fixPrepositions(source.chapter_subtitle), 180),
    chapter_text: fixPrepositions(text),
    updated_story_state: state,
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
    // Un mestiere inventato si riporta al sostantivo di funzione; se non si può,
    // il luogo resta da battezzare domani.
    const alias = coerceTradeName(clean(value, 160), key);
    if (!alias) continue;
    // Un alias provvisorio non è un nome: non si archivia mai come battesimo.
    if (isProvisionalAlias(alias)) continue;
    // Un nome già battezzato è immutabile: si può solo battezzare un luogo
    // nuovo o sostituire un alias ancora provvisorio («Luogo sconosciuto»).
    if (established[key] && !isProvisionalAlias(established[key])) continue;
    established[key] = alias;
  }

  let ending = source.last_chapter_ending_state;
  if (!ENDINGS.has(ending)) ending = previous?.last_chapter_ending_state || "AT_HOME_RESTING";

  const locationNames = new Set(Object.values(established).map((name) => name.toLowerCase()));
  return {
    // Filo e ritratto attraversano il romanzo: se il modello li omette, restano quelli di ieri.
    through_line: clean(source.through_line, 400) || previous?.through_line || "",
    character_portrait: clean(source.character_portrait, 800) || previous?.character_portrait || "",
    // Memoria tenuta dal codice (titoli, aperture, ultima scena), mai dal modello.
    used_titles: stringList(previous?.used_titles),
    openings: stringList(previous?.openings),
    closings: stringList(previous?.closings),
    prodigies: stringList(previous?.prodigies),
    seen_locations: Array.isArray(previous?.seen_locations) ? previous.seen_locations.filter((id) => typeof id === "string") : [],
    event_log: Array.isArray(previous?.event_log) ? previous.event_log.filter((event) => event && event.kind) : [],
    last_scene: previous?.last_scene || null,
    through_line_locked: Boolean(previous?.through_line_locked),
    previous_chapter_summary: clean(source.previous_chapter_summary, 2500) || previous?.previous_chapter_summary || "",
    last_chapter_ending_state: ending,
    established_locations: established,
    // I nomi dei luoghi non sono motivi: stanno già nella mappa.
    recurring_motifs: stringList(source.recurring_motifs).filter(
      (motif) => !locationNames.has(motif.toLowerCase())
    ),
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

// context: { currentDay, protagonist, usedTitles } — un numero vale come currentDay.
export function styleIssuesInDraft(draft, context = {}) {
  const {
    currentDay = 1,
    protagonist = null,
    usedTitles = [],
    places = [],
    peakAtRest = true,
    openings = [],
    closings = [],
    noteClocks = [],
  } = context && typeof context === "object" ? context : { currentDay: context };
  const issues = [];
  const words = countWords(draft.chapter_text);
  if (words > 880) {
    issues.push(`capitolo di ${words} parole oltre il tetto di 800: comprimi routine, meteo e descrizioni, non le scene dell'Atto II`);
  }
  const heartbeats = countHeartbeats([draft.chapter_subtitle, draft.chapter_text].join("\n"));
  if (heartbeats > 0 && !peakAtRest) {
    issues.push("il battito compare ma oggi non c'è nessun picco a corpo fermo: toglilo");
  } else if (heartbeats > 1) {
    issues.push(`il battito è citato ${heartbeats} volte nel capitolo (cuore, battito, polso, pulsazioni): massimo una, solo se decisiva`);
  }
  const echoes = findEchoes(draft.chapter_text);
  if (echoes.length) {
    issues.push(`parole ripetute nella stessa frase: ${echoes.join(", ")}`);
  }
  const hype = findDetailHype([draft.chapter_title, draft.chapter_subtitle, draft.chapter_text].join("\n"));
  if (hype.length) {
    issues.push(`dettaglio di un appunto celebrato o ripetuto come tormentone: ${hype.join(", ")}`);
  }
  const leaks = findProvisionalLeaks(draft.chapter_text);
  if (leaks.length) {
    issues.push(`luoghi non battezzati: la prosa usa descrizioni provvisorie (${leaks.join(", ")}) invece di nomi propri`);
  }
  const timeLed = countTimeLedParagraphs(draft.chapter_text);
  if (timeLed > 2) {
    issues.push(`${timeLed} paragrafi cominciano con un'ora: massimo 2, gli orari vanno dentro le frasi`);
  }
  if (Number(currentDay) > 1) {
    const cliches = findWakeCliches(draft.chapter_text);
    if (cliches.length) {
      issues.push(`apertura ricopiata dai capitoli precedenti: ${cliches.join(", ")}`);
    }
  }
  if (opensWithWakeUp(draft.chapter_text)) {
    issues.push("il capitolo si apre con il risveglio: comincia invece dall'immagine d'apertura del copione");
  }
  const scaffolding = findScaffolding([draft.chapter_title, draft.chapter_subtitle, draft.chapter_text].join("\n"));
  if (scaffolding.length) {
    issues.push(`parole del mestiere nella prosa (${scaffolding.join(", ")}): fai sentire la cosa con un gesto o un pensiero`);
  }
  if (protagonist) {
    const labels = findProfileLabels([draft.chapter_title, draft.chapter_text].join("\n"), protagonist);
    if (labels.length) issues.push(`etichette del profilo nella prosa (${labels.join(", ")}): mostrale in azioni`);
  }
  const devices = countDeviceMentions(draft.chapter_text);
  if (devices > 0) {
    issues.push(`lo schermo compare come oggetto in scena (${devices} volte): conta solo ciò che rivela, senza nominarlo`);
  }
  const overused = findOveruse(draft.chapter_text, [protagonist?.name, ...places].filter(Boolean));
  if (overused.length) {
    issues.push(`parole ripetute come un tic nel capitolo (${overused.join(", ")}): varia o togli`);
  }
  const chronicle = countChronicleParagraphs(draft.chapter_text);
  if (chronicle > 2) {
    issues.push(`${chronicle} paragrafi si aprono con luogo e ora come un diario: entra nelle scene da un'azione o un pensiero`);
  }
  const incipit = String(draft.chapter_text || "").split(/\n\s*\n/).slice(0, 2).join(" ");
  if (Number(currentDay) <= 1 && protagonist?.age && !/\banni\b/i.test(incipit)) {
    issues.push(`primo capitolo senza l'età del protagonista nell'incipit: ${protagonist.age} anni, dentro un gesto`);
  }
  const dataLeaks = findDataLeaks([draft.chapter_subtitle, draft.chapter_text].join("\n"), noteClocks);
  if (dataLeaks.length) {
    issues.push(`lessico da registro dei dati nella prosa (${dataLeaks.join(", ")}): gli orari si dicono a grandi linee, ciò che manca si tace o si pensa, mai «non documentato» o «senza traccia»`);
  }
  const ignore = [protagonist?.name, ...places].filter(Boolean);
  const closing = lastSentence(draft.chapter_text);
  const closingEcho = findSentenceEcho(closing, closings, ignore);
  if (closingEcho) {
    issues.push(`l'ultima frase («${closing}») ricalca il finale di un capitolo precedente («${closingEcho}»): chiudi su altro — un gesto sospeso, una scelta a metà, un'immagine aperta`);
  }
  if (Number(currentDay) > 1) {
    const opening = firstSentence(draft.chapter_text);
    const openingEcho = findSentenceEcho(opening, openings, ignore);
    if (openingEcho) {
      issues.push(`la prima frase riprende immagini di un'apertura precedente («${openingEcho}»): apri su un'immagine nuova`);
    }
  }
  if (/\b(?:cronaca|diario|resoconto|bollettino)\b/i.test([draft.chapter_title, draft.chapter_subtitle].join(" "))) {
    issues.push("titolo o sottotitolo dichiarano una cronaca o un diario: devono promettere una storia");
  }
  const recycled = titleOverlap(draft.chapter_title, usedTitles);
  if (recycled.length) {
    issues.push(`il titolo ricicla parole di titoli precedenti (${recycled.join(", ")}): trovane uno nuovo, dalla svolta di oggi`);
  }
  return issues;
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
    draft.updated_story_state.through_line,
    draft.updated_story_state.character_portrait,
    ...(draft.updated_story_state.recurring_motifs || []),
    ...(draft.updated_story_state.unresolved_tensions || []),
    ...Object.values(draft.updated_story_state.established_locations || {}),
  ].join("\n");
  return blob;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  // Il modello a volte restituisce oggetti ({tensione, luogo, momento}) invece
  // di frasi: si tengono i valori, mai «[object Object]».
  const flat = (item) =>
    item && typeof item === "object"
      ? Object.values(item).filter((part) => typeof part === "string" && part.trim()).join(" — ")
      : item;
  return value.map((item) => clean(flat(item), 240)).filter(Boolean).slice(0, 12);
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

export function replaceLastSentence(text, line) {
  const source = String(text || "").trimEnd();
  const last = lastSentence(source);
  const at = last ? source.lastIndexOf(last) : -1;
  const sentence = line.charAt(0).toUpperCase() + line.slice(1);
  return at >= 0 ? `${source.slice(0, at)}${sentence}` : `${source}\n\n${sentence}`;
}

export function countWords(text) {
  return (String(text || "").trim().match(/\S+/g) || []).length;
}

function mask(key) {
  if (!key) return "";
  if (key.length < 10) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
