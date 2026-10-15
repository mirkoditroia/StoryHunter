import { genderVoice } from "./meta.js";

export function buildSystemPrompt(payload) {
  const book = payload.book_config;
  const protagonist = book.protagonist;
  const cutoff = payload.today_unified_telemetry?.midnight_cutoff_status;

  return `Sei un biografo invisibile e uno scrittore d'autore. Il tuo compito è scrivere il Capitolo ${book.current_day} di ${book.total_days} di un romanzo autobiografico nel genere ${book.genre}, basandoti sull'unico file JSON giornaliero fornito.

### REGOLE FERREE DI STILE E MONDO
1. DIVIETO TECNOLOGICO ASSOLUTO: Non usare MAI parole come smartphone, telefono, cellulare, app, WhatsApp, Instagram, social, GPS, notifiche, sveglia digitale o smartwatch. Trasfigura sempre questi concetti usando le metafore già scritte in \`screen_behavior_summary.semantic_translation\` e \`wake_up_event.semantic_translation\`, adattandole al genere ${book.genre}. Vale anche per il titolo, il riassunto e le liste di stato.
2. VOCE E LENTE DEL PROTAGONISTA: Il protagonista si chiama ${protagonist.name} (${protagonist.age} anni). ${genderVoice(protagonist.gender)} Filtra ogni descrizione sensoriale, metafora e riflessione attraverso il dominio d'interesse primario (${protagonist.metaphor_domain}) e l'archetipo (${protagonist.archetype}). Il modo di reagire agli imprevisti è ${protagonist.emotional_reactivity}, con un focus ${protagonist.narrative_focus} e un ritmo di scrittura ${protagonist.pacing}.
3. INFALLIBILITÀ POETICA: Tratta ogni dato in \`biometric_vibe\` come verità emotiva assoluta. Se il battito è alto mentre il corpo è fermo, nella scena deve esserci un turbamento, una suspense o una vertigine reale. Non smentire il dato e non attribuirlo a un errore di misurazione.
4. CONTINUITÀ E TOPONOMASTICA: Riprendi il filo da \`previous_chapter_summary\` e da \`last_chapter_ending_state\`. Per i luoghi già presenti in \`established_locations\` usa soltanto il nome letterario salvato. Se \`location_id\` termina con \`_new\` e l'alias è ancora una descrizione provvisoria, battezza quel luogo con un nome evocativo coerente con il genere ${book.genre}. Nel campo \`established_locations\` conserva le stesse chiavi e aggiorna solo i nomi.
5. GESTIONE GIORNATA VUOTA: Se \`is_empty_day\` è true, non inventare viaggi né eventi d'azione fuori casa. Scrivi un capitolo denso, psicologico e introspettivo: il protagonista, chiuso nel suo spazio, rielabora \`unresolved_tensions\` e \`recurring_motifs\` attraverso la lente dei suoi interessi.
6. CHIUSURA: ${closingRule(cutoff)}
7. LINGUA E MISURA: Prosa letteraria in italiano. Il campo \`chapter_text\` contiene solo il capitolo, senza titolo, senza elenchi, senza markdown. Minimo 800 parole, diviso in paragrafi separati da una riga vuota. Non ripetere il JSON e non commentare le istruzioni.

### FORMATO DI OUTPUT
Restituisci esclusivamente un oggetto JSON valido con questa struttura:
{
  "chapter_number": ${book.current_day},
  "chapter_title": "Titolo evocativo del capitolo",
  "chapter_text": "Testo completo del capitolo",
  "updated_story_state": {
    "previous_chapter_summary": "Riassunto denso di ciò che è accaduto dal Giorno 1 fino alla fine del Giorno ${book.current_day}",
    "last_chapter_ending_state": "AT_HOME_RESTING oppure OUTSIDE_CLIFFHANGER oppure OUTSIDE_AWAY",
    "established_locations": {},
    "recurring_motifs": [],
    "unresolved_tensions": []
  }
}`;
}

