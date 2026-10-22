import test from "node:test";
import assert from "node:assert/strict";
import { samplePayload } from "./sample.js";
import { bridgeFromYesterday, dramaticEvents, lastSceneOf, materialBlock } from "./dramaturgy.js";
import { normalizePlan, styleIssuesInDraft } from "./narrator.js";
import {
  findProfileLabels,
  findScaffolding,
  fixPrepositions,
  opensWithWakeUp,
  roughClock,
  titleOverlap,
} from "./transfiguration.js";

test("il materiale drammatico mette in testa appunti, luoghi nuovi e picchi da fermo", () => {
  const events = dramaticEvents(samplePayload);
  assert.match(events[0], /^APPUNTO/);
  assert.ok(events.some((event) => /^LUOGO NUOVO NEL LIBRO/.test(event)));
  assert.ok(events.some((event) => /^PICCO A CORPO FERMO/.test(event)));
  assert.ok(events.some((event) => /^FINE GIORNATA FUORI CASA/.test(event)));
  // Le cifre della biometria non passano nel materiale.
  assert.ok(events.every((event) => !/bpm|\d{2,3}\s*%/.test(event)));
});

test("il ponte da ieri riparte dal cliffhanger e dalla sua ultima frase", () => {
  const payload = structuredClone(samplePayload);
  payload.story_state_memory.last_chapter_ending_state = "OUTSIDE_CLIFFHANGER";
  payload.story_state_memory.last_scene = { place: "via Pacini", at: "in via Pacini", when: "da poco dopo le ventuno a mezzanotte" };
  payload.today_unified_telemetry.unified_scenes = [
    { time_window: "00:17 - 05:25", location_id: "loc_home", location_alias: "casa", location_at: "a casa", user_notes: [] },
    ...payload.today_unified_telemetry.unified_scenes,
  ];
  payload.story_state_memory.closings = ["Che cosa lo trattiene ancora sulla soglia?"];
  const bridge = bridgeFromYesterday(payload);
  assert.match(bridge, /Ieri il capitolo si è chiuso in via Pacini/);
  assert.match(bridge, /Ultima frase di ieri: «Che cosa lo trattiene ancora sulla soglia\?»/);
  assert.match(bridge, /Oggi si riparte da lì, dalla mezzanotte: la prima traccia lo trova già a casa poco dopo mezzanotte/);
  assert.doesNotMatch(bridge, /documentat/);
  // Una memoria scritta prima dei luoghi veri non ha `at`: la preposizione si articola lo stesso.
  payload.story_state_memory.last_scene = { place: "Il Luogo della Soglia", when: "a mezzanotte" };
  assert.match(materialBlock(payload), /chiuso al Luogo della Soglia/);
});

test("l'ultima scena entra nella memoria con il suo nome vero e il modo di dirlo", () => {
  const last = lastSceneOf(samplePayload);
  assert.equal(last.place, "via Pacini");
  assert.equal(last.at, "in via Pacini");
  assert.match(last.when, /verso le diciannove e mezza/);
});

test("le preposizioni davanti ai nomi propri si articolano", () => {
  assert.equal(
    fixPrepositions("Uscì de La Casa, passò a Il Tavolo e finì ne L'Archivio. De La Casa restava poco."),
    "Uscì della Casa, passò al Tavolo e finì nell'Archivio. Della Casa restava poco."
  );
  assert.equal(fixPrepositions("La Casa resta. Andò a Lisbona."), "La Casa resta. Andò a Lisbona.");
});

test("le ore si dicono come le direbbe una persona", () => {
  assert.equal(roughClock("06:49"), "poco prima delle sette");
  assert.equal(roughClock("07:25"), "verso le sette e mezza");
  assert.equal(roughClock("12:10"), "poco dopo mezzogiorno");
  assert.equal(roughClock("00:50"), "poco prima dell'una");
});

test("impalcatura, etichette, risveglio e titoli riciclati si riconoscono", () => {
  const protagonist = { emotional_reactivity: "Razionale / Analitico", archetype: "L'Atleta / Cinestetico", narrative_focus: "Satirico" };
  assert.deepEqual(findScaffolding("L'obiettivo era uscire, ma l'ostacolo arrivò. Il punto di svolta affiorò."), [
    "L'obiettivo era",
    "l'ostacolo",
    "punto di svolta",
  ]);
  assert.deepEqual(findProfileLabels("lo sguardo analitico e il passo da atleta", protagonist), ["analitico", "atleta"]);
  assert.equal(opensWithWakeUp("Il suono tagliente interruppe il torpore delle otto. Poi uscì."), true);
  assert.equal(opensWithWakeUp("Via del Portico era già piena di vento."), false);
  assert.deepEqual(titleOverlap("La Geometria del Vento", ["La Geometria del Limite"]), ["geometria"]);

  const issues = styleIssuesInDraft(
    {
      chapter_title: "La Geometria del Vento",
      chapter_text: "Il richiamo metallico ruppe il sonno. L'obiettivo era uscire, con lo sguardo analitico fisso sullo specchio nero.",
    },
    { currentDay: 3, protagonist, usedTitles: ["La Geometria del Limite"] }
  );
  for (const expected of ["si apre con il risveglio", "parole del mestiere", "etichette del profilo", "schermo compare", "titolo ricicla"]) {
    assert.ok(issues.some((issue) => issue.includes(expected)), `manca: ${expected}`);
  }
});

test("un copione senza desiderio o domanda finale non si usa", () => {
  assert.equal(normalizePlan({ titolo: "Solo un titolo" }, samplePayload), null);
  const plan = normalizePlan(
    {
      through_line: "Tornerà de La Panchina?",
      desiderio: "tornare alla panchina",
      nuovi_luoghi: { loc_unknown_via_pacini: "Il Cortile della Pioggia" },
      atto_2: { scene: [{ luogo: "Il Giardino", obiettivo: "sedersi" }], svolta: "il risotto" },
      atto_3: { domanda_finale: "chi lo aspettava?" },
    },
    samplePayload
  );
  assert.equal(plan.through_line, "Tornerà della Panchina?");
  // I luoghi non si battezzano più: un nome proposto dal copione si ignora.
  assert.equal("nuovi_luoghi" in plan, false);
});

test("il materiale nomina i luoghi veri e non chiede battesimi", () => {
  const block = materialBlock(samplePayload);
  assert.doesNotMatch(block, /battezz|ancora senza nome|Luogo sconosciuto/);
  assert.match(block, /LUOGO NUOVO NEL LIBRO — via Pacini \(Città Studi, Milano\)/);
  assert.ok(dramaticEvents(samplePayload).some((event) => /APPUNTO — Parco Sempione/.test(event)));
});
