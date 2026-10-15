import test from "node:test";
import assert from "node:assert/strict";
import { buildPreset } from "./presets.js";
import { mergeDay } from "./merger.js";
import { containsBanned, homeAlias } from "./transfiguration.js";
import { profileFromAnswers } from "./meta.js";

function book(overrides = {}) {
  const traits = profileFromAnswers({ q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" });
  return {
    started_on: "2026-10-15",
    book_config: {
      total_days: 5,
      current_day: 1,
      genre: "Realismo Magico",
      protagonist: { name: "Marco", age: 27, gender: "M", ...traits },
    },
    story_state: {
      previous_chapter_summary: "Nessun capitolo precedente.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: {
        loc_home: homeAlias("Realismo Magico", traits.metaphor_domain),
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    ...overrides,
  };
}

test("la giornata vuota resta in casa, senza note, con lo specchio nero alto", () => {
  const payload = mergeDay({
    book: book(),
    day: 1,
    date: "2026-10-15",
    slots: buildPreset("empty_day"),
  });
  const today = payload.today_unified_telemetry;
  assert.equal(today.is_empty_day, true);
  assert.equal(today.midnight_cutoff_status, "AT_HOME_RESTING");
  assert.equal(today.slots_merged.length, 4);
  assert.ok(today.unified_scenes.every((scene) => scene.location_id === "loc_home"));
  assert.equal(today.screen_behavior_summary.doomscrolling_level, "VERY_HIGH_MORNING");
  assert.equal(today.unified_scenes.some((scene) => scene.user_notes.length), false);
  assert.equal(containsBanned(today.screen_behavior_summary.semantic_translation), false);
  assert.equal(containsBanned(today.wake_up_event.semantic_translation), false);
  assert.match(today.wake_up_event.semantic_translation, /richiamo metallico/i);
  assert.match(today.wake_up_event.semantic_translation, /alle nove e quaranta/);
  assert.doesNotMatch(today.wake_up_event.semantic_translation, /alle le /);
});

test("il falso positivo resta fermo e finisce a casa", () => {
  const payload = mergeDay({
    book: book(),
    day: 2,
    date: "2026-10-16",
    slots: buildPreset("false_positive"),
  });
  const today = payload.today_unified_telemetry;
  const office = today.unified_scenes.find((scene) => /135/.test(scene.biometric_vibe));
  assert.ok(office);
  assert.equal(office.location_id, "loc_work_new");
  assert.match(office.biometric_vibe, /tachicardia da fermo/);
  assert.match(office.location_alias, /Luogo sconosciuto/);
  assert.equal(today.is_empty_day, false);
  assert.equal(today.midnight_cutoff_status, "AT_HOME_RESTING");
});

test("il cliffhanger chiude fuori casa e la ripresa riusa il luogo battezzato", () => {
  const firstBook = book();
  const night = mergeDay({
    book: firstBook,
    day: 1,
    date: "2026-10-15",
    slots: buildPreset("cliffhanger"),
  });
  const today = night.today_unified_telemetry;
  assert.equal(today.midnight_cutoff_status, "OUTSIDE_HIGH_ACTIVITY");
  const last = today.unified_scenes.at(-1);
  assert.equal(last.location_id, "loc_unknown_est_new");
  assert.match(last.biometric_vibe, /tachicardia da fermo/);
  const park = today.unified_scenes.find((scene) => scene.location_id === "loc_park_new");
  assert.equal(park.user_notes.length, 1);
  assert.match(park.user_notes[0].text, /panchina/);

  firstBook.story_state = {
    ...firstBook.story_state,
    last_chapter_ending_state: "OUTSIDE_CLIFFHANGER",
    established_locations: {
      ...firstBook.story_state.established_locations,
      loc_unknown_est_new: "La Lanterna dell'Est",
      loc_park_new: "Il Giardino delle Statue Mute",
      loc_work_new: "La Fornace Grigia",
    },
  };
  firstBook.book_config.current_day = 2;

  const next = mergeDay({
    book: firstBook,
    day: 2,
    date: "2026-10-16",
    slots: buildPreset("resume_cliffhanger"),
  });
  const resume = next.today_unified_telemetry.unified_scenes[0];
  assert.equal(resume.location_id, "loc_unknown_est_new");
  assert.equal(resume.location_alias, "La Lanterna dell'Est");
  assert.equal(next.today_unified_telemetry.midnight_cutoff_status, "AT_HOME_RESTING");
  assert.equal(next.story_state_memory.last_chapter_ending_state, "OUTSIDE_CLIFFHANGER");
});

test("una giornata ordinaria non è vuota e rientra", () => {
  const payload = mergeDay({
    book: book(),
    day: 1,
    date: "2026-10-15",
    slots: buildPreset("ordinary"),
  });
  const today = payload.today_unified_telemetry;
  assert.equal(today.is_empty_day, false);
  assert.equal(today.midnight_cutoff_status, "AT_HOME_RESTING");
  assert.ok(today.unified_scenes.some((scene) => scene.location_id === "loc_cafe_new"));
  const table = today.unified_scenes.find((scene) => scene.location_id === "loc_cafe_new");
  assert.match(table.user_notes[0].text, /salato/);
});

test("il questionario produce il profilo di Marco", () => {
  const traits = profileFromAnswers({ q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" });
  assert.equal(traits.metaphor_domain, "Cucina & Materia");
  assert.equal(traits.emotional_reactivity, "Autoironico / Sarcastico");
  assert.equal(traits.archetype, "L'Alchimista / Conviviale");
  assert.equal(traits.narrative_focus, "Psicologico / Relazionale");
  assert.equal(traits.pacing, "Sincopato e dinamico");
  assert.equal(homeAlias("Realismo Magico", traits.metaphor_domain), "Il Rifugio delle Spezie");
});
