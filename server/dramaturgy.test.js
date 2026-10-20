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
  assert.ok(events.some((event) => /^LUOGO MAI VISTO/.test(event)));
  assert.ok(events.some((event) => /^PICCO A CORPO FERMO/.test(event)));
  assert.ok(events.some((event) => /^FINE GIORNATA FUORI CASA/.test(event)));
  // Le cifre della biometria non passano nel materiale.
  assert.ok(events.every((event) => !/bpm|\d{2,3}\s*%/.test(event)));
});

test("il ponte da ieri segnala un rientro non documentato", () => {
  const payload = structuredClone(samplePayload);
  payload.story_state_memory.last_chapter_ending_state = "OUTSIDE_CLIFFHANGER";
  payload.story_state_memory.last_scene = { place: "Il Luogo della Soglia", when: "da poco dopo le ventuno a mezzanotte" };
  payload.today_unified_telemetry.unified_scenes = [
    { time_window: "00:17 - 05:25", location_id: "loc_home", location_alias: "La Casa", user_notes: [] },
    ...payload.today_unified_telemetry.unified_scenes,
  ];
  const bridge = bridgeFromYesterday(payload);
  assert.match(bridge, /Ieri il capitolo si è chiuso a Il Luogo della Soglia/);
  assert.match(bridge, /Il rientro non è documentato/);
  // Nel blocco finale la preposizione è già articolata.
  assert.match(materialBlock(payload), /chiuso al Luogo della Soglia/);
});

test("l'ultima scena entra nella memoria con il nome battezzato", () => {
  const last = lastSceneOf(samplePayload, { loc_unknown_est_new: "Il Cortile della Pioggia" });
  assert.equal(last.place, "Il Cortile della Pioggia");
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
      nuovi_luoghi: { loc_unknown_est_new: "Il Cortile della Pioggia", loc_inventato: "Altrove" },
      atto_2: { scene: [{ luogo: "Il Giardino", obiettivo: "sedersi" }], svolta: "il risotto" },
      atto_3: { domanda_finale: "chi lo aspettava?" },
    },
    samplePayload
  );
  assert.equal(plan.through_line, "Tornerà della Panchina?");
  assert.deepEqual(plan.nuovi_luoghi, { loc_unknown_est_new: "Il Cortile della Pioggia" });
});

test("il copione scarta nomi di luogo con mestieri non documentati", () => {
  const plan = normalizePlan(
    {
      desiderio: "tornare a ovest",
      nuovi_luoghi: { loc_unknown_est_new: "L'Officina delle Ombre" },
      atto_2: { scene: [{ luogo: "Via", obiettivo: "camminare" }] },
      atto_3: { domanda_finale: "tornerà?" },
    },
    samplePayload
  );
  assert.deepEqual(plan.nuovi_luoghi, {});
});
