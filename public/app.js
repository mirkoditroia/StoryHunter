import { simulatedDay } from "/engine/scenarios.js";

const state = {
  meta: null,
  books: [],
  book: null,
  view: "cover",
  form: blankForm(),
  slots: [],
  activeSlot: 0,
  date: "",
  payload: null,
  payloadText: "",
  notesText: "",
  scenarioId: "",
  scenarioShift: 0,
  raw: false,
  mountedKey: "",
  busy: false,
  motion: "enter-cover",
  premiere: false,
  pactArrive: false,
  coverInking: false,
};

const BARE_VIEWS = new Set(["cover", "soglia", "conferma"]);

const CUTOFF = {
  AT_HOME_RESTING: "Chiude in casa",
  OUTSIDE_AWAY: "Chiude fuori, in sospeso",
  OUTSIDE_HIGH_ACTIVITY: "Cliffhanger alle 23:59",
  OUTSIDE_CLIFFHANGER: "Interrotto in piena scena",
};

function blankForm() {
  return {
    name: "",
    age: 30,
    gender: "",
    total_days: 5,
    answers: { q1: "", q2: "", q3: "", q4: "", q5: "" },
  };
}

function $(selector) {
  return document.querySelector(selector);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roman(number) {
  const map = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = number;
  let out = "";
  for (const [value, glyph] of map) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out || String(number);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prose(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function subtitleLine(subtitle) {
  const text = String(subtitle || "").trim();
  return text ? `<p class="chapter-subtitle">${esc(text)}</p>` : "";
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("La scrittura sta impiegando troppo. Riprova tra un attimo.");
    }
    throw new Error("Il server locale non risponde. Ricarica la pagina, oppure riavvia Storyhunter.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Richiesta non riuscita.");
  return data;
}

function setBanner(kind, text) {
  const banner = $("#banner");
  banner.className = `banner ${kind || ""}`.trim();
  banner.textContent = text || "";
  banner.hidden = !text;
  if (text) banner.scrollIntoView({ block: "nearest" });
}

function setBusy(text) {
  state.busy = Boolean(text);
  $("#busy").hidden = !text;
  $("#busy-text").textContent = text || "";
}

function fillModelSelect() {
  const select = $("#model-select");
  const current = state.meta?.llm?.model || state.meta?.default_model;
  const options = [...(state.meta?.models || [])];
  if (current && !options.some((model) => model.id === current)) {
    options.unshift({ id: current, label: current, provider: "openai" });
  }
  const groups = [
    ["openai", "OpenAI"],
    ["google", "Google"],
  ];
  select.innerHTML = groups
    .map(([id, label]) => {
      const items = options.filter((model) => (model.provider || "openai") === id);
      if (!items.length) return "";
      const html = items.map((model) => `<option value="${esc(model.id)}">${esc(model.label)}</option>`).join("");
      return `<optgroup label="${esc(label)}">${html}</optgroup>`;
    })
    .join("");
  select.value = current || "";
}

function engineName() {
  return state.meta?.llm?.provider_label || "OpenAI";
}

function paintKeyHint(selector, info, label) {
  const node = $(selector);
  if (!node) return;
  if (!info?.configured) {
    node.textContent = `Nessuna chiave ${label} salvata.`;
    return;
  }
  const where = info.source === "env" ? "dal file .env" : "su questo computer";
  node.textContent = `Chiave ${label} ${where}: ${info.hint}`;
}

function voiceReady() {
  return state.meta.questions.every((question) => state.form.answers[question.id]);
}

function anagraficaProblems() {
  if (!state.form.name.trim()) return "Manca il nome.";
  if (!state.form.gender) return "Scegli il genere anagrafico.";
  const age = Number(state.form.age);
  if (!Number.isInteger(age) || age < 16 || age > 99) return "L'età deve essere un numero fra 16 e 99.";
  return "";
}

function formProblems() {
  const first = anagraficaProblems();
  if (first) return first;
  const missing = state.meta.questions.find((question) => !state.form.answers[question.id]);
  if (missing) return `Manca una risposta: ${missing.title}.`;
  return "";
}

const STUDIO_KEY = "storyhunter-osservatorio";

function isStudioWindow() {
  const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
  return path === "/studio" || new URLSearchParams(location.search).has("studio");
}

if (isStudioWindow()) document.documentElement.classList.add("is-studio");
else document.documentElement.classList.remove("is-studio");

const SOUND_KEY = "storyhunter-suono";
const SOUND_TRACKS = {
  rain: "/audio/rain.mp3",
};

let soundUnlocked = false;
let soundCurrent = "";
let soundLead = null;
let soundTail = null;
let soundFadeTimer = 0;
let markLead = null;
let markTail = null;
let pageLead = null;
let pageTail = null;
let typeNodes = [];
let typeIndex = 0;

function soundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function persistSound(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota */
  }
}

function soundTrackKey() {
  return "rain";
}

function soundVolume() {
  if (state.view === "notebook" || state.view === "volume" || state.view === "memory") return 0.035;
  return 0.05;
}

function makeAmbienceNode() {
  const node = new Audio();
  node.loop = true;
  node.preload = "auto";
  node.playsInline = true;
  return node;
}

function ambienceHost() {
  let host = $("#ambience-nodes");
  if (!host) {
    host = document.createElement("div");
    host.id = "ambience-nodes";
    host.hidden = true;
    document.body.append(host);
  }
  return host;
}

function ensureAmbience() {
  if (soundLead && soundTail) return;
  soundLead = makeAmbienceNode();
  soundTail = makeAmbienceNode();
  ambienceHost().append(soundLead, soundTail);
}

function makeMarkNode() {
  const node = new Audio("/audio/mark.mp3");
  node.preload = "auto";
  node.playsInline = true;
  return node;
}

function ensureMark() {
  if (markLead && markTail) return;
  markLead = makeMarkNode();
  markTail = makeMarkNode();
  ambienceHost().append(markLead, markTail);
}

function cutMark(node) {
  if (!node) return;
  window.clearTimeout(node._cut);
  node.pause();
  try {
    node.currentTime = 0;
  } catch {
    /* some browsers throw until metadata is ready */
  }
}

function playMark() {
  if (isStudioWindow() || !soundEnabled()) return;
  ensureMark();
  const node = !markLead.paused && markTail.paused ? markTail : markLead;
  cutMark(node);
  node.volume = 0.16;
  const start = node.play();
  if (start?.catch) start.catch(() => {});
  node._cut = window.setTimeout(() => cutMark(node), 220);
}

function makePageNode() {
  const node = new Audio("/audio/page.mp3");
  node.preload = "auto";
  node.playsInline = true;
  return node;
}

function ensurePage() {
  if (pageLead && pageTail) return;
  pageLead = makePageNode();
  pageTail = makePageNode();
  ambienceHost().append(pageLead, pageTail);
}

function playPageTurn() {
  if (isStudioWindow() || !soundEnabled()) return;
  ensurePage();
  const node = !pageLead.paused && pageTail.paused ? pageTail : pageLead;
  cutMark(node);
  node.volume = 0.03;
  const start = node.play();
  if (start?.catch) start.catch(() => {});
}

function makeTypeNode() {
  const node = new Audio("/audio/type.mp3");
  node.preload = "auto";
  node.playsInline = true;
  return node;
}

function ensureType() {
  if (typeNodes.length) return;
  typeNodes = [makeTypeNode(), makeTypeNode(), makeTypeNode()];
  ambienceHost().append(...typeNodes);
}

function playType() {
  if (isStudioWindow() || !soundEnabled()) return;
  ensureType();
  const node = typeNodes[typeIndex % typeNodes.length];
  typeIndex += 1;
  cutMark(node);
  node.volume = 0.01;
  try {
    node.currentTime = 0.03;
  } catch {
    /* ignore */
  }
  const start = node.play();
  if (start?.catch) start.catch(() => {});
  node._cut = window.setTimeout(() => cutMark(node), 150);
}

function shouldTypeSound(event) {
  const el = event.target;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement) {
    const kind = (el.type || "text").toLowerCase();
    if (["password", "range", "checkbox", "radio", "date", "time", "hidden", "file", "color"].includes(kind)) {
      return false;
    }
  }
  const inputType = event.inputType || "insertText";
  return /^(insertText|insertCompositionText|insertLineBreak|deleteContentBackward|deleteContentForward)$/.test(inputType);
}

function markFromClick(event) {
  if (event.target.closest("#toggle-sound")) return;
  if (state.view === "cover") {
    if (event.target.closest("#cover-start")) playMark();
    return;
  }
  const target = event.target.closest("button, a, [data-age-step], summary, .overture");
  if (!target || target.disabled) return;
  playMark();
}

function paintSoundToggle() {
  const button = $("#toggle-sound");
  if (!button) return;
  const on = soundEnabled();
  button.hidden = isStudioWindow();
  button.setAttribute("aria-pressed", on ? "true" : "false");
  button.dataset.track = on && soundUnlocked ? soundCurrent : "";
  button.textContent = on ? "Suono" : "Silenzio";
}

function stopAmbience() {
  window.clearTimeout(soundFadeTimer);
  for (const node of [soundLead, soundTail]) {
    if (!node) continue;
    node.pause();
    node.volume = 0;
  }
  soundCurrent = "";
  cutMark(markLead);
  cutMark(markTail);
  cutMark(pageLead);
  cutMark(pageTail);
  typeNodes.forEach(cutMark);
}

