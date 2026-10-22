import test from "node:test";
import assert from "node:assert/strict";
import { calendarKind, literaryTitle, normalizeCalendar } from "./calendar.js";
import { mergeDay } from "./merger.js";
import { dramaticEvents, materialBlock, strongEventsOf, threadSeed } from "./dramaturgy.js";
import { buildPlanPrompt, buildSystemPrompt } from "./prompts.js";
import { applySimulatedTelemetry, listScenarios, personalizeSlots } from "./scenarios.js";
import { findBanned } from "./transfiguration.js";
import { profileFromAnswers } from "./meta.js";

function book(day = 2, extra = {}) {
  const traits = profileFromAnswers({ q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" });
  return {
    id: "bk_cal",
    started_on: "2026-10-15",
    book_config: {
      total_days: 5,
      current_day: day,
      genre: "Realismo Magico",
      protagonist: { name: "Marco", age: 27, gender: "M", ...traits },
    },
    story_state: {
      previous_chapter_summary: "Nessun capitolo precedente.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: { loc_home: "casa" },
      recurring_motifs: [],
      unresolved_tensions: [],
      seen_locations: ["loc_home"],
      ...extra,
    },
  };
}

const at = (kind, start, end, more = {}) => ({ kind, start, end, movement: "STILL", hr_avg: 70, stress: "low", ...more });

function slots({ morning = [], afternoon = [], evening = [], night = [] } = {}, places = {}) {
  return [
    { id: "SLOT_1_NIGHT", places: places.night || [at("home", "00:20", "05:50", { hr_avg: 56 })], calendar_events: night },
    { id: "SLOT_2_MORNING", wake_time: "07:10", places: places.morning || [at("home", "07:10", "11:55")], calendar_events: morning },
    { id: "SLOT_3_AFTERNOON", places: places.afternoon || [at("home", "12:00", "17:55")], calendar_events: afternoon },
    { id: "SLOT_4_EVENING", places: places.evening || [at("home", "18:00", "23:30")], calendar_events: evening },
  ];
}

test("i titoli dell'agenda arrivano spogli e la salute non dice mai che cosa è", () => {
  assert.equal(literaryTitle("Call con il cliente — link https://zoom.us/j/88"), "Colloquio a distanza con il cliente");
  assert.equal(literaryTitle("Zoom con Anna (ID: 882 1234 5678)"), "Colloquio a distanza con Anna");
  assert.equal(literaryTitle("Visita cardiologica dal dott. Bianchi"), "Appuntamento per la salute");
  assert.equal(literaryTitle("🎂"), "Impegno senza titolo");
  assert.equal(calendarKind("Cena da Marta"), "social");
  assert.equal(calendarKind("Palestra"), "sport");
  assert.equal(calendarKind("Treno per casa"), "travel");
  assert.equal(calendarKind("Ritiro pacco"), "errand");
  assert.equal(calendarKind("Riunione di reparto"), "work");
  assert.equal(calendarKind("Leggere il libro"), "personal");
  assert.equal(findBanned("una videochiamata su Zoom").length, 2);
});

test("eventi malformati si scartano, la fine prima dell'inizio si chiude a mezzanotte", () => {
  const list = normalizeCalendar([
    { title: "Senza ora" },
    { title: "Festa", start: "22:00", end: "01:00" },
    { title: "Compleanno di Luca", all_day: true },
    null,
  ]);
  assert.deepEqual(
    list.map((event) => [event.title, event.start, event.end, event.all_day]),
    [
      ["Festa", "22:00", "23:59", false],
      ["Compleanno di Luca", "", "", true],
    ]
  );
});

test("il merger affianca ogni impegno al luogo in cui la persona era davvero", () => {
  const payload = mergeDay({
    book: book(),
    day: 2,
    date: "2026-10-16",
    slots: slots(
      {
        night: [{ title: "Compleanno di Luca", all_day: true }],
        morning: [{ title: "Riunione di reparto", start: "09:00", end: "10:00", recurring: true }],
        afternoon: [
          { title: "Pranzo con Giulia", start: "13:00", end: "14:00" },
          { title: "Pranzo con Giulia", start: "13:00", end: "14:00" },
          { title: "Ritiro pacco", start: "15:00", end: "15:20" },
        ],
        evening: [
          { title: "Palestra", start: "19:00", end: "20:00" },
          { title: "Telefonata alla zia", start: "23:45", end: "23:55" },
        ],
      },
      {
        afternoon: [at("cafe", "12:50", "14:10"), at("street", "14:55", "15:30", { movement: "WALKING", zone: "centro" })],
        evening: [at("home", "18:00", "23:30")],
      }
    ),
  });
  const agenda = payload.today_unified_telemetry.calendar_events;
  assert.deepEqual(
    agenda.map((event) => [event.title, event.presence]),
    [
      ["Compleanno di Luca", "ALL_DAY"],
      ["Riunione di reparto", "HOME"],
      ["Pranzo con Giulia", "AWAY"],
      ["Ritiro pacco", "IN_TRANSIT"],
      ["Palestra", "HOME"],
      ["Telefonata alla zia", "NO_TRACE"],
    ]
  );
  assert.match(agenda[2].location_alias, /^un locale di /);
  assert.match(agenda[2].location_at, /^in un locale di /);
  assert.equal(agenda[0].time_window, "tutto il giorno");
});

test("un impegno che non si ripete toglie alla giornata il vuoto; la routine no", () => {
  const routine = mergeDay({
    book: book(),
    day: 2,
    slots: slots({ morning: [{ title: "Riunione di reparto", start: "09:00", end: "10:00", recurring: true }] }),
  });
  assert.equal(routine.today_unified_telemetry.is_empty_day, true);
  const oneOff = mergeDay({ book: book(), day: 2, slots: slots({ evening: [{ title: "Palestra", start: "19:00", end: "20:00" }] }) });
  assert.equal(oneOff.today_unified_telemetry.is_empty_day, false);
});

test("un impegno fuori passato in casa diventa materiale forte e seme del filo", () => {
  const payload = mergeDay({ book: book(), day: 2, slots: slots({ evening: [{ title: "Palestra", start: "19:00", end: "20:00" }] }) });
  const events = dramaticEvents(payload);
  assert.match(events[0], /IMPEGNO FUORI, MA A CASA — «Palestra»/);
  assert.match(threadSeed(payload), /trattenuto Marco a casa all'ora di «Palestra»/);
  assert.deepEqual(strongEventsOf(payload), [{ day: 2, kind: "calendar_home", location_id: "cal:palestra" }]);

  const again = mergeDay({
    book: book(3, { event_log: [{ day: 2, kind: "calendar_home", location_id: "cal:palestra" }] }),
    day: 3,
    slots: slots({ evening: [{ title: "Palestra", start: "19:00", end: "20:00" }] }),
  });
  assert.match(dramaticEvents(again)[0], /Già successo il giorno 2/);
});

test("la salute non semina il filo; la routine resta solo nella riga dell'agenda", () => {
  const payload = mergeDay({
    book: book(),
    day: 2,
    slots: slots({
      morning: [
        { title: "Visita dal dentista", start: "10:00", end: "10:30" },
        { title: "Stand-up", start: "09:00", end: "09:15", recurring: true },
      ],
    }),
  });
  const events = dramaticEvents(payload);
  assert.ok(events.some((event) => /«Appuntamento per la salute» \(salute: mai il motivo/.test(event)));
  assert.ok(!events.some((event) => /Stand-up/.test(event)));
  assert.equal(threadSeed(payload), "");
  const block = materialBlock(payload);
  assert.match(block, /Impegni di oggi .*«Stand-up» \(ricorrente: routine della settimana\), a casa/);
  assert.doesNotMatch(block, /dentista/i);
});

test("un impegno che contiene il sobbalzo da fermo lo dice", () => {
  const payload = mergeDay({
    book: book(),
    day: 2,
    slots: slots(
      { afternoon: [{ title: "Colloquio annuale", start: "16:30", end: "17:15" }] },
      { afternoon: [at("work", "12:10", "17:50", { hr_peak: 138, hr_peak_time: "16:42", peak_while_still: true })] }
    ),
  });
  assert.ok(dramaticEvents(payload).some((event) => /«Colloquio annuale».*coincide con il sobbalzo da fermo/.test(event)));
});

test("i prompt conoscono l'agenda: regole sui fatti, divieti di scena, dati compatti", () => {
  const payload = mergeDay({ book: book(), day: 2, slots: slots({ evening: [{ title: "Cena da Marta", start: "20:00", end: "21:30" }] }) });
  const { system, user } = buildPlanPrompt(payload);
  assert.match(system, /Agenda: un impegno in calendario è un programma/);
  assert.match(system, /un impegno dell'agenda, una notte fuori/);
  assert.match(user, /"agenda": \[/);
  assert.match(user, /"title": "Cena da Marta"/);
  const narrator = buildSystemPrompt(payload);
  assert.match(narrator, /mai il calendario come oggetto/);
  assert.match(narrator, /impegno dell'agenda senza esito/);
});

test("gli impegni simulati seguono le tappe e l'ancora non esce dal simulatore", () => {
  const cena = listScenarios().find((item) => item.id === "cena_fuori");
  const varied = personalizeSlots(cena.slots, "bk_x:1:0:cena_fuori");
  const evening = varied.find((slot) => slot.id === "SLOT_4_EVENING");
  const event = evening.calendar_events[0];
  assert.equal(event.title, "Cena da Marta");
  assert.equal("anchor" in event, false);
  const cafe = evening.places[1];
  const toMin = (clock) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  assert.ok(toMin(event.start) <= toMin(cafe.start) && toMin(cafe.start) - toMin(event.start) < 15);
  assert.equal(toMin(event.end) - toMin(event.start), 90);

  const withAgenda = listScenarios().filter((item) => item.slots.some((slot) => slot.calendar_events?.length));
  assert.ok(withAgenda.length >= 8 && withAgenda.length < listScenarios().length, "solo una parte delle giornate ha un'agenda");
});

test("un'agenda già presente vince su quella simulata", () => {
  const blank = ["SLOT_1_NIGHT", "SLOT_2_MORNING", "SLOT_3_AFTERNOON", "SLOT_4_EVENING"].map((id) => ({ id, places: [], notes: [] }));
  blank[3].calendar_events = [{ title: "Teatro", start: "21:00", end: "23:00" }];
  const filled = applySimulatedTelemetry(blank, { bookId: "bk_y", day: 1 });
  assert.deepEqual(filled[3].calendar_events, [{ title: "Teatro", start: "21:00", end: "23:00" }]);
});
