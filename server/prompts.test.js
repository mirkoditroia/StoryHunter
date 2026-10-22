import test from "node:test";
import assert from "node:assert/strict";
import { samplePayload } from "./sample.js";
import { arcAct, buildClosingPrompt, buildPlanPrompt, buildSystemPrompt, buildUserPrompt, dayView, plainBody, plainWeather } from "./prompts.js";
import { countHeartbeats, findEchoes, findMeasures } from "./transfiguration.js";

const plan = {
  through_line: "Marco riuscirà a dire le parole rimaste sospese?",
  desiderio: "tornare alla panchina di ieri prima che il gabbiano se ne vada",
  atto_2: { scene: [{ luogo: "Parco Sempione", obiettivo: "sedersi" }], svolta: "il risotto bruciato" },
  atto_3: { domanda_finale: "chi era seduto al tavolo con lui?" },
};

test("il drammaturgo riceve materiale scelto, arco e regole del copione", () => {
  const { system, user } = buildPlanPrompt(samplePayload);
  assert.match(system, /Sei il Drammaturgo/);
  assert.match(system, /SECONDO ATTO del romanzo/);
  assert.match(system, /Filo conduttore: lo fondi oggi, da questo seme/);
  assert.match(system, /Materiale drammatico di oggi, dal più forte/);
  assert.match(system, /panchina di ieri/);
  assert.match(system, /LUOGO NUOVO NEL LIBRO/);
  assert.match(system, /Vietate le astrazioni: perimetro, confine/);
  assert.match(system, /mai il risveglio/);
  assert.match(system, /Realismo magico: il quotidiano è preciso/);
  // Le parole del profilo sono vietate per nome.
  assert.match(system, /autoironi…, sarcasti…/);
  assert.match(system, /"domanda_finale"/);
  assert.match(user, /"scenes"/);
  assert.ok(system.length < 12000, `prompt del drammaturgo troppo lungo: ${system.length}`);
});

