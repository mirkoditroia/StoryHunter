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

// Per i semi del filo: un luogo ancora senza nome si dice con la sua funzione
// («al lavoro»), mai con la nota di regia «un luogo ancora senza nome».
const WHERE_BY_KIND = { work: "al lavoro", cafe: "al locale", park: "al giardino", street: "per strada", home: "a casa", unknown: "in quel luogo" };
const WHAT_BY_KIND = { work: "il lavoro", cafe: "il locale", park: "il giardino", street: "la strada", home: "la casa", unknown: "quel luogo" };

function namedPlace(scene, memory) {
  const known = memory?.established_locations?.[scene.location_id];
  if (known && !isProvisionalAlias(known)) return known;
  return isProvisionalAlias(scene.location_alias) ? "" : scene.location_alias || "";
}

function whereOf(scene, memory) {
  const name = namedPlace(scene, memory);
  return name ? fixPrepositions(`a ${name}`) : WHERE_BY_KIND[kindOf(scene)];
}

function whatOf(scene, memory) {
  return namedPlace(scene, memory) || WHAT_BY_KIND[kindOf(scene)];
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
  const day = Number(payload.book_config?.current_day) || 1;
  const add = (weight, at, text, seed = "", tag = null) =>
    events.push({ weight, at: minutes(at) ?? 0, text, seed, ...(tag || {}) });
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
          `Cosa farà ${who} di ciò che ha scritto ${whereOf(scene, memory)} («${text}»)?`
        );
      }
    }

    // Il primo giorno ogni luogo è senza nome solo perché il libro non lo
    // conosce ancora: per chi vive quella vita è la strada di sempre. Con dati
    // veri, «luogo mai visto» al giorno 1 inventerebbe un «primo giorno».
    // Nuovo = mai comparso nei giorni precedenti, anche se non ha ancora un nome
    // (un battesimo rifiutato ieri non fa del luogo di lavoro un luogo nuovo).
    const visited = Array.isArray(memory.seen_locations) && memory.seen_locations.includes(scene.location_id);
    if (day > 1 && !visited && !isHome(scene) && isProvisionalAlias(scene.location_alias) && kindOf(scene) !== "street") {
      const hint = provisionalHint(scene.location_alias);
      add(
        5,
        start,
        `LUOGO NUOVO NEL LIBRO — ${hint || "senza indizi"} — ${span(start, end)}`,
        `Che cosa è andato a cercare ${who} ${WHERE_BY_KIND[kindOf(scene)] || "in quel luogo"}, fuori dalle sue strade?`,
        { kind: "new_place", location_id: scene.location_id }
      );
    }

    if (/tachicardia da fermo/i.test(vibe)) {
      const at = vibe.match(/alle (\d{2}:\d{2})/)?.[1] || start;
      const before = pastEvents(memory, "peak_at_rest", scene.location_id);
      if (before.length) {
        add(
          6,
          at,
          `RICORRENZA — ${name} — ${roughClock(at)} — il sobbalzo da fermo torna (già ${daysLabel(before)}, stesso luogo): ${who} lo riconosce, non è più una sorpresa; il capitolo non lo ridescrive, mostra che cosa ne fa`,
          `Quanto a lungo ${who} potrà fingere che ${whatOf(scene, memory)} non gli tolga il fiato?`,
          { kind: "peak_at_rest", location_id: scene.location_id }
        );
      } else {
        add(
          5,
          at,
          `PICCO A CORPO FERMO — ${name} — ${roughClock(at)} — causa ignota: nessun fatto la spiega`,
          `Che cosa, ${whereOf(scene, memory)}, toglie il fiato a ${who} quando è fermo?`,
          { kind: "peak_at_rest", location_id: scene.location_id }
        );
      }
    }

    // Notte fuori casa: dalla mezzanotte all'alba la giornata comincia altrove.
    // Se è la ripresa del cliffhanger di ieri, la racconta già il ponte.
    const nightStart = minutes(start);
    const isResume = day > 1 && endedOutside(memory) && scene === scenes[0];
    if (!isHome(scene) && nightStart != null && nightStart < 5 * 60 && !isResume) {
      add(
        5,
        start,
        `NOTTE FUORI CASA — ${name} — ${span(start, end)}: è la prima scena del capitolo, non un antefatto`,
        `Che cosa tiene ${who} sveglio ${whereOf(scene, memory)} mentre la città dorme?`,
        { kind: "night_out", location_id: scene.location_id }
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
        `ORE SENZA TRACCIA — ${span(sceneEnd(scenes[i - 1]), sceneStart(scenes[i]))} — lì il racconto tace: al massimo un pensiero o un'ellissi, mai un fatto, mai chiamato «vuoto» o «traccia»`
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
      `Che cosa tiene ${who} fuori casa fino a notte, ${whereOf(last, memory)}?`,
      { kind: "late_out", location_id: last.location_id }
    );
  }

  return events.sort((a, b) => b.weight - a.weight || a.at - b.at).slice(0, 7);
}

// Eventi forti di oggi, da archiviare: domani dicono al Drammaturgo che cosa
// sta tornando. La seconda volta di un fatto è un riconoscimento, non una replica.
export function strongEventsOf(payload) {
  const day = Number(payload.book_config?.current_day) || 1;
  return rankedEvents(payload)
    .filter((event) => event.kind)
    .map((event) => ({ day, kind: event.kind, location_id: event.location_id || "" }));
}

