import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, styleIssuesInDraft } from "./narrator.js";

const previous = {
  previous_chapter_summary: "Giorno 1.",
  last_chapter_ending_state: "AT_HOME_RESTING",
  established_locations: {
    loc_home: "casa",
    loc_work_via_dante: "il lavoro in via Dante",
  },
  recurring_motifs: [],
  unresolved_tensions: [],
};

test("il modello non rinomina né battezza i luoghi: la mappa la tiene il codice", () => {
  const next = sanitizeState(
    {
      previous_chapter_summary: "Giorno 2.",
      last_chapter_ending_state: "AT_HOME_RESTING",
      established_locations: {
        loc_home: "La Casa delle Spezie",
        loc_work_via_dante: "La Fornace Grigia",
        loc_cafe_corso_garibaldi: "Il Locale dell'Angolo",
      },
      recurring_motifs: [],
      unresolved_tensions: [],
    },
    previous
  );
  assert.deepEqual(next.established_locations, previous.established_locations);
});

test("lo stile segnala battiti in eccesso ed echi", () => {
  const issues = styleIssuesInDraft({
    chapter_text:
      "Il cuore saliva e il polso correva mentre le pulsazioni riempivano la stanza. L'asfalto del corridoio d'asfalto tagliava il centro.",
  });
  assert.equal(issues.length, 2);
  assert.deepEqual(styleIssuesInDraft({ chapter_text: "Marco raggiunse il parco e si fermò alla panchina." }), []);
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

test("lo stile segnala luoghi inventati, aperture a orario e risveglio ricopiato", () => {
  const draft = {
    chapter_text: [
      "Alle sette Marco uscì dalla Casa delle Spezie e prese via dei Mercanti.",
      "Alle nove era al lavoro, in via Dante, e il Parco Sempione restava lontano.",
      "Alle undici attraversò la Galleria Vittorio Emanuele.",
      "Un richiamo metallico ruppe l'incantesimo del sonno.",
    ].join("\n\n"),
  };
  const knownPlaces = ["Milano", "Marco", "casa", "il lavoro in via Dante", "al lavoro, in via Dante", "Parco Sempione", "Cordusio, Milano"];
  const issues = styleIssuesInDraft(draft, { currentDay: 3, knownPlaces });
  const invented = issues.find((issue) => issue.startsWith("luoghi inventati"));
  assert.ok(invented);
  for (const name of ["Casa delle Spezie", "via dei Mercanti", "Galleria Vittorio Emanuele"]) assert.ok(invented.includes(name), name);
  assert.ok(!invented.includes("via Dante") && !invented.includes("Parco Sempione"));
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
