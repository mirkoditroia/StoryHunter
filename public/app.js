const state = {
  meta: null,
  books: [],
  book: null,
  view: "start",
  form: blankForm(),
  slots: [],
  activeSlot: 1,
  date: "",
  payload: null,
  payloadText: "",
  raw: false,
  mountedKey: "",
  busy: false,
};

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
    genre: "",
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Richiesta non riuscita.");
  return data;
}

function setBanner(kind, text) {
  const banner = $("#banner");
  banner.className = `banner ${kind || ""}`.trim();
  banner.textContent = text || "";
  banner.hidden = !text;
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

  const book = state.book;
  if (!book || state.view === "start") {
    $("#top-kicker").textContent = "Simulatore locale · quattro slot, un JSON, un capitolo";
    return;
  }
  const day = Math.min(book.book_config.current_day, book.book_config.total_days);
  const done = book.book_config.current_day > book.book_config.total_days;
  $("#top-kicker").textContent = done
    ? `${book.book_config.protagonist.name} · ciclo concluso · ${book.book_config.genre}`
    : `Giorno ${day} di ${book.book_config.total_days} · ${book.book_config.genre}`;
}

function renderStart() {
  const meta = state.meta;
  if (!meta) return;
  const form = state.form;
  const shelf = state.books
    .map(
      (book) => `
      <div class="spine">
        <button type="button" data-open="${esc(book.id)}">
          <strong>${esc(book.name)}</strong>
          <small>${esc(book.genre)} · ${book.chapters}/${book.total_days} capitoli${book.complete ? " · completo" : ""}</small>
        </button>
        <div class="spine-actions">
          <button type="button" class="ghost" data-delete="${esc(book.id)}">Elimina</button>
        </div>
      </div>`
    )
    .join("");

  $("#start").innerHTML = `
    <section class="manifesto">
      <p class="eyebrow">Localhost</p>
      <h1>La giornata diventa un capitolo.</h1>
      <p class="lede">Qui i sensori sono leve. Componi la giornata in quattro fasce, il Daily Merger la cuce in un solo JSON, il modello scelto scrive il capitolo e aggiorna la memoria del romanzo.</p>
      ${
        state.books.length
          ? `<div class="shelf"><p class="eyebrow">Cicli aperti</p>${shelf}</div>`
          : ""
      }
      ${
        state.book
          ? `<button type="button" class="ghost" id="back-to-book">Torna al ciclo di ${esc(state.book.book_config.protagonist.name)}</button>`
          : ""
      }
    </section>
    <section class="panel" id="start-form">
      <p class="eyebrow">Onboarding rapido</p>
      <h2>Apri un ciclo</h2>
      <div class="preset-row">
        ${meta.profiles
          .map((profile) => `<button type="button" class="choice" data-profile="${esc(profile.id)}">${esc(profile.label)}</button>`)
          .join("")}
      </div>
      <div class="grid-3">
        <label>Nome <input name="name" value="${esc(form.name)}" maxlength="40" placeholder="Il nome nel romanzo"></label>
        <label>Età <input name="age" type="number" min="16" max="99" value="${esc(form.age)}"></label>
        <label>Giorni del ciclo <input name="total_days" type="range" min="3" max="7" value="${esc(form.total_days)}"> <output id="days-out">${form.total_days} giorni</output></label>
      </div>
      <p class="eyebrow">Genere anagrafico</p>
      <div class="choice-row">
        ${meta.genders
          .map(
            (gender) =>
              `<button type="button" class="choice ${form.gender === gender.id ? "is-on" : ""}" data-gender="${gender.id}" aria-pressed="${form.gender === gender.id}">${esc(gender.label)}</button>`
          )
          .join("")}
      </div>
      <p class="eyebrow">Genere letterario</p>
      <div class="choice-row">
        ${meta.genres
          .map(
            (genre) =>
              `<button type="button" class="choice ${form.genre === genre.id ? "is-on" : ""}" data-genre="${esc(genre.id)}" aria-pressed="${form.genre === genre.id}"><strong>${esc(genre.short)}</strong><small>${esc(genre.blurb)}</small></button>`
          )
          .join("")}
      </div>
      <div class="questions">
        ${meta.questions.map((question) => renderQuestion(question)).join("")}
      </div>
      <div class="trait-line" id="trait-line"></div>
      <div class="actions" style="margin-top: 1rem">
        <button type="button" class="solid" id="create-book">Apri il ciclo</button>
      </div>
    </section>
  `;
  renderTraitLine();
}

