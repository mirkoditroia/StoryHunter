import { fixPrepositions, roughClock } from "./transfiguration.js";
import { OUTSIDE_KINDS } from "./calendar.js";

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

// I luoghi sono veri e arrivano già con il loro nome dai dati:
// `location_alias` è il nome («Parco Sempione», «casa»),
// `location_at` il modo di dirlo («al Parco Sempione», «a casa, all'Isola»).
function placeName(scene) {
  return scene?.location_alias || "un luogo";
}

function whereOf(scene) {
  return scene?.location_at || fixPrepositions(`a ${placeName(scene)}`);
}

function whatOf(scene) {
  return scene?.location_alias === "casa" ? "la casa" : placeName(scene);
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
    const name = placeName(scene);
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
          `Cosa farà ${who} di ciò che ha scritto ${whereOf(scene)} («${text}»)?`
        );
      }
    }

    // Il primo giorno nessun luogo è nuovo: il libro lo incontra ora, ma per
    // chi vive quella vita è la strada di sempre. Con dati veri, «luogo mai
    // visto» al giorno 1 inventerebbe un «primo giorno».
    // Nuovo = mai comparso nei giorni precedenti del libro.
    const visited = Array.isArray(memory.seen_locations) && memory.seen_locations.includes(scene.location_id);
    if (day > 1 && !visited && !isHome(scene) && kindOf(scene) !== "street") {
      const area = scene.location_area ? ` (${scene.location_area})` : "";
      add(
        5,
        start,
        `LUOGO NUOVO NEL LIBRO — ${name}${area} — ${span(start, end)}`,
        `Che cosa è andato a cercare ${who} ${whereOf(scene)}, fuori dalle sue strade?`,
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
          `Quanto a lungo ${who} potrà fingere che ${whatOf(scene)} non gli tolga il fiato?`,
          { kind: "peak_at_rest", location_id: scene.location_id }
        );
      } else {
        add(
          5,
          at,
          `PICCO A CORPO FERMO — ${name} — ${roughClock(at)} — causa ignota: nessun fatto la spiega`,
          `Che cosa, ${whereOf(scene)}, toglie il fiato a ${who} quando è fermo?`,
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
        `Che cosa tiene ${who} sveglio ${whereOf(scene)} mentre la città dorme?`,
        { kind: "night_out", location_id: scene.location_id }
      );
    }

    const startMin = minutes(start);
    if (!isHome(scene) && startMin != null && startMin >= 21 * 60) {
      add(4, start, `FUORI A TARDA SERA — ${name} — ${roughClock(start)}`);
    }

    if (/stress alto/i.test(vibe) && !/tachicardia da fermo/i.test(vibe)) {
      add(3, start, `TENSIONE ALTA — ${name} — ${roughClock(start)}`);
    }

    if (["park", "cafe"].includes(kindOf(scene))) {
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

  calendarEvents(payload, add);

  const cutoff = today.midnight_cutoff_status;
  const last = scenes.at(-1);
  if (last && cutoff && cutoff !== "AT_HOME_RESTING") {
    add(
      5,
      sceneEnd(last),
      `FINE GIORNATA FUORI CASA — ${placeName(last)} — ${CUTOFF_LABEL[cutoff]}, senza rientro nel capitolo`,
      `Che cosa tiene ${who} fuori casa fino a notte, ${whereOf(last)}?`,
      { kind: "late_out", location_id: last.location_id }
    );
  }

  return events.sort((a, b) => b.weight - a.weight || a.at - b.at).slice(0, 7);
}

// Agenda: un impegno è un programma. Il fatto è dove si trovava la persona
// a quell'ora; il dramma è lo scarto (o la coincidenza) fra le due cose.
// La routine ricorrente non entra nel materiale, solo nella riga «Agenda».
function calendarEvents(payload, add) {
  const today = payload.today_unified_telemetry || {};
  const memory = payload.story_state_memory || {};
  const scenes = today.unified_scenes || [];
  const who = payload.book_config?.protagonist?.name || "il protagonista";
  for (const event of today.calendar_events || []) {
    if (event.recurring) continue;
    const title = String(event.title || "").replace(/`/g, "'").trim();
    if (!title) continue;
    const quoted = `«${title}»`;
    const health = event.kind === "health" ? " (salute: mai il motivo, mai dettagli del corpo)" : "";
    if (event.all_day) {
      add(4, "00:00", `GIORNO SEGNATO — ${quoted}${health} — tutto il giorno: una data che pesa sulla giornata; vive in un pensiero o in un gesto, mai una festa o un incontro inventati`);
      continue;
    }
    const [start, end] = String(event.time_window || "").split(" - ");
    const when = span(start, end && end !== start ? end : "");
    const peak = peakDuring(scenes, start, end);
    const coincide = peak ? ` — coincide con il sobbalzo da fermo, ${roughClock(peak)}` : "";
    const ref = `cal:${title.toLowerCase()}`;
    if (event.presence === "HOME" && OUTSIDE_KINDS.has(event.kind)) {
      if (event.kind === "health") {
        add(4, start, `IMPEGNO FUORI, MA A CASA — ${quoted}${health} — ${when} — a quell'ora ${who} era a casa: l'impegno non avviene; il perché si tace${coincide}`);
        continue;
      }
      const before = pastEvents(memory, "calendar_home", ref);
      const again = before.length ? ` Già successo ${daysLabel(before)}: è un riconoscimento, non una sorpresa.` : "";
      add(
        5,
        start,
        `IMPEGNO FUORI, MA A CASA — ${quoted} — ${when} — a quell'ora ${who} era a casa: l'impegno non avviene, né fuori né in una versione casalinga (niente allenamenti, cene o incontri in casa al suo posto); il perché si tace, al massimo un pensiero di ${who}${coincide}.${again}`,
        `Che cosa ha trattenuto ${who} a casa all'ora di ${quoted}?`,
        { kind: "calendar_home", location_id: ref }
      );
      continue;
    }
    if (event.presence === "AWAY") {
      const where = atPlace(event);
      add(4, start, `IMPEGNO — ${quoted}${health} — ${when} — a quell'ora ${who} era ${where}: la scena può essere quell'impegno, vissuto da dentro (attesa, sensi, pensiero); come è finito e che cosa si è detto, no${coincide}`);
      continue;
    }
    if (event.presence === "IN_TRANSIT") {
      add(3, start, `IMPEGNO — ${quoted}${health} — ${when} — a quell'ora ${who} era per strada, in movimento: mai dire dove andava${coincide}`);
      continue;
    }
    if (event.presence === "HOME") {
      add(3, start, `IMPEGNO — ${quoted} — ${when} — da sbrigare in casa${coincide}`);
      continue;
    }
    add(2, start, `IMPEGNO — ${quoted}${health} — ${when} — nessuna tappa a quell'ora: l'impegno resta un pensiero`);
  }
}