function unlockAmbience() {
  if (isStudioWindow()) return;
  soundUnlocked = true;
  syncAmbience();
}

function toggleAmbience() {
  const on = !soundEnabled();
  persistSound(on);
  if (on) unlockAmbience();
  else {
    stopAmbience();
    paintSoundToggle();
  }
}

function syncAmbience() {
  paintSoundToggle();
  if (isStudioWindow() || !soundEnabled()) {
    stopAmbience();
    return;
  }
  if (!soundUnlocked) return;
  ensureAmbience();
  const key = soundTrackKey();
  const vol = soundVolume();
  if (soundCurrent === key && soundLead && !soundLead.paused) {
    soundLead.volume = vol;
    return;
  }
  crossfadeAmbience(key, vol);
}

function crossfadeAmbience(key, vol) {
  ensureAmbience();
  window.clearTimeout(soundFadeTimer);
  const next = soundTail;
  const prev = soundLead;
  next.src = SOUND_TRACKS[key];
  next.volume = 0;
  const start = next.play();
  if (start?.catch) start.catch(() => {});
  let step = 0;
  const from = prev && !prev.paused ? prev.volume : 0;
  const tick = () => {
    step += 1;
    const t = Math.min(1, step / 14);
    next.volume = vol * t;
    if (prev && prev !== next && !prev.paused) prev.volume = from * (1 - t);
    if (t >= 1) {
      if (prev && prev !== next) {
        prev.pause();
        prev.removeAttribute("src");
        prev.load();
      }
      next.volume = vol;
      soundLead = next;
      soundTail = prev || makeAmbienceNode();
      soundCurrent = key;
      paintSoundToggle();
      return;
    }
    soundFadeTimer = window.setTimeout(tick, 80);
  };
  tick();
}

function go(view, motion = "enter-forward") {
  if (isStudioWindow()) view = "studio";
  else if (view === "slot" || view === "merge") view = "today";
  const shouldTurn = !isStudioWindow() && motion !== "enter-cover" && motion !== "none";
  if (view !== "volume") state.premiere = false;
  state.pactArrive = state.view === "cover" && view === "soglia";
  state.view = view;
  state.motion = motion;
  if (view === "today" || (view === "studio" && state.book)) syncStudio();
  if (view === "volume" && state.book?.closing && state.book.days.some((entry) => entry.chapter?.sealed)) {
    openBoundBook()
      .then(() => {
        if (state.view === "volume") {
          if (shouldTurn) playPageTurn();
          render();
        }
      })
      .catch((error) => setBanner("error", error.message));
    return;
  }
  render();
  if (shouldTurn) playPageTurn();
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

let coverInkGen = 0;

function clearCoverInk() {
  coverInkGen += 1;
  state.coverInking = false;
  document.querySelectorAll(".ink-blot").forEach((node) => node.remove());
}

function armInkTrail() {
  if (isStudioWindow() || prefersReducedMotion()) return;
  let lastX = null;
  let lastY = null;
  const stains = [];
  const radius = () => {
    const n = () => (18 + Math.random() * 64).toFixed(0);
    return `${n()}% ${n()}% ${n()}% ${n()}% / ${n()}% ${n()}% ${n()}% ${n()}%`;
  };
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const x = event.clientX;
    const y = event.clientY;
    if (lastX != null && (x - lastX) ** 2 + (y - lastY) ** 2 < 18 * 18) return;
    const turn = lastX == null ? Math.random() * 40 - 20 : Math.atan2(y - lastY, x - lastX) * 180 / Math.PI;
    lastX = x;
    lastY = y;
    const stain = document.createElement("span");
    stain.className = "ink-stain";
    stain.setAttribute("aria-hidden", "true");
    const width = 2.1 + Math.random() * 1.5;
    stain.style.left = `${x}px`;
    stain.style.top = `${y}px`;
    stain.style.width = `${width.toFixed(2)}rem`;
    stain.style.height = `${(width * (0.55 + Math.random() * 0.7)).toFixed(2)}rem`;
    stain.style.borderRadius = radius();
    stain.style.setProperty("--ink-turn", `${(turn + Math.random() * 18 - 9).toFixed(1)}deg`);
    for (let lobe = 0; lobe < 2; lobe += 1) {
      const splash = document.createElement("i");
      splash.style.width = `${(28 + Math.random() * 58).toFixed(0)}%`;
      splash.style.height = `${(24 + Math.random() * 52).toFixed(0)}%`;
      splash.style.left = `${(Math.random() * 72).toFixed(0)}%`;
      splash.style.top = `${(Math.random() * 68).toFixed(0)}%`;
      splash.style.borderRadius = radius();
      stain.append(splash);
    }
    stain.addEventListener("animationend", () => {
      stain.remove();
      const index = stains.indexOf(stain);
      if (index >= 0) stains.splice(index, 1);
    }, { once: true });
    document.body.append(stain);
    stains.push(stain);
    while (stains.length > 80) stains.shift()?.remove();
  });
}

function spillCoverInk(event) {
  if (state.coverInking) return;
  unlockAmbience();
  if (prefersReducedMotion()) {
    go("soglia", "enter-forward");
    return;
  }
  state.coverInking = true;
  const gen = ++coverInkGen;
  const title = document.querySelector(".cover h1");
  const box = title?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : event.clientX;
  const y = box ? box.top + box.height / 2 : event.clientY;
  const blot = document.createElement("span");
  blot.className = "ink-blot";
  blot.setAttribute("aria-hidden", "true");
  blot.style.left = `${x}px`;
  blot.style.top = `${y}px`;
  blot.style.setProperty("--ink-turn", `${(Math.random() * 16 - 8).toFixed(1)}deg`);
  blot.innerHTML = `<i></i><i></i>`;
  document.body.append(blot);
  window.setTimeout(() => {
    if (gen !== coverInkGen) return;
    blot.classList.add("is-leaving");
    go("soglia", "enter-forward");
    window.setTimeout(() => {
      if (gen !== coverInkGen) return;
      blot.remove();
      state.coverInking = false;
    }, 900);
  }, 920);
}