function renderQuestion(question) {
  const selected = state.form.answers[question.id];
  return `
    <fieldset class="question">
      <h3>${esc(question.title)}</h3>
      <p>${esc(question.prompt)}</p>
      <div class="choice-row">
        ${question.options
          .map(
            (option) => `
            <button type="button" class="choice ${selected === option.id ? "is-on" : ""}" data-answer="${question.id}:${option.id}" aria-pressed="${selected === option.id}">
              <strong>${option.id}</strong>
              <small>${esc(option.label)}</small>
            </button>`
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function renderTraitLine() {
  const host = $("#trait-line");
  if (!host || !state.meta) return;
  const parts = state.meta.questions.map((question) => {
    const option = question.options.find((item) => item.id === state.form.answers[question.id]);
    return `<span>${esc(option ? option.value : "—")}</span>`;
  });
  host.innerHTML = `<p class="quiet">Voce che uscirà dal questionario: ${parts.join(" · ")}</p>`;
}

function renderRail() {
  const book = state.book;
  if (!book) {
    $("#rail").innerHTML = "";
    return;
  }
  const protagonist = book.book_config.protagonist;
  const home = book.story_state?.established_locations?.loc_home || "";
  const days = [];
  for (let day = 1; day <= book.book_config.total_days; day += 1) {
    const entry = book.days.find((item) => item.day === day);
    const current = day === book.book_config.current_day;
    const status = entry ? (entry.chapter.sealed ? "sigillato" : "aperto") : current ? "in corso" : "in attesa";
    days.push(`
      <button type="button" class="day-dot ${entry ? "is-written" : ""} ${current ? "is-now" : ""}" data-goto="${day}">
        <span>${roman(day)}</span>
        <small>${status}</small>
      </button>`);
  }
  const views = [
    ["studio", "Studio della giornata"],
    ["notebook", "Taccuino del narratore"],
    ["memory", "Memoria narrativa"],
    ["volume", "Volume"],
  ];
  $("#rail").innerHTML = `
    <div class="who">
      <p class="eyebrow">${esc(book.book_config.genre)}</p>
      <p class="name">${esc(protagonist.name)}</p>
      <p class="quiet">${esc(protagonist.age)} anni · ${esc(home)}</p>
      <p class="quiet">${esc(protagonist.metaphor_domain)}</p>
    </div>
    <nav class="day-list">${days.join("")}</nav>
    <nav>
      ${views
        .map(
          ([id, label]) =>
            `<button type="button" class="nav-btn ${state.view === id ? "is-current" : ""}" data-view="${id}">${label}</button>`
        )
        .join("")}
      <button type="button" class="nav-btn" id="new-cycle">Nuovo ciclo</button>
    </nav>
  `;
}

function showView(view) {
  state.view = view;
  $("#start").hidden = view !== "start";
  $("#workspace").hidden = view === "start";
  for (const name of ["studio", "notebook", "memory", "volume"]) {
    $(`#${name}`).hidden = view !== name;
  }
  renderChrome();
  if (view === "start") renderStart();
  if (!state.book || view === "start") return;
  renderRail();
  if (view === "studio") syncStudio();
  if (view === "notebook") renderNotebook();
  if (view === "memory") renderMemory();
  if (view === "volume") renderVolume();
}

function prepareDay() {
  const book = state.book;
  const day = book.book_config.current_day;
  if (book.draft?.day === day && Array.isArray(book.draft.slots)) {
    state.slots = hydrateSlots(book.draft.slots);
    state.date = book.draft.date || addDays(book.started_on, day - 1);
  } else {
    state.slots = hydrateSlots([]);
    state.date = addDays(book.started_on || state.meta.today, Math.max(day, 1) - 1);
  }
  state.payload = null;
  state.payloadText = "";
  state.activeSlot = 1;
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
  const key = `${state.book.id}:${state.book.book_config.current_day}`;
  if (state.mountedKey !== key) {
    prepareDay();
    mountStudio();
    state.mountedKey = key;
  }
}

