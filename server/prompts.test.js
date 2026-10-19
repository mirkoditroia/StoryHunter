import test from "node:test";
import assert from "node:assert/strict";
import { samplePayload } from "./sample.js";
import { buildClosingPrompt, buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { findMeasures } from "./transfiguration.js";

test("il prompt del capitolo segue la struttura drammaturgica", () => {
  const system = buildSystemPrompt(samplePayload);
  const user = buildUserPrompt(samplePayload);

  assert.match(system, /Incipit/);
  assert.match(system, /Sviluppo/);
  assert.match(system, /Chiusura/);
  assert.match(system, /chapter_subtitle/);
  assert.match(system, /Marco/);
  assert.match(system, /terza persona/);
  assert.match(system, /Non citare le 19:00/);
  assert.match(system, /OUTSIDE_CLIFFHANGER/);
  assert.match(system, /Non inventare pericoli/);
  assert.match(system, /senza un fondamento nei dati/);
  assert.match(system, /Minimo 800 parole/);
  assert.match(system, /Metafora/);
  assert.match(system, /Climax/);
  assert.match(system, /sedici gradi/);
  assert.match(user, /incipit, sviluppo e chiusura/);
  assert.doesNotMatch(system, /turbamento, una suspense/);
});

test("la chiusura domestica non forza un cliffhanger", () => {
  const payload = structuredClone(samplePayload);
  payload.today_unified_telemetry.midnight_cutoff_status = "AT_HOME_RESTING";
  const system = buildSystemPrompt(payload);
  assert.match(system, /AT_HOME_RESTING/);
  assert.match(system, /non un'interruzione per strada/);
});

test("il bollettino numerico si riconosce, la metafora no", () => {
  const bulletin =
    "sedici gradi centigradi misuravano l'aria e l'umidità toccava il sessantadue percento, con settanta pulsazioni al minuto e la saturazione dell'ossigeno al novantotto percento";
  assert.ok(findMeasures(bulletin).length >= 3);
  assert.deepEqual(findMeasures("La notte restava ferma e il fiato di Mirko teneva un passo lento."), []);
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
  assert.match(closing.system, /sottotitolo/);
  assert.match(closing.user, /Una sosta che non si chiude/);
});
