import { SLOT_DEFS } from "./meta.js";

const HOUR_WORD = [
  "mezzanotte",
  "una",
  "due",
  "tre",
  "quattro",
  "cinque",
  "sei",
  "sette",
  "otto",
  "nove",
  "dieci",
  "undici",
  "mezzogiorno",
  "tredici",
  "quattordici",
  "quindici",
  "sedici",
  "diciassette",
  "diciotto",
  "diciannove",
  "venti",
  "ventuno",
  "ventidue",
  "ventitré",
];

const PERIOD = {
  SLOT_1_NIGHT: "NIGHT",
  SLOT_2_MORNING: "MORNING",
  SLOT_3_AFTERNOON: "AFTERNOON",
  SLOT_4_EVENING: "EVENING",
};

const ARC_LABEL = {
  SLOT_1_NIGHT: "notte",
  SLOT_2_MORNING: "mattina",
  SLOT_3_AFTERNOON: "pomeriggio",
  SLOT_4_EVENING: "sera",
};

const BANNED =
  /\b(smartphone|telefonino|cellulare|telefono|whatsapp|instagram|facebook|tiktok|twitter|gps|notifica|notifiche|smartwatch|doomscrolling|applicazioni|applicazione|touchscreen|social)\b|\bapps?\b/i;

export function containsBanned(text) {
  return BANNED.test(String(text || ""));
}

