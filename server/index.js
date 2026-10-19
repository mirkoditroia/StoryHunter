import dns from "node:dns";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first");
import {
  DEFAULT_MODEL,
  GENDERS,
  GENRES,
  MODELS,
  PLACE_KINDS,
  PROFILES,
  QUESTIONS,
  SLOT_DEFS,
  WEATHERS,
  ZONES,
} from "./meta.js";
import { PRESET_LIST, buildPreset } from "./presets.js";
import { applySimulatedTelemetry, listScenarios } from "./scenarios.js";
import { mergeDay } from "./merger.js";
import { composeVolume, llmStatus, writeChapter } from "./narrator.js";
import { samplePayload } from "./sample.js";
import {
  createBook,
  dateForDay,
  deleteBook,
  ensureData,
  listBooks,
  loadBook,
  localISODate,
  saveBook,
  writeSettings,
} from "./store.js";
import { HttpError } from "./errors.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
dotenv.config({ path: path.join(root, ".env") });
const port = Number(process.env.PORT) || 3000;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (/\.(html|js|css)$/.test(req.path)) res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "storyhunter-simulator" });
});

app.get("/api/meta", async (_req, res, next) => {
  try {
    const llm = await llmStatus();
    res.json({
      genres: GENRES,
      genders: GENDERS,
      questions: QUESTIONS,
      profiles: PROFILES,
      presets: PRESET_LIST,
      scenarios: listScenarios(),
      slots: SLOT_DEFS,
      place_kinds: PLACE_KINDS,
      zones: ZONES,
      weathers: WEATHERS,
      models: MODELS,
      default_model: DEFAULT_MODEL,
      llm,
      today: localISODate(),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", async (req, res, next) => {
  try {
    await writeSettings({
      api_key: req.body?.api_key,
      google_api_key: req.body?.google_api_key,
      model: req.body?.model,
      clear_key: Boolean(req.body?.clear_key),
      clear_google_key: Boolean(req.body?.clear_google_key),
    });
    res.json({ llm: await llmStatus() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books", async (_req, res, next) => {
  try {
    res.json({ books: await listBooks() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books", async (req, res, next) => {
  try {
    const book = createBook(req.body || {});
    await saveBook(book);
    res.status(201).json({ book });
  } catch (error) {
    next(error);
  }
});

app.get("/api/books/:id", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/books/:id", async (req, res, next) => {
  try {
    await requireBook(req.params.id);
    await deleteBook(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/merge", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    const day = assertOpenDay(book);
    const date = validDate(req.body?.date) || dateForDay(book.started_on, day);
    const slots = applySimulatedTelemetry(req.body?.slots, { bookId: book.id, day });
    const payload = mergeDay({ book, day, date, slots });
    book.draft = { day, date, slots };
    await saveBook(book);
    res.json({ payload, draft_saved: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/generate", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    if (req.body?.regenerate) {
      const response = await regenerateLast(book);
      res.json(response);
      return;
    }

    const day = assertOpenDay(book);
    const date = validDate(req.body?.date) || dateForDay(book.started_on, day);
    const source = req.body?.source || "slots";
    let payload;
    let slots = null;

    if (source === "raw" || source === "editor") {
      payload = req.body?.payload;
      if (!payload?.today_unified_telemetry || !payload?.book_config) {
        throw new HttpError(400, "Il JSON deve contenere book_config e today_unified_telemetry.");
      }
      if (source === "editor") {
        payload = {
          ...payload,
          book_config: {
            ...book.book_config,
            current_day: day,
          },
          story_state_memory: book.story_state,
        };
        payload.today_unified_telemetry = {
          ...payload.today_unified_telemetry,
          date: payload.today_unified_telemetry.date || date,
        };
      }
    } else {
      slots = applySimulatedTelemetry(req.body?.slots, { bookId: book.id, day });
      payload = mergeDay({ book, day, date, slots });
    }

    const written = await writeChapter(payload);
    const before = structuredClone(book.story_state);
    book.story_state = written.state;
    book.days.push({
      day,
      date: payload.today_unified_telemetry.date || date,
      slots,
      payload,
      source,
      system_prompt: written.system_prompt,
      chapter: {
        chapter_number: day,
        chapter_title: written.chapter_title,
        chapter_subtitle: written.chapter_subtitle,
        chapter_text: written.chapter_text,
        sealed: true,
        opened_at: null,
        words: written.words,
        model: written.model,
        warnings: written.warnings,
      },
      story_state_before: before,
      story_state_after: written.state,
    });
    book.book_config.current_day = day + 1;
    book.draft = null;
    await saveBook(book);
    res.json({
      book,
      payload,
      warnings: written.warnings,
      system_prompt: written.system_prompt,
      words: written.words,
      model: written.model,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/chapters/:day/open", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    const entry = findDay(book, Number(req.params.day));
    if (!entry.chapter.sealed) {
      res.json({ book });
      return;
    }
    entry.chapter.sealed = false;
    entry.chapter.opened_at = new Date().toISOString();
    await saveBook(book);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/open-all", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    const now = new Date().toISOString();
    for (const entry of book.days) {
      if (entry.chapter?.sealed) {
        entry.chapter.sealed = false;
        entry.chapter.opened_at = now;
      }
    }
    await saveBook(book);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

app.post("/api/books/:id/close", async (req, res, next) => {
  try {
    const book = await requireBook(req.params.id);
    if (book.days.length < book.book_config.total_days) {
      throw new HttpError(400, "Il volume si compone quando tutti i giorni hanno un capitolo.");
    }
    if (book.closing && !req.body?.force) {
      res.json({ book });
      return;
    }
    const closing = await composeVolume(book);
    book.closing = { ...closing, generated_at: new Date().toISOString() };
    await saveBook(book);
    res.json({ book });
  } catch (error) {
    next(error);
  }
});

app.get("/api/presets/:id", (req, res, next) => {
  try {
    res.json({ slots: buildPreset(req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sample-payload", (_req, res) => {
  res.json({ payload: samplePayload });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint non trovato." });
});

app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: error.message || "Errore interno del simulatore." });
});

async function requireBook(id) {
  const book = await loadBook(id);
  if (!book) throw new HttpError(404, "Libro non trovato.");
  return book;
}

function assertOpenDay(book) {
  if (book.book_config.current_day > book.book_config.total_days) {
    throw new HttpError(400, "Il ciclo è completo. I giorni nuovi si aprono solo in un altro libro.");
  }
  return book.book_config.current_day;
}

function findDay(book, day) {
  const entry = book.days.find((item) => item.day === day);
  if (!entry) throw new HttpError(404, "Capitolo non trovato.");
  return entry;
}

async function regenerateLast(book) {
  const last = book.days.at(-1);
  if (!last) throw new HttpError(400, "Non c'è ancora un capitolo da riscrivere.");
  book.story_state = structuredClone(last.story_state_before);
  book.book_config.current_day = last.day;
  const payload = {
    ...last.payload,
    book_config: { ...book.book_config, current_day: last.day },
    story_state_memory: book.story_state,
  };
  const written = await writeChapter(payload);
  book.days.pop();
  book.story_state = written.state;
  book.days.push({
    ...last,
    payload,
    system_prompt: written.system_prompt,
    chapter: {
      chapter_number: last.day,
      chapter_title: written.chapter_title,
      chapter_subtitle: written.chapter_subtitle,
      chapter_text: written.chapter_text,
      sealed: true,
      opened_at: null,
      words: written.words,
      model: written.model,
      warnings: written.warnings,
    },
    story_state_after: written.state,
  });
  book.book_config.current_day = last.day + 1;
  book.closing = null;
  await saveBook(book);
  return {
    book,
    payload,
    warnings: written.warnings,
    system_prompt: written.system_prompt,
    words: written.words,
    model: written.model,
  };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}

await ensureData();
app.listen(port, "127.0.0.1", () => {
  console.log(`Storyhunter in ascolto su http://127.0.0.1:${port}`);
});