function render() {
  const stage = $("#stage");
  if (state.view !== "cover" && !state.pactArrive) clearCoverInk();
  document.querySelectorAll(".page-ghost-host").forEach((node) => node.remove());
  stage.classList.remove("enter-forward", "enter-back", "enter-cover", "enter-soglia", "slot-next", "slot-prev", "is-turning", "is-turning-back");
  const previous = stage.querySelector(":scope > .page");
  const backward = state.motion === "enter-back" || state.motion === "slot-prev";
  const dissolving = Boolean(previous) && state.pactArrive && !prefersReducedMotion();
  const turning =
    Boolean(previous) &&
    !dissolving &&
    state.motion !== "enter-cover" &&
    state.motion !== "replace" &&
    !prefersReducedMotion();
  const ghosting = turning || dissolving;
  const outgoing = ghosting ? previous.getBoundingClientRect() : null;
  const ghost = ghosting ? document.createElement("div") : null;
  const host = ghosting ? document.createElement("div") : null;
  if (ghost && host && outgoing) {
    host.className = "page-ghost-host";
    ghost.className = `page-ghost${backward ? " is-back" : ""}${dissolving ? " is-dissolve" : ""}`;
    ghost.style.top = `${outgoing.top}px`;
    ghost.style.left = `${outgoing.left}px`;
    ghost.style.width = `${outgoing.width}px`;
    ghost.style.height = `${outgoing.height}px`;
    const clone = previous.cloneNode(true);
    clone.scrollTop = previous.scrollTop;
    ghost.append(clone);
    host.append(ghost);
    document.body.append(host);
  }

  document.body.dataset.lens = "realismo";
  document.body.classList.toggle("is-premiere", Boolean(state.premiere) && state.view === "volume");
  $("#chrome").hidden = BARE_VIEWS.has(state.view);
  renderChrome();
  const html = {
    cover: renderCover,
    soglia: renderSoglia,
    anagrafica: renderAnagrafica,
    voce: renderVoce,
    conferma: renderConferma,
    today: renderToday,
    studio: renderStudio,
    slot: renderSlotPage,
    merge: renderMergePage,
    notebook: renderNotebook,
    memory: renderMemory,
    volume: renderVolume,
  }[state.view];
  const turnClass = backward ? "is-turning-back" : "is-turning";
  if (state.motion !== "replace") {
    if (state.pactArrive) stage.classList.add("enter-soglia");
    else stage.classList.add(ghost ? turnClass : state.motion);
  }
  stage.innerHTML = html ? html() : "";
  if (state.view === "slot") renderPlaces();
  if (state.view === "anagrafica") requestAnimationFrame(() => bindDaysSlider());
  if (state.view === "merge") {
    const area = $("#payload-json");
    if (area) area.value = state.payloadText;
    renderSummary(state.payload);
  }

  if (ghost && host) {
    const settle = (event) => {
      if (!host.isConnected) return;
      if (event && event.target !== ghost) return;
      if (
        event &&
        event.animationName &&
        !String(event.animationName).startsWith("leafTurn") &&
        event.animationName !== "coverDissolve"
      ) {
        return;
      }
      ghost.removeEventListener("animationend", settle);
      host.remove();
      stage.classList.remove("is-turning", "is-turning-back");
    };
    ghost.addEventListener("animationend", settle);
    window.setTimeout(() => settle(), dissolving ? 1400 : 1100);
  }

  if (state.view === "notebook") {
    const last = state.book?.days.at(-1);
    if (last) document.getElementById(`chapter-${last.day}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (state.view === "volume") armPremiere();
  if (state.view === "soglia" && state.pactArrive && !prefersReducedMotion()) {
    armPactReveal();
  } else {
    pactRevealGen += 1;
  }
  syncAmbience();
}

function renderChrome() {
  const llm = state.meta?.llm;
  const pill = $("#llm-pill");
  const name = llm?.provider_label || "OpenAI";
  if (!llm) {
    pill.textContent = "OpenAI";
    pill.className = "pill";
  } else if (llm.configured) {
    pill.textContent = `${name} · ${llm.model}`;
    pill.className = "pill is-on";
  } else {
    pill.textContent = `${name} · chiave assente`;
    pill.className = "pill is-off";
  }
  paintKeyHint("#openai-hint", llm?.openai, "OpenAI");
  paintKeyHint("#google-hint", llm?.google, "Google");

  const progress = $("#chrome-progress");
  const book = state.book;
  if (!book || BARE_VIEWS.has(state.view) || state.view === "anagrafica" || state.view === "voce") {
    progress.textContent = state.view === "voce" ? "La voce del libro" : state.view === "anagrafica" ? "Il protagonista" : "";
    return;
  }
  if (state.view === "studio") {
    progress.textContent = "Osservatorio";
    return;
  }
  if (state.view === "today") {
    progress.textContent = `${book.book_config.protagonist.name} · taccuino`;
    return;
  }
  const day = Math.min(book.book_config.current_day, book.book_config.total_days);
  const done = book.book_config.current_day > book.book_config.total_days;
  progress.textContent = done
    ? `${book.book_config.protagonist.name} · ${roman(book.book_config.total_days)} / ${roman(book.book_config.total_days)}`
    : `${book.book_config.protagonist.name} · ${roman(day)} / ${roman(book.book_config.total_days)}`;
}

function cycleLinks() {
  if (!state.book) return "";
  return `
    <nav class="cycle-links">
      <button type="button" data-view="today">Oggi</button>
      <button type="button" data-view="notebook">Capitoli sigillati</button>
      <button type="button" data-view="volume">Volume</button>
    </nav>`;
}

function renderCover() {
  return `
    <section class="page cover" id="cover-page">
      <div class="cover-inner">
        <h1>Storyhunter</h1>
        <p class="kicker">Il narratore dietro le quinte</p>
        <button type="button" class="cover-start" id="cover-start">Clicca qui per iniziare</button>
      </div>
    </section>`;
}

let pactRevealGen = 0;

function armPactReveal() {
  const page = document.querySelector(".soglia.is-arriving");
  const pact = page?.querySelector(".pact");
  if (!pact) return;
  const gen = ++pactRevealGen;
  const done = () => {
    if (gen !== pactRevealGen || !page.isConnected) return;
    page.classList.add("is-written");
  };
  pact.addEventListener(
    "animationend",
    (event) => {
      if (event.animationName === "pactMask") done();
    },
    { once: true }
  );
  window.setTimeout(done, 3800);
}

function sogliaReturn(book) {
  if (book.complete) {
    return {
      title: book.name,
      pact: "I giorni di questo romanzo sono stati scritti.",
      label: "Apri il volume",
    };
  }
  if (book.chapters <= 0) {
    return {
      title: book.name,
      pact: "Il taccuino è aperto. Il primo capitolo non è ancora scritto.",
      label: "Riprendi il taccuino",
    };
  }
  if (book.chapters === 1) {
    return {
      title: book.name,
      pact: "Il primo capitolo è già nel taccuino.",
      label: "Riprendi il taccuino",
    };
  }
  return {
    title: book.name,
    pact: `Il giorno ${roman(book.chapters)} è già scritto. Il taccuino resta aperto.`,
    label: "Riprendi il taccuino",
  };
}

function renderSoglia() {
  const arriving = Boolean(state.pactArrive) && !prefersReducedMotion();
  const book = state.books[0];
  const back = book ? sogliaReturn(book) : null;
  const pact = back ? back.pact : "La routine diventa prosa. La tua vita diventa un libro.";
  const action = back
    ? `<button type="button" class="pact-open" data-open="${esc(book.id)}">${esc(back.label)}</button>
       <button type="button" class="soglia-new" id="new-cycle">Inizia la tua nuova storia</button>`
    : `<button type="button" class="pact-open" id="new-cycle">Inizia la tua storia</button>`;
  return `
    <section class="page soglia${back ? " is-return" : ""}${arriving ? " is-arriving" : ""}">
      <div class="soglia-inner">
        <h1>${back ? esc(back.title) : "Ogni giorno, un capitolo"}</h1>
        <p class="pact">${pact}</p>
        ${action}
      </div>
    </section>`;
}

function renderAnagrafica() {
  const form = state.form;
  return `
    <section class="page">
      <article class="paper" id="anagrafica-form">
        <p class="eyebrow">Chi sei</p>
        <h2>Il protagonista</h2>
        <label>Nome <input name="name" value="${esc(form.name)}" maxlength="40" placeholder="Il nome nel romanzo"></label>
        <div class="grid-2" style="margin-top: 0.9rem">
          <div class="age-field">
            <label for="age-input">Età</label>
            <div class="age-stepper">
              <button type="button" class="age-nudge is-up" data-age-step="1" aria-label="Aumenta l'età"></button>
              <input id="age-input" name="age" type="number" min="16" max="99" inputmode="numeric" value="${esc(form.age)}">
              <button type="button" class="age-nudge is-down" data-age-step="-1" aria-label="Diminuisci l'età"></button>
            </div>
          </div>
          <div>
            <p class="quiet" style="margin: 0 0 0.4rem">Genere anagrafico</p>
            <div class="choice-row">
              ${state.meta.genders
                .map(
                  (gender) =>
                    `<button type="button" class="choice ${form.gender === gender.id ? "is-on" : ""}" data-gender="${gender.id}" aria-pressed="${form.gender === gender.id}">${esc(gender.label)}</button>`
                )
                .join("")}
            </div>
          </div>
        </div>
        <div class="block">
          <p class="block-title">Quanto dura</p>
          <label class="days-field">Giorni del ciclo
            <span class="days-slider" id="days-slider">
              <input name="total_days" type="hidden" value="${esc(form.total_days)}">
              <span class="days-track" aria-hidden="true"></span>
              <span class="days-thumb" aria-hidden="true"></span>
              <output id="days-out">${form.total_days} giorni</output>
            </span>
          </label>
        </div>
        <div class="page-nav">
          <button type="button" class="ghost" data-back="soglia">Indietro</button>
          <button type="button" class="solid" id="to-voce">Continua</button>
        </div>
      </article>
    </section>`;
}

function renderVoce() {
  const ready = voiceReady();
  return `
    <section class="page">
      <article class="paper" id="voce-form">
        <p class="eyebrow">La voce</p>
        <h2>Il racconto</h2>
        <p class="lede">Il biografo prenderà ispirazione da: meteo, sveglia, spostamenti, agenda e battito cardiaco. Cinque domande per conoscerti, parti da un ritratto già scritto.</p>
        <section class="voce-block is-questions" aria-labelledby="voce-domande-title">
          <h3 class="voce-heading" id="voce-domande-title">Cinque domande</h3>
          <p class="voce-lead">Non è un test. Ogni risposta dice al narratore come guardarti.</p>
          <div class="questions">
            ${state.meta.questions.map((question, index) => renderQuestion(question, index)).join("")}
          </div>
        </section>
        <div class="sticky-bar">
          <button type="button" class="ghost" data-back="anagrafica">Indietro</button>
          <button type="button" class="solid" id="to-conferma" ${ready ? "" : "disabled"}>Continua</button>
        </div>
      </article>
    </section>`;
}

function renderQuestion(question, index = 0) {
  const selected = state.form.answers[question.id];
  return `
    <fieldset class="question">
      <span class="question-num" aria-hidden="true">${index + 1}</span>
      <div class="question-head">
        <h3>${esc(question.title)}</h3>
        <p>${esc(question.prompt)}</p>
      </div>
      <div class="choice-row">
        ${question.options
          .map(
            (option) => `
            <button type="button" class="choice answer ${selected === option.id ? "is-on" : ""}" data-answer="${question.id}:${option.id}" aria-pressed="${selected === option.id}">
              <span class="answer-mark">${option.id}</span>
              <span class="answer-copy">${esc(option.label)}</span>
            </button>`
          )
          .join("")}
      </div>
    </fieldset>`;
}

function renderConferma() {
  const form = state.form;
  const traits = state.meta.questions
    .map((question) => {
      const option = question.options.find((item) => item.id === form.answers[question.id]);
      return `<li>${esc(option ? option.value : "—")}</li>`;
    })
    .join("");
  return `
    <section class="page conferma">
      <div class="conferma-inner">
        <p class="home-alias">${esc(form.name)}</p>
        <ul class="echo">
          <li>${esc(form.age)} anni</li>
          <li>${form.total_days} giorni</li>
        </ul>
        <ul class="echo">${traits}</ul>
        <div class="page-nav" style="justify-content: center">
          <button type="button" class="ghost" data-back="voce">Indietro</button>
          <button type="button" class="solid" id="create-book">Inizia la tua storia</button>
        </div>
      </div>
    </section>`;
}

function telemetryBlank(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return true;
  return slots.every((slot) => {
    const places = Array.isArray(slot?.places) ? slot.places : [];
    return (
      places.length === 0 &&
      !String(slot?.wake_time || "").trim() &&
      !(Number(slot?.doomscrolling_minutes) > 0) &&
      !(Number(slot?.messaging_minutes) > 0)
    );
  });
}

function notesFromSlotList(slots) {
  return (slots || [])
    .flatMap((slot) => {
      const text = String(slot?.notes_text || "").trim();
      if (text) return [text];
      return (slot?.notes || [])
        .map((note) => `${note.time ? `${note.time} ` : ""}${note.text || ""}`.trim())
        .filter(Boolean);
    })
    .filter(Boolean)
    .join("\n");
}

function currentScenario() {
  if (!state.book) return null;
  const avoid = (state.book.days || []).map((entry) => entry.scenario_id).filter(Boolean);
  return simulatedDay({
    bookId: state.book.id,
    day: state.book.book_config.current_day,
    shift: state.scenarioShift || 0,
    avoid,
  });
}

function assignScenario(notes = state.notesText) {
  const scenario = currentScenario();
  state.notesText = notes || "";
  if (!scenario) {
    state.scenarioId = "";
    state.slots = hydrateSlots([]);
  } else {
    state.scenarioId = scenario.id;
    state.slots = hydrateSlots(scenario.slots);
  }
  applyNotesToSlots(state.notesText);
  publishOsservatorio();
}

function prepareDay() {
  const book = state.book;
  const day = book.book_config.current_day;
  const draft = book.draft?.day === day && Array.isArray(book.draft.slots) ? book.draft : null;
  state.date = draft?.date || addDays(book.started_on || state.meta.today, Math.max(day, 1) - 1);
  state.payload = null;
  state.payloadText = "";
  state.activeSlot = 0;
  if (draft && !telemetryBlank(draft.slots)) {
    state.slots = hydrateSlots(draft.slots);
    state.scenarioId = draft.scenario_id || "";
    state.notesText = notesFromSlotList(state.slots);
    publishOsservatorio();
    return;
  }
  assignScenario(draft ? notesFromSlotList(draft.slots) : "");
}

function hydrateSlots(list) {
  const byId = new Map((list || []).map((slot) => [slot.id, slot]));
  return state.meta.slots.map((def) => {
    const raw = byId.get(def.id) || {};
    const notes = Array.isArray(raw.notes) ? raw.notes : [];
    return {
      id: def.id,
      included: raw.included !== false,
      weather: raw.weather || def.defaultWeather,
      doomscrolling_minutes: Number(raw.doomscrolling_minutes) || 0,
      messaging_minutes: Number(raw.messaging_minutes) || 0,
      wake_time: raw.wake_time || "",
      places: Array.isArray(raw.places) ? raw.places.map((place) => ({ ...blankPlace(def.id), ...place })) : [],
      notes,
      calendar_events: Array.isArray(raw.calendar_events) ? raw.calendar_events.map((event) => ({ ...event })) : [],
      notes_text:
        raw.notes_text ||
        notes
          .map((note) => `${note.time ? `${note.time} ` : ""}${note.text}`)
          .join("\n"),
    };
  });
}

function blankPlace(slotId) {
  const def = state.meta.slots.find((slot) => slot.id === slotId);
  const [start, end] = def?.defaultWindow || ["08:00", "09:00"];
  return {
    kind: "home",
    zone: "",
    start,
    end,
    movement: "STILL",
    hr_avg: 72,
    hr_peak: "",
    hr_peak_time: "",
    peak_while_still: false,
    spo2: 98,
    stress: "low",
  };
}

function syncStudio() {
  if (!state.book) return;
  const key = `${state.book.id}:${state.book.book_config.current_day}`;
  if (state.mountedKey !== key) {
    state.scenarioShift = 0;
    prepareDay();
    state.mountedKey = key;
  }
}

function scenarioSnapshot() {
  const list = state.meta?.scenarios || [];
  const scenario = list.find((item) => item.id === state.scenarioId);
  if (!scenario) return null;
  return { id: scenario.id, name: scenario.name, description: scenario.description };
}

function closedBookMarkup() {
  return `
    <section class="page">
      <article class="paper">
        <p class="eyebrow">Ciclo concluso</p>
        <h2>I giorni di questo romanzo sono stati scritti.</h2>
        <p class="lede">Puoi rileggere il taccuino, controllare la memoria, oppure comporre il volume.</p>
        <button type="button" class="solid" data-view="volume">Vai al volume</button>
        ${cycleLinks()}
      </article>
    </section>`;
}

function renderToday() {
  const book = state.book;
  if (!book) return "";
  if (book.book_config.current_day > book.book_config.total_days) return closedBookMarkup();
  const day = book.book_config.current_day;
  return `
    <section class="page">
      <article class="paper" id="taccuino-attivo">
        <p class="eyebrow">Giorno ${roman(day)} di ${roman(book.book_config.total_days)}</p>
        <h2>Scrivi, se serve.</h2>
        <p class="lede">Annota gli accadimenti importanti della giornata.</p>
        <label class="taccuino-field">Appunti
          <textarea id="day-notes" spellcheck="true" placeholder="13:40 Una frase, se vuoi.">${esc(state.notesText)}</textarea>
        </label>
        <div class="page-nav">
          <button type="button" class="ghost" data-view="notebook">Capitoli sigillati</button>
          <button type="button" class="solid" id="end-day">Concludi Giornata</button>
        </div>
        ${cycleLinks()}
      </article>
    </section>`;
}

function refreshStudioLive() {
  const host = $("#osservatorio");
  if (!host) return;
  const next = readOsservatorio();
  if (String(next?.at || "") === String(host.dataset.at || "")) return;
  const page = host.closest(".page");
  if (!page) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = renderStudio();
  const fresh = wrap.firstElementChild;
  if (fresh) page.replaceWith(fresh);
}

function publishOsservatorio() {
  if (!state.book || !state.slots.length) return;
  applyNotesToSlots(state.notesText);
  const snap = {
    at: Date.now(),
    book: {
      id: state.book.id,
      name: state.book.book_config.protagonist.name,
      day: state.book.book_config.current_day,
      total: state.book.book_config.total_days,
    },
    date: state.date,
    notesText: state.notesText,
    scenario: scenarioSnapshot(),
    slots: slotsForApi(),
  };
  try {
    localStorage.setItem(STUDIO_KEY, JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

function readOsservatorio() {
  try {
    const raw = localStorage.getItem(STUDIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function renderStudio() {
  const live = readOsservatorio();
  const slots = live?.slots || state.slots || [];
  const defs = state.meta?.slots || [];
  const book = live?.book;
  const updated = live?.at ? new Date(live.at).toLocaleTimeString("it-IT") : "—";
  return `
    <section class="page osservatorio-page">
      <article class="paper" id="osservatorio" data-at="${esc(live?.at || "")}">
        <p class="eyebrow">Osservatorio</p>
        <h2>Dati simulati della giornata</h2>
        <p class="lede">Questa finestra non è il taccuino del lettore. Qui si vedono le quattro fasce che il merger riceve quando si chiude la giornata: meteo, sveglia, schermo, tappe, battito, agenda, appunti. I numeri imitano telefono e meteo.</p>
        ${
          live?.scenario
            ? `<p class="quiet">Combinazione: ${esc(live.scenario.name)}. ${esc(live.scenario.description)}</p>`
            : ""
        }
        ${
          book
            ? `<p class="quiet">${esc(book.name)} · giorno ${roman(book.day)} di ${roman(book.total)} · ${esc(live.date || "")} · aggiornato alle ${esc(updated)}</p>`
            : `<p class="quiet">Apri il taccuino in un'altra finestra, oppure scegli un ciclo qui sotto. I dati arrivano in diretta mentre si scrive.</p>`
        }
        ${
          state.books?.length
            ? `<div class="preset-row studio-books">${state.books
                .map(
                  (item) =>
                    `<button type="button" class="choice ${book?.id === item.id ? "is-on" : ""}" data-watch-book="${esc(item.id)}">${esc(item.name)}</button>`
                )
                .join("")}</div>`
            : ""
        }
        <p class="quiet">Appunti del taccuino</p>
        <pre class="json-view">${esc(live?.notesText || "—")}</pre>
        <div class="studio-slots">
          ${
            slots.length
              ? slots
                  .map((slot, index) => studioSlotCard(slot, defs[index] || defs.find((item) => item.id === slot.id)))
                  .join("")
              : `<p class="quiet">Nessuno slot in memoria. Compila il taccuino attivo, poi torna qui.</p>`
          }
        </div>
        <details class="json-fold">
          <summary>JSON inviato al merger</summary>
          <pre class="json-view">${esc(JSON.stringify(slots, null, 2))}</pre>
        </details>
      </article>
    </section>`;
}

function studioSlotCard(slot, def) {
  const label = def?.label || slot.id;
  const range = def?.range || "";
  const places = slot.places?.length
    ? slot.places
        .map(
          (place) =>
            `<li>${esc(place.kind)} ${esc(place.zone || "")} · ${esc(place.start)}–${esc(place.end)} · ${esc(place.movement)} · HR ${esc(place.hr_avg)}${place.hr_peak ? ` / picco ${esc(place.hr_peak)}${place.hr_peak_time ? ` alle ${esc(place.hr_peak_time)}` : ""}` : ""} · stress ${esc(place.stress)}${place.spo2 ? ` · SpO2 ${esc(place.spo2)}%` : ""}</li>`
        )
        .join("")
    : "<li>Nessuna tappa: il merger assume casa per tutta la fascia.</li>";
  const agenda = slot.calendar_events?.length
    ? slot.calendar_events
        .map(
          (event) =>
            `<li>${event.all_day ? "tutto il giorno" : `${esc(event.start)}–${esc(event.end)}`} · ${esc(event.title || "senza titolo")}${event.recurring ? " · ricorrente" : ""}</li>`
        )
        .join("")
    : "<li>Nessun impegno in calendario.</li>";
  return `
    <article class="studio-slot">
      <p class="eyebrow">${esc(label)} · ${esc(range)}</p>
      <ul>
        <li>Incluso nel merge: ${slot.included !== false ? "sì" : "no"}</li>
        <li>Meteo: ${esc(slot.weather || "—")}</li>
        <li>Risveglio: ${esc(slot.wake_time || "—")}</li>
        <li>Visione passiva: ${esc(slot.doomscrolling_minutes || 0)} min</li>
        <li>Messaggistica: ${esc(slot.messaging_minutes || 0)} min</li>
        <li>Appunti: ${esc(slot.notes_text || "—")}</li>
      </ul>
      <p class="quiet">Tappe</p>
      <ul>${places}</ul>
      <p class="quiet">Agenda</p>
      <ul>${agenda}</ul>
    </article>`;
}

function renderSlotPage() {
  const book = state.book;
  if (!book) return "";
  if (book.book_config.current_day > book.book_config.total_days) return closedBookMarkup();
  const slot = state.slots[state.activeSlot];
  const def = state.meta.slots[state.activeSlot];
  const last = state.activeSlot === state.slots.length - 1;
  return `
    <section class="page">
      <article class="paper" id="slot-form">
        <p class="eyebrow">${esc(def.label)} · ${esc(def.range)}</p>
        <h2>${esc(def.label)}</h2>
        <label class="check"><input type="checkbox" data-field="included" ${slot.included ? "checked" : ""}> Includi questa fascia nel merge</label>
        <div class="grid-2">
          <label>Meteo <input data-field="weather" list="weather-list" value="${esc(slot.weather)}"></label>
          <label>Risveglio in questa fascia <input data-field="wake_time" type="time" value="${esc(slot.wake_time)}"></label>
        </div>
        <div class="grid-2">
          <label>Minuti di visione passiva <input data-field="doomscrolling_minutes" type="range" min="0" max="240" value="${esc(slot.doomscrolling_minutes)}"> <output>${slot.doomscrolling_minutes} min</output></label>
          <label>Minuti di messaggistica <input data-field="messaging_minutes" type="range" min="0" max="240" value="${esc(slot.messaging_minutes)}"> <output>${slot.messaging_minutes} min</output></label>
        </div>
        <div class="place-head">
          <p class="eyebrow" style="margin: 0">Tappe</p>
          <button type="button" class="ghost" id="add-place">Aggiungi una tappa</button>
        </div>
        <div class="places" id="places"></div>
        <p class="quiet" id="place-hint"></p>
        <label>Appunti, un rigo per volta. Se c'è l'ora, mettila all'inizio: 13:40 testo
          <textarea data-field="notes_text">${esc(slot.notes_text || "")}</textarea>
        </label>
        <div class="page-nav">
          <button type="button" class="ghost" id="slot-back">${state.activeSlot === 0 ? "Oggi" : "Indietro"}</button>
          <button type="button" class="solid" id="slot-next">${last ? "Cuci la giornata" : "Continua"}</button>
        </div>
        <datalist id="weather-list">
          ${state.meta.weathers.map((weather) => `<option value="${esc(weather)}"></option>`).join("")}
        </datalist>
      </article>
    </section>`;
}

function renderPlaces() {
  const host = $("#places");
  const hint = $("#place-hint");
  if (!host) return;
  const slot = state.slots[state.activeSlot];
  if (!slot.places.length) {
    host.innerHTML = "";
    if (hint) hint.textContent = "Senza tappe, il merger assume una sosta in casa per tutta la fascia.";
    return;
  }
  if (hint) hint.textContent = "Una tappa diventa una scena. Il picco di battito, se il corpo è fermo, va trattato dal narratore come verità emotiva.";
  host.innerHTML = slot.places.map((place, index) => placeMarkup(place, index)).join("");
}

function placeMarkup(place, index) {
  const kinds = state.meta.place_kinds
    .map((kind) => `<option value="${kind.id}" ${place.kind === kind.id ? "selected" : ""}>${esc(kind.label)}</option>`)
    .join("");
  const zones = state.meta.zones
    .map((zone) => `<option value="${zone.id}" ${place.zone === zone.id ? "selected" : ""}>${esc(zone.label)}</option>`)
    .join("");
  const movements = [
    ["STILL", "Fermo"],
    ["WALKING", "A piedi"],
    ["TRANSIT", "Spostamento lungo"],
  ]
    .map(([id, label]) => `<option value="${id}" ${place.movement === id ? "selected" : ""}>${label}</option>`)
    .join("");
  const stresses = [
    ["low", "Lieve"],
    ["moderate", "Moderato"],
    ["high", "Alto"],
  ]
    .map(([id, label]) => `<option value="${id}" ${place.stress === id ? "selected" : ""}>${label}</option>`)
    .join("");

  return `
    <article class="place">
      <div class="place-head">
        <strong>Tappa ${index + 1}</strong>
        <button type="button" class="ghost" data-remove-place="${index}">Togli</button>
      </div>
      <div class="place-grid">
        <label>Luogo <select data-place="${index}" data-place-field="kind">${kinds}</select></label>
        <label>Zona <select data-place="${index}" data-place-field="zone">${zones}</select></label>
        <label>Dalle <input data-place="${index}" data-place-field="start" type="time" value="${esc(place.start)}"></label>
        <label>Alle <input data-place="${index}" data-place-field="end" type="time" value="${esc(place.end)}"></label>
      </div>
      <div class="place-grid">
        <label>Movimento <select data-place="${index}" data-place-field="movement">${movements}</select></label>
        <label>Battito medio <input data-place="${index}" data-place-field="hr_avg" type="number" min="40" max="200" value="${esc(place.hr_avg)}"></label>
        <label>Picco <input data-place="${index}" data-place-field="hr_peak" type="number" min="40" max="220" placeholder="vuoto se assente" value="${esc(place.hr_peak ?? "")}"></label>
        <label>Ora del picco <input data-place="${index}" data-place-field="hr_peak_time" type="time" value="${esc(place.hr_peak_time || "")}"></label>
      </div>
      <div class="grid-2">
        <label>Stress <select data-place="${index}" data-place-field="stress">${stresses}</select></label>
        <label>Saturazione <input data-place="${index}" data-place-field="spo2" type="number" min="70" max="100" value="${esc(place.spo2 ?? "")}"></label>
      </div>
      <label class="check"><input data-place="${index}" data-place-field="peak_while_still" type="checkbox" ${place.peak_while_still ? "checked" : ""}> Il picco avviene a corpo fermo</label>
    </article>`;
}

function renderMergePage() {
  const book = state.book;
  if (!book) return "";
  if (book.book_config.current_day > book.book_config.total_days) return closedBookMarkup();
  return `
    <section class="page">
      <article class="paper">
        <p class="eyebrow">Giorno cucito</p>
        <h2>Questa è la giornata che leggerà il narratore.</h2>
        <div id="merge-summary"></div>
        <div class="page-nav">
          <button type="button" class="ghost" id="back-to-slots">Indietro</button>
          <button type="button" class="solid" id="simulate">Scrivi il capitolo</button>
        </div>
        <details class="json-fold">
          <summary>JSON unico</summary>
          <textarea id="payload-json" class="json" spellcheck="false" placeholder="Il merger scrive qui il DailyUnifiedPayload. Puoi anche incollarlo."></textarea>
          <label class="check" style="margin-top: 0.6rem">
            <input id="raw-json" type="checkbox" ${state.raw ? "checked" : ""}>
            Invia il JSON così com'è, senza riallineare profilo e memoria del ciclo
          </label>
          <div class="actions" style="margin-top: 0.7rem">
            <button type="button" class="ghost" id="from-json">Genera dal JSON</button>
            <button type="button" class="ghost" id="load-sample">Carica l'esempio delle specifiche</button>
          </div>
        </details>
        ${cycleLinks()}
      </article>
    </section>`;
}

function slotsForApi() {
  return state.slots.map((slot) => ({
    ...slot,
    places: slot.places.map((place) => ({
      ...place,
      hr_avg: Number(place.hr_avg),
      hr_peak: place.hr_peak === "" || place.hr_peak == null ? null : Number(place.hr_peak),
      spo2: place.spo2 === "" || place.spo2 == null ? null : Number(place.spo2),
    })),
  }));
}

function renderSummary(payload) {
  const host = $("#merge-summary");
  if (!host) return;
  if (!payload?.today_unified_telemetry) {
    host.innerHTML = `<p class="quiet">Il merger non ha ancora cucito gli slot. Torna indietro, oppure incolla un JSON.</p>`;
    return;
  }
  const today = payload.today_unified_telemetry;
  const flags = [
    today.is_empty_day ? "Giornata vuota" : "Giornata con eventi",
    CUTOFF[today.midnight_cutoff_status] || today.midnight_cutoff_status,
    `${today.unified_scenes.length} scene`,
    (today.slots_merged || []).join(" · "),
  ];
  host.innerHTML = `
    <div class="flags">${flags.filter(Boolean).map((flag) => `<span class="flag">${esc(flag)}</span>`).join("")}</div>
    <p>${esc(today.wake_up_event?.semantic_translation || "")}</p>
    <p>${esc(today.screen_behavior_summary?.semantic_translation || "")}</p>
    <p class="quiet">${esc(today.weather_daily_arc || "")}</p>
    <ol class="scenes">
      ${today.unified_scenes
        .map(
          (scene) => `
          <li>
            <strong>${esc(scene.time_window)} · ${esc(scene.location_alias)}</strong>
            <span>${esc(scene.biometric_vibe)}</span>
            ${scene.user_notes?.length ? `<em>${esc(scene.user_notes.map((note) => note.text).join(" "))}</em>` : ""}
          </li>`
        )
        .join("")}
    </ol>
  `;
}

function applyPayload(payload) {
  state.payload = payload;
  state.payloadText = JSON.stringify(payload, null, 2);
  const area = $("#payload-json");
  if (area) area.value = state.payloadText;
  renderSummary(payload);
}

function renderNotebook() {
  const book = state.book;
  if (!book) return "";
  const complete = book.days.length >= book.book_config.total_days;
  return `
    <section class="page">
      <p class="eyebrow">Taccuino del narratore</p>
      <h2>Capitoli sigillati</h2>
      <p class="lede">Ogni capitolo nasce chiuso. Aprilo subito, oppure lascialo così fino al volume finale.</p>
      ${
        book.days.length
          ? ""
          : `<article class="paper"><p>Nessun capitolo, per ora. Chiudi la prima giornata dal taccuino.</p></article>`
      }
      <div class="chapter-list">
        ${book.days.map((entry) => chapterCard(entry)).join("")}
      </div>
      <div class="page-nav">
        ${
          complete
            ? `<button type="button" class="solid" data-view="volume">Vai al volume</button>`
            : `<button type="button" class="solid" data-view="today">Giorno successivo</button>`
        }
      </div>
      ${cycleLinks()}
    </section>`;
}

function chapterCard(entry) {
  const chapter = entry.chapter;
  if (chapter.sealed) {
    return `
      <article class="sheet" id="chapter-${entry.day}">
        <div class="seal">${roman(entry.day)}</div>
        <h3>Capitolo ${roman(entry.day)}</h3>
        <p class="quiet">${esc(entry.date)} · ${chapter.words || "—"} parole · sigillato</p>
        <p>Il foglio è chiuso. Puoi aprirlo adesso, o conservarlo per quando il ciclo sarà intero.</p>
        <div class="actions no-print">
          <button type="button" class="solid" data-open-chapter="${entry.day}">Apri il sigillo</button>
        </div>
      </article>`;
  }
  const warnings = (chapter.warnings || []).map((warning) => `<li>${esc(warning)}</li>`).join("");
  return `
    <article class="sheet" id="chapter-${entry.day}">
      <p class="quiet">Capitolo ${roman(entry.day)} · ${esc(entry.date)} · ${chapter.words || "—"} parole · ${esc(chapter.model || "")}</p>
      <h3>${esc(chapter.chapter_title)}</h3>
      ${subtitleLine(chapter.chapter_subtitle)}
      <div class="prose">${prose(chapter.chapter_text)}</div>
      ${warnings ? `<ul class="quiet">${warnings}</ul>` : ""}
    </article>`;
}

function renderMemory() {
  const book = state.book;
  if (!book) return "";
  const memory = book.story_state;
  const locations = Object.entries(memory.established_locations || {})
    .map(([key, alias]) => `<li><code>${esc(key)}</code> — ${esc(alias)}</li>`)
    .join("");
  const list = (items) =>
    items?.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="quiet">Niente, per ora.</p>`;
  const last = book.days.at(-1);
  return `
    <section class="page">
      <p class="eyebrow">StoryState</p>
      <h2>Memoria del romanzo</h2>
      <div class="memory-grid">
        <article class="paper">
          <p class="eyebrow">Chiusura dell'ultimo capitolo</p>
          <p>${esc(CUTOFF[memory.last_chapter_ending_state] || memory.last_chapter_ending_state)}</p>
          <p>${esc(memory.previous_chapter_summary)}</p>
          <p class="eyebrow">Filo conduttore</p>
          <p>${esc(memory.through_line || "Si stabilisce nel primo capitolo.")}</p>
          <p class="eyebrow">Ritratto</p>
          <p>${esc(memory.character_portrait || "Si delinea nel primo capitolo.")}</p>
        </article>
        <article class="paper">
          <p class="eyebrow">Luoghi</p>
          <ul>${locations}</ul>
          <p class="eyebrow">Motivi</p>
          ${list(memory.recurring_motifs)}
          <p class="eyebrow">Tensioni aperte</p>
          ${list(memory.unresolved_tensions)}
        </article>
        ${
          last
            ? `<article class="paper">
                <p class="eyebrow">Ultimo JSON inviato</p>
                <pre class="json-view">${esc(JSON.stringify(last.payload, null, 2))}</pre>
                ${
                  last.chapter?.dramaturgy
                    ? `<details>
                        <summary>Copione del drammaturgo per il capitolo ${last.day}</summary>
                        <pre class="json-view">${esc(JSON.stringify(last.chapter.dramaturgy, null, 2))}</pre>
                      </details>`
                    : ""
                }
                <details>
                  <summary>Prompt di sistema usato per il capitolo ${last.day}</summary>
                  <pre class="json-view">${esc(last.system_prompt || "Non archiviato.")}</pre>
                </details>
              </article>`
            : ""
        }
      </div>
      ${cycleLinks()}
    </section>`;
}

function renderVolume() {
  const book = state.book;
  if (!book) return "";
  const missing = book.book_config.total_days - book.days.length;
  if (missing > 0) {
    return `
      <section class="page">
        <article class="paper">
          <p class="eyebrow">Volume</p>
          <h2>Mancano ancora ${missing} ${missing === 1 ? "giorno" : "giorni"}.</h2>
          <p class="lede">Il romanzo si impagina quando ogni giorno del ciclo ha un capitolo.</p>
          ${cycleLinks()}
        </article>
      </section>`;
  }

  const closing = book.closing;
  if (!closing) {
    return `
      <section class="page">
        <article class="paper compose-invite">
          <p class="eyebrow">Volume</p>
          <h2>Il ciclo è intero.</h2>
          <p class="lede">Manca solo il frontespizio. Quando il libro è composto, si apre da solo.</p>
          <button type="button" class="solid" id="compose">Componi il libro</button>
        </article>
        ${cycleLinks()}
      </section>`;
  }
  const premiering = state.premiere ? " is-premiering" : " is-open";
  return `
    <section class="page volume-premiere${premiering}">
      ${
        state.premiere
          ? `<div class="overture">
              <div class="overture-inner">
                <p class="kicker">${esc(book.book_config.genre)}</p>
                <h2 class="overture-title">${esc(closing.book_title)}</h2>
                <div class="overture-rule" aria-hidden="true"></div>
                <p class="overture-sub">${esc(closing.subtitle || "")}</p>
                <p class="epigraph">${esc(closing.epigraph || "")}</p>
                <p class="overture-name">${esc(book.book_config.protagonist.name)}</p>
                <p class="overture-hint">Tocca per aprire il libro</p>
              </div>
            </div>`
          : ""
      }
      <article class="book cinema-book">
        <header class="cover-page cinema-cover">
          <p class="eyebrow">${esc(book.book_config.genre)}</p>
          <h2>${esc(closing.book_title)}</h2>
          <p class="cinema-subtitle">${esc(closing.subtitle || "")}</p>
          <p class="epigraph">${esc(closing.epigraph || "")}</p>
          <p class="cinema-by">${esc(book.book_config.protagonist.name)}</p>
        </header>
        ${book.days.map((entry) => volumeChapter(entry)).join("")}
        <section class="back-cover cinema-back">
          <p class="eyebrow">Quarta di copertina</p>
          <div class="prose">${prose(closing.back_cover)}</div>
        </section>
      </article>
      <div class="volume-tools no-print">
        <button type="button" class="ghost" id="print">Stampa o salva in PDF</button>
      </div>
      ${cycleLinks()}
    </section>`;
}

function volumeChapter(entry) {
  if (entry.chapter.sealed) {
    return `
      <section class="volume-leaf">
        <div class="seal">${roman(entry.day)}</div>
        <h3>Capitolo ${roman(entry.day)}</h3>
        <p>Ancora sigillato.</p>
      </section>`;
  }
  return `
    <section class="volume-leaf">
      <p class="chapter-index">Capitolo ${roman(entry.day)}</p>
      <h3>${esc(entry.chapter.chapter_title)}</h3>
      ${subtitleLine(entry.chapter.chapter_subtitle)}
      <div class="prose">${prose(entry.chapter.chapter_text)}</div>
    </section>`;
}

function armPremiere() {
  const root = document.querySelector(".volume-premiere.is-premiering");
  if (!root || root.dataset.armed) return;
  root.dataset.armed = "true";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    state.premiere = false;
    document.body.classList.remove("is-premiere");
    root.classList.remove("is-premiering");
    root.classList.add("is-open");
    root.querySelector(".overture")?.remove();
  };
  root.querySelector(".overture")?.addEventListener("click", () => {
    playMark();
    finish();
  });
  window.setTimeout(finish, prefersReducedMotion() ? 40 : 5400);
}

async function openBoundBook() {
  const book = state.book;
  if (!book?.closing || !book.days.some((entry) => entry.chapter?.sealed)) return;
  const result = await api(`/api/books/${book.id}/open-all`, { method: "POST", body: {} });
  if (state.book?.id === book.id) state.book = result.book;
}

async function createCycle() {
  const problem = formProblems();
  if (problem) {
    setBanner("error", problem);
    return;
  }
  setBanner("", "");
  setBusy("Si apre il taccuino…");
  try {
    const { book } = await api("/api/books", { method: "POST", body: state.form });
    state.book = book;
    state.mountedKey = "";
    state.books = (await api("/api/books")).books;
    go("today", "enter-forward");
    publishOsservatorio();
    setBanner("ok", `Ciclo di ${book.book_config.protagonist.name} aperto.`);
  } catch (error) {
    setBanner("error", error.message);
  } finally {
    setBusy("");
  }
}

async function openBook(id) {
  setBusy("");
  setBanner("", "");
  try {
    const { book } = await api(`/api/books/${id}`);
    state.book = book;
    state.mountedKey = "";
    go(
      isStudioWindow()
        ? "studio"
        : book.book_config.current_day > book.book_config.total_days
          ? "volume"
          : "today",
      "enter-forward"
    );
    publishOsservatorio();
  } catch (error) {
    setBanner("error", error.message);
  }
}

async function removeBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book) return;
  if (!confirm(`Eliminare il ciclo di ${book.name}? I capitoli locali spariscono.`)) return;
  try {
    await api(`/api/books/${id}`, { method: "DELETE" });
    if (state.book?.id === id) {
      state.book = null;
      state.mountedKey = "";
    }
    state.books = (await api("/api/books")).books;
    go("soglia", "enter-forward");
  } catch (error) {
    setBanner("error", error.message);
  }
}