function mountStudio() {
  const book = state.book;
  const closed = book.book_config.current_day > book.book_config.total_days;
  if (closed) {
    $("#studio").innerHTML = `
      <section class="panel">
        <p class="eyebrow">Ciclo concluso</p>
        <h2>I giorni di questo romanzo sono stati scritti.</h2>
        <p class="lede">Puoi rileggere il taccuino, controllare la memoria, oppure comporre il volume.</p>
        <button type="button" class="solid" data-view="volume">Vai al volume</button>
      </section>`;
    return;
  }

  const day = book.book_config.current_day;
  $("#studio").innerHTML = `
    <section>
      <p class="eyebrow">Giorno ${day} di ${book.book_config.total_days}</p>
      <h2 style="font-family: var(--serif); font-weight: 560; letter-spacing: -0.03em; margin-top: 0">Studio della giornata</h2>
      <p class="lede">Il modello non legge questi quattro moduli. Legge soltanto il JSON unico, dopo il Daily Merger.</p>
      <div class="preset-row">
        ${state.meta.presets
          .map(
            (preset) =>
              `<button type="button" class="choice" data-preset="${esc(preset.id)}" title="${esc(preset.description)}"><strong>${esc(preset.name)}</strong><small>${esc(preset.description)}</small></button>`
          )
          .join("")}
      </div>
      <label>Data della giornata simulata <input id="day-date" type="date" value="${esc(state.date)}"></label>
      <div class="tabs" id="slot-tabs" role="tablist"></div>
      <div class="panel" id="slot-form"></div>
      <div class="actions" style="margin: 0.9rem 0">
        <button type="button" class="ghost" id="merge">Esegui il Daily Merger</button>
        <button type="button" class="solid" id="simulate">Simula questo giorno</button>
      </div>
      <div class="panel">
        <p class="eyebrow">JSON unico</p>
        <div id="merge-summary"></div>
        <textarea id="payload-json" class="json" spellcheck="false" placeholder="Il merger scrive qui il DailyUnifiedPayload. Puoi anche incollarlo."></textarea>
        <label class="check" style="margin-top: 0.6rem">
          <input id="raw-json" type="checkbox" ${state.raw ? "checked" : ""}>
          Invia il JSON così com'è, senza riallineare profilo e memoria del ciclo
        </label>
        <div class="actions" style="margin-top: 0.7rem">
          <button type="button" class="ghost" id="from-json">Genera dal JSON</button>
          <button type="button" class="ghost" id="load-sample">Carica l'esempio delle specifiche</button>
        </div>
      </div>
    </section>
    <datalist id="weather-list">
      ${state.meta.weathers.map((weather) => `<option value="${esc(weather)}"></option>`).join("")}
    </datalist>
  `;
  $("#payload-json").value = state.payloadText;
  renderTabs();
  renderSlotForm();
  renderSummary(state.payload);
}

function renderTabs() {
  const host = $("#slot-tabs");
  if (!host) return;
  host.innerHTML = state.slots
    .map((slot, index) => {
      const def = state.meta.slots[index];
      return `
        <button type="button" class="tab ${slot.included ? "" : "is-off"}" role="tab" data-slot="${index}" aria-selected="${index === state.activeSlot}">
          <span>${esc(def.label)}</span>
          <small>${esc(def.range)}</small>
          <em data-tab-meta="${index}"></em>
        </button>`;
    })
    .join("");
  updateTabLabels();
}

function updateTabLabels() {
  state.slots.forEach((slot, index) => {
    const meta = document.querySelector(`[data-tab-meta="${index}"]`);
    const tab = document.querySelector(`[data-slot="${index}"]`);
    if (!meta || !tab) return;
    const places =
      slot.places.length === 1 ? "1 tappa" : slot.places.length ? `${slot.places.length} tappe` : "casa implicita";
    const minutes = Number(slot.doomscrolling_minutes) + Number(slot.messaging_minutes);
    meta.textContent = slot.included ? `${places} · ${minutes} min` : "escluso";
    tab.classList.toggle("is-off", !slot.included);
  });
}

