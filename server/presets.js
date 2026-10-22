function slot(id, extra) {
  return {
    id,
    included: true,
    weather: "Cielo terso, vento freddo",
    doomscrolling_minutes: 0,
    messaging_minutes: 0,
    wake_time: "",
    places: [],
    notes: [],
    notes_text: "",
    calendar_events: [],
    ...extra,
  };
}

function place(extra) {
  return {
    kind: "home",
    zone: "",
    start: "",
    end: "",
    movement: "STILL",
    hr_avg: 68,
    hr_peak: null,
    hr_peak_time: "",
    peak_while_still: false,
    spo2: 98,
    stress: "low",
    ...extra,
  };
}

function notesText(notes) {
  return notes.map((note) => `${note.time} ${note.text}`).join("\n");
}

export const PRESET_LIST = [
  {
    id: "empty_day",
    name: "Giornata vuota",
    description: "Quattro slot in casa, zero appunti, quattro ore nello specchio nero.",
  },
  {
    id: "false_positive",
    name: "Falso positivo biometrico",
    description: "Fermo sul luogo di fatica, battito a 135. Il narratore deve crederci.",
  },
  {
    id: "cliffhanger",
    name: "Notte brava, 23:59",
    description: "La sera si chiude fuori casa, con il cuore ancora alto.",
  },
  {
    id: "resume_cliffhanger",
    name: "Ripresa alle 00:01",
    description: "Il giorno dopo ricomincia in strada, nella stessa zona, e poi rientra.",
  },
  {
    id: "ordinary",
    name: "Giornata ordinaria",
    description: "Sveglia, sosta di lavoro, un tavolo, rientro. Utile come controllo.",
  },
];

export function buildPreset(id) {
  const builders = {
    empty_day: emptyDay,
    false_positive: falsePositive,
    cliffhanger: cliffhanger,
    resume_cliffhanger: resumeCliffhanger,
    ordinary: ordinary,
  };
  const build = builders[id];
  if (!build) {
    const error = new Error("Preset sconosciuto.");
    error.status = 404;
    throw error;
  }
  return build();
}

function emptyDay() {
  const home = (start, end, hr) => place({ kind: "home", start, end, hr_avg: hr, spo2: 98, stress: "low" });
  return [
    slot("SLOT_1_NIGHT", {
      weather: "Buio quieto, aria ferma",
      doomscrolling_minutes: 15,
      places: [home("00:40", "05:50", 58)],
    }),
    slot("SLOT_2_MORNING", {
      weather: "Luce pigra sulla stanza",
      wake_time: "09:40",
      doomscrolling_minutes: 150,
      places: [home("09:40", "11:50", 66)],
    }),
    slot("SLOT_3_AFTERNOON", {
      weather: "Pomeriggio fermo, tende socchiuse",
      doomscrolling_minutes: 90,
      places: [home("12:10", "17:40", 70)],
    }),
    slot("SLOT_4_EVENING", {
      weather: "Sera senza vento",
      doomscrolling_minutes: 40,
      places: [home("18:20", "23:10", 64)],
    }),
  ];
}

function falsePositive() {
  return [
    slot("SLOT_1_NIGHT", {
      weather: "Buio quieto, aria ferma",
      places: [place({ start: "00:20", end: "06:10", hr_avg: 56, spo2: 98 })],
    }),
    slot("SLOT_2_MORNING", {
      weather: "Cielo terso, vento freddo",
      wake_time: "07:05",
      doomscrolling_minutes: 25,
      messaging_minutes: 10,
      places: [
        place({ kind: "home", start: "07:05", end: "08:00", hr_avg: 72 }),
        place({
          kind: "street",
          zone: "centro",
          start: "08:05",
          end: "08:35",
          movement: "TRANSIT",
          hr_avg: 88,
          stress: "low",
        }),
        place({ kind: "work", start: "08:40", end: "11:50", hr_avg: 76, stress: "moderate" }),
      ],
    }),
    slot("SLOT_3_AFTERNOON", {
      weather: "Luce piatta da interno",
      doomscrolling_minutes: 10,
      messaging_minutes: 15,
      places: [
        place({
          kind: "work",
          start: "12:10",
          end: "17:45",
          movement: "STILL",
          hr_avg: 74,
          hr_peak: 135,
          hr_peak_time: "15:10",
          peak_while_still: true,
          spo2: 99,
          stress: "moderate",
        }),
      ],
    }),
    slot("SLOT_4_EVENING", {
      weather: "Sereno che si spegne",
      places: [place({ kind: "home", start: "19:00", end: "23:15", hr_avg: 68, stress: "low" })],
    }),
  ];
}