function slotIndexForClock(time) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 3;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < 6 * 60) return 0;
  if (minutes < 12 * 60) return 1;
  if (minutes < 18 * 60) return 2;
  return 3;
}

function applyNotesToSlots(text) {
  state.notesText = String(text || "");
  for (const slot of state.slots) {
    slot.notes = [];
    slot.notes_text = "";
  }
  const lines = state.notesText.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const buckets = [[], [], [], []];
  for (const line of lines) {
    const timed = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    const index = timed ? slotIndexForClock(timed[1]) : 3;
    buckets[index].push(line);
  }
  state.slots.forEach((slot, index) => {
    slot.notes_text = buckets[index].join("\n");
  });
}

async function loadPreset(id) {
  try {
    const preset = state.meta.presets.find((item) => item.id === id);
    const { slots } = await api(`/api/presets/${id}`);
    state.slots = hydrateSlots(slots);
    state.notesText = state.slots.map((slot) => slot.notes_text).filter(Boolean).join("\n");
    setBanner("ok", preset ? preset.description : "Preset caricato.");
    go("today", "enter-forward");
  } catch (error) {
    setBanner("error", error.message);
  }
}

async function concludeDay() {
  if (state.busy) return;
  applyNotesToSlots(state.notesText);
  publishOsservatorio();
  await generate(
    { source: "slots", date: state.date, slots: slotsForApi() },
    "Si chiude la giornata. Il narratore sta scrivendo il capitolo."
  );
}