function pastEvents(memory, kind, locationId) {
  return (memory?.event_log || []).filter(
    (event) => event?.kind === kind && (!locationId || event.location_id === locationId)
  );
}

function daysLabel(events) {
  const days = [...new Set(events.map((event) => Number(event.day)).filter(Boolean))];
  if (!days.length) return "in passato";
  return days.length === 1 ? `il giorno ${days[0]}` : `i giorni ${days.join(", ")}`;
}

function endedOutside(memory) {
  const ending = memory?.last_chapter_ending_state;
  return Boolean(ending) && ending !== "AT_HOME_RESTING";
}

// Ponte fra ieri e oggi. La giornata va da mezzanotte a mezzanotte: se ieri
// il capitolo si è chiuso fuori casa, oggi riparte esattamente da lì, e le
// prime ore rispondono alla domanda con cui ieri si è chiuso.
export function bridgeFromYesterday(payload) {
  const memory = payload.story_state_memory || {};
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  if (Number(payload.book_config?.current_day) <= 1) return "";
  const last = memory.last_scene;
  const ending = memory.last_chapter_ending_state;
  const first = scenes[0];
  const closing = (memory.closings || []).filter(Boolean).at(-1);
  const yesterday = last
    ? `Ieri il capitolo si è chiuso a ${last.place}, ${last.when}, ${CUTOFF_LABEL[ending] || "in casa"}.`
    : `Ieri il capitolo si è chiuso ${CUTOFF_LABEL[ending] || "in casa"}.`;
  const question = closing ? ` Ultima frase di ieri: «${closing}».` : "";
  if (!first || !endedOutside(memory)) return `${yesterday}${question}`;
  const where = placeName(first, memory);
  const when = roughClock(sceneStart(first));
  let resume;
  if (isHome(first)) {
    resume = ` Oggi si riparte da lì, dalla mezzanotte: la prima traccia lo trova già a casa ${when}. L'Atto I comincia con quel ritorno (la strada di notte, che cosa si porta dentro) ed è la risposta a come si è chiuso ieri; il tragitto si evoca, ciò che è accaduto nel mezzo non si inventa.`;
  } else if (last?.location_id && first.location_id === last.location_id) {
    resume = ` Oggi si riparte da lì, in medias res: dopo la mezzanotte è ancora a ${where}. L'Atto I continua la scena di ieri.`;
  } else {
    resume = ` Oggi si riparte da lì: dopo la mezzanotte lo si ritrova a ${where}, ${when}. L'Atto I è quel passaggio, risposta a come si è chiuso ieri.`;
  }
  return `${yesterday}${question}${resume}`;
}

// Le ore fra mezzanotte e l'alba appartengono al capitolo, ma non sono sempre
// una scena: con dati veri, una notte in casa a corpo fermo è sonno.
export function nightOf(payload) {
  const memory = payload.story_state_memory || {};
  const today = payload.today_unified_telemetry || {};
  const scenes = today.unified_scenes || [];
  const name = payload.book_config?.protagonist?.name || "il protagonista";
  const night = scenes.filter((scene) => {
    const start = minutes(sceneStart(scene));
    return start != null && start < 6 * 60;
  });
  if (!night.length) return "";
  const resumed = Number(payload.book_config?.current_day) > 1 && endedOutside(memory);
  const away = night.filter((scene) => !isHome(scene));
  if (away.length) {
    if (resumed && night[0] === away[0] && away.length === night.length) return "";
    const place = placeName(away[0], memory);
    return fixPrepositions(`Notte: fuori casa, a ${place}, ${span(sceneStart(away[0]), sceneEnd(away.at(-1)))}. È la prima scena del capitolo: si racconta come scena, non come antefatto.`);
  }
  if (night.every((scene) => /corpo fermo/i.test(scene.biometric_vibe || ""))) {
    const wake = today.wake_up_event?.time;
    const until = wake ? ` fino al risveglio, ${roughClock(wake)}` : "";
    const prefix = resumed ? "dopo il ritorno, " : "";
    return `Notte: ${prefix}sonno in casa${until}. Le ore dalla mezzanotte appartengono al capitolo ma non sono una scena: ${name} dorme, quindi niente gesti, passi o sguardi notturni. Al massimo la casa nel buio in una frase, mai un'immagine già usata nei capitoli precedenti; il primo gesto di ${name} arriva dopo il risveglio.`;
  }
  return "";
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
  const night = nightOf(payload);
  const threads = (payload.story_state_memory?.unresolved_tensions || []).filter(Boolean);
  const day = Number(payload.book_config?.current_day) || 1;

  const lines = [];
  if (bridge) lines.push(`Ponte da ieri: ${bridge}`);
  if (night) lines.push(night);
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
  if (day <= 1 && baptize.length) {
    lines.push("Primo capitolo: i luoghi si battezzano oggi perché il libro li incontra ora, ma per chi vive questa vita sono quelli di sempre — mai «per la prima volta», mai «primo giorno», salvo un appunto che lo dica.");
  }
  return fixPrepositions(lines.join("\n")).replace(/\ba un luogo\b/g, "in un luogo");
}
