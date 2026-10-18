import test from "node:test";
import assert from "node:assert/strict";
import { mergeDay } from "./merger.js";
import { homeAlias } from "./transfiguration.js";
import { profileFromAnswers } from "./meta.js";
import {
  applySimulatedTelemetry,
  listScenarios,
  scenarioById,
  scenarioIndex,
  telemetryIsBlank,
} from "./scenarios.js";

const BOUNDS = {
  SLOT_1_NIGHT: [0, 5 * 60 + 59],
  SLOT_2_MORNING: [6 * 60, 11 * 60 + 59],
  SLOT_3_AFTERNOON: [12 * 60, 17 * 60 + 59],
  SLOT_4_EVENING: [18 * 60, 23 * 60 + 59],
};

const KINDS = new Set(["home", "work", "park", "cafe", "street", "unknown"]);
const MOVEMENTS = new Set(["STILL", "WALKING", "TRANSIT"]);
const STRESS = new Set(["low", "moderate", "high"]);

function minutes(clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function book() {
  const traits = profileFromAnswers({ q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" });
  return {
    started_on: "2026-10-15",
    book_config: {
      total_days: 7,
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
  };
}

function blankSlots() {
  return ["SLOT_1_NIGHT", "SLOT_2_MORNING", "SLOT_3_AFTERNOON", "SLOT_4_EVENING"].map((id) => ({
    id,
    included: true,
    weather: "Buio quieto, aria ferma",
    doomscrolling_minutes: 0,
    messaging_minutes: 0,
    wake_time: "",
    places: [],
    notes: [],
    notes_text: "",
  }));
}

test("le giornate simulate sono coerenti con le fasce orarie", () => {
  const scenarios = listScenarios();
  assert.ok(scenarios.length >= 12);
  const ids = new Set(scenarios.map((item) => item.id));
  assert.equal(ids.size, scenarios.length);

  for (const scenario of scenarios) {
    assert.equal(scenario.slots.length, 4, scenario.id);
    assert.match(scenario.description, /\d{2}:\d{2}|sette|diciannove|dieci/i);
    for (const slot of scenario.slots) {
      const [from, to] = BOUNDS[slot.id];
      assert.ok(slot.weather && /\d/.test(slot.weather), `${scenario.id} ${slot.id} meteo`);
      assert.ok(slot.places.length > 0, `${scenario.id} ${slot.id} senza tappe`);
      if (slot.wake_time) {
        const wake = minutes(slot.wake_time);
        assert.ok(wake >= from && wake <= to, `${scenario.id} sveglia fuori fascia`);
      }
      let previousEnd = -1;
      for (const place of slot.places) {
        assert.ok(KINDS.has(place.kind), place.kind);
        assert.ok(MOVEMENTS.has(place.movement), place.movement);
        assert.ok(STRESS.has(place.stress), place.stress);
        const start = minutes(place.start);
        const end = minutes(place.end);
        assert.ok(start >= from && end <= to && start < end, `${scenario.id} ${slot.id} ${place.start}-${place.end}`);
        assert.ok(start >= previousEnd, `${scenario.id} tappe sovrapposte`);
        previousEnd = end;
        assert.ok(place.hr_avg >= 48 && place.hr_avg <= 160, `${scenario.id} hr`);
        assert.ok(place.spo2 >= 95 && place.spo2 <= 100);
        if (place.hr_peak) {
          assert.ok(place.hr_peak > place.hr_avg);
          assert.ok(place.hr_peak_time);
          const peak = minutes(place.hr_peak_time);
          assert.ok(peak >= start && peak <= end, `${scenario.id} picco fuori tappa`);
        }
        if (place.movement === "WALKING") assert.ok(place.hr_avg >= 84, `${scenario.id} cammino lento`);
        if (place.hr_avg <= 62 && place.kind === "home") assert.equal(place.movement, "STILL");
      }
    }
    const wakes = scenario.slots.map((slot) => slot.wake_time).filter(Boolean);
    assert.equal(wakes.length, 1, `${scenario.id} sveglie`);
  }
});

test("i giorni consecutivi di un ciclo cambiano combinazione", () => {
  const total = listScenarios().length;
  const ids = [];
  for (let day = 1; day <= 7; day += 1) {
    ids.push(listScenarios()[scenarioIndex("bk_demo", day, 0)].id);
  }
  assert.equal(new Set(ids).size, 7);
  assert.equal(scenarioIndex("bk_demo", 2, 0), (scenarioIndex("bk_demo", 1, 0) + 1) % total);
  assert.equal(scenarioIndex("bk_demo", 1, 3), scenarioIndex("bk_demo", 4, 0));
});

test("gli slot vuoti del merger vengono sostituiti e gli appunti restano", () => {
  const slots = blankSlots();
  slots[1].notes_text = "08:10 Il caffè era troppo lungo.";
  assert.equal(telemetryIsBlank(slots), true);
  const filled = applySimulatedTelemetry(slots, { bookId: "bk_demo", day: 1 });
  assert.equal(telemetryIsBlank(filled), false);
  assert.match(filled[1].notes_text, /caffè/);
  assert.ok(filled.every((slot) => slot.places.length > 0));
  assert.ok(filled.some((slot) => slot.wake_time));
  const again = applySimulatedTelemetry(filled, { bookId: "bk_altro", day: 3 });
  assert.equal(again, filled);
});

test("le combinazioni chiave producono una giornata plausibile", () => {
  const office = mergeDay({
    book: book(),
    day: 1,
    date: "2026-10-15",
    slots: scenarioById("sveglia_sette_ufficio_dieci").slots,
  });
  const officeToday = office.today_unified_telemetry;
  assert.equal(officeToday.wake_up_event.time, "07:00");
  assert.equal(officeToday.is_empty_day, false);
  assert.equal(officeToday.midnight_cutoff_status, "AT_HOME_RESTING");
  assert.ok(officeToday.unified_scenes.some((scene) => scene.location_id === "loc_work_new"));
  assert.match(officeToday.weather_daily_arc, /8°/);

  const night = mergeDay({
    book: book(),
    day: 2,
    date: "2026-10-16",
    slots: scenarioById("turno_notte").slots,
  });
  const nightToday = night.today_unified_telemetry;
  assert.equal(nightToday.wake_up_event.time, "19:00");
  assert.equal(nightToday.midnight_cutoff_status, "OUTSIDE_AWAY");
  assert.match(nightToday.unified_scenes.at(-1).location_id, /work/);

  const out = mergeDay({
    book: book(),
    day: 3,
    date: "2026-10-17",
    slots: scenarioById("fuori_fino_a_mezzanotte").slots,
  });
  assert.equal(out.today_unified_telemetry.midnight_cutoff_status, "OUTSIDE_HIGH_ACTIVITY");

  const home = mergeDay({
    book: book(),
    day: 4,
    date: "2026-10-18",
    slots: scenarioById("casa_tutto_il_giorno").slots,
  });
  assert.equal(home.today_unified_telemetry.is_empty_day, true);
  assert.equal(home.today_unified_telemetry.midnight_cutoff_status, "AT_HOME_RESTING");

  const spike = mergeDay({
    book: book(),
    day: 5,
    date: "2026-10-19",
    slots: scenarioById("picco_da_fermo").slots,
  });
  const still = spike.today_unified_telemetry.unified_scenes.find((scene) => /138/.test(scene.biometric_vibe));
  assert.ok(still);
  assert.match(still.biometric_vibe, /tachicardia da fermo/);
});
