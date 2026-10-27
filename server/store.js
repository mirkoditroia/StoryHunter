import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GENRE, profileFromAnswers } from "./meta.js";
import { HttpError } from "./errors.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const booksDir = path.join(dataDir, "books");
const profilesDir = path.join(dataDir, "profiles");
const settingsFile = path.join(dataDir, "settings.json");
const profileFile = path.join(dataDir, "profile.json");

export async function ensureData() {
  await fs.mkdir(booksDir, { recursive: true });
}

export async function readSettings() {
  try {
    const raw = await fs.readFile(settingsFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      api_key: typeof parsed.api_key === "string" ? parsed.api_key.trim() : "",
      google_api_key: typeof parsed.google_api_key === "string" ? parsed.google_api_key.trim() : "",
      model: typeof parsed.model === "string" ? parsed.model.trim() : "",
    };
  } catch {
    return { api_key: "", google_api_key: "", model: "" };
  }
}

export async function writeSettings(partial) {
  const current = await readSettings();
  const next = { ...current };
  if (partial.clear_key) next.api_key = "";
  if (partial.clear_google_key) next.google_api_key = "";
  if (typeof partial.api_key === "string" && partial.api_key.trim()) next.api_key = partial.api_key.trim();
  if (typeof partial.google_api_key === "string" && partial.google_api_key.trim()) {
    next.google_api_key = partial.google_api_key.trim();
  }
  if (typeof partial.model === "string") next.model = partial.model.trim();
  await fs.writeFile(settingsFile, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function listBooks() {
  await ensureData();
  const files = await fs.readdir(booksDir);
  const books = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const book = JSON.parse(await fs.readFile(path.join(booksDir, file), "utf8"));
      books.push(summarize(book));
    } catch {
      /* un file illeggibile non blocca la libreria */
    }
  }
  books.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return books;
}

export async function loadBook(id) {
  assertId(id);
  try {
    return JSON.parse(await fs.readFile(bookPath(id), "utf8"));
  } catch {
    return null;
  }
}

export async function saveBook(book, options = {}) {
  assertId(book.id);
  book.updated_at = options.keepUpdatedAt || new Date().toISOString();
  await fs.writeFile(bookPath(book.id), JSON.stringify(book, null, 2), "utf8");
  return book;
}

export async function deleteBook(id) {
  assertId(id);
  await fs.rm(bookPath(id), { force: true });
}

export function createBook(input) {
  const name = clean(input.name, 40);
  if (!name) throw new HttpError(400, "Manca il nome del protagonista.");
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 16 || age > 99) {
    throw new HttpError(400, "L'età deve essere un numero fra 16 e 99.");
  }
  const gender = ["F", "M", "X"].includes(input.gender) ? input.gender : null;
  if (!gender) throw new HttpError(400, "Scegli un genere anagrafico.");
  const total = Number(input.total_days);
  if (!Number.isInteger(total) || total < 3 || total > 7) {
    throw new HttpError(400, "Il ciclo del prototipo dura da 3 a 7 giorni.");
  }

  let traits;
  try {
    traits = profileFromAnswers(input.answers);
  } catch (error) {
    throw new HttpError(400, error.message);
  }

  const protagonist = { name, age, gender, ...traits };
  const id = `bk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  return {
    id,
    created_at: now,
    updated_at: now,
    started_on: localISODate(),
    book_config: {
      total_days: total,
      current_day: 1,
      genre: GENRE.id,
      protagonist,
    },
    story_state: {
      through_line: "",
      character_portrait: "",
      previous_chapter_summary: "Nessun capitolo precedente. La storia inizia oggi.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: {
        loc_home: "casa",
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    days: [],
    draft: null,
    closing: null,
  };
}

export function summarize(book) {
  const protagonist = book.book_config.protagonist;
  const written = book.days?.length || 0;
  return {
    id: book.id,
    name: protagonist.name,
    genre: book.book_config.genre,
    total_days: book.book_config.total_days,
    current_day: book.book_config.current_day,
    chapters: written,
    complete: written >= book.book_config.total_days,
    archived: Boolean(book.archived),
    title: String(book.closing?.book_title || "").trim(),
    profile_id: book.profile_id || "",
    updated_at: book.updated_at,
  };
}

export function visibleBooks(books, profileId) {
  if (!profileId) return [];
  return books.filter((book) => book.profile_id === profileId);
}

export function publicProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    answers: { ...profile.answers },
  };
}

export function protagonistFromProfile(profile) {
  return {
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    ...profileFromAnswers(profile.answers),
  };
}

let profilePending = null;

export function ensureProfile() {
  if (!profilePending) {
    profilePending = migrateProfile().finally(() => {
      profilePending = null;
    });
  }
  return profilePending;
}

export async function createProfile(input) {
  const person = assertPerson(input);
  const now = new Date().toISOString();
  const profile = {
    id: `pf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...person,
    created_at: now,
    updated_at: now,
  };
  await writeProfile(profile);
  return profile;
}