function cliffhanger() {
  const parkNote = {
    time: "13:40",
    text: "Sono tornato sulla panchina di ieri. Qualcosa, in alto, mi fissava e non batteva ciglio.",
  };
  const nightNote = {
    time: "23:40",
    text: "Non sono rientrato. Qualcuno ha detto il mio nome e io non ho risposto.",
  };
  return [
    slot("SLOT_1_NIGHT", {
      weather: "Notte stellata e ventosa",
      places: [place({ start: "00:30", end: "06:20", hr_avg: 58 })],
    }),
    slot("SLOT_2_MORNING", {
      weather: "Mattina limpida e fredda",
      wake_time: "07:20",
      doomscrolling_minutes: 35,
      places: [
        place({ kind: "home", start: "07:20", end: "08:10", hr_avg: 74 }),
        place({ kind: "work", start: "08:40", end: "11:50", hr_avg: 80, stress: "moderate" }),
      ],
    }),
    slot("SLOT_3_AFTERNOON", {
      weather: "Nuvole basse in movimento",
      messaging_minutes: 20,
      places: [
        place({
          kind: "park",
          zone: "centro",
          start: "13:10",
          end: "14:20",
          movement: "WALKING",
          hr_avg: 96,
          stress: "moderate",
        }),
        place({ kind: "work", start: "14:40", end: "17:50", hr_avg: 78, stress: "moderate" }),
      ],
      notes: [parkNote],
      notes_text: notesText([parkNote]),
    }),
    slot("SLOT_4_EVENING", {
      weather: "Pioggia battente",
      messaging_minutes: 25,
      places: [
        place({
          kind: "unknown",
          zone: "est",
          start: "20:10",
          end: "23:59",
          movement: "STILL",
          hr_avg: 98,
          hr_peak: 132,
          hr_peak_time: "23:40",
          peak_while_still: true,
          spo2: 98,
          stress: "high",
        }),
      ],
      notes: [nightNote],
      notes_text: notesText([nightNote]),
    }),
  ];
}

function resumeCliffhanger() {
  const note = {
    time: "00:20",
    text: "Sono ancora fuori. La pioggia non ha deciso se smettere, e nemmeno io.",
  };
  return [
    slot("SLOT_1_NIGHT", {
      weather: "Pioggia battente",
      places: [
        place({
          kind: "unknown",
          zone: "est",
          start: "00:08",
          end: "02:10",
          movement: "WALKING",
          hr_avg: 112,
          hr_peak: 124,
          hr_peak_time: "00:20",
          peak_while_still: false,
          spo2: 98,
          stress: "high",
        }),
      ],
      notes: [note],
      notes_text: notesText([note]),
    }),
    slot("SLOT_2_MORNING", {
      weather: "Nebbia bassa",
      wake_time: "",
      places: [place({ kind: "home", start: "03:00", end: "11:30", hr_avg: 64, stress: "low" })],
    }),
    slot("SLOT_3_AFTERNOON", {
      weather: "Coperto, vento umido",
      doomscrolling_minutes: 30,
      places: [place({ kind: "home", start: "12:00", end: "17:20", hr_avg: 70 })],
    }),
    slot("SLOT_4_EVENING", {
      weather: "Sereno che si spegne",
      places: [place({ kind: "home", start: "19:00", end: "23:00", hr_avg: 66 })],
    }),
  ];
}

function ordinary() {
  const lunch = {
    time: "13:20",
    text: "Il pranzo era troppo salato e al tavolo accanto qualcuno rideva senza un motivo chiaro.",
  };
  return [
    slot("SLOT_1_NIGHT", {
      weather: "Buio quieto, aria ferma",
      places: [place({ start: "00:40", end: "06:30", hr_avg: 57 })],
    }),
    slot("SLOT_2_MORNING", {
      weather: "Mattina limpida e fredda",
      wake_time: "07:15",
      doomscrolling_minutes: 20,
      messaging_minutes: 12,
      places: [
        place({ kind: "home", start: "07:15", end: "08:05", hr_avg: 74 }),
        place({
          kind: "street",
          zone: "centro",
          start: "08:10",
          end: "08:40",
          movement: "WALKING",
          hr_avg: 92,
        }),
        place({ kind: "work", start: "08:45", end: "11:50", hr_avg: 78, stress: "moderate" }),
      ],
    }),
    slot("SLOT_3_AFTERNOON", {
      weather: "Nuvole basse in movimento",
      messaging_minutes: 18,
      places: [
        place({ kind: "cafe", zone: "centro", start: "13:00", end: "14:00", hr_avg: 82, stress: "low" }),
        place({ kind: "work", start: "14:15", end: "17:40", hr_avg: 76, stress: "moderate" }),
      ],
      notes: [lunch],
      notes_text: notesText([lunch]),
    }),
    slot("SLOT_4_EVENING", {
      weather: "Sereno che si spegne",
      doomscrolling_minutes: 25,
      places: [
        place({
          kind: "street",
          zone: "centro",
          start: "18:10",
          end: "18:40",
          movement: "WALKING",
          hr_avg: 90,
        }),
        place({ kind: "home", start: "18:50", end: "23:10", hr_avg: 68 }),
      ],
    }),
  ];
}
