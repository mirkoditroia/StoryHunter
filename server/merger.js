import { SLOT_DEFS } from "./meta.js";
import { HttpError } from "./errors.js";
import { agendaOfDay, normalizeCalendar } from "./calendar.js";
import { cityOfDay, placeOf, simulatedCity, simulatedGeo } from "./geo.js";
import {
  biometricVibe,
  screenBehavior,
  slotWindow,
  wakeTranslation,
  weatherArc,
} from "./transfiguration.js";

const SLOT_IDS = new Set(SLOT_DEFS.map((slot) => slot.id));
const MOVEMENTS = new Set(["STILL", "WALKING", "TRANSIT"]);
const STRESS = new Set(["low", "moderate", "high"]);
const KINDS = new Set(["home", "work", "park", "cafe", "street", "unknown"]);

export function emptySlot(id) {
  const def = SLOT_DEFS.find((slot) => slot.id === id);
  return {
    id,
    included: true,
    weather: def?.defaultWeather || "",
    doomscrolling_minutes: 0,
    messaging_minutes: 0,
    wake_time: "",
    places: [],
    notes: [],
    notes_text: "",
    calendar_events: [],
  };
}

export function normalizeSlots(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new HttpError(400, "Servono i dati dei quattro slot.");
  }

  const byId = new Map();
  for (const raw of input) {
    if (!raw || !SLOT_IDS.has(raw.id)) continue;
    byId.set(raw.id, normalizeSlot(raw));
  }

  const slots = SLOT_DEFS.map((def) => byId.get(def.id))
    .filter(Boolean)
    .filter((slot) => slot.included);

  if (slots.length === 0) {
    throw new HttpError(400, "Nessuno slot è incluso nel merge.");
  }
  return slots;
}

function normalizeSlot(raw) {
  const notes = normalizeNotes(raw);
  return {
    id: raw.id,
    included: raw.included !== false,
    weather: cleanText(raw.weather, 180),
    doomscrolling_minutes: clamp(raw.doomscrolling_minutes, 0, 600),
    messaging_minutes: clamp(raw.messaging_minutes, 0, 600),
    wake_time: normalizeClock(raw.wake_time),
    places: Array.isArray(raw.places) ? raw.places.slice(0, 8).map(normalizePlace).filter(Boolean) : [],
    notes,
    calendar_events: normalizeCalendar(raw.calendar_events),
  };
}

function normalizePlace(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = KINDS.has(raw.kind) ? raw.kind : "home";
  const hrAvg = raw.hr_avg === "" || raw.hr_avg == null ? 68 : clamp(raw.hr_avg, 35, 210);
  let hrPeak = raw.hr_peak === "" || raw.hr_peak == null ? 0 : clamp(raw.hr_peak, 35, 220);
  if (hrPeak && hrPeak <= hrAvg) hrPeak = 0;
  return {
    kind,
    zone: cleanText(raw.zone, 24).toLowerCase(),
    start: normalizeClock(raw.start),
    end: normalizeClock(raw.end),
    movement: MOVEMENTS.has(raw.movement) ? raw.movement : "STILL",
    hr_avg: hrAvg,
    hr_peak: hrPeak || null,
    hr_peak_time: normalizeClock(raw.hr_peak_time),
    peak_while_still: Boolean(raw.peak_while_still),
    spo2: raw.spo2 === "" || raw.spo2 == null ? null : clamp(raw.spo2, 70, 100),
    stress: STRESS.has(raw.stress) ? raw.stress : "low",
    geo: normalizeGeo(raw.geo),
  };
}

// Esito del reverse geocoding del telefono. Solo nomi pubblici di luogo:
// città, quartiere, via (senza numero civico), nome del posto.
function normalizeGeo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const street = cleanText(raw.street, 80).replace(/[,\s]+\d+[a-z]?$/i, "");
  const geo = {
    city: cleanText(raw.city, 60),
    district: cleanText(raw.district, 60),
    street,
    poi: cleanText(raw.poi, 80),
  };
  return geo.city || geo.street || geo.poi ? geo : null;
}

function normalizeNotes(raw) {
  if (Array.isArray(raw.notes) && raw.notes.length) {
    return raw.notes
      .slice(0, 12)
      .map((note) => ({
        time: normalizeClock(note?.time),
        text: cleanText(note?.text, 500),
      }))
      .filter((note) => note.text);
  }
  return parseNotes(raw.notes_text);
}

export function parseNotes(text) {
  return String(text || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      if (!match) return { time: "", text: cleanText(line, 500) };
      return { time: normalizeClock(match[1]), text: cleanText(match[2], 500) };
    })
    .filter((note) => note.text);
}

