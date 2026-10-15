export const GENRES = [
  {
    id: "Noir / Hardboiled",
    short: "Noir",
    blurb: "Ombre, dispacci, stanze che non perdonano.",
  },
  {
    id: "Realismo Magico",
    short: "Realismo magico",
    blurb: "Il quotidiano si dilata e gli oggetti ricordano.",
  },
  {
    id: "Commedia Brillante",
    short: "Commedia",
    blurb: "Ritmo di scena, ironia e imprevisti.",
  },
];

export const GENDERS = [
  { id: "F", label: "Donna" },
  { id: "M", label: "Uomo" },
  { id: "X", label: "Altro" },
];

export const MODELS = [
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 mini — miglior rapporto qualità/prezzo",
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o mini — il più economico",
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    label: "GPT-5 mini — un po' più caro",
  },
  {
    id: "gemini-3.5-flash-lite",
    provider: "google",
    label: "Gemini 3.5 Flash-Lite — il più economico",
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    label: "Gemini 2.5 Flash — prosa più ricca",
  },
];

export const DEFAULT_MODEL = "gpt-4.1-mini";

const KNOWN_MODELS = new Map(MODELS.map((model) => [model.id, model]));

export function resolveModel(model) {
  const chosen = String(model || "").trim();
  return KNOWN_MODELS.has(chosen) ? chosen : DEFAULT_MODEL;
}

export function providerOf(model) {
  return KNOWN_MODELS.get(resolveModel(model))?.provider || "openai";
}

export const SLOT_DEFS = [
  {
    id: "SLOT_1_NIGHT",
    label: "Notte / Alba",
    range: "00:00–05:59",
    defaultWindow: ["00:30", "05:30"],
    defaultWeather: "Buio quieto, aria ferma",
  },
  {
    id: "SLOT_2_MORNING",
    label: "Mattina",
    range: "06:00–11:59",
    defaultWindow: ["07:30", "11:40"],
    defaultWeather: "Cielo terso, vento freddo",
  },
  {
    id: "SLOT_3_AFTERNOON",
    label: "Pomeriggio",
    range: "12:00–17:59",
    defaultWindow: ["12:30", "17:40"],
    defaultWeather: "Nuvole basse in movimento",
  },
  {
    id: "SLOT_4_EVENING",
    label: "Sera",
    range: "18:00–23:59",
    defaultWindow: ["19:00", "23:20"],
    defaultWeather: "Sereno che si spegne",
  },
];

export const PLACE_KINDS = [
  { id: "home", label: "Casa" },
  { id: "work", label: "Lavoro o studio" },
  { id: "park", label: "Parco o giardino" },
  { id: "cafe", label: "Locale, tavolo" },
  { id: "street", label: "In cammino" },
  { id: "unknown", label: "Luogo nuovo" },
];

export const ZONES = [
  { id: "", label: "Zona non indicata" },
  { id: "centro", label: "Centro" },
  { id: "nord", label: "Nord" },
  { id: "est", label: "Est" },
  { id: "sud", label: "Sud" },
  { id: "ovest", label: "Ovest" },
];

export const WEATHERS = [
  "Buio quieto, aria ferma",
  "Cielo terso, vento freddo",
  "Mattina limpida e fredda",
  "Nuvole basse in movimento",
  "Coperto, vento umido",
  "Pioggia sottile",
  "Pioggia battente",
  "Nebbia bassa",
  "Caldo fermo",
  "Temporale in arrivo",
  "Sereno che si spegne",
  "Notte stellata e ventosa",
];

