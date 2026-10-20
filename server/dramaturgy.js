import { fixPrepositions, isProvisionalAlias, roughClock } from "./transfiguration.js";

// Analisi drammaturgica fatta dal codice, prima di qualsiasi chiamata al modello.
// Un modello piccolo, davanti a una lista di fasce orarie, scrive cronaca:
// qui gli si consegna già scelto il materiale che fa storia, in ordine di forza,
// e il ponte con la fine del capitolo precedente.

const CUTOFF_LABEL = {
  AT_HOME_RESTING: "in casa",
  OUTSIDE_CLIFFHANGER: "ancora fuori casa, in piena attività",
  OUTSIDE_HIGH_ACTIVITY: "ancora fuori casa, in piena attività",
  OUTSIDE_AWAY: "ancora fuori casa",
};

export function sceneStart(scene) {
  return String(scene?.time_window || "").split(" - ")[0] || "";
}

export function sceneEnd(scene) {
  return String(scene?.time_window || "").split(" - ")[1] || "";
}

// «verso le sette e mezza, fino a poco prima delle nove»
function span(start, end) {
  return end ? `${roughClock(start)}, fino a ${roughClock(end)}` : roughClock(start);
}

function minutes(clock) {
  const match = String(clock || "").match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isHome(scene) {
  return String(scene?.location_id || "").startsWith("loc_home");
}

function kindOf(scene) {
  const id = String(scene?.location_id || "");
  const match = id.match(/^loc_(home|work|park|cafe|street|unknown)/);
  return match ? match[1] : "unknown";
}

function placeName(scene, memory) {
  const known = memory?.established_locations?.[scene.location_id];
  if (known && !isProvisionalAlias(known)) return known;
  if (isProvisionalAlias(scene.location_alias)) {
    const hint = provisionalHint(scene.location_alias);
    return `un luogo ancora senza nome${hint ? ` (${hint})` : ""}`;
  }
  return scene.location_alias || "un luogo";
}

function provisionalHint(alias) {
  return String(alias || "")
    .replace(/^luogo sconosciuto\s*/i, "")
    .replace(/^\(|\)$/g, "")
    .trim();
}

// Eventi candidati a diventare dramma, dal più forte al più debole.
export function dramaticEvents(payload) {
  return rankedEvents(payload).map((event) => event.text);
}

// Un evento forte (appunto, luogo mai visto, picco da fermo, notte fuori) è
// l'incidente scatenante che può fissare il filo conduttore del romanzo.
export function hasStrongEvent(payload) {
  return rankedEvents(payload).some((event) => event.weight >= 5);
}

// Seme del filo conduttore: una domanda concreta costruita dal codice
// sull'evento più forte. Il modello la rifinisce, ma non può più inventarsi
// un filo astratto («la cortina delle ore») o una banalità («il tavolo al centro»).
export function threadSeed(payload) {
  return rankedEvents(payload).find((event) => event.weight >= 5 && event.seed)?.seed || "";
}

function rankedEvents(payload) {
  const today = payload.today_unified_telemetry || {};
  const memory = payload.story_state_memory || {};
  const scenes = today.unified_scenes || [];
  const events = [];
  const who = payload.book_config?.protagonist?.name || "il protagonista";
  const add = (weight, at, text, seed = "") => events.push({ weight, at: minutes(at) ?? 0, text, seed });
  const weatherSeen = new Set();

  for (const scene of scenes) {
    const name = placeName(scene, memory);
    const start = sceneStart(scene);
    const end = sceneEnd(scene);
    const vibe = String(scene.biometric_vibe || "");

    for (const note of scene.user_notes || []) {
      const text = String(note.text || "").replace(/`/g, "'").trim();
      if (text) {
        add(
          6,
          note.time || start,
          `APPUNTO — ${name} — ${roughClock(note.time || start)} — «${text}»`,
          `Cosa farà ${who} di ciò che ha scritto a ${name} («${text}»)?`
        );
      }
    }

    if (!isHome(scene) && isProvisionalAlias(scene.location_alias) && kindOf(scene) !== "street") {
      const hint = provisionalHint(scene.location_alias);
      add(
        5,
        start,
        `LUOGO MAI VISTO — ${hint || "senza indizi"} — ${span(start, end)}`,
        `Che cosa ha portato ${who} in quel luogo mai visto${hint ? ` (${hint})` : ""}, e ci tornerà?`
      );
    }

    if (/tachicardia da fermo/i.test(vibe)) {
      const at = vibe.match(/alle (\d{2}:\d{2})/)?.[1] || start;
      add(
        5,
        at,
        `PICCO A CORPO FERMO — ${name} — ${roughClock(at)} — causa non documentata`,
        `Che cosa ha fatto sobbalzare ${who} a ${name}, e lo cercherà ancora?`
      );
    }

    const startMin = minutes(start);
    if (!isHome(scene) && !isProvisionalAlias(scene.location_alias) && startMin != null && startMin >= 21 * 60) {
      add(4, start, `FUORI A TARDA SERA — ${name} — ${roughClock(start)}`);
    }

    if (/stress alto/i.test(vibe) && !/tachicardia da fermo/i.test(vibe)) {
      add(3, start, `TENSIONE ALTA — ${name} — ${roughClock(start)}`);
    }

    if (["park", "cafe"].includes(kindOf(scene)) && !isProvisionalAlias(scene.location_alias)) {
      add(2, start, `SOSTA FUORI ROUTINE — ${name} — ${roughClock(start)}`);
    }

    const wind = Number(String(scene.weather || "").match(/vento[^,]*?(\d+)\s*km\/h/i)?.[1] || 0);
    const harsh = wind >= 25 || /pioggia battente|temporale|grandine|neve/i.test(scene.weather || "");
    if (harsh && !weatherSeen.has(scene.weather)) {
      weatherSeen.add(scene.weather);
      const sky = String(scene.weather).split(",")[0].trim().toLowerCase();
      add(1, start, `TEMPO AVVERSO — ${roughClock(start)} — ${wind >= 25 ? `vento forte, cielo ${sky}` : sky}`);
    }
  }

  // Buchi nella giornata: ore senza traccia fra due luoghi diversi, di giorno.
  // Sono il «chissà dove è stato» che il lettore si porta dietro; fra due
  // scene nello stesso luogo, invece, è solo una pausa.
  for (let i = 1; i < scenes.length; i += 1) {
    if (scenes[i - 1].location_id === scenes[i].location_id) continue;
    const gapFrom = minutes(sceneEnd(scenes[i - 1]));
    const gapTo = minutes(sceneStart(scenes[i]));
    if (gapFrom == null || gapTo == null) continue;
    if (gapTo - gapFrom >= 75 && gapFrom >= 7 * 60) {
      add(
        2,
        sceneEnd(scenes[i - 1]),
        `ORE SENZA TRACCIA — fra ${sceneEnd(scenes[i - 1])} e ${sceneStart(scenes[i])} — cosa sia successo non è documentato: domanda, mai fatto`
      );
    }
  }

  const cutoff = today.midnight_cutoff_status;
  const last = scenes.at(-1);
  if (last && cutoff && cutoff !== "AT_HOME_RESTING") {
    add(
      5,
      sceneEnd(last),
      `FINE GIORNATA FUORI CASA — ${placeName(last, memory)} — ${CUTOFF_LABEL[cutoff]}, senza rientro nel capitolo`,
      `Che cosa tiene ${who} fuori casa fino a notte, a ${placeName(last, memory)}?`
    );
  }

  return events.sort((a, b) => b.weight - a.weight || a.at - b.at).slice(0, 7);
}

// Ponte fra ieri e oggi: dove si era chiuso il capitolo e dove riparte la giornata.
export function bridgeFromYesterday(payload) {
  const memory = payload.story_state_memory || {};
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  if (Number(payload.book_config?.current_day) <= 1) return "";
  const last = memory.last_scene;
  const ending = memory.last_chapter_ending_state;
  const first = scenes[0];
  const yesterday = last
    ? `Ieri il capitolo si è chiuso a ${last.place}, ${last.when}, ${CUTOFF_LABEL[ending] || "in casa"}.`
    : `Ieri il capitolo si è chiuso ${CUTOFF_LABEL[ending] || "in casa"}.`;
  if (!first) return yesterday;
  const todayStart = `Oggi la prima traccia è a ${placeName(first, memory)}, ${roughClock(sceneStart(first))}.`;
  const outside = ending && ending !== "AT_HOME_RESTING";
  const backHome = isHome(first);
  const gap = outside && backHome
    ? " Il rientro non è documentato: come e quando sia avvenuto è una domanda da aprire nell'Atto I, non un fatto da inventare."
    : "";
  return `${yesterday} ${todayStart}${gap}`;
}

// Riassunto della scena finale, salvato nella memoria per il ponte di domani.
export function lastSceneOf(payload, established = {}) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  const last = scenes.at(-1);
  if (!last) return null;
  const name = established[last.location_id] && !isProvisionalAlias(established[last.location_id])
    ? established[last.location_id]
    : last.location_alias;
  return {
    location_id: last.location_id,
    place: name,
    when: span(sceneStart(last), sceneEnd(last)),
  };
}

const FUNCTION_NOUN = [
  [/_work_/, "Lavoro"],
  [/_park_/, "Parco/Giardino"],
  [/_cafe_/, "Locale/Tavolo"],
  [/_street_/, "Via/Cammino"],
  [/_home/, "Casa"],
];

function functionNoun(locationId) {
  for (const [pattern, noun] of FUNCTION_NOUN) if (pattern.test(locationId)) return noun;
  return "Luogo";
}

export function placesToBaptize(payload) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  const known = payload.story_state_memory?.established_locations || {};
  const found = new Map();
  for (const scene of scenes) {
    const id = String(scene.location_id || "");
    const alias = String(scene.location_alias || "");
    const established = String(known[id] || "");
    const needsName = id.endsWith("_new") && isProvisionalAlias(alias) && (!established || isProvisionalAlias(established));
    if (needsName && !found.has(id)) {
      found.set(id, `${id} → sostantivo ${functionNoun(id)} (indizio: ${provisionalHint(alias) || "nessuno"})`);
    }
  }
  return [...found.values()];
}

export function peaksAtRest(payload) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  return scenes
    .filter((scene) => /tachicardia da fermo/i.test(scene.biometric_vibe || ""))
    .map((scene) => `${scene.time_window}, ${scene.location_alias}`);
}

export function notesOfToday(payload) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  const notes = [];
  for (const scene of scenes) {
    for (const note of scene.user_notes || []) {
      const text = String(note.text || "").replace(/`/g, "'").trim();
      if (text) notes.push(`ore ${note.time || scene.time_window}, ${scene.location_alias}: «${text}»`);
    }
  }
  return notes;
}

// Blocco «materiale di oggi», condiviso da drammaturgo e narratore.
export function materialBlock(payload) {
  const notes = notesOfToday(payload);
  const peaks = peaksAtRest(payload);
  const events = dramaticEvents(payload);
  const baptize = placesToBaptize(payload);
  const bridge = bridgeFromYesterday(payload);
  const threads = (payload.story_state_memory?.unresolved_tensions || []).filter(Boolean);
  const day = Number(payload.book_config?.current_day) || 1;

  const lines = [];
  if (bridge) lines.push(`Ponte da ieri: ${bridge}`);
  if (day > 1) {
    lines.push(threads.length ? `Fili aperti dai capitoli precedenti: ${threads.join("; ")}.` : "Fili aperti dai capitoli precedenti: nessuno dichiarato.");
  }
  lines.push(
    events.length
      ? `Materiale drammatico di oggi, dal più forte (note di regia telegrafiche: usale come fatti, non ricopiarne le parole):\n${events.map((event) => `- ${event}`).join("\n")}`
      : "Materiale drammatico di oggi: giornata senza scarti dalla routine — il dramma nasce dal contrasto più concreto (dentro/fuori, fermo/moto) e dai fili aperti."
  );
  lines.push(
    notes.length
      ? `Appunti di oggi (modo vincolante: registrati nelle scene indicate; un programma resta programma, mai esito, mai spostato nel luogo che nomina): ${notes.join("; ")}.`
      : "Appunti di oggi: nessuno."
  );
  lines.push(
    peaks.length
      ? `Picchi a corpo fermo: ${peaks.join("; ")} — unico momento in cui il corpo può entrare nel racconto.`
      : "Picchi a corpo fermo: nessuno — il corpo non entra nel racconto."
  );
  if (baptize.length) lines.push(`Luoghi da battezzare ora: ${baptize.join("; ")}.`);
  return fixPrepositions(lines.join("\n")).replace(/\ba un luogo\b/g, "in un luogo");
}
