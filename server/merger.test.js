import test from "node:test";
import assert from "node:assert/strict";
import { buildPreset } from "./presets.js";
import { mergeDay } from "./merger.js";
import { containsBanned } from "./transfiguration.js";
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
        loc_home: "casa",
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    ...overrides,
  };
}

test("la giornata vuota resta in casa, senza note, con lo schermo alto", () => {
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
  // Il risveglio arriva come dato, non come frase da ricopiare in apertura.
  assert.doesNotMatch(today.wake_up_event.semantic_translation, /richiamo metallico|incantesimo/i);
  assert.match(today.wake_up_event.semantic_translation, /poco prima delle dieci/);
  assert.doesNotMatch(today.screen_behavior_summary.semantic_translation, /specchio nero|\d/);
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
  assert.match(office.location_id, /^loc_work_/);
  assert.match(office.biometric_vibe, /tachicardia da fermo/);
  assert.match(office.location_alias, /^il lavoro in /);
  assert.match(office.location_at, /^al lavoro, /);
  assert.equal(today.is_empty_day, false);
  assert.equal(today.midnight_cutoff_status, "AT_HOME_RESTING");
});

test("il cliffhanger chiude fuori casa e la ripresa ritrova lo stesso luogo vero", () => {
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
  assert.match(last.location_id, /^loc_unknown_/);
  assert.doesNotMatch(last.location_alias, /sconosciuto/i);
  assert.match(last.biometric_vibe, /tachicardia da fermo/);
  const park = today.unified_scenes.find((scene) => /^loc_park_/.test(scene.location_id));
  assert.equal(park.user_notes.length, 1);
  assert.match(park.user_notes[0].text, /panchina/);

  firstBook.story_state = {
    ...firstBook.story_state,
    last_chapter_ending_state: "OUTSIDE_CLIFFHANGER",
  };
  firstBook.book_config.current_day = 2;

  const next = mergeDay({
    book: firstBook,
    day: 2,
    date: "2026-10-16",
    slots: buildPreset("resume_cliffhanger"),
  });
  const resume = next.today_unified_telemetry.unified_scenes[0];
  assert.equal(resume.location_id, last.location_id);
  assert.equal(resume.location_alias, last.location_alias);
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
  const table = today.unified_scenes.find((scene) => /^loc_cafe_/.test(scene.location_id));
  assert.match(table.location_alias, /^un locale di /);
  assert.match(table.user_notes[0].text, /salato/);
});

test("il questionario produce il profilo di Marco", () => {
  const traits = profileFromAnswers({ q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" });
  assert.equal(traits.metaphor_domain, "Cucina & Materia");
  assert.equal(traits.emotional_reactivity, "Irritabile / Collerico");
  assert.equal(traits.archetype, "L'Assopito / Letargico");
  assert.equal(traits.narrative_focus, "Psicologico / Relazionale");
  assert.equal(traits.pacing, "Romantico, lirico e sentimentale");
});

test("il geo del telefono vince sullo stradario: nomi veri, senza numero civico", () => {
  const payload = mergeDay({
    book: book(),
    day: 1,
    date: "2026-10-15",
    slots: [
      {
        id: "SLOT_2_MORNING",
        wake_time: "07:30",
        places: [
          { kind: "home", start: "07:30", end: "08:40", geo: { city: "Milano", district: "Isola" } },
          { kind: "cafe", start: "09:00", end: "10:00", geo: { city: "Milano", district: "Isola", street: "via Borsieri 12" } },
          { kind: "park", start: "10:10", end: "11:00", geo: { city: "Milano", district: "Sempione", poi: "Parco Sempione" } },
        ],
      },
    ],
  });
  const [home, cafe, park] = payload.today_unified_telemetry.unified_scenes;
  assert.deepEqual([home.location_id, home.location_alias, home.location_at], ["loc_home", "casa", "a casa, all'Isola"]);
  assert.deepEqual([cafe.location_alias, cafe.location_at, cafe.location_area], ["un locale di via Borsieri", "in un locale di via Borsieri", "Isola, Milano"]);
  assert.equal(cafe.location_id, "loc_cafe_via_borsieri");
  assert.equal(park.location_alias, "Parco Sempione");
});

test("la città viene dal GPS: in locale è simulata per libro, sempre la stessa", () => {
  const merge = (target) => mergeDay({ book: target, day: 1, date: "2026-10-15", slots: buildPreset("ordinary") });
  const cities = new Set();
  for (const id of ["bk_a", "bk_b", "bk_c", "bk_d", "bk_e", "bk_f", "bk_g", "bk_h"]) {
    const payload = merge(book({ id }));
    const city = payload.book_config.city;
    cities.add(city);
    const scenes = payload.today_unified_telemetry.unified_scenes;
    assert.ok(scenes.every((scene) => scene.location_area.endsWith(`, ${city}`)), id);
    assert.ok(scenes.every((scene) => !/sconosciuto|Casa delle/i.test(scene.location_alias)), id);
    // Stesso libro, stessa città e stessi luoghi ogni giorno.
    assert.deepEqual(merge(book({ id })).today_unified_telemetry.unified_scenes.map((scene) => scene.location_alias), scenes.map((scene) => scene.location_alias));
  }
  assert.ok(cities.size > 1, "libri diversi vivono in città diverse");
});

test("con dati veri la città è quella dei luoghi del giorno, non una scelta del libro", () => {
  const payload = mergeDay({
    book: book({ id: "bk_a" }),
    day: 1,
    slots: [
      {
        id: "SLOT_2_MORNING",
        places: [
          { kind: "home", start: "07:00", end: "08:00", geo: { city: "Firenze", district: "Oltrarno" } },
          { kind: "street", start: "08:10", end: "08:30", geo: { city: "Firenze", district: "Centro", street: "via dei Calzaiuoli" } },
        ],
      },
    ],
  });
  assert.equal(payload.book_config.city, "Firenze");
  assert.deepEqual(payload.today_unified_telemetry.unified_scenes.map((scene) => scene.location_at), ["a casa, in zona Oltrarno", "in via dei Calzaiuoli"]);
});