export function mergeDay({ book, day, date, slots }) {
  const protagonist = book.book_config.protagonist;
  const storyState = book.story_state;
  const included = normalizeSlots(slots);
  // Con dati veri ogni tappa porta il suo geo (reverse geocoding del GPS) e la
  // città si legge da lì. In locale il GPS è simulato: città e luoghi vengono
  // dallo stradario, sempre uguali per lo stesso libro.
  const seed = book.id || "story";
  const homeCity = simulatedCity(seed);
  const geos = [];
  const geoOf = (place) => {
    const geo = place.geo || simulatedGeo(place, { city: homeCity, seed });
    geos.push(geo);
    return geo;
  };

  const wake = included.map((slot) => slot.wake_time).find(Boolean) || "";
  const scenes = [];

  for (const slot of included) {
    const [fallbackStart, fallbackEnd] = slotWindow(slot.id);
    const places = slot.places.length
      ? slot.places
      : [
          {
            kind: "home",
            zone: "",
            start: fallbackStart,
            end: fallbackEnd,
            movement: "STILL",
            hr_avg: 66,
            hr_peak: null,
            hr_peak_time: "",
            peak_while_still: false,
            spo2: null,
            stress: "low",
          },
        ];

    const built = places.map((place) => {
      const location = placeOf(place, geoOf(place));
      const start = place.start || fallbackStart;
      const end = place.end || fallbackEnd;
      return {
        slot_origin: slot.id,
        time_window: `${start} - ${end}`,
        start,
        location_id: location.location_id,
        location_alias: location.location_alias,
        location_at: location.location_at,
        location_area: location.location_area,
        ...(location.location_also ? { location_also: location.location_also } : {}),
        weather: slot.weather,
        biometric_vibe: biometricVibe(place),
        user_notes: [],
        away: !location.location_id.startsWith("loc_home"),
        high: isHighActivity(place),
      };
    });

    for (const note of slot.notes) {
      const host =
        built.find((scene) => note.time && inWindow(note.time, scene.start, scene.time_window.split(" - ")[1])) ||
        built[built.length - 1];
      host.user_notes.push({ time: note.time || host.start, text: note.text });
    }

    for (const scene of built) {
      delete scene.start;
      scenes.push(scene);
    }
  }

  scenes.sort((a, b) => a.time_window.localeCompare(b.time_window));

  const hasNotes = scenes.some((scene) => scene.user_notes.length > 0);
  const agenda = agendaOfDay(included, scenes);
  // Un impegno che non si ripete è materiale della giornata; la routine no.
  const hasAgenda = agenda.some((event) => !event.recurring);
  const leftHome = scenes.some((scene) => scene.away);
  const last = scenes[scenes.length - 1];
  let midnight = "AT_HOME_RESTING";
  if (last?.away && last.high) midnight = "OUTSIDE_HIGH_ACTIVITY";
  else if (last?.away) midnight = "OUTSIDE_AWAY";

  const publicScenes = scenes.map((scene) => ({
    slot_origin: scene.slot_origin,
    time_window: scene.time_window,
    location_id: scene.location_id,
    location_alias: scene.location_alias,
    location_at: scene.location_at,
    location_area: scene.location_area,
    ...(scene.location_also ? { location_also: scene.location_also } : {}),
    weather: scene.weather,
    biometric_vibe: scene.biometric_vibe,
    user_notes: scene.user_notes,
  }));

  return {
    book_config: {
      total_days: book.book_config.total_days,
      current_day: day,
      genre: book.book_config.genre,
      city: cityOfDay(geos) || homeCity,
      protagonist: {
        name: protagonist.name,
        age: protagonist.age,
        gender: protagonist.gender,
        metaphor_domain: protagonist.metaphor_domain,
        emotional_reactivity: protagonist.emotional_reactivity,
        archetype: protagonist.archetype,
        narrative_focus: protagonist.narrative_focus,
        pacing: protagonist.pacing,
      },
    },
    story_state_memory: storyState,
    today_unified_telemetry: {
      date: date || book.started_on,
      slots_merged: included.map((slot) => slot.id),
      is_empty_day: !leftHome && !hasNotes && !hasAgenda,
      wake_up_event: {
        time: wake || null,
        semantic_translation: wakeTranslation(wake),
      },
      weather_daily_arc: weatherArc(included),
      screen_behavior_summary: screenBehavior(included, protagonist.gender),
      unified_scenes: publicScenes,
      calendar_events: agenda,
      midnight_cutoff_status: midnight,
    },
  };
}

function isHighActivity(place) {
  const peak = Number(place.hr_peak) || 0;
  const hr = Number(place.hr_avg) || 0;
  if (peak >= 105 || hr >= 105) return true;
  if (place.stress === "high") return true;
  return place.movement === "WALKING" || place.movement === "TRANSIT";
}

function inWindow(time, start, end) {
  if (!time || !start || !end) return false;
  const value = toMinutes(time);
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from <= to) return value >= from && value <= to;
  return value >= from || value <= to;
}

function toMinutes(clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function normalizeClock(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
