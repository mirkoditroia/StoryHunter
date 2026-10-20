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
    /\d+(?:[.,]\d+)?\s*(?:°|º|%)|[°%]|centigradi|\b(?:gradi|percento|percentuale|bpm|pulsazioni|tachicardi\w*)\b|battiti al minuto|saturazione dell['’]ossigeno|\bkm\/h\b/gi;
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
  // Il sostantivo dice la funzione (è la casa intera, mai una sola stanza);
  // la lente del protagonista entra solo come epiteto.
  const domain = metaphorDomain.toLowerCase();
  if (genre.startsWith("Noir")) {
    if (domain.startsWith("arti")) return "La Casa in Penombra";
    if (domain.startsWith("cucina")) return "La Casa Fredda";
    if (domain.startsWith("sport")) return "La Casa del Corpo Stanco";
    if (domain.startsWith("musica")) return "La Casa Sorda";
    return "La Casa in Penombra";
  }
  if (genre.startsWith("Realismo")) {
    if (domain.startsWith("cucina")) return "La Casa delle Spezie";
    if (domain.startsWith("arti")) return "La Casa delle Finestre Dipinte";
    if (domain.startsWith("sport")) return "La Casa che Respira";
    if (domain.startsWith("musica")) return "La Casa delle Corde Mute";
    return "La Casa dalle Pareti Larghe";
  }
  if (domain.startsWith("cucina")) return "La Casa delle Pentole";
  if (domain.startsWith("arti")) return "La Casa Museo";
  if (domain.startsWith("sport")) return "La Casa del Divano";
  return "La Casa del Divano";
}

