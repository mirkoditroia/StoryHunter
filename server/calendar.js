// Agenda del telefono: impegni della giornata letti dal calendario di sistema.
// Un impegno è un programma, non un fatto: dice che cosa la persona si
// aspettava dalla giornata. Il fatto è dove si trovava a quell'ora, e lo dicono
// le tappe. Il dramma nasce dal confronto fra le due cose.

const MAX_EVENTS = 10;

// Ordine conta: la salute vince su tutto, perché il titolo non deve uscire.
const KIND_RULES = [
  ["health", /\b(?:medic\w*|dottor\w*|dott\.?|visita|dentist\w*|analisi|esam[ei]|prelievo|ospedal\w*|clinic\w*|terapi\w*|psicolog\w*|psicoterap\w*|psichiatr\w*|fisioterap\w*|vaccin\w*|ecografi\w*|radiografi\w*|risonanza|ginecolog\w*|oculist\w*|cardiolog\w*|dermatolog\w*|farmacia)\b/i],
  ["travel", /\b(?:treno|volo|aereo|partenza|viaggio|stazione|aeroporto|navetta|traghetto|pullman)\b/i],
  ["sport", /\b(?:palestra|corsa|allenament\w*|calcetto|yoga|pilates|nuoto|piscina|partita|tennis|padel|crossfit|running|bici)\b/i],
  ["social", /\b(?:cena|pranzo|aperitiv\w*|colazione con|caff[eè] con|compleann\w*|festa|matrimoni\w*|amic\w*|appuntamento con|cinema|teatro|concerto|mostra|serata|anniversari\w*)\b/i],
  ["errand", /\b(?:posta|banca|comune|anagrafe|spesa|ritiro|pacco|meccanico|parrucchier\w*|barbiere|lavanderia|commercialista|notaio|assicurazion\w*|bollett\w*|tintoria)\b/i],
  ["work", /\b(?:riunion\w*|meeting|call|colloquio|client\w*|progett\w*|presentazion\w*|stand-?up|sprint|consegna|scadenza|ufficio|turno|review|revisione|demo|lavoro|webinar|zoom|teams|capo|reparto)\b/i],
];

// Impegni che, per loro natura, portano fuori casa.
export const OUTSIDE_KINDS = new Set(["health", "travel", "sport", "social", "errand"]);

export function calendarKind(title) {
  const text = String(title || "");
  for (const [kind, pattern] of KIND_RULES) if (pattern.test(text)) return kind;
  return "personal";
}

// Il titolo arriva al racconto spoglio: niente link, indirizzi email, numeri,
// codici di riunione, nomi di piattaforme. Un impegno di salute non dice mai
// che cosa è: resta «un appuntamento per la salute».
export function literaryTitle(title, kind = calendarKind(title)) {
  if (kind === "health") return "Appuntamento per la salute";
  const clean = String(title || "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/g, " ")
    .replace(/\+?\d[\d\s./-]{6,}\d/g, " ")
    .replace(/\b(?:id|codice|pin|password|pwd)\s*[:=]?\s*\S+/gi, " ")
    .replace(/\b(?:link|url|online)\b/gi, " ")
    .replace(/\b(?:google\s+meet|meet|zoom|teams|skype|webex|video\s*call|videochiamata|call)\b/gi, "colloquio a distanza")
    .replace(/\b(?:whatsapp|instagram|facebook|telegram|slack|app)\b/gi, " ")
    .replace(/\p{Extended_Pictographic}|️|‍/gu, " ")
    .replace(/[\[\]{}<>|#*_~]+/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
    .trim()
    .slice(0, 80);
  // Una parentesi rimasta sola (il codice tolto ne lasciava metà) se ne va.
  const balanced = (clean.match(/\(/g) || []).length === (clean.match(/\)/g) || []).length
    ? clean
    : clean.replace(/[()]/g, " ").replace(/\s+/g, " ").replace(/[\s,;:–—-]+$/g, "").trim();
  if (!balanced) return "Impegno senza titolo";
  return balanced.charAt(0).toUpperCase() + balanced.slice(1);
}

function normalizeClock(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutes(clock) {
  const match = String(clock || "").match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Un evento del calendario di sistema, come lo manda il telefono per uno slot.
export function normalizeCalendarEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const allDay = Boolean(raw.all_day);
  const start = allDay ? "" : normalizeClock(raw.start);
  if (!allDay && !start) return null;
  let end = allDay ? "" : normalizeClock(raw.end);
  if (end && toMinutes(end) < toMinutes(start)) end = "23:59";
  return { title, start, end: end || start, all_day: allDay, recurring: Boolean(raw.recurring) };
}

export function normalizeCalendar(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_EVENTS).map(normalizeCalendarEvent).filter(Boolean);
}

function sceneBounds(scene) {
  const [start, end] = String(scene.time_window || "").split(" - ");
  return [toMinutes(start), toMinutes(end)];
}

function overlap(fromA, toA, fromB, toB) {
  return Math.max(0, Math.min(toA, toB) - Math.max(fromA, fromB));
}

// Dove si trovava la persona durante l'impegno: la tappa che lo copre di più.
// HOME / AWAY / IN_TRANSIT (per strada) / NO_TRACE (nessuna tappa a quell'ora).
function presenceDuring(event, scenes) {
  const from = toMinutes(event.start);
  const to = Math.max(from + 1, toMinutes(event.end) ?? from + 1);
  let best = null;
  let bestOverlap = 0;
  for (const scene of scenes) {
    const [start, end] = sceneBounds(scene);
    if (start == null || end == null) continue;
    const shared = overlap(from, to, start, Math.max(end, start + 1));
    if (shared > bestOverlap) {
      best = scene;
      bestOverlap = shared;
    }
  }
  if (!best) return { presence: "NO_TRACE", location_id: null, location_alias: null, location_at: null };
  const id = String(best.location_id || "");
  const presence = id.startsWith("loc_home") ? "HOME" : id.startsWith("loc_street") ? "IN_TRANSIT" : "AWAY";
  return { presence, location_id: best.location_id, location_alias: best.location_alias, location_at: best.location_at || null };
}

// Agenda della giornata per il JSON unico: in ordine, senza doppioni,
// ogni impegno affiancato al luogo in cui la persona si trovava davvero.
export function agendaOfDay(slots, scenes) {
  const seen = new Set();
  const events = [];
  for (const slot of slots) {
    for (const event of slot.calendar_events || []) {
      const key = `${event.all_day ? "allday" : event.start}|${event.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(event);
    }
  }
  events.sort((a, b) => (a.all_day === b.all_day ? a.start.localeCompare(b.start) : a.all_day ? -1 : 1));
  return events.slice(0, MAX_EVENTS).map((event) => {
    const kind = calendarKind(event.title);
    const where = event.all_day
      ? { presence: "ALL_DAY", location_id: null, location_alias: null, location_at: null }
      : presenceDuring(event, scenes);
    return {
      time_window: event.all_day ? "tutto il giorno" : `${event.start} - ${event.end}`,
      title: literaryTitle(event.title, kind),
      kind,
      all_day: event.all_day,
      recurring: event.recurring,
      ...where,
    };
  });
}