export const QUESTIONS = [
  {
    id: "q1",
    parameter: "metaphor_domain",
    title: "La lente sensoriale",
    prompt:
      "Entri in una città sconosciuta per la prima volta. Cosa cattura subito la tua attenzione?",
    options: [
      {
        id: "A",
        label: "Le forme dei palazzi, le luci, i dettagli visivi e artistici.",
        value: "Arti Visive & Estetica",
      },
      {
        id: "B",
        label: "I profumi che escono dai forni, i mercati, i sapori di strada.",
        value: "Cucina & Materia",
      },
      {
        id: "C",
        label: "Il ritmo dei passi, i parchi, l'energia fisica di chi si muove.",
        value: "Sport & Dinamismo corporeo",
      },
      {
        id: "D",
        label: "I suoni di sottofondo, le voci, la colonna sonora invisibile del luogo.",
        value: "Musica & Atmosfera sonora",
      },
    ],
  },
  {
    id: "q2",
    parameter: "emotional_reactivity",
    title: "L'imprevisto",
    prompt:
      "Un diluvio improvviso manda all'aria i tuoi piani del pomeriggio. Qual è la tua prima reazione interna?",
    options: [
      {
        id: "A",
        label: "Rido della sfortuna: è l'ennesima gag della giornata.",
        value: "Autoironico / Sarcastico",
      },
      {
        id: "B",
        label: "Cerco subito un piano B logico e ricalcolo i tempi.",
        value: "Razionale / Analitico",
      },
      {
        id: "C",
        label: "Mi godo il caos: cambio strada e vedo dove mi porta.",
        value: "Istintivo / Esploratore",
      },
      {
        id: "D",
        label: "Lo prendo come un segno del destino e mi chiudo nei miei pensieri.",
        value: "Malinconico / Riflessivo",
      },
    ],
  },
  {
    id: "q3",
    parameter: "archetype",
    title: "Il rifugio",
    prompt:
      "Hai tre ore libere senza obblighi. Come ricarichi davvero la mente?",
    options: [
      {
        id: "A",
        label: "Creando o osservando: una mostra, un film d'autore, un progetto.",
        value: "Il Creativo / Esteta",
      },
      {
        id: "B",
        label: "Mettendo le mani in pasta: cucinare qualcosa di complesso o scoprire un locale.",
        value: "L'Alchimista / Conviviale",
      },
      {
        id: "C",
        label: "Muovendo il corpo: allenamento, corsa, trekking o fatica fisica.",
        value: "L'Atleta / Cinestetico",
      },
      {
        id: "D",
        label: "Esplorando mondi: lettura, giochi di strategia o pura contemplazione.",
        value: "Il Pensatore / Stratega",
      },
    ],
  },
  {
    id: "q4",
    parameter: "narrative_focus",
    title: "Il dialogo interno",
    prompt:
      "Quando ripensi a una giornata appena conclusa, su cosa si fissa la tua memoria?",
    options: [
      {
        id: "A",
        label: "Sulle parole non dette e sugli sguardi incrociati.",
        value: "Psicologico / Relazionale",
      },
      {
        id: "B",
        label: "Sulle cose concrete che ho concluso o lasciato a metà.",
        value: "Pragmatico / Obiettivi",
      },
      {
        id: "C",
        label: "Sulle assurdità e sui paradossi delle persone incontrate.",
        value: "Satirico / Osservazionale",
      },
      {
        id: "D",
        label: "Sulle sensazioni fisiche: stanchezza, adrenalina, fame, quiete.",
        value: "Viscerale / Sensoriale",
      },
    ],
  },
  {
    id: "q5",
    parameter: "pacing",
    title: "Il ruolo nel mondo",
    prompt:
      "Se la tua settimana fosse un film, che tipo di inquadratura ti rappresenterebbe meglio?",
    options: [
      {
        id: "A",
        label: "Un piano sequenza frenetico in mezzo alla folla.",
        value: "Incalzante e paratattico",
      },
      {
        id: "B",
        label: "Un dettaglio ravvicinato sulle mani mentre fanno qualcosa.",
        value: "Descrittivo e minuzioso",
      },
      {
        id: "C",
        label: "Un campo lungo e silenzioso visto da una finestra in alto.",
        value: "Lento, lirico e contemplativo",
      },
      {
        id: "D",
        label: "Un montaggio alternato pieno di imprevisti e cambi di ritmo.",
        value: "Sincopato e dinamico",
      },
    ],
  },
];

export const PROFILES = [
  {
    id: "marco",
    label: "Marco — Realismo magico — cucina",
    name: "Marco",
    age: 27,
    gender: "M",
    total_days: 5,
    genre: "Realismo Magico",
    answers: { q1: "B", q2: "A", q3: "B", q4: "A", q5: "D" },
  },
  {
    id: "elena",
    label: "Elena — Noir — arti visive",
    name: "Elena",
    age: 34,
    gender: "F",
    total_days: 7,
    genre: "Noir / Hardboiled",
    answers: { q1: "A", q2: "D", q3: "A", q4: "A", q5: "C" },
  },
  {
    id: "chiara",
    label: "Chiara — Commedia brillante — sguardo satirico",
    name: "Chiara",
    age: 29,
    gender: "F",
    total_days: 3,
    genre: "Commedia Brillante",
    answers: { q1: "A", q2: "A", q3: "A", q4: "C", q5: "D" },
  },
];

export function profileFromAnswers(answers) {
  const protagonist = {};
  for (const question of QUESTIONS) {
    const selected = question.options.find((option) => option.id === answers?.[question.id]);
    if (!selected) {
      throw new Error(`Manca la risposta: ${question.title}.`);
    }
    protagonist[question.parameter] = selected.value;
  }
  return protagonist;
}

export function genderVoice(gender) {
  if (gender === "F") return "Usa il femminile grammaticale per il protagonista.";
  if (gender === "M") return "Usa il maschile grammaticale per il protagonista.";
  return "Non forzare un genere grammaticale sul protagonista: privilegia il nome proprio e costruzioni che non assegnino un sesso.";
}