// Un nome di luogo non può dichiarare un mestiere che i dati non documentano
// («L'Officina…», «L'Ufficio…»): il sostantivo dice solo la funzione.
export function isInventedTradeName(name) {
  return /^(?:l['’]\s*|la |il |lo )?(?:officina|fabbrica|ufficio|studio|negozio|vetrina|bottega|atelier)\b/i.test(
    String(name || "").trim()
  );
}

export function isProvisionalAlias(alias) {
  return /^luogo sconosciuto/i.test(String(alias || "").trim());
}

const HEARTBEAT = /\b(?:cuore|battit\w*|polso|pulsazion\w*|cardiac\w*)\b/gi;

export function countHeartbeats(text) {
  return (String(text || "").match(HEARTBEAT) || []).length;
}

const ECHO_STOPWORDS = new Set([
  "mentre",
  "ancora",
  "quando",
  "prima",
  "dopo",
  "giorno",
  "notte",
  "mattina",
  "pomeriggio",
  "sera",
  "stesso",
  "stessa",
  "stessi",
  "stesse",
  "quello",
  "quella",
  "questo",
  "questa",
  "essere",
  "aveva",
  "erano",
  "senza",
  "sopra",
  "sotto",
  "verso",
  "oltre",
  "lungo",
  "dentro",
  "fuori",
  "avevano",
]);

function echoToken(raw) {
  // «l'asfalto» e «d'asfalto» sono la stessa parola: conta il frammento dopo l'elisione.
  const tail = String(raw).split(/['’]/).pop() || "";
  return tail
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

const PROVISIONAL_PHRASES = [
  "luogo di fatica quotidiana",
  "orari fissi e stanze chiuse",
  "tratto di strada urbana",
  "giardino pubblico con panchine",
  "locale con tavoli, in mezzo agli altri",
  "luogo mai nominato prima",
  "luogo sconosciuto",
];

export function findProvisionalLeaks(text) {
  const source = String(text || "").toLowerCase();
  return PROVISIONAL_PHRASES.filter((phrase) => source.includes(phrase));
}

const TIME_LED = /^(alle|all'|a mezzogiorno|a mezzanotte|verso le|poco prima delle|poco dopo le|nel primo pomeriggio|in serata)\b/i;

export function countTimeLedParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && TIME_LED.test(paragraph)).length;
}

// Il dettaglio di un appunto (qui: la bevanda) non si celebra né si ripete:
// giochi di parole e ritorni sono un tormentone, non un motivo.
export function findDetailHype(text) {
  const source = String(text || "").toLowerCase();
  const hype = source.match(/schium\w*|luppolo|boccal\w*/g) || [];
  const beers = source.match(/birr\w*/g) || [];
  const hits = [...hype];
  if (beers.length > 1) hits.push(...beers);
  return hits;
}

const WAKE_CLICHES = ["ruppe l'incantesimo del sonno", "squarciò il buio", "decretò la fine della pace", "richiamo metallico"];

export function findWakeCliches(text) {
  const source = String(text || "").toLowerCase();
  return WAKE_CLICHES.filter((phrase) => source.includes(phrase));
}

export function findEchoes(text) {
  const found = new Set();
  const sentences = String(text || "").split(/[.!?…]+/);
  for (const sentence of sentences) {
    const counts = new Map();
    for (const raw of sentence.split(/\s+/)) {
      const token = echoToken(raw);
      if (token.length < 6 || ECHO_STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    for (const [token, count] of counts) {
      if (count > 1) found.add(token);
    }
  }
  return [...found].slice(0, 6);
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

// Il risveglio arriva al narratore come dato, non come frase fatta:
// una formula pronta finiva ricopiata in apertura di ogni capitolo.
export function wakeTranslation(_genre, time) {
  if (!time) return "Risveglio senza un'ora precisa. Dato di contorno: si racconta solo se serve alla storia.";
  const hour = Number(time.slice(0, 2));
  const moment = hour < 6 ? "prima dell'alba, molto presto" : hour >= 9 ? "tardi rispetto al mattino" : "a un'ora consueta del mattino";
  return `Risveglio ${roughClock(time)}, ${moment}. Dato di contorno: si racconta solo se serve alla storia.`;
}

// Ora detta come la direbbe una persona: «poco prima delle sette», «verso le nove».
export function roughClock(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return "a un'ora imprecisata";
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  if (minute >= 40) return `poco prima ${hourWith("di", (hour + 1) % 24)}`;
  if (minute >= 20) return `verso ${hourWith("", hour)} e mezza`;
  if (minute >= 5) return `poco dopo ${hourWith("", hour)}`;
  return `verso ${hourWith("", hour)}`;
}

// «le sette», «l'una», «mezzogiorno»; con «di»: «delle sette», «dell'una», «di mezzogiorno».
function hourWith(preposition, hour) {
  const word = HOUR_WORD[hour];
  if (hour === 0 || hour === 12) return preposition ? `${preposition} ${word}` : word;
  if (hour === 1) return preposition ? "dell'una" : "l'una";
  return preposition ? `delle ${word}` : `le ${word}`;
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

const SPAN = {
  LOW: "per pochi minuti",
  MODERATE: "a tratti",
  HIGH: "a lungo",
  VERY_HIGH: "per gran parte del tempo libero",
};

const MOMENT = {
  SLOT_1_NIGHT: "di notte",
  SLOT_2_MORNING: "soprattutto la mattina",
  SLOT_3_AFTERNOON: "soprattutto il pomeriggio",
  SLOT_4_EVENING: "soprattutto la sera",
};

export function screenBehavior(genre, slots, gender = "M") {
  const doomMinutes = slots.reduce((sum, slot) => sum + (Number(slot.doomscrolling_minutes) || 0), 0);
  const messageMinutes = slots.reduce((sum, slot) => sum + (Number(slot.messaging_minutes) || 0), 0);
  const doomLevel = intensity(doomMinutes);
  const messageLevel = intensity(messageMinutes);
  const doomSlot = dominantSlot(slots, "doomscrolling_minutes");
  const messageSlot = dominantSlot(slots, "messaging_minutes");

  // Contenuto, non frasi: le metafore pronte («specchio nero tascabile»)
  // finivano ricopiate identiche in ogni capitolo e in quarta di copertina.
  const parts = [];
  if (doomLevel !== "NONE") {
    parts.push(`scorrimento passivo di immagini e vite altrui ${SPAN[doomLevel]}, ${MOMENT[doomSlot] || ""}`.trim().replace(/,$/, ""));
  }
  if (messageLevel !== "NONE") {
    parts.push(`conversazioni scritte a distanza ${SPAN[messageLevel]}, ${MOMENT[messageSlot] || ""}`.trim().replace(/,$/, ""));
  }
  const semantic = parts.length
    ? `Schermo: ${parts.join("; ")}. Dato di contorno, mai un oggetto in scena: vale per ciò che rivela (un desiderio, un'attesa, qualcuno con cui si parla).`
    : "Schermo quasi spento: la giornata si è vissuta di persona.";

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

// --- Correzioni deterministiche e controlli drammaturgici -------------------

const PREP_STEM = { di: "de", de: "de", a: "a", da: "da", in: "ne", ne: "ne", su: "su" };
const ARTICLE_TAIL = { il: "l", lo: "llo", la: "lla", i: "i", gli: "gli", le: "lle", "l'": "ll'" };

// «de La Casa», «a Il Tavolo», «ne L'Archivio» non esistono in italiano:
// diventano «della Casa», «al Tavolo», «nell'Archivio». Il modello ci ricade
// anche quando il prompt lo vieta, quindi si corregge qui, senza un'altra chiamata.
export function fixPrepositions(text) {
  return String(text || "").replace(
    /(^|[^\p{L}'’])(di|de|a|da|in|ne|su|Di|De|A|Da|In|Ne|Su)\s+(Il|Lo|La|I|Gli|Le|L['’])(?=[\s\p{L}])/gu,
    (match, before, prep, article) => {
      const stem = PREP_STEM[prep.toLowerCase()];
      const tail = ARTICLE_TAIL[article.toLowerCase().replace("’", "'")];
      if (!stem || !tail) return match;
      const merged = stem + tail;
      const cased = prep[0] === prep[0].toUpperCase() ? merged[0].toUpperCase() + merged.slice(1) : merged;
      return `${before}${cased}`;
    }
  );
}

// Gli attrezzi del mestiere non vanno in scena: il lettore deve sentire la
// svolta, non leggere la parola «svolta».
const SCAFFOLDING = [
  /\bl['’]obiettivo (?:era|di)\b/i,
  /\bl['’]ostacolo\b/i,
  /\bl['’]esito di\b/i,
  /\bpunto di svolta\b/i,
  /\bla svolta\b/i,
  /\bl['’]innesco\b/i,
  /\b(?:primo|secondo|terzo) atto\b/i,
  /\bclimax\b/i,
  /\bposta in gioco\b/i,
  /\bl['’]intento era\b/i,
  /\bprima prova\b/i,
  /\bl['’]intenzione è\b/i,
  /\bla meta impone\b/i,
  /\bla ricerca di [^.]{0,60}si scontra\b/i,
];

export function findScaffolding(text) {
  const source = String(text || "");
  return SCAFFOLDING.map((pattern) => source.match(pattern)?.[0]).filter(Boolean);
}

// Le voci del profilo («Razionale / Analitico», «L'Atleta / Cinestetico»)
// sono istruzioni per il tono: se finiscono nella prosa diventano etichette.
const LABEL_FIELDS = ["emotional_reactivity", "archetype", "narrative_focus"];

export function profileLabelStems(protagonist = {}) {
  const stems = new Set();
  for (const field of LABEL_FIELDS) {
    for (const raw of String(protagonist[field] || "").split(/[^\p{L}]+/u)) {
      const word = raw.toLowerCase();
      if (word.length < 6) continue;
      stems.add(word.slice(0, Math.max(5, word.length - 2)));
    }
  }
  return [...stems];
}

export function findProfileLabels(text, protagonist) {
  const words = String(text || "").toLowerCase().split(/[^\p{L}]+/u);
  const found = new Set();
  for (const stem of profileLabelStems(protagonist)) {
    const hit = words.find((word) => word.startsWith(stem));
    if (hit) found.add(hit);
  }
  return [...found];
}

const WAKE_SOUND = /\b(?:sveglia|richiamo|suono|squillo|trillo|gong|sirena|campanell\w*|allarme)\b/i;
const WAKE_BREAK = /\b(?:ruppe|interruppe|strapp\w*|squarci\w*|decret\w*|spezz\w*|lacer\w*|risvegli\w*)\b/i;

// Aprire ogni capitolo con «il suono che interrompe il sonno» è la formula
// più logora del libro: l'incipit deve partire dalla storia, non dalla sveglia.
export function opensWithWakeUp(text) {
  const first = String(text || "").trim().split(/(?<=[.!?…])\s/)[0] || "";
  return WAKE_SOUND.test(first) && WAKE_BREAK.test(first);
}

const DEVICE = /specchio nero|schermo|tascabil\w*|rettangolo (?:di vetro|luminoso)|oggetto nero/gi;

export function countDeviceMentions(text) {
  return (String(text || "").match(DEVICE) || []).length;
}

// Tic di scrittura: la stessa parola piena tre o più volte nel capitolo
// («geometria», «precisione»). I nomi propri non contano.
export function findOveruse(text, ignore = []) {
  const skip = new Set(ignore.flatMap((name) => String(name).toLowerCase().split(/[^\p{L}]+/u)).filter(Boolean));
  const counts = new Map();
  for (const raw of String(text || "").split(/[^\p{L}'’]+/u)) {
    const word = (raw.split(/['’]/).pop() || "").toLowerCase();
    if (word.length < 7 || skip.has(word) || ECHO_STOPWORDS.has(word)) continue;
    const stem = word.slice(0, 7);
    const seen = counts.get(stem);
    counts.set(stem, { count: (seen?.count || 0) + 1, word: seen?.word || word });
  }
  return [...counts.values()].filter((entry) => entry.count >= 3).map((entry) => `${entry.word} ×${entry.count}`);
}

const SPOKEN_TIME = /\b(?:alle|all['’]una|verso l[ea']|poco (?:prima|dopo) (?:del|dell['’]|di|l)|a mezzogiorno|a mezzanotte|nel primo pomeriggio|nel tardo pomeriggio|in serata|a metà (?:mattina|pomeriggio))/i;

// Cronaca: paragrafi che si aprono con «Nel Luogo, verso le dieci…».
export function countChronicleParagraphs(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .filter((paragraph) => SPOKEN_TIME.test(paragraph.trim().slice(0, 70))).length;
}

export function firstSentence(text) {
  return (String(text || "").trim().split(/(?<=[.!?…])\s/)[0] || "").slice(0, 200);
}

const TITLE_STOP = new Set(["della", "delle", "degli", "dello", "nella", "nelle", "sulla", "sulle", "dalla", "dalle", "quando", "senza", "verso", "oltre", "sotto", "sopra", "prima", "dopo", "ancora"]);

function titleWords(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 5 && !TITLE_STOP.has(word));
}

// Parole piene di un titolo già usate in titoli precedenti («Geometria» tre volte).
export function titleOverlap(title, usedTitles = []) {
  const used = new Set(usedTitles.flatMap(titleWords));
  return [...new Set(titleWords(title).filter((word) => used.has(word)))];
}