function renderSlotForm() {
  const host = $("#slot-form");
  if (!host) return;
  const slot = state.slots[state.activeSlot];
  const def = state.meta.slots[state.activeSlot];
  host.innerHTML = `
    <p class="eyebrow">${esc(def.label)} · ${esc(def.range)}</p>
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
  `;
  renderPlaces();
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
    host.innerHTML = "";
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
  const last = book.days.at(-1);
  $("#notebook").innerHTML = `
    <p class="eyebrow">Taccuino del narratore</p>
    <h2 style="font-family: var(--serif); font-weight: 560;">Capitoli sigillati</h2>
    <p class="lede">Ogni capitolo nasce chiuso. Aprilo subito, oppure lascialo così fino al volume finale.</p>
    ${
      book.days.length
        ? ""
        : `<section class="panel"><p>Nessun capitolo, per ora. Simula il primo giorno dallo studio.</p></section>`
    }
    <div class="chapter-list">
      ${book.days.map((entry) => chapterCard(entry, last && entry.day === last.day)).join("")}
    </div>
  `;
}

function chapterCard(entry, isLast) {
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
          ${isLast ? `<button type="button" class="ghost" id="rewrite">Riscrivi con ${esc(engineName())}</button>` : ""}
        </div>
      </article>`;
  }
  const warnings = (chapter.warnings || []).map((warning) => `<li>${esc(warning)}</li>`).join("");
  return `
    <article class="sheet" id="chapter-${entry.day}">
      <p class="quiet">Capitolo ${roman(entry.day)} · ${esc(entry.date)} · ${chapter.words || "—"} parole · ${esc(chapter.model || "")}</p>
      <h3>${esc(chapter.chapter_title)}</h3>
      <div class="prose">${prose(chapter.chapter_text)}</div>
      ${warnings ? `<ul class="quiet">${warnings}</ul>` : ""}
      ${
        isLast
          ? `<button type="button" class="ghost no-print" id="rewrite">Riscrivi questo capitolo con ${esc(engineName())}</button>`
          : ""
      }
    </article>`;
}

function renderMemory() {
  const book = state.book;
  const memory = book.story_state;
  const locations = Object.entries(memory.established_locations || {})
    .map(([key, alias]) => `<li><code>${esc(key)}</code> — ${esc(alias)}</li>`)
    .join("");
  const list = (items) =>
    items?.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="quiet">Niente, per ora.</p>`;
  const last = book.days.at(-1);
  $("#memory").innerHTML = `
    <p class="eyebrow">StoryState</p>
    <h2 style="font-family: var(--serif); font-weight: 560;">Memoria del romanzo</h2>
    <div class="memory-grid">
      <section class="panel">
        <p class="eyebrow">Chiusura dell'ultimo capitolo</p>
        <p>${esc(CUTOFF[memory.last_chapter_ending_state] || memory.last_chapter_ending_state)}</p>
        <p>${esc(memory.previous_chapter_summary)}</p>
      </section>
      <section class="panel">
        <p class="eyebrow">Luoghi</p>
        <ul>${locations}</ul>
        <p class="eyebrow">Motivi</p>
        ${list(memory.recurring_motifs)}
        <p class="eyebrow">Tensioni aperte</p>
        ${list(memory.unresolved_tensions)}
      </section>
      ${
        last
          ? `<section class="panel">
              <p class="eyebrow">Ultimo JSON inviato</p>
              <pre class="json-view">${esc(JSON.stringify(last.payload, null, 2))}</pre>
              <details>
                <summary>Prompt di sistema usato per il capitolo ${last.day}</summary>
                <pre class="json-view">${esc(last.system_prompt || "Non archiviato.")}</pre>
              </details>
            </section>`
          : ""
      }
    </div>
  `;
}

