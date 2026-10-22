import test from "node:test";
import assert from "node:assert/strict";
import { samplePayload } from "./sample.js";
import { dramaticEvents, materialBlock, nightOf, strongEventsOf, threadSeed } from "./dramaturgy.js";
import { buildPlanPrompt, buildClosingPrompt } from "./prompts.js";
import { normalizePlan, sanitizeState, styleIssuesInDraft } from "./narrator.js";
import { findDataLeaks, findSentenceEcho, fixPrepositions, lastSentence, sharedRun } from "./transfiguration.js";

// Giornata tipo con dati veri: sonno in casa, lavoro, rientro.
function realDay({ day = 2, peak = false, ending = "AT_HOME_RESTING", nightAway = false } = {}) {
  const payload = structuredClone(samplePayload);
  payload.book_config.current_day = day;
  payload.story_state_memory.last_chapter_ending_state = ending;
  payload.story_state_memory.established_locations = {
    loc_home: "casa",
    loc_work_via_dante: "il lavoro in via Dante",
  };
  // Dal giorno 2 casa e lavoro sono già comparsi nel libro: sono la vita di sempre.
  payload.story_state_memory.seen_locations = ["loc_home", "loc_work_via_dante"];
  payload.today_unified_telemetry.wake_up_event = { time: "07:05" };
  payload.today_unified_telemetry.midnight_cutoff_status = "AT_HOME_RESTING";
  payload.today_unified_telemetry.unified_scenes = [
    nightAway
      ? { time_window: "00:20 - 05:40", location_id: "loc_work_via_dante", location_alias: "il lavoro in via Dante", location_at: "al lavoro, in via Dante", location_area: "Cordusio, Milano", biometric_vibe: "Corpo fermo, stress moderato", user_notes: [] }
      : { time_window: "00:12 - 05:30", location_id: "loc_home", location_alias: "casa", location_at: "a casa, all'Isola", location_area: "Isola, Milano", biometric_vibe: "Corpo fermo, ritmo medio 55 bpm", user_notes: [] },
    {
      time_window: "08:50 - 17:40",
      location_id: "loc_work_via_dante", location_alias: "il lavoro in via Dante", location_at: "al lavoro, in via Dante", location_area: "Cordusio, Milano",
      biometric_vibe: peak ? "Corpo fermo, picco improvviso di tachicardia da fermo alle 15:22 (HR 143 bpm)" : "Corpo fermo",
      user_notes: [],
    },
    { time_window: "19:15 - 23:20", location_id: "loc_home", location_alias: "casa", location_at: "a casa, all'Isola", location_area: "Isola, Milano", biometric_vibe: "Corpo fermo", user_notes: [] },
  ];
  return payload;
}

test("una notte in casa a corpo fermo è sonno: niente scene notturne inventate", () => {
  const night = nightOf(realDay());
  assert.match(night, /^Notte: sonno in casa fino al risveglio, poco dopo le sette/);
  assert.match(night, /Marco dorme, quindi niente gesti/);
  assert.match(materialBlock(realDay()), /Notte: sonno in casa/);
});

test("una notte fuori casa è la prima scena del capitolo", () => {
  const payload = realDay({ nightAway: true });
  assert.match(nightOf(payload), /^Notte: fuori casa, al lavoro, in via Dante/);
  assert.ok(dramaticEvents(payload).some((event) => /^NOTTE FUORI CASA/.test(event)));
});

test("dopo un cliffhanger la notte è ripresa, poi sonno", () => {
  const payload = realDay({ ending: "OUTSIDE_AWAY" });
  payload.story_state_memory.last_scene = { location_id: "loc_work_via_dante", place: "il lavoro in via Dante", at: "al lavoro, in via Dante", when: "fino a tardi" };
  assert.match(nightOf(payload), /^Notte: dopo il ritorno, sonno in casa/);
  assert.match(materialBlock(payload), /Oggi si riparte da lì/);
});

test("il primo giorno nessun luogo è «mai visto»: è la vita di sempre", () => {
  const payload = realDay({ day: 1 });
  payload.story_state_memory = {};
  assert.ok(dramaticEvents(payload).every((event) => !/^LUOGO NUOVO/.test(event)));
  assert.equal(threadSeed(payload), "");
  assert.match(materialBlock(payload), /mai «per la prima volta»/);
});