test("il narratore segue il copione e conosce i divieti di scena", () => {
  const system = buildSystemPrompt(samplePayload, plan);
  const user = buildUserPrompt(samplePayload);
  assert.match(system, /Sei il Narratore/);
  assert.match(system, /COPIONE DEL DRAMMATURGO — vincolante/);
  assert.match(system, /tornare alla panchina di ieri/);
  assert.match(system, /Mostra, non riassumere/);
  assert.match(system, /discorso indiretto libero/);
  assert.match(system, /vietate le parole obiettivo, ostacolo, esito, svolta/);
  assert.match(system, /mai il risveglio come prima frase/);
  assert.match(system, /mai «de La», «a Il», «ne L'»/);
  assert.match(system, /niente «specchio nero»/);
  assert.match(system, /sedici gradi/);
  assert.match(system, /19:00/);
  assert.match(system, /va a dormire/);
  assert.match(system, / OUTSIDE_CLIFFHANGER\./);
  assert.match(system, /550-800 parole, 6-9 paragrafi/);
  assert.match(system, /nei luoghi veri dei dati/);
  assert.doesNotMatch(system, /battezz/);
  assert.match(user, /Controllo finale/);
  assert.match(user, /prima frase = immagine d'apertura/);
  assert.ok(system.length < 14000, `system prompt troppo lungo: ${system.length}`);
});

test("senza copione il narratore pianifica da sé", () => {
  const system = buildSystemPrompt(samplePayload, null);
  assert.match(system, /Nessun copione disponibile/);
});

test("il primo giorno fonda il filo e presenta il personaggio", () => {
  const payload = structuredClone(samplePayload);
  payload.book_config.current_day = 1;
  const { system } = buildPlanPrompt(payload);
  assert.match(system, /PRIMO ATTO del romanzo/);
  assert.match(system, /Marco, 27 anni/);
  assert.match(system, /ritratto del protagonista in azione/);
  assert.doesNotMatch(system, /Ponte da ieri/);
  assert.match(buildUserPrompt(payload), /ritratto in azione/);
});

test("l'ultimo giorno è il culmine, il filo stabilito e la memoria tornano nel prompt", () => {
  const payload = structuredClone(samplePayload);
  payload.book_config.current_day = 5;
  payload.story_state_memory.through_line = "Marco riuscirà a dire le parole rimaste sospese?";
  payload.story_state_memory.through_line_locked = true;
  payload.story_state_memory.character_portrait = "Scherza per non esporsi.";
  payload.story_state_memory.used_titles = ["La Geometria del Limite"];
  payload.story_state_memory.openings = ["Il suono tagliente interruppe il torpore."];
  const { system } = buildPlanPrompt(payload);
  assert.match(system, /TERZO ATTO del romanzo/);
  assert.match(system, /stabilito, non riformularlo/);
  assert.match(system, /Scherza per non esporsi/);
  assert.match(system, /Titoli già usati .*Geometria del Limite/);
  assert.match(system, /Aperture già usate .*suono tagliente/);
  assert.equal(arcAct(1, 3), 1);
  assert.equal(arcAct(2, 3), 2);
  assert.equal(arcAct(3, 3), 3);
});

test("la chiusura domestica non forza un cliffhanger", () => {
  const payload = structuredClone(samplePayload);
  payload.today_unified_telemetry.midnight_cutoff_status = "AT_HOME_RESTING";
  const system = buildSystemPrompt(payload);
  assert.match(system, /AT_HOME_RESTING/);
  assert.match(system, /chiusura in casa/);
});

test("il bollettino numerico si riconosce, la metafora no", () => {
  const bulletin =
    "sedici gradi centigradi misuravano l'aria e l'umidità toccava il sessantadue percento, con settanta pulsazioni al minuto e la saturazione dell'ossigeno al novantotto percento";
  assert.ok(findMeasures(bulletin).length >= 3);
  assert.deepEqual(findMeasures("La notte restava ferma e il fiato di Mirko teneva un passo lento."), []);
});

test("battiti ripetuti ed echi si riconoscono", () => {
  const tic =
    "Il cuore di Marco teneva il tempo, il polso saliva, le pulsazioni scandivano la sera e il battito tornava nel buio.";
  assert.ok(countHeartbeats(tic) >= 4);
  assert.equal(countHeartbeats("Marco attraversò la strada e guardò il parco."), 0);
  assert.deepEqual(findEchoes("Quando varcò la soglia, l'asfalto del corridoio d'asfalto del centro chiese subito pegno."), [
    "asfalto",
  ]);
  assert.deepEqual(findEchoes("Marco uscì di casa e raggiunse il parco sotto la pioggia."), []);
});

test("un picco in movimento non entra nel nucleo", () => {
  const payload = structuredClone(samplePayload);
  payload.today_unified_telemetry.unified_scenes =
    payload.today_unified_telemetry.unified_scenes.map((scene) => ({
      ...scene,
      biometric_vibe: "Passo rapido, picco di battito alle 19:17 (HR 153 bpm)",
    }));
  const system = buildSystemPrompt(payload);
  assert.match(system, /Picchi a corpo fermo: nessuno/);
});

test("il frontespizio chiede titolo e sottotitolo d'arco, senza inventare", () => {
  const book = {
    book_config: samplePayload.book_config,
    days: [
      {
        day: 1,
        chapter: {
          chapter_title: "Il gabbiano e il pane",
          chapter_subtitle: "Una sosta che non si chiude",
          chapter_text: "Marco tornò alla panchina.",
        },
        story_state_after: samplePayload.story_state_memory,
      },
    ],
  };
  const closing = buildClosingPrompt(book);
  assert.match(closing.system, /senza inventare eventi/);
  assert.match(closing.system, /Non attribuire esiti/);
  assert.match(closing.system, /diverso da ogni titolo di capitolo \(«Il gabbiano e il pane»\)/);
  assert.match(closing.system, /back_cover/);
  assert.match(closing.user, /Una sosta che non si chiude/);
});

test("un filo nato in un giorno di sola routine resta provvisorio", () => {
  const payload = structuredClone(samplePayload);
  payload.story_state_memory.through_line = "Cosa cerca Marco dietro la cortina delle ore fisse?";
  const { system } = buildPlanPrompt(payload);
  // Il sample ha appunti e un luogo nuovo: è il giorno dell'incidente scatenante.
  assert.match(system, /Filo conduttore provvisorio/);
  assert.match(system, /Oggi arriva l'incidente scatenante/);
  assert.match(system, /da questo seme: «Cosa farà Marco di ciò che ha scritto/);
});

test("ai modelli arriva una vista curata: luoghi veri, niente numeri dei sensori né campi tecnici", () => {
  const view = dayView(samplePayload);
  assert.equal(view.city, "Milano");
  assert.deepEqual(view.scenes.map((scene) => scene.at), ["al lavoro, in via Dante", "al Parco Sempione", "in via Pacini"]);
  const blob = JSON.stringify(view);
  assert.doesNotMatch(blob, /bpm|SpO2|°|%|km\/h|HR |slot_origin|location_id|tachicardia/);
  assert.match(view.scenes[2].body, /il battito sale all'improvviso a corpo fermo, poco dopo le ventuno/);

  const user = buildUserPrompt(samplePayload);
  assert.doesNotMatch(user, /established_locations|seen_locations|event_log|story_state_memory|bpm/);
  assert.match(user, /"previous_chapter_summary"/);
  assert.ok(user.length < JSON.stringify(samplePayload, null, 2).length);
});

test("meteo e corpo detti a parole", () => {
  assert.equal(plainWeather("Coperto e umido, 6°, umidità 73%"), "coperto e umido, freddo");
  assert.equal(plainWeather("Pioggia moderata, 9°, raffiche a 28 km/h"), "pioggia moderata, freddo, raffiche, forte");
  assert.equal(plainWeather("Sereno, 22°, vento da nord-est 6 km/h"), "sereno, mite, vento da nord-est");
  assert.equal(plainBody("Corpo fermo, ritmo medio 52 bpm, stress lieve, SpO2 99%"), "corpo fermo, stress lieve");
  assert.equal(plainBody("Passo rapido, ritmo medio 128 bpm, stress alto, picco di battito alle 19:05 (HR 156 bpm, SpO2 97%)"), "passo rapido, stress alto, fatica del passo");
});

test("i prompt chiedono luoghi veri e vietano quelli inventati", () => {
  const narrator = buildSystemPrompt(samplePayload, plan);
  assert.match(narrator, /La storia si svolge a Milano, nei luoghi veri dei dati/);
  assert.match(narrator, /La casa è «casa»/);
  assert.match(narrator, /in quel di Milano/);
  assert.match(narrator, /vietato inventare vie, piazze, parchi, locali, edifici/);
  assert.doesNotMatch(narrator, /established_locations|battezz|nuovi_luoghi/);
  const { system } = buildPlanPrompt(samplePayload);
  assert.match(system, /6\. Luoghi: la storia si svolge a Milano/);
  assert.doesNotMatch(system, /nuovi_luoghi|battezz/);
});