function renderVolume() {
  const book = state.book;
  const missing = book.book_config.total_days - book.days.length;
  if (missing > 0) {
    $("#volume").innerHTML = `
      <section class="panel">
        <p class="eyebrow">Volume</p>
        <h2>Mancano ancora ${missing} ${missing === 1 ? "giorno" : "giorni"}.</h2>
        <p class="lede">Il romanzo si impagina quando ogni giorno del ciclo ha un capitolo.</p>
      </section>`;
    return;
  }

  const closing = book.closing;
  const sealed = book.days.some((entry) => entry.chapter.sealed);
  $("#volume").innerHTML = `
    <div class="actions no-print" style="margin-bottom: 1rem">
      <button type="button" class="solid" id="compose">${closing ? "Riscrivi frontespizio e quarta" : "Componi frontespizio e quarta"}</button>
      ${sealed ? `<button type="button" class="ghost" id="open-all">Spezza i sigilli e mostra il romanzo</button>` : ""}
      ${closing ? `<button type="button" class="ghost" id="print">Stampa o salva in PDF</button>` : ""}
    </div>
    ${
      closing
        ? `<article class="book">
            <header class="cover">
              <p class="eyebrow">${esc(book.book_config.genre)}</p>
              <h2>${esc(closing.book_title)}</h2>
              <p>${esc(closing.subtitle || "")}</p>
              <p class="epigraph">${esc(closing.epigraph || "")}</p>
              <p class="quiet">${esc(book.book_config.protagonist.name)}</p>
            </header>
            ${book.days.map((entry) => volumeChapter(entry)).join("")}
            <section class="back-cover">
              <p class="eyebrow">Quarta</p>
              <div class="prose">${prose(closing.back_cover)}</div>
            </section>
          </article>`
        : `<section class="panel"><p>I capitoli ci sono. Manca ancora il frontespizio: lo chiede ${esc(engineName())} all'arco intero.</p></section>`
    }
  `;
}

function volumeChapter(entry) {
  if (entry.chapter.sealed) {
    return `
      <section class="sheet" style="margin-top: 1rem">
        <div class="seal">${roman(entry.day)}</div>
        <h3>Capitolo ${roman(entry.day)}</h3>
        <p>Ancora sigillato.</p>
      </section>`;
  }
  return `
    <section style="margin-top: 1.6rem">
      <p class="quiet">Capitolo ${roman(entry.day)}</p>
      <h3>${esc(entry.chapter.chapter_title)}</h3>
      <div class="prose">${prose(entry.chapter.chapter_text)}</div>
    </section>`;
}

function applyProfile(profile) {
  state.form = {
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    total_days: profile.total_days,
    genre: profile.genre,
    answers: { ...profile.answers },
  };
  renderStart();
}

function formProblems() {
  const form = state.form;
  if (!form.name.trim()) return "Manca il nome.";
  if (!form.gender) return "Scegli il genere anagrafico.";
  if (!form.genre) return "Scegli il genere letterario.";
  const missing = state.meta.questions.find((question) => !form.answers[question.id]);
  if (missing) return `Manca una risposta: ${missing.title}.`;
  return "";
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
    showView("studio");
    setBanner("ok", `Ciclo di ${book.book_config.protagonist.name} aperto. La casa si chiama ${book.story_state.established_locations.loc_home}.`);
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
    showView("studio");
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
    showView("start");
  } catch (error) {
    setBanner("error", error.message);
  }
}

async function loadPreset(id) {
  try {
    const preset = state.meta.presets.find((item) => item.id === id);
    const { slots } = await api(`/api/presets/${id}`);
    state.slots = hydrateSlots(slots);
    renderTabs();
    renderSlotForm();
    setBanner("ok", preset ? preset.description : "Preset caricato.");
  } catch (error) {
    setBanner("error", error.message);
  }
}

async function mergeSlots() {
  setBanner("", "");
  setBusy("Il merger sta cucendo i quattro slot…");
  try {
    const { payload, book } = await api(`/api/books/${state.book.id}/merge`, {
      method: "POST",
      body: { date: state.date, slots: slotsForApi() },
    });
    if (book) state.book = book;
    else state.book.draft = { day: state.book.book_config.current_day, date: state.date, slots: slotsForApi() };
    applyPayload(payload);
    setBanner("ok", "JSON unico pronto. Controlla le scene, poi simula il giorno oppure genera da questo testo.");
  } catch (error) {
    setBanner("error", error.message);
  } finally {
    setBusy("");
  }
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
      body,
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
    showView("notebook");
    const card = document.getElementById(`chapter-${result.book.days.at(-1).day}`);
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    updateTabLabels();
    return;
  }

  if (!event.target.closest("#start-form")) return;
  const el = event.target;
  if (el.name === "name") state.form.name = el.value;
  if (el.name === "age") state.form.age = Number(el.value);
  if (el.name === "total_days") {
    state.form.total_days = Number(el.value);
    const output = $("#days-out");
    if (output) output.textContent = `${el.value} giorni`;
  }
}

async function onClick(event) {
  const preset = event.target.closest("[data-preset]");
  const slotTab = event.target.closest("[data-slot]");
  const removePlace = event.target.closest("[data-remove-place]");
  const profile = event.target.closest("[data-profile]");
  const open = event.target.closest("[data-open]");
  const remove = event.target.closest("[data-delete]");
  const gender = event.target.closest("[data-gender]");
  const genre = event.target.closest("[data-genre]");
  const answer = event.target.closest("[data-answer]");
  const view = event.target.closest("[data-view]");
  const goto = event.target.closest("[data-goto]");
  const openChapter = event.target.closest("[data-open-chapter]");

  if (event.target.closest("#brand") || event.target.closest("#new-cycle")) {
    showView("start");
    return;
  }
  if (event.target.closest("#back-to-book") && state.book) {
    showView("studio");
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
  if (profile) {
    const found = state.meta.profiles.find((item) => item.id === profile.dataset.profile);
    if (found) applyProfile(found);
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
  if (event.target.closest("#create-book")) {
    await createCycle();
    return;
  }
  if (gender) {
    state.form.gender = gender.dataset.gender;
    markPressed("[data-gender]", state.form.gender, "data-gender");
    return;
  }
  if (genre) {
    state.form.genre = genre.dataset.genre;
    markPressed("[data-genre]", state.form.genre, "data-genre");
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
    renderTraitLine();
    return;
  }
  if (view) {
    showView(view.dataset.view);
    return;
  }
  if (goto) {
    const day = Number(goto.dataset.goto);
    const entry = state.book.days.find((item) => item.day === day);
    if (entry) {
      showView("notebook");
      document.getElementById(`chapter-${day}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (day === state.book.book_config.current_day) showView("studio");
    return;
  }
  if (preset) {
    await loadPreset(preset.dataset.preset);
    return;
  }
  if (slotTab) {
    state.activeSlot = Number(slotTab.dataset.slot);
    renderTabs();
    renderSlotForm();
    return;
  }
  if (event.target.closest("#add-place")) {
    state.slots[state.activeSlot].places.push(blankPlace(state.slots[state.activeSlot].id));
    renderPlaces();
    updateTabLabels();
    return;
  }
  if (removePlace) {
    state.slots[state.activeSlot].places.splice(Number(removePlace.dataset.removePlace), 1);
    renderPlaces();
    updateTabLabels();
    return;
  }
  if (event.target.closest("#merge")) {
    await mergeSlots();
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
  if (event.target.closest("#open-all")) {
    await mutateBook(`/api/books/${state.book.id}/open-all`, "volume");
    return;
  }
  if (event.target.closest("#rewrite")) {
    if (!confirm(`${engineName()} riscrive l'ultimo capitolo e lo sigilla di nuovo. La memoria torna a prima di quel giorno.`)) return;
    await generate({ regenerate: true }, `${engineName()} sta riscrivendo l'ultimo capitolo.`);
    return;
  }
  if (event.target.closest("#compose")) {
    if (!state.meta.llm.configured) {
      setBanner("error", `Manca la chiave API ${engineName()}.`);
      $("#settings").showModal();
      return;
    }
    setBusy(`${engineName()} sta componendo frontespizio e quarta…`);
    try {
      const result = await api(`/api/books/${state.book.id}/close`, {
        method: "POST",
        body: { force: Boolean(state.book.closing) },
        signal: typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(120000)
          : undefined,
      });
      state.book = result.book;
      renderVolume();
      setBanner("ok", `Il volume si intitola «${result.book.closing.book_title}».`);
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
    showView(view);
  } catch (error) {
    setBanner("error", error.message);
  }
}

function markPressed(selector, value, attr) {
  document.querySelectorAll(selector).forEach((button) => {
    const on = button.getAttribute(attr) === value;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function bind() {
  document.addEventListener("click", (event) => {
    onClick(event).catch((error) => setBanner("error", error.message));
  });
  document.addEventListener("input", onField);
  document.addEventListener("change", (event) => {
    if (event.target.id === "day-date") state.date = event.target.value;
    if (event.target.id === "raw-json") state.raw = event.target.checked;
    if (event.target.dataset?.placeField || event.target.dataset?.field) onField(event);
  });
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
  try {
    const [meta, library] = await Promise.all([api("/api/meta"), api("/api/books")]);
    state.meta = meta;
    state.books = library.books;
    state.date = meta.today;
    fillModelSelect();
    renderChrome();
    renderStart();
  } catch (error) {
    setBanner("error", error.message);
  }
}

boot();
