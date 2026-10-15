export const samplePayload = {
  book_config: {
    total_days: 5,
    current_day: 3,
    genre: "Realismo Magico",
    protagonist: {
      name: "Marco",
      age: 27,
      gender: "M",
      metaphor_domain: "Cucina & Materia",
      emotional_reactivity: "Autoironico / Sarcastico",
      archetype: "L'Alchimista / Conviviale",
      narrative_focus: "Psicologico / Relazionale",
      pacing: "Sincopato e dinamico",
    },
  },
  story_state_memory: {
    previous_chapter_summary:
      "Nel Giorno 2, Marco ha attraversato la città sotto una pioggia sottile, fermandosi al Giardino delle Statue Mute dove un gabbiano gli ha sottratto il pranzo durante un incontro carico di non detti.",
    last_chapter_ending_state: "AT_HOME_RESTING",
    established_locations: {
      loc_home: "Il Rifugio delle Spezie",
      loc_park_new: "Il Giardino delle Statue Mute",
      loc_work_new: "La Fornace Grigia",
    },
    recurring_motifs: [
      "Il gabbiano ladro come presagio di imprevisti",
      "I pensieri che fermentano come lievito madre",
    ],
    unresolved_tensions: ["Le parole rimaste in sospeso durante l'incontro interrotto nel Giorno 2"],
  },
  today_unified_telemetry: {
    date: "2026-10-15",
    slots_merged: ["SLOT_1_NIGHT", "SLOT_2_MORNING", "SLOT_3_AFTERNOON", "SLOT_4_EVENING"],
    is_empty_day: false,
    wake_up_event: {
      time: "06:45",
      semantic_translation: "Risveglio brusco prima dell'alba, interruzione netta del sonno",
    },
    weather_daily_arc: "Mattina limpida e fredda, pomeriggio coperto con vento umido, sera piovosa",
    screen_behavior_summary: {
      doomscrolling_level: "HIGH_MORNING",
      messaging_intensity: "VERY_HIGH_AFTERNOON",
      semantic_translation:
        "Lunghe immersioni mattutine nello specchio nero (oltre 50 minuti di visioni passive), seguite nel pomeriggio da una fitta ragnatela di dispacci silenziosi e conversazioni mute a distanza",
    },
    unified_scenes: [
      {
        slot_origin: "SLOT_2_MORNING",
        time_window: "08:30 - 12:30",
        location_id: "loc_work_new",
        location_alias: "La Fornace Grigia",
        weather: "Cielo terso, vento freddo",
        biometric_vibe: "Concentrazione statica, lieve tensione costante (HR medio 82 bpm, stress moderato)",
        user_notes: [],
      },
      {
        slot_origin: "SLOT_3_AFTERNOON",
        time_window: "13:15 - 14:30",
        location_id: "loc_park_new",
        location_alias: "Il Giardino delle Statue Mute",
        weather: "Nuvole basse in rapido movimento",
        biometric_vibe: "Passo rapido seguito da sosta inquieta (HR 98 bpm)",
        user_notes: [
          {
            time: "13:40",
            text: "Sono tornato sulla panchina di ieri. Il gabbiano mi fissava dal lampione.",
          },
        ],
      },
      {
        slot_origin: "SLOT_4_EVENING",
        time_window: "19:30 - 23:59",
        location_id: "loc_unknown_est_new",
        location_alias: "Luogo sconosciuto nella zona Est della città",
        weather: "Pioggia battente",
        biometric_vibe: "Picco improvviso di adrenalina e tachicardia da fermo alle 21:15 (HR 128 bpm, SpO2 98%)",
        user_notes: [
          {
            time: "21:20",
            text: "Ho bruciato il risotto proprio mentre cercavo di fare colpo.",
          },
        ],
      },
    ],
    midnight_cutoff_status: "OUTSIDE_HIGH_ACTIVITY",
  },
};