async function generate(body, busyText) {
  if (state.busy) return;
  if (!state.meta.llm.configured) {
    setBanner("error", `Manca la chiave API ${engineName()}.`);
    $("#settings").showModal();
    return;
  }
  setBanner("", "");
  setBusy(busyText);
  try {
    const result = await api(`/api/books/${state.book.id}/generate`, {
      method: "POST",
      body: {
        ...body,
        scenario_id: body.scenario_id || state.scenarioId || "",
        shift: state.scenarioShift || 0,
      },
      signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(150000)
        : undefined,
    });
    state.book = result.book;
    state.mountedKey = "";
    const warnings = (result.warnings || []).filter(Boolean);
    setBanner(
      warnings.length ? "error" : "ok",
      warnings.length
        ? `Capitolo scritto. ${warnings.join(" ")}`
        : `Capitolo ${roman(result.book.days.at(-1).day)} sigillato nel taccuino. ${result.words} parole.`
    );
    go("notebook", "enter-forward");
  } catch (error) {
    setBanner("error", error.message);
    if (/chiave API/i.test(error.message)) $("#settings").showModal();
  } finally {
    setBusy("");
  }
}

function readPayloadText() {
  const area = $("#payload-json");
  state.payloadText = area ? area.value : state.payloadText;
  return JSON.parse(state.payloadText);
}