export async function updateProfile(profile, input) {
  const person = assertPerson(input);
  const next = {
    ...profile,
    ...person,
    updated_at: new Date().toISOString(),
  };
  await writeProfile(next);
  await applyProfileToOpenBooks(next);
  return next;
}

export async function logoutProfile() {
  const profile = await readProfile();
  if (!profile) return;
  await fs.mkdir(profilesDir, { recursive: true });
  await fs.writeFile(path.join(profilesDir, `${profile.id}.json`), JSON.stringify(profile, null, 2), "utf8");
  await fs.rm(profileFile, { force: true });
}

export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateForDay(startedOn, day) {
  const date = new Date(`${startedOn}T12:00:00`);
  date.setDate(date.getDate() + (day - 1));
  return localISODate(date);
}

function bookPath(id) {
  return path.join(booksDir, `${id}.json`);
}

function assertId(id) {
  if (!/^bk_[a-z0-9]+$/.test(id)) throw new HttpError(400, "Identificativo del libro non valido.");
}

function clean(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function assertPerson(input) {
  const name = clean(input?.name, 40);
  if (!name) throw new HttpError(400, "Manca il nome del protagonista.");
  const age = Number(input?.age);
  if (!Number.isInteger(age) || age < 16 || age > 99) {
    throw new HttpError(400, "L'età deve essere un numero fra 16 e 99.");
  }
  const gender = ["F", "M", "X"].includes(input?.gender) ? input.gender : null;
  if (!gender) throw new HttpError(400, "Scegli un genere anagrafico.");
  let traits;
  try {
    traits = profileFromAnswers(input?.answers);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  return { name, age, gender, answers: { ...input.answers }, traits };
}

async function readProfile() {
  try {
    const parsed = JSON.parse(await fs.readFile(profileFile, "utf8"));
    if (!parsed?.id || !parsed?.name || !parsed?.answers) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeProfile(profile) {
  await ensureData();
  await fs.writeFile(profileFile, JSON.stringify(profile, null, 2), "utf8");
  return profile;
}

async function loadAllBooks() {
  await ensureData();
  const files = await fs.readdir(booksDir);
  const books = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      books.push(JSON.parse(await fs.readFile(path.join(booksDir, file), "utf8")));
    } catch {
      /* un file illeggibile non entra nel profilo */
    }
  }
  return books;
}

async function migrateProfile() {
  // Dopo il logout profile.json non c'è. I libri restano sul disco, ma non
  // riaprono il profilo: altrimenti un refresh rientra nel primo utente.
  const profile = await readProfile();
  if (!profile) return null;
  const books = await loadAllBooks();
  const name = profile.name.toLocaleLowerCase("it");
  for (const book of books) {
    const bookName = String(book.book_config?.protagonist?.name || "").toLocaleLowerCase("it");
    if (book.profile_id || bookName !== name) continue;
    book.profile_id = profile.id;
    await saveBook(book, { keepUpdatedAt: book.updated_at });
  }
  return profile;
}

export async function archiveOpenBooks(profileId) {
  for (const book of await loadAllBooks()) {
    if (book.profile_id !== profileId || book.archived) continue;
    book.archived = true;
    await saveBook(book, { keepUpdatedAt: book.updated_at });
  }
}

async function applyProfileToOpenBooks(profile) {
  const protagonist = protagonistFromProfile(profile);
  for (const book of await loadAllBooks()) {
    if (book.profile_id !== profile.id || book.archived) continue;
    const written = book.days?.length || 0;
    if (written >= book.book_config.total_days) continue;
    book.book_config.protagonist = { ...protagonist };
    await saveBook(book, { keepUpdatedAt: book.updated_at });
  }
}