function peakDuring(scenes, start, end) {
  const from = minutes(start);
  const to = minutes(end) ?? from;
  if (from == null) return "";
  for (const scene of scenes) {
    const vibe = String(scene.biometric_vibe || "");
    if (!/tachicardia da fermo/i.test(vibe)) continue;
    const at = vibe.match(/alle (\d{2}:\d{2})/)?.[1];
    const value = minutes(at);
    if (value != null && value >= from && value <= to) return at;
  }
  return "";
}

const PRESENCE_LABEL = { HOME: "a casa", IN_TRANSIT: "per strada", NO_TRACE: "nessuna tappa a quell'ora" };

// Riga «Agenda» del materiale: tutti gli impegni, routine compresa.
export function agendaOfToday(payload) {
  return (payload.today_unified_telemetry?.calendar_events || []).map((event) => {
    const title = `«${String(event.title || "").replace(/`/g, "'")}»`;
    const [start, end] = String(event.time_window || "").split(" - ");
    const when = event.all_day ? "tutto il giorno" : span(start, end && end !== start ? end : "");
    const where = event.all_day
      ? ""
      : event.presence === "AWAY"
        ? `, ${atPlace(event)}`
        : `, ${PRESENCE_LABEL[event.presence] || "nessuna tappa a quell'ora"}`;
    const routine = event.recurring ? " (ricorrente: routine della settimana)" : "";
    return `${when} ${title}${routine}${where}`;
  });
}

function atPlace(event) {
  return whereOf({ location_alias: event.location_alias, location_at: event.location_at });
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
    ? `Ieri il capitolo si è chiuso ${last.at || fixPrepositions(`a ${last.place}`)}, ${last.when}, ${CUTOFF_LABEL[ending] || "in casa"}.`
    : `Ieri il capitolo si è chiuso ${CUTOFF_LABEL[ending] || "in casa"}.`;
  const question = closing ? ` Ultima frase di ieri: «${closing}».` : "";
  if (!first || !endedOutside(memory)) return `${yesterday}${question}`;
  const where = whereOf(first);
  const when = roughClock(sceneStart(first));
  let resume;
  if (isHome(first)) {
    resume = ` Oggi si riparte da lì, dalla mezzanotte: la prima traccia lo trova già a casa ${when}. L'Atto I comincia con quel ritorno (la strada di notte, che cosa si porta dentro) ed è la risposta a come si è chiuso ieri; il tragitto si evoca, ciò che è accaduto nel mezzo non si inventa.`;
  } else if (last?.location_id && first.location_id === last.location_id) {
    resume = ` Oggi si riparte da lì, in medias res: dopo la mezzanotte è ancora lì, ${where}. L'Atto I continua la scena di ieri.`;
  } else {
    resume = ` Oggi si riparte da lì: dopo la mezzanotte lo si ritrova ${where}, ${when}. L'Atto I è quel passaggio, risposta a come si è chiuso ieri.`;
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
    return fixPrepositions(`Notte: fuori casa, ${whereOf(away[0])}, ${span(sceneStart(away[0]), sceneEnd(away.at(-1)))}. È la prima scena del capitolo: si racconta come scena, non come antefatto.`);
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
export function lastSceneOf(payload) {
  const scenes = payload.today_unified_telemetry?.unified_scenes || [];
  const last = scenes.at(-1);
  if (!last) return null;
  return {
    location_id: last.location_id,
    place: placeName(last),
    at: whereOf(last),
    when: span(sceneStart(last), sceneEnd(last)),
  };
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
  const agenda = agendaOfToday(payload);
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
  if (agenda.length) {
    lines.push(
      `Impegni di oggi (programmi: titolo e ora sono fatti, l'esito no; dove si trovava a quell'ora lo dicono le scene, e vince sempre): ${agenda.join("; ")}.`
    );
  }
  lines.push(
    peaks.length
      ? `Picchi a corpo fermo: ${peaks.join("; ")} — unico momento in cui il corpo può entrare nel racconto.`
      : "Picchi a corpo fermo: nessuno — il corpo non entra nel racconto."
  );
  if (day <= 1) {
    lines.push("Primo capitolo: il libro incontra ora questi luoghi, ma per chi vive questa vita sono quelli di sempre — mai «per la prima volta», mai «primo giorno», salvo un appunto che lo dica.");
  }
  return fixPrepositions(lines.join("\n")).replace(/\ba un luogo\b/g, "in un luogo");
}