async function saveSettings(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy("Salvo la configurazione…");
  try {
    const result = await api("/api/settings", {
      method: "PUT",
      body: {
        api_key: String(data.get("api_key") || ""),
        google_api_key: String(data.get("google_api_key") || ""),
        model: String(data.get("model") || ""),
      },
    });
    state.meta.llm = result.llm;
    fillModelSelect();
    renderChrome();
    event.currentTarget.elements.api_key.value = "";
    event.currentTarget.elements.google_api_key.value = "";
    $("#settings").close();
    setBanner(
      "ok",
      result.llm.configured
        ? `${result.llm.provider_label} pronto con ${result.llm.model}.`
        : `Nessuna chiave ${result.llm.provider_label} configurata.`
    );
  } catch (error) {
    setBanner("error", error.message);
  } finally {
    setBusy("");
  }
}

async function clearKey(which) {
  setBusy("");
  try {
    const result = await api("/api/settings", {
      method: "PUT",
      body: which === "google"
        ? { clear_google_key: true, model: $("#model-select").value }
        : { clear_key: true, model: $("#model-select").value },
    });
    state.meta.llm = result.llm;
    renderChrome();
    const name = which === "google" ? "Google" : "OpenAI";
    const info = which === "google" ? result.llm.google : result.llm.openai;
    setBanner(
      "ok",
      info.configured
        ? `Rimossa la chiave ${name} del file. Resta quella dell'ambiente.`
        : `Chiave ${name} rimossa da questo computer.`
    );
  } catch (error) {
    setBanner("error", error.message);
  }
}