function closingRule(cutoff) {
  if (cutoff === "OUTSIDE_HIGH_ACTIVITY") {
    return "midnight_cutoff_status è OUTSIDE_HIGH_ACTIVITY: la giornata si interrompe nel mezzo dell'azione alle 23:59. Chiudi il capitolo in medias res, su un cliffhanger, senza risolvere la scena. In last_chapter_ending_state scrivi OUTSIDE_CLIFFHANGER.";
  }
  if (cutoff === "OUTSIDE_AWAY") {
    return "midnight_cutoff_status è OUTSIDE_AWAY: il protagonista è ancora fuori casa, ma non in piena crisi. Chiudi su un'immagine aperta, non risolta. In last_chapter_ending_state scrivi OUTSIDE_AWAY.";
  }
  return "midnight_cutoff_status è AT_HOME_RESTING: il protagonista chiude la giornata nello spazio domestico. Puoi lasciare tensioni aperte, ma non un cliffhanger in strada. In last_chapter_ending_state scrivi AT_HOME_RESTING.";
}

export function buildUserPrompt(payload) {
  return `Questo è l'unico JSON della giornata. Usalo come sola fonte dei fatti. Non aggiungere spostamenti che non compaiono in unified_scenes.

${JSON.stringify(payload, null, 2)}

Scrivi ora il capitolo ${payload.book_config.current_day}. Rispondi solo con l'oggetto JSON richiesto.`;
}

export function buildExpansionPrompt(payload, draft) {
  return `Il capitolo qui sotto è troppo breve. Riscrivi l'intero oggetto JSON mantenendo gli stessi fatti, lo stesso titolo se funziona, e le stesse chiavi di stato. Porta chapter_text ad almeno 800 parole, in italiano, senza parole tecnologiche (niente telefono, app, social, GPS, notifiche, smartwatch). Non inventare luoghi assenti dal JSON di giornata.

JSON di giornata:
${JSON.stringify(payload)}

Bozza da espandere:
${JSON.stringify(draft)}`;
}

export function buildRepairPrompt(payload, draft, words) {
  return `Nel JSON narrativo compaiono parole vietate: ${words.join(", ")}. Riscrivi l'intero oggetto JSON sostituendole con metafore già coerenti con il genere ${payload.book_config.genre}. Non perdere i fatti del capitolo e non accorciare il testo.

${JSON.stringify(draft)}`;
}

export function buildClosingPrompt(book) {
  const last = book.days.at(-1);
  const memory = last?.story_state_after || {};
  const chapters = book.days
    .map((day) => {
      const excerpt = String(day.chapter?.chapter_text || "").replace(/\s+/g, " ").trim().slice(0, 420);
      return `Capitolo ${day.day} — ${day.chapter.chapter_title}\n${excerpt}`;
    })
    .join("\n\n");
  const protagonist = book.book_config.protagonist;

  return {
    system: `Sei l'editor di un romanzo già scritto. Componi il frontespizio. ${genderVoice(protagonist.gender)} Non usare parole come smartphone, telefono, app, social, GPS, notifiche, smartwatch. Rispondi solo con JSON valido:
{
  "book_title": "titolo del romanzo",
  "subtitle": "sottotitolo breve",
  "epigraph": "una frase di epigrafe, senza attribuzione tecnologica",
  "back_cover": "quarta di copertina tra 140 e 180 parole"
}`,
    user: `Genere: ${book.book_config.genre}
Protagonista: ${protagonist.name}, ${protagonist.age} anni
Dominio metaforico: ${protagonist.metaphor_domain}
Archetipo: ${protagonist.archetype}
Durata: ${book.book_config.total_days} giorni

Arco completo:
${memory.previous_chapter_summary || ""}

Motivi ricorrenti: ${(memory.recurring_motifs || []).join("; ") || "nessuno"}
Tensioni aperte: ${(memory.unresolved_tensions || []).join("; ") || "nessuna"}

Voci dei capitoli:
${chapters}`,
  };
}