test("un picco che torna nello stesso luogo diventa ricorrenza", () => {
  const first = realDay({ day: 4, peak: true });
  const logged = strongEventsOf(first);
  assert.deepEqual(logged, [{ day: 4, kind: "peak_at_rest", location_id: "loc_work_via_dante" }]);
  assert.ok(dramaticEvents(first).some((event) => /^PICCO A CORPO FERMO/.test(event)));

  const second = realDay({ day: 5, peak: true });
  second.story_state_memory.event_log = logged;
  const events = dramaticEvents(second);
  assert.match(events[0], /^RICORRENZA — il lavoro in via Dante/);
  assert.match(events[0], /già il giorno 4/);
  assert.doesNotMatch(threadSeed(second), /tornerà/i);
});

test("i semi del filo non chiedono più «ci tornerà?»", () => {
  assert.doesNotMatch(threadSeed(realDay({ peak: true })), /tornerà/i);
});

test("note di regia e orari al minuto non passano nella prosa", () => {
  assert.deepEqual(
    findDataLeaks("Il rientro non documentato. Il vuoto temporale. Si ferma alle quindici e trentacinque, verso le sette e mezza."),
    ["non documentato", "vuoto temporale", "alle quindici e trentacinque"]
  );
  // L'ora di un appunto si può dire esatta.
  assert.deepEqual(findDataLeaks("Scrisse alle ventuno e venti.", ["alle ventuno e venti"]), []);
});

test("finali e aperture che ricalcano i capitoli precedenti si riconoscono", () => {
  const closings = ["Tornerà a Via dei Bastioni Sospesi, ora che il corpo ha memorizzato quel sussulto segreto?"];
  assert.ok(findSentenceEcho("Tornerà al Lavoro, adesso che sa?", closings));
  assert.ok(findSentenceEcho("Riuscirà a restare, ora che il corpo ha memorizzato tutto?", closings, ["Via dei Bastioni Sospesi"]));
  assert.equal(findSentenceEcho("La mano resta sulla maniglia, senza decidere.", closings), "");
  assert.equal(lastSentence("Primo. Secondo paragrafo.\n\nE adesso?"), "E adesso?");

  const issues = styleIssuesInDraft(
    {
      chapter_title: "Il sale",
      chapter_subtitle: "Cronaca di un lunedì",
      chapter_text: "La vernice azzurra della cornice trattiene la pioggia. Il rientro non documentato pesa.\n\nTornerà a casa, ora che sa?",
    },
    {
      currentDay: 3,
      closings,
      openings: ["La luce filtra mentre la vernice azzurra della cornice trattiene il brivido."],
    }
  );
  for (const expected of ["lessico da registro", "ricalca il finale", "apertura precedente", "cronaca o un diario"]) {
    assert.ok(issues.some((issue) => issue.includes(expected)), `manca: ${expected}`);
  }
});

test("le tensioni restituite come oggetti non diventano «[object Object]»", () => {
  const state = sanitizeState({ unresolved_tensions: [{ tensione: "notte al Lavoro", momento: "tarda sera" }, "appunto aperto"] }, {});
  assert.deepEqual(state.unresolved_tensions, ["notte al Lavoro — tarda sera", "appunto aperto"]);
  const kept = sanitizeState({}, { closings: ["E adesso?"], event_log: [{ day: 1, kind: "peak_at_rest" }] });
  assert.deepEqual(kept.closings, ["E adesso?"]);
  assert.equal(kept.event_log.length, 1);
});

test("ogni capitolo chiede un prodigio, anche nei libri salvati con un altro genere", () => {
  const { system } = buildPlanPrompt(realDay());
  assert.match(system, /Prodigio \(obbligatorio\)/);
  assert.match(system, /"prodigio"/);
  assert.match(system, /figura di sfondo senza nome/);
  assert.match(system, /Mai chiedere se tornerà in un luogo di routine/);
  const old = realDay();
  old.book_config.genre = "Noir / Hardboiled";
  assert.match(buildPlanPrompt(old).system, /Prodigio \(obbligatorio\)/);
  assert.doesNotMatch(buildPlanPrompt(old).system, /Noir/);
  const plan = normalizePlan(
    { desiderio: "uscire prima", prodigio: "la porta ricorda il suo passo", atto_2: { scene: [{ luogo: "Lavoro", presenza: "un collega senza nome" }] }, atto_3: { domanda_finale: "e se restasse?" } },
    realDay()
  );
  assert.equal(plan.prodigio, "la porta ricorda il suo passo");
  assert.equal(plan.atto_2.scene[0].presenza, "un collega senza nome");
});