function onField(event) {
  const slotForm = event.target.closest("#slot-form");
  if (slotForm) {
    const slot = state.slots[state.activeSlot];
    if (!slot) return;
    if (event.target.dataset.placeField) {
      const place = slot.places[Number(event.target.dataset.place)];
      if (!place) return;
      const key = event.target.dataset.placeField;
      place[key] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      return;
    }
    const field = event.target.dataset.field;
    if (!field) return;
    if (event.target.type === "checkbox") slot[field] = event.target.checked;
    else if (event.target.type === "range") {
      slot[field] = Number(event.target.value);
      const output = event.target.parentElement.querySelector("output");
      if (output) output.textContent = `${event.target.value} min`;
    } else if (field === "notes_text") {
      slot.notes_text = event.target.value;
      slot.notes = [];
    } else slot[field] = event.target.value;
    return;
  }

  if (event.target.id === "day-notes") {
    state.notesText = event.target.value;
    publishOsservatorio();
    return;
  }

  if (!event.target.closest("#anagrafica-form")) return;
  const el = event.target;
  if (el.name === "name") state.form.name = el.value;
  if (el.name === "age") state.form.age = Number(el.value);
}

function nudgeAge(button) {
  const input = button.closest(".age-stepper")?.querySelector('input[name="age"]');
  if (!input) return;
  const min = Number(input.min) || 16;
  const max = Number(input.max) || 99;
  const next = Math.min(max, Math.max(min, Number(input.value || min) + Number(button.dataset.ageStep)));
  input.value = String(next);
  state.form.age = next;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const DAYS_MIN = 3;
const DAYS_MAX = 7;

function daysFromPointer(slider, clientX) {
  const track = slider.querySelector(".days-track");
  const box = (track || slider).getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (clientX - box.left) / (box.width || 1)));
  return DAYS_MIN + pct * (DAYS_MAX - DAYS_MIN);
}

function paintDays(value, { snap = false, glide = false } = {}) {
  const slider = $("#days-slider");
  const input = $('input[name="total_days"]');
  const thumb = slider?.querySelector(".days-thumb");
  const output = $("#days-out");
  if (!slider || !input || !thumb || !output) return;
  let next = Math.min(DAYS_MAX, Math.max(DAYS_MIN, Number(value)));
  const nearest = Math.round(next);
  if (snap) next = nearest;
  const pct = ((next - DAYS_MIN) / (DAYS_MAX - DAYS_MIN)) * 100;
  slider.classList.toggle("is-gliding", Boolean(glide));
  thumb.style.left = `${pct}%`;
  output.style.left = `${pct}%`;
  output.style.transform = `translateX(-${pct}%)`;
  output.textContent = `${nearest} giorni`;
  input.value = String(nearest);
  state.form.total_days = nearest;
}