export function findMeasures(text) {
  const found = new Set();
  const source = String(text || "");
  const measure =
    /\d+(?:[.,]\d+)?\s*(?:°|º|%)|[°%]|centigradi|\b(?:gradi|percento|percentuale|bpm|pulsazioni)\b|battiti al minuto|saturazione dell['’]ossigeno|\bkm\/h\b/gi;
  for (const match of source.matchAll(measure)) {
    found.add(match[0].toLowerCase());
  }
  return [...found].slice(0, 8);
}

export function findBanned(text) {
  const found = new Set();
  const source = String(text || "");
  for (const match of source.matchAll(
    /\b(smartphone|telefonino|cellulare|telefono|whatsapp|instagram|facebook|tiktok|twitter|gps|notifica|notifiche|smartwatch|doomscrolling|applicazioni|applicazione|touchscreen|social|apps?)\b/gi
  )) {
    found.add(match[0].toLowerCase());
  }
  return [...found];
}

export function homeAlias(genre, metaphorDomain = "") {
  const domain = metaphorDomain.toLowerCase();
  if (genre.startsWith("Noir")) {
    if (domain.startsWith("arti")) return "La Camera Oscura";
    if (domain.startsWith("cucina")) return "La Cucina Fredda";
    if (domain.startsWith("sport")) return "Lo Stanzino del Corpo";
    if (domain.startsWith("musica")) return "La Stanza Sorda";
    return "L'Appartamento in Penombra";
  }
  if (genre.startsWith("Realismo")) {
    if (domain.startsWith("cucina")) return "Il Rifugio delle Spezie";
    if (domain.startsWith("arti")) return "La Casa delle Finestre Dipinte";
    if (domain.startsWith("sport")) return "La Stanza che Respira";
    if (domain.startsWith("musica")) return "La Casa delle Corde Mute";
    return "La Casa dalle Pareti Larghe";
  }
  if (domain.startsWith("cucina")) return "Il Quartier Generale delle Pentole";
  if (domain.startsWith("arti")) return "Il Museo Domestico";
  if (domain.startsWith("sport")) return "La Palestra del Divano";
  return "Il Quartier Generale del Divano";
}

export function clockPhrase(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return "a un'ora imprecisata";
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  const word = HOUR_WORD[hour] || "un'ora imprecisata";
  let head = `alle ${word}`;
  if (hour === 0 || hour === 12) head = `a ${word}`;
  if (hour === 1) head = "all'una";
  const tail = minutePhrase(minute);
  return tail ? `${head} ${tail}` : head;
}

function minutePhrase(minute) {
  if (minute === 0) return "";
  if (minute === 15) return "e un quarto";
  if (minute === 30) return "e mezzo";
  if (minute === 45) return "e tre quarti";
  const units = [
    "",
    "uno",
    "due",
    "tre",
    "quattro",
    "cinque",
    "sei",
    "sette",
    "otto",
    "nove",
    "dieci",
    "undici",
    "dodici",
    "tredici",
    "quattordici",
    "quindici",
    "sedici",
    "diciassette",
    "diciotto",
    "diciannove",
  ];
  if (minute < 20) return `e ${units[minute]}`;
  const tens = ["", "", "venti", "trenta", "quaranta", "cinquanta"];
  const ten = tens[Math.floor(minute / 10)];
  const unit = minute % 10;
  if (!unit) return `e ${ten}`;
  const stem = unit === 1 || unit === 8 ? ten.slice(0, -1) : ten;
  return `e ${stem}${units[unit]}`;
}

export function wakeTranslation(genre, time) {
  if (!time) {
    return "Nessun richiamo ha spezzato il sonno in un'ora precisa.";
  }
  const hour = Number(time.slice(0, 2));
  const when = clockPhrase(time);
  const early = hour < 6;
  const late = hour >= 9;

  if (genre.startsWith("Noir")) {
    if (early) {
      return `La sirena del mattino squarciò il buio della stanza ${when}, prima che la città ammettesse di essere sveglia.`;
    }
    if (late) {
      return `La sirena del mattino arrivò tardi e squarciò comunque il buio della stanza ${when}.`;
    }
    return `La sirena del mattino squarciò il buio della stanza ${when}.`;
  }

  if (genre.startsWith("Realismo")) {
    if (early) {
      return `Il richiamo metallico ruppe l'incantesimo del sonno ${when}, alle prime luci che non erano ancora luci.`;
    }
    if (late) {
      return `Il richiamo metallico tardò, poi ruppe l'incantesimo del sonno ${when}.`;
    }
    return `Il richiamo metallico ruppe l'incantesimo del sonno ${when}.`;
  }

  if (early) {
    return `L'impietoso gong decretò la fine della pace ${when}, con un anticipo che sembrava uno scherzo di cattivo gusto.`;
  }
  if (late) {
    return `L'impietoso gong decretò la fine della pace solo ${when}, quando la mattina era già un pettegolezzo.`;
  }
  return `L'impietoso gong decretò la fine della pace ${when}.`;
}

function intensity(minutes) {
  const value = Number(minutes) || 0;
  if (value <= 0) return "NONE";
  if (value < 25) return "LOW";
  if (value < 50) return "MODERATE";
  if (value < 90) return "HIGH";
  return "VERY_HIGH";
}

function dominantSlot(slots, field) {
  let best = null;
  let bestValue = 0;
  for (const slot of slots) {
    const value = Number(slot[field]) || 0;
    if (value > bestValue) {
      bestValue = value;
      best = slot.id;
    }
  }
  return bestValue > 0 ? best : null;
}

function spellbound(gender) {
  if (gender === "F") return "ipnotizzata";
  if (gender === "X") return "in stato di ipnosi";
  return "ipnotizzato";
}

function doomClause(genre, level, minutes, gender) {
  if (level === "NONE") return "";
  const span =
    level === "LOW"
      ? "Per pochi minuti"
      : level === "MODERATE"
        ? "A tratti"
        : level === "HIGH"
          ? "A lungo"
          : "Per un tempo che divora le ore";
  const daze = spellbound(gender);

  if (genre.startsWith("Noir")) {
    if (gender === "X") {
      return `${span}, lo sguardo restò fisso sul rettangolo di vetro luminoso, a cercare indizi nelle vite degli altri (${minutes} minuti)`;
    }
    return `${span}, restò ${daze} dal rettangolo di vetro luminoso, cercando indizi nelle vite degli altri (${minutes} minuti)`;
  }
  if (genre.startsWith("Realismo")) {
    return `${span}, lo specchio nero tascabile tenne lo sguardo, e vi scorrevano visioni di mondi lontani e irraggiungibili (${minutes} minuti)`;
  }
  if (gender === "X") {
    return `${span}, la tana del bianconiglio si aprì su un carosello infinito di vite altrui (${minutes} minuti)`;
  }
  return `${span}, scivolò nella tana del bianconiglio, ${daze} da un carosello infinito di vite altrui (${minutes} minuti)`;
}

function messageClause(genre, level, minutes) {
  if (level === "NONE") return "";
  const span =
    level === "LOW"
      ? "Per poco"
      : level === "MODERATE"
        ? "A più riprese"
        : level === "HIGH"
          ? "A lungo"
          : "Senza tregua";

  if (genre.startsWith("Noir")) {
    return `${span}, un fitto scambio di dispacci silenziosi e messaggi cifrati tenne occupate le dita (${minutes} minuti)`;
  }
  if (genre.startsWith("Realismo")) {
    return `${span}, parole invisibili viaggiarono nell'etere e tesserono una ragnatela di conversazioni mute (${minutes} minuti)`;
  }
  return `${span}, un ping-pong di botta e risposta a distanza non lasciò tregua ai pollici (${minutes} minuti)`;
}

export function screenBehavior(genre, slots, gender = "M") {
  const doomMinutes = slots.reduce((sum, slot) => sum + (Number(slot.doomscrolling_minutes) || 0), 0);
  const messageMinutes = slots.reduce((sum, slot) => sum + (Number(slot.messaging_minutes) || 0), 0);
  const doomLevel = intensity(doomMinutes);
  const messageLevel = intensity(messageMinutes);
  const doomSlot = dominantSlot(slots, "doomscrolling_minutes");
  const messageSlot = dominantSlot(slots, "messaging_minutes");

  const doomClauseText = doomClause(genre, doomLevel, doomMinutes, gender);
  const messageClauseText = messageClause(genre, messageLevel, messageMinutes);
  let semantic;
  if (!doomClauseText && !messageClauseText) {
    semantic = genre.startsWith("Commedia")
      ? "Lo specchio nero restò chiuso e nessun dispaccio pretese le dita: la giornata parlò solo di persona."
      : "Nessuna immersione nello specchio nero e nessun dispaccio a distanza: la giornata restò nel mondo a portata di mano.";
  } else if (doomClauseText && messageClauseText) {
    semantic = `${doomClauseText}. ${messageClauseText}.`;
  } else {
    semantic = `${doomClauseText || messageClauseText}.`;
  }

  return {
    doomscrolling_level: doomSlot ? `${doomLevel}_${PERIOD[doomSlot]}` : "NONE",
    messaging_intensity: messageSlot ? `${messageLevel}_${PERIOD[messageSlot]}` : "NONE",
    semantic_translation: semantic,
  };
}

export function weatherArc(slots) {
  const parts = slots
    .filter((slot) => slot.weather)
    .map((slot) => {
      const weather = String(slot.weather).trim();
      const label = ARC_LABEL[slot.id];
      if (weather.toLowerCase().startsWith(label)) return lowerFirst(weather);
      return `${label} ${lowerFirst(weather)}`;
    });
  return parts.join(", ");
}

export function biometricVibe(place) {
  const hr = Number(place.hr_avg) || 0;
  const peak = Number(place.hr_peak) || 0;
  const bits = [];

  if (place.movement === "WALKING") bits.push("Passo rapido");
  else if (place.movement === "TRANSIT") bits.push("Spostamento prolungato");
  else bits.push("Corpo fermo");

  if (hr) bits.push(`ritmo medio ${Math.round(hr)} bpm`);

  const stress = { low: "stress lieve", moderate: "stress moderato", high: "stress alto" }[place.stress];
  if (stress) bits.push(stress);

  const peakMatters = peak >= Math.max(hr, 60) * 1.15 && peak > hr;
  if (peakMatters) {
    const still = Boolean(place.peak_while_still) || place.movement === "STILL";
    const when = place.hr_peak_time ? ` alle ${place.hr_peak_time}` : "";
    const spo2 = place.spo2 ? `, SpO2 ${Math.round(Number(place.spo2))}%` : "";
    if (still) {
      bits.push(`picco improvviso di tachicardia da fermo${when} (HR ${Math.round(peak)} bpm${spo2})`);
    } else {
      bits.push(`picco di battito${when} (HR ${Math.round(peak)} bpm${spo2})`);
    }
  } else if (place.spo2) {
    bits.push(`SpO2 ${Math.round(Number(place.spo2))}%`);
  }

  return bits.join(", ");
}

const HINTS = {
  home: "interno domestico",
  work: "luogo di fatica quotidiana, orari fissi e stanze chiuse",
  park: "giardino pubblico con panchine e alberi",
  cafe: "locale con tavoli, in mezzo agli altri",
  street: "tratto di strada urbana",
  unknown: "luogo mai nominato prima",
};

export function resolveLocation(place, storyState, genre, metaphorDomain) {
  const kind = place.kind || "home";
  const zone = String(place.zone || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const base = kind === "street" || kind === "unknown" ? `loc_${kind}_${zone || "generica"}` : `loc_${kind}`;
  const novelKey = `${base}_new`;
  const known = storyState?.established_locations || {};

  if (known[base]) return { location_id: base, location_alias: known[base] };
  if (known[novelKey]) return { location_id: novelKey, location_alias: known[novelKey] };
  if (kind === "home") {
    return { location_id: "loc_home", location_alias: homeAlias(genre, metaphorDomain) };
  }

  const zonePart = zone ? `, zona ${zone}` : "";
  return {
    location_id: novelKey,
    location_alias: `Luogo sconosciuto (${HINTS[kind] || "sosta"}${zonePart})`,
  };
}

export function slotWindow(slotId) {
  const def = SLOT_DEFS.find((slot) => slot.id === slotId);
  return def?.defaultWindow || ["00:00", "23:59"];
}

function lowerFirst(text) {
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}