test("la quarta non ricopia l'incipit e non parla da copione", () => {
  const book = {
    book_config: samplePayload.book_config,
    days: [{ day: 1, chapter: { chapter_title: "Uno", chapter_text: "La luce delle undici si taglia a metà contro i mattoni grezzi." }, story_state_after: {} }],
  };
  assert.match(buildClosingPrompt(book).system, /nessuna frase ripresa dai capitoli, nemmeno l'incipit/);
  assert.ok(sharedRun("Apre così: la luce delle undici si taglia a metà contro i mattoni.", [book.days[0].chapter.chapter_text]));
  assert.equal(sharedRun("Un uomo cammina sotto il vento.", [book.days[0].chapter.chapter_text]), "");
});

test("un luogo già frequentato non torna «nuovo»", () => {
  const payload = realDay({ day: 2 });
  payload.story_state_memory.seen_locations = ["loc_home"];
  assert.ok(dramaticEvents(payload).some((event) => /^LUOGO NUOVO NEL LIBRO — il lavoro in via Dante \(Cordusio, Milano\)/.test(event)));
  payload.story_state_memory.seen_locations = ["loc_home", "loc_work_via_dante"];
  assert.ok(dramaticEvents(payload).every((event) => !/^LUOGO NUOVO NEL LIBRO/.test(event)));
});

test("orari al minuto con preposizione articolata e finali che iniziano col nome", () => {
  assert.deepEqual(findDataLeaks("il picco immobile delle sedici e quarantatré"), ["delle sedici e quarantatré"]);
  const before = ["Mirko osserva quel segno asciugarsi lentamente."];
  assert.equal(findSentenceEcho("Mirko rimane con le dita tese sul pennino.", before, ["Mirko"]), "");
});

test("le preposizioni non mangiano le parole che cominciano come un articolo", () => {
  assert.equal(fixPrepositions("sveglio a Lavoro, vento di Levante, ne L'Archivio, a La Casa"), "sveglio a Lavoro, vento di Levante, nell'Archivio, alla Casa");
});

test("si sostituisce solo l'ultima frase del capitolo", async () => {
  const { replaceLastSentence } = await import("./narrator.js");
  assert.equal(replaceLastSentence("Uno. Due.\n\nTre resta? Quattro.", "Cinque?"), "Uno. Due.\n\nTre resta? Cinque?");
});

test("i semi del filo dicono il luogo vero, con la sua preposizione", () => {
  const payload = realDay({ day: 2, nightAway: true });
  payload.story_state_memory.seen_locations = ["loc_home"];
  // Luogo nuovo: il seme lo nomina come lo si dice.
  assert.match(threadSeed(payload), /^Che cosa è andato a cercare Marco al lavoro, in via Dante, fuori dalle sue strade\?$/);
  // Luogo già frequentato: vince la notte fuori.
  payload.story_state_memory.seen_locations = ["loc_home", "loc_work_via_dante"];
  assert.match(threadSeed(payload), /sveglio al lavoro, in via Dante mentre la città dorme/);
});

test("il copione non dichiara gli atti", () => {
  const issues = styleIssuesInDraft({ chapter_title: "Il vento", chapter_subtitle: "Ultimo atto prima della pioggia", chapter_text: "Testo." }, { currentDay: 2 });
  assert.ok(issues.some((issue) => issue.includes("parole del mestiere")));
});

test("il prodigio non si nomina e il finale sostituito comincia maiuscolo", async () => {
  const { replaceLastSentence } = await import("./narrator.js");
  const { findScaffolding } = await import("./transfiguration.js");
  assert.deepEqual(findScaffolding("Si ferma a contemplare quel prodigio silenzioso."), ["prodigio"]);
  assert.equal(replaceLastSentence("Uno. Due.", "quante volte ancora?"), "Uno. Quante volte ancora?");
});