function bindDaysSlider() {
  const slider = $("#days-slider");
  if (!slider) return;
  paintDays(state.form.total_days, { snap: true });
  if (slider.dataset.bound) return;
  slider.dataset.bound = "true";
  let stuck = null;
  let dragging = false;
  const follow = (event) => {
    let next = daysFromPointer(slider, event.clientX);
    const nearest = Math.round(next);
    if (stuck !== null) {
      if (Math.abs(next - stuck) < 0.22) next = stuck;
      else stuck = null;
    }
    if (stuck === null && Math.abs(next - nearest) <= 0.12) {
      next = nearest;
      stuck = nearest;
    }
    paintDays(next);
  };
  slider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    stuck = null;
    slider.setPointerCapture?.(event.pointerId);
    follow(event);
  });
  slider.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    follow(event);
  });
  const finish = (event) => {
    if (!dragging) return;
    dragging = false;
    stuck = null;
    paintDays(daysFromPointer(slider, event.clientX), { snap: true, glide: true });
  };
  slider.addEventListener("pointerup", finish);
  slider.addEventListener("pointercancel", finish);
}

function placeDaysOutput() {
  paintDays(state.form.total_days, { snap: true });
}

function markPressed(selector, value, attr) {
  document.querySelectorAll(selector).forEach((button) => {
    const on = button.getAttribute(attr) === value;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

async function onClick(event) {
  if (event.target.closest("#toggle-sound")) {
    const wasOff = !soundEnabled();
    toggleAmbience();
    if (wasOff) playMark();
    return;
  }
  markFromClick(event);
  if (state.view === "cover") {
    if (event.target.closest("#cover-start")) spillCoverInk(event);
    return;
  }

  const ageNudge = event.target.closest("[data-age-step]");
  if (ageNudge) {
    nudgeAge(ageNudge);
    return;
  }

  const preset = event.target.closest("[data-preset]");
  const removePlace = event.target.closest("[data-remove-place]");
  const open = event.target.closest("[data-open]");
  const remove = event.target.closest("[data-delete]");
  const gender = event.target.closest("[data-gender]");
  const answer = event.target.closest("[data-answer]");
  const view = event.target.closest("[data-view]");
  const back = event.target.closest("[data-back]");
  const openChapter = event.target.closest("[data-open-chapter]");

  if (event.target.closest("#brand")) {
    if (isStudioWindow()) return;
    go("soglia", "enter-back");
    return;
  }
  const watch = event.target.closest("[data-watch-book]");
  if (watch) {
    await openBook(watch.dataset.watchBook);
    return;
  }
  if (event.target.closest("#open-settings")) {
    $("#settings").showModal();
    return;
  }
  if (event.target.closest("#close-settings")) {
    $("#settings").close();
    return;
  }
  if (event.target.closest("#clear-key")) {
    await clearKey("openai");
    return;
  }
  if (event.target.closest("#clear-google-key")) {
    await clearKey("google");
    return;
  }
  if (open) {
    await openBook(open.dataset.open);
    return;
  }
  if (remove) {
    await removeBook(remove.dataset.delete);
    return;
  }
  if (event.target.closest("#new-cycle")) {
    state.form = blankForm();
    go("anagrafica", "enter-forward");
    return;
  }
  if (gender) {
    state.form.gender = gender.dataset.gender;
    markPressed("[data-gender]", state.form.gender, "data-gender");
    return;
  }
  if (answer) {
    const [question, option] = answer.dataset.answer.split(":");
    state.form.answers[question] = option;
    document.querySelectorAll(`[data-answer^="${question}:"]`).forEach((button) => {
      const on = button.dataset.answer === `${question}:${option}`;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const next = $("#to-conferma");
    if (next) next.disabled = !voiceReady();
    return;
  }
  if (event.target.closest("#to-voce")) {
    const problem = anagraficaProblems();
    if (problem) {
      setBanner("error", problem);
      return;
    }
    setBanner("", "");
    go("voce", "enter-forward");
    return;
  }
  if (event.target.closest("#to-conferma")) {
    if (!voiceReady()) {
      setBanner("error", formProblems());
      return;
    }
    setBanner("", "");
    go("conferma", "enter-forward");
    return;
  }
  if (back) {
    go(back.dataset.back, "enter-back");
    return;
  }
  if (event.target.closest("#create-book")) {
    await createCycle();
    return;
  }
  if (view) {
    go(view.dataset.view, "enter-forward");
    return;
  }
  if (preset) {
    await loadPreset(preset.dataset.preset);
    return;
  }
  if (event.target.closest("#end-day")) {
    await concludeDay();
    return;
  }
  if (event.target.closest("#start-day") || event.target.closest("#slot-back") || event.target.closest("#slot-next") || event.target.closest("#back-to-slots")) {
    go("today", "enter-forward");
    return;
  }
  if (event.target.closest("#add-place")) {
    state.slots[state.activeSlot].places.push(blankPlace(state.slots[state.activeSlot].id));
    renderPlaces();
    return;
  }
  if (removePlace) {
    state.slots[state.activeSlot].places.splice(Number(removePlace.dataset.removePlace), 1);
    renderPlaces();
    return;
  }
  if (event.target.closest("#simulate")) {
    await generate(
      { source: "slots", date: state.date, slots: slotsForApi() },
      `${engineName()} sta scrivendo il capitolo. Può volerci un minuto.`
    );
    return;
  }
  if (event.target.closest("#from-json")) {
    let payload;
    try {
      payload = readPayloadText();
    } catch {
      setBanner("error", "Il JSON nell'editor non è valido.");
      return;
    }
    await generate(
      { source: state.raw ? "raw" : "editor", payload, date: state.date },
      `${engineName()} sta scrivendo dal JSON unico.`
    );
    return;
  }
  if (event.target.closest("#load-sample")) {
    try {
      const { payload } = await api("/api/sample-payload");
      state.raw = true;
      const box = $("#raw-json");
      if (box) box.checked = true;
      applyPayload(payload);
      setBanner("ok", "Esempio del documento caricato. È il giorno 3 di Marco: con la casella attiva parte così com'è.");
    } catch (error) {
      setBanner("error", error.message);
    }
    return;
  }
  if (openChapter) {
    await mutateBook(`/api/books/${state.book.id}/chapters/${openChapter.dataset.openChapter}/open`, "notebook");
    return;
  }
  if (event.target.closest("#compose")) {
    if (!state.meta.llm.configured) {
      setBanner("error", `Manca la chiave API ${engineName()}.`);
      $("#settings").showModal();
      return;
    }
    setBusy("Il libro si sta componendo.");
    try {
      const result = await api(`/api/books/${state.book.id}/close`, {
        method: "POST",
        body: {},
        signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(120000)
          : undefined,
      });
      state.book = result.book;
      state.premiere = true;
      setBanner("", "");
      go("volume", "enter-forward");
    } catch (error) {
      setBanner("error", error.message);
    } finally {
      setBusy("");
    }
    return;
  }
  if (event.target.closest("#print")) window.print();
}

async function mutateBook(path, view) {
  setBanner("", "");
  try {
    const result = await api(path, { method: "POST", body: {} });
    state.book = result.book;
    go(view, "enter-forward");
  } catch (error) {
    setBanner("error", error.message);
  }
}

function bind() {
  document.addEventListener("mousedown", (event) => {
    if (event.target.closest?.("[data-age-step]")) event.preventDefault();
  });
  document.addEventListener("click", (event) => {
    const ageNudge = event.target.closest?.("[data-age-step]");
    if (ageNudge) {
      event.preventDefault();
      nudgeAge(ageNudge);
      return;
    }
    onClick(event).catch((error) => setBanner("error", error.message));
  });
  document.addEventListener("input", (event) => {
    if (shouldTypeSound(event)) playType();
  });
  document.addEventListener("input", onField);
  window.addEventListener("resize", () => placeDaysOutput());
  document.addEventListener("change", (event) => {
    if (event.target.id === "day-date") state.date = event.target.value;
    if (event.target.id === "raw-json") state.raw = event.target.checked;
    if (event.target.dataset?.placeField || event.target.dataset?.field) onField(event);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STUDIO_KEY || state.view !== "studio") return;
    refreshStudioLive();
  });
  window.setInterval(() => {
    if (state.view === "studio") refreshStudioLive();
  }, 900);
  document.addEventListener("input", (event) => {
    if (event.target.id === "payload-json") {
      state.payloadText = event.target.value;
      try {
        state.payload = JSON.parse(state.payloadText);
        renderSummary(state.payload);
      } catch {
        state.payload = null;
        const host = $("#merge-summary");
        if (host) host.innerHTML = `<p class="quiet">Il testo nell'editor non è ancora un JSON valido.</p>`;
      }
    }
  });
  $("#settings-form").addEventListener("submit", (event) => {
    saveSettings(event).catch((error) => setBanner("error", error.message));
  });
}

async function boot() {
  bind();
  armInkTrail();
  try {
    const [meta, library] = await Promise.all([api("/api/meta"), api("/api/books")]);
    state.meta = meta;
    state.books = library.books;
    state.date = meta.today;
    fillModelSelect();
    if (isStudioWindow()) {
      if (location.pathname.replace(/\/+$/, "") !== "/studio") history.replaceState({}, "", "/studio");
      go("studio", "none");
    } else {
      go("cover", "enter-cover");
    }
  } catch (error) {
    setBanner("error", error.message);
  }
}

boot();
