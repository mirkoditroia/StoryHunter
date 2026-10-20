import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, styleIssuesInDraft } from "./narrator.js";

const previous = {
  previous_chapter_summary: "Giorno 1.",
  last_chapter_ending_state: "AT_HOME_RESTING",
  established_locations: {
    loc_home: "La Casa Fredda",
    loc_work_new: "Il Lavoro delle Ore Chiuse",
    loc_park_new: "Luogo sconosciuto (giardino pubblico con panchine e alberi, zona centro)",
  },
  recurring_motifs: [],
  unresolved_tensions: [],
};

test("un luogo già battezzato non si rinomina, uno provvisorio sì", () => {
  const next = sanitizeState(
    {
      previous_chapter_summary: "Giorno 2.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: {
        loc_home: "La Cucina Fredda",
        loc_work_new: "L'officina delle ore chiuse",
        loc_park_new: "Il Giardino del Centro",
        loc_cafe_new: "Il Locale dell'Angolo",
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    previous
  );
  assert.equal(next.established_locations.loc_home, "La Casa Fredda");
  assert.equal(next.established_locations.loc_work_new, "Il Lavoro delle Ore Chiuse");
  assert.equal(next.established_locations.loc_park_new, "Il Giardino del Centro");
  assert.equal(next.established_locations.loc_cafe_new, "Il Locale dell'Angolo");
});

test("lo stile segnala battiti in eccesso ed echi", () => {
  const issues = styleIssuesInDraft({
    chapter_text:
      "Il cuore saliva e il polso correva mentre le pulsazioni riempivano la stanza. L'asfalto del corridoio d'asfalto tagliava il centro.",
  });
  assert.equal(issues.length, 2);
  assert.deepEqual(styleIssuesInDraft({ chapter_text: "Marco raggiunse il parco e si fermò alla panchina." }), []);
});

test("un alias provvisorio restituito dal modello non viene archiviato come nome", () => {
  const next = sanitizeState(
    {
      previous_chapter_summary: "Giorno 2.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: {
        loc_cafe_new: "Luogo sconosciuto (locale con tavoli, in mezzo agli altri, zona centro)",
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    previous
  );
  assert.equal(next.established_locations.loc_cafe_new, undefined);
});

test("lo stile segnala capitoli troppo lunghi e dettagli celebrati", () => {
  const long = styleIssuesInDraft({ chapter_text: Array(950).fill("parola").join(" ") });
  assert.ok(long.some((issue) => issue.includes("oltre il tetto di 800")));
  const hype = styleIssuesInDraft({
    chapter_title: "Geometrie di Schiuma",
    chapter_subtitle: "Bionde inattese",
    chapter_text: "Le due bionde schiumose tornarono tra i vapori del luppolo e la birra.",
  });
  assert.ok(hype.some((issue) => issue.includes("tormentone")));
});

test("lo stile segnala perifrasi provvisorie, aperture a orario e risveglio ricopiato", () => {
  const draft = {
    chapter_text: [
      "Alle sette Marco entrò nel luogo di fatica quotidiana, orari fissi e stanze chiuse.",
      "Alle nove tornò al luogo di fatica quotidiana, orari fissi e stanze chiuse.",
      "Alle undici uscì dal luogo di fatica quotidiana, orari fissi e stanze chiuse.",
      "Un richiamo metallico ruppe l'incantesimo del sonno.",
    ].join("\n\n"),
  };
  const issues = styleIssuesInDraft(draft, 3);
  assert.ok(issues.some((issue) => issue.includes("luoghi non battezzati")));
  assert.ok(issues.some((issue) => issue.includes("cominciano con un'ora")));
  assert.ok(issues.some((issue) => issue.includes("apertura ricopiata")));
  // Al Giorno 1 la stessa frase di risveglio è ammessa.
  assert.ok(!styleIssuesInDraft(draft, 1).some((issue) => issue.includes("apertura ricopiata")));
});

test("filo conduttore e ritratto sopravvivono se il modello li omette", () => {
  const next = sanitizeState(
    { previous_chapter_summary: "Giorno 2.", established_locations: {} },
    { ...previous, through_line: "Cosa cerca Marco?", character_portrait: "Ride per difendersi." }
  );
  assert.equal(next.through_line, "Cosa cerca Marco?");
  assert.equal(next.character_portrait, "Ride per difendersi.");
});

test("un nome di luogo con un mestiere inventato torna al sostantivo di funzione", () => {
  const next = sanitizeState(
    {
      established_locations: {
        loc_cafe_new: "L'Officina dei Numeri Freddi",
        loc_work_new: "L'Officina Silenziosa",
        loc_park_new: "Il Giardino del Vento",
      },
    },
    previous
  );
  assert.equal(next.established_locations.loc_cafe_new, "Il Locale dei Numeri Freddi");
  // Senza complemento non c'è epiteto da salvare: il luogo resta da battezzare.
  assert.equal(next.established_locations.loc_work_new, previous.established_locations?.loc_work_new);
  assert.equal(next.established_locations.loc_park_new, "Il Giardino del Vento");
});
