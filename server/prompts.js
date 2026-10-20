import { genderVoice } from "./meta.js";
import { materialBlock, threadSeed } from "./dramaturgy.js";
import { profileLabelStems } from "./transfiguration.js";

// Il capitolo nasce in due tempi, come a teatro:
// 1. il Drammaturgo legge i dati e scrive il copione (desiderio, scene, svolta, domanda finale);
// 2. il Narratore scrive la prosa seguendo il copione.
// Separare le due cose è ciò che toglie la cronaca: un modello che deve insieme
// scegliere cosa raccontare e come scriverlo finisce per riassumere le fasce orarie.

// ---------------------------------------------------------------------------
// Blocchi condivisi

function genreRegister(genre) {
  const g = String(genre || "");
  if (g.startsWith("Noir")) {
    return "Noir: frasi secche, ombre e sospetto; la città è un antagonista che osserva; ironia amara, mai battute. Il protagonista indaga sulla propria giornata come su un caso.";
  }
  if (g.startsWith("Realismo")) {
    return "Realismo magico: il quotidiano è preciso e concreto, e dentro ogni capitolo accade un solo piccolo prodigio trattato con naturalezza, senza spiegazioni (un oggetto che ricorda, il vento che sceglie una strada, una luce che arriva in ritardo). Il prodigio colora i fatti, non li contraddice e non li sostituisce.";
  }
  if (g.startsWith("Commedia")) {
    return "Commedia brillante: situazioni, contrattempi e ironia di situazione; ritmo da battuta, il protagonista inciampa nella propria vita con grazia e se ne accorge. Mai solennità, mai sarcasmo sul corpo o sui dati sensibili.";
  }
  return `${g}: tono e passo coerenti dall'inizio alla fine del capitolo.`;
}

export function arcAct(currentDay, totalDays) {
  const day = Math.max(1, Number(currentDay) || 1);
  const total = Math.max(1, Number(totalDays) || 1);
  if (day === 1) return 1;
  if (day >= total) return 3;
  return 2;
}

function arcBlock(book, memory, name, seed = "") {
  const act = arcAct(book.current_day, book.total_days);
  const stage = {
    1: "PRIMO ATTO del romanzo: presenta il mondo e il protagonista e chiude sull'incidente che mette in moto la storia.",
    2: "SECONDO ATTO del romanzo: la posta sale; la svolta di oggi rende la domanda del libro più urgente di ieri.",
    3: "TERZO ATTO del romanzo: il culmine dell'intero arco. I fili aperti convergono, la domanda del libro riceve una risposta parziale dai fatti di oggi, e il finale resta aperto quanto basta per la vita che continua.",
  }[act];
  const line = String(memory.through_line || "").trim();
  const concrete = `una domanda sì/no che nomina un elemento concreto della storia (un luogo, un appunto, un gesto che torna) e dice cosa vuole ${name}, cosa lo trattiene, cosa rischia — mai astrazioni come «cortina», «perimetro», «ore fisse», «altrove»`;
  let thread;
  if (line && memory.through_line_locked) {
    thread = `Filo conduttore del romanzo (stabilito, non riformularlo): «${line}». Oggi deve fare un passo avanti visibile.`;
  } else if (line && seed) {
    thread = `Filo conduttore provvisorio: «${line}». Oggi arriva l'incidente scatenante del romanzo. Nuovo filo, da questo seme: «${seed}» — rifiniscilo nella lingua del genere restando concreto (stesso evento, stesso luogo); da domani non cambierà più.`;
  } else if (line) {
    thread = `Filo conduttore provvisorio: «${line}». Oggi nessun evento forte: copialo identico e fallo avanzare di un passo.`;
  } else if (seed) {
    thread = `Filo conduttore: lo fondi oggi, da questo seme: «${seed}» — rifiniscilo nella lingua del genere restando concreto.`;
  } else {
    thread = `Filo conduttore: ancora da stabilire. Lo fondi oggi, dal materiale più forte della giornata: ${concrete}.`;
  }
  return `Capitolo ${book.current_day} di ${book.total_days}: ${stage}\n${thread}`;
}

function characterBlock(book, memory) {
  const p = book.protagonist;
  const voice = genderVoice(p.gender);
  if (Number(book.current_day) <= 1) {
    return `${p.name}, ${p.age} anni. ${voice} È il primo capitolo: il lettore deve conoscerlo come si conosce il protagonista di un romanzo — da ciò che fa, desidera e teme, non da una scheda.`;
  }
  const portrait = String(memory.character_portrait || "").trim();
  return `${p.name}, già presentato: niente età, niente ripresentazione. ${voice}${portrait ? ` Ciò che il lettore sa finora del personaggio: ${portrait}` : ""}`;
}

function profileBlock(p) {
  const banned = profileLabelStems(p).map((stem) => `${stem}…`);
  return `Profilo, da tradurre in comportamenti e mai da nominare: reattività «${p.emotional_reactivity}», rifugio «${p.archetype}», sguardo «${p.narrative_focus}», ritmo «${p.pacing}», lente metaforica «${p.metaphor_domain}». Parole del profilo vietate nel testo, in ogni forma: ${banned.join(", ")}.`;
}

function memoryOfRepetitions(memory) {
  const titles = (memory.used_titles || []).filter(Boolean);
  const openings = (memory.openings || []).filter(Boolean);
  const lines = [];
  if (titles.length) lines.push(`Titoli già usati (non riprenderne le parole): ${titles.map((t) => `«${t}»`).join(", ")}.`);
  if (openings.length) lines.push(`Aperture già usate (non somigliarle per immagine né per costruzione): ${openings.map((t) => `«${t}»`).join(" / ")}.`);
  return lines.join("\n");
}

const FACTS_RULES = `Intoccabili, dal JSON di oggi e dalla memoria: luoghi, ore, spostamenti, meteo, appunti (testo, ora, luogo, modo). Il resto è romanzo, ed è richiesto: sensazioni, pensieri, ricordi plausibili, dettagli d'ambiente, figure di sfondo senza nome, possibilità immaginate («e se…»). La fantasia non sposta il protagonista fuori dalle scene documentate, non inventa persone con nome né dialoghi con loro, non decide l'esito di un programma o di un appuntamento, non crea fatti che domani andrebbero smentiti. Ciò che non è documentato si pensa, si teme o si immagina: non si afferma. Niente misteri fabbricati (persone che aspettano, porte socchiuse, messaggi): il mistero vero è già nei dati.
Appunti: il modo dell'appunto è il modo del racconto — un evento accaduto è scena, un programma resta attesa o decisione (mai esito), un'impressione resta pensiero. Ora e luogo sono quelli di registrazione. Mai citarli come appunti. Il loro dettaglio (bevanda, cibo, oggetto) compare una volta sola, spoglio, mai in titolo, mai giochi di parole, mai tormentone.`;

// ---------------------------------------------------------------------------
// 1. Il Drammaturgo: progetta il capitolo, non scrive prosa.

export function buildPlanPrompt(payload) {
  const book = payload.book_config;
  const p = book.protagonist;
  const memory = payload.story_state_memory || {};
  const today = payload.today_unified_telemetry || {};

  const system = `Sei il Drammaturgo di un romanzo autobiografico in tre atti, genere ${book.genre}. Il protagonista è anche il lettore: vive già questa vita, e tu gliene dai una versione romanzata che lo tenga con il fiato sospeso. Non scrivi prosa: scrivi il copione del capitolo, che un Narratore seguirà alla lettera.

# ARCO
${arcBlock(book, memory, p.name, threadSeed(payload))}

# PERSONAGGIO
${characterBlock(book, memory)}
${profileBlock(p)}

# REGISTRO
${genreRegister(book.genre)}

# MATERIALE (già selezionato dai dati: parti da qui)
${materialBlock(payload)}

# FATTI E FANTASIA
${FACTS_RULES}

# COME SI PROGETTA UN CAPITOLO
1. Desiderio di oggi: ciò che ${p.name} vuole, detto come un'azione che si può compiere o mancare (tornare, evitare, raggiungere, rivedere, decidere, finire, nascondere). Si appoggia al materiale più forte e al filo conduttore; se non è documentato, è un'intenzione o un pensiero, mai un fatto. Vietate le astrazioni: perimetro, confine, limite, geometria, cortina, soglia, margini, equilibrio, essenza, altrove, ordine, destino, disegno segreto. Male: «capire quale disegno governa le cose». Bene: «uscire in tempo per tornare dove è rimasta ieri sera».
2. Paura: cosa rischia di perdere o di scoprire se ottiene ciò che vuole.
3. Atto I (un quarto): apertura su un'immagine concreta e nuova — mai il risveglio, mai un suono che interrompe il sonno —, dove/quando/chi${Number(book.current_day) <= 1 ? `, ritratto del protagonista in azione (nome ed età, ${p.age} anni, entro il primo paragrafo)` : ", un tratto nuovo del personaggio"}, aggancio al ponte da ieri, innesco: il dato che accende il desiderio di oggi.
4. Atto II (metà): da 2 a 3 scene, ciascuna in un luogo documentato e in un momento della giornata. Per ognuna: obiettivo concreto, ostacolo concreto (dai dati o da una fantasia lieve), un gesto visibile, un pensiero di ${p.name} in una frase, un esito che alza la posta. Fra le scene, un ponte di tensione. Svolta a metà: il dato del materiale che cambia la domanda.
5. Atto III (un quarto, dati dalle 19:00): il punto più alto della giornata, poi un finale semi-aperto con una domanda concreta che il lettore si porta al capitolo dopo. La domanda nasce da un elemento documentato (un luogo nuovo, un appunto senza esito, una notte fuori, un sobbalzo da fermo, un filo aperto) e riguarda ciò che ${p.name} farà, sceglierà o rischierà — mai persone, oggetti o messaggi misteriosi inventati. Male: «quale filo invisibile legava quel perimetro al mondo?», «chi aveva lasciato la porta socchiusa?». Bene: «tornerà nella zona ovest, ora che conosce la strada?». Mai chiudere con il sonno o la notte che cala.
6. Luoghi: i nomi stabiliti si usano alla lettera; per quelli da battezzare scegli ora il nome (sostantivo di funzione + epiteto nel clima del genere, mai «Luogo sconosciuto»).
7. Titolo: sintetico ed evocativo, nato dalla svolta di oggi; non riusa parole dei titoli già usati. Sottotitolo: una riga che non svela il finale.
8. Al massimo 2 immagini della lente «${p.metaphor_domain}», nuove e concrete.
${memoryOfRepetitions(memory)}

Solo JSON valido:
{
  "through_line": "domanda del romanzo (se già stabilita, copiala identica)",
  "desiderio": "azione concreta",
  "paura": "cosa rischia",
  "nuovi_luoghi": {"<location_id da battezzare>": "Nome"},
  "atto_1": {"apertura": "immagine d'apertura", "luogo": "nome", "momento": "parte del giorno", "ritratto": "come si mostra il personaggio", "innesco": "dato che accende il desiderio"},
  "atto_2": {"scene": [{"luogo": "nome", "momento": "parte del giorno", "obiettivo": "", "ostacolo": "", "gesto": "", "pensiero": "", "esito": ""}], "svolta": "dato che cambia la domanda"},
  "atto_3": {"luogo": "nome", "momento": "sera", "culmine": "", "domanda_finale": "domanda concreta per il lettore"},
  "immagini": ["max 2"],
  "titolo": "titolo del capitolo",
  "sottotitolo": "una riga"
}`;

  const user = `Dati della giornata (fonte dei fatti):
${JSON.stringify(compactDay(today), null, 2)}

Progetta il Capitolo ${book.current_day}. Solo il JSON del copione.`;

  return { system, user };
}

// Al Drammaturgo servono le scene, non il rumore numerico.
function compactDay(today) {
  return {
    date: today.date,
    is_empty_day: today.is_empty_day,
    wake_up: today.wake_up_event?.semantic_translation,
    weather: today.weather_daily_arc,
    screen: today.screen_behavior_summary?.semantic_translation,
    scenes: (today.unified_scenes || []).map((scene) => ({
      time_window: scene.time_window,
      location_id: scene.location_id,
      place: scene.location_alias,
      weather: scene.weather,
      body: scene.biometric_vibe,
      notes: scene.user_notes,
    })),
    end_of_day: today.midnight_cutoff_status,
  };
}

// ---------------------------------------------------------------------------
// 2. Il Narratore: scrive la prosa seguendo il copione.

export function buildSystemPrompt(payload, plan = null) {
  const book = payload.book_config;
  const p = book.protagonist;
  const memory = payload.story_state_memory || {};
  const cutoff = payload.today_unified_telemetry?.midnight_cutoff_status;

  const script = plan
    ? `# COPIONE DEL DRAMMATURGO — vincolante
Il copione decide cosa accade e in che ordine; tu decidi come suona. Segui atti, scene, svolta, domanda finale, titolo e nomi dei luoghi nuovi. Se il copione contraddice i dati, vincono i dati.
${JSON.stringify(plan, null, 2)}`
    : `# COPIONE
Nessun copione disponibile: prima di scrivere stabilisci in silenzio desiderio concreto di oggi, due scene dell'Atto II con obiettivo/ostacolo/esito, la svolta e la domanda finale, e seguili.`;

  return `Sei il Narratore di un romanzo autobiografico in tre atti, genere ${book.genre}: scrivi il Capitolo ${book.current_day} di ${book.total_days}. Il lettore è il protagonista: deve riconoscere la propria giornata e scoprirla come un romanzo di cui vuole il seguito. Terza persona, nome ${p.name}.

# ARCO E PERSONAGGIO
${arcBlock(book, memory, p.name, threadSeed(payload))}
${characterBlock(book, memory)}
${profileBlock(p)}

# REGISTRO
${genreRegister(book.genre)}

${script}

# MATERIALE DI OGGI
${materialBlock(payload)}

# COME SI SCRIVE
Tre atti senza intestazioni, nell'ordine del copione: Atto I in 1-2 paragrafi, Atto II in 3-4, Atto III in 1-2.${Number(book.current_day) <= 1 ? ` Primo paragrafo: ${p.name} e i suoi ${p.age} anni entrano nella scena dentro un gesto, non in una scheda.` : ""}
Non è un diario a fasce orarie: i paragrafi non si aprono con «Nel Luogo, verso le dieci…»; si entra nella scena da un'azione, un'immagine o un pensiero, e il quando arriva dopo, se serve. Le scene di routine si fondono in una frase di raccordo.
Mostra, non riassumere. Ogni scena dell'Atto II vive in un momento preciso: un gesto, un dettaglio dei sensi (suono, odore, luce, tatto, temperatura detta con il corpo), un pensiero di ${p.name} in discorso indiretto libero, una reazione. Una frase che riassume ore («la mattinata scivolò via») vale solo come raccordo, una volta.
Soggetto delle azioni è ${p.name}: «${p.name} vuole…, ${p.name} si ferma…», mai costruzioni impersonali come «l'intenzione è…», «la meta impone…», «la ricerca di… si scontra…». Il copione è una scaletta di cose da far accadere, non frasi da tradurre.
Ritmo: frasi brevi nei momenti tesi, più distese nelle pause. Ogni paragrafo spinge il desiderio, lo ostacola o lo cambia; se non lo fa, taglialo.
Non nominare mai il mestiere: vietate le parole obiettivo, ostacolo, esito, svolta, innesco, atto, climax, posta in gioco, «prima prova». Il lettore deve sentire la svolta, non leggerla.
Incipit: mai il risveglio come prima frase, mai un suono che rompe il sonno; parti dall'immagine d'apertura del copione. Il risveglio, se serve, in una subordinata.
Orari detti come li direbbe una persona («poco prima delle sette», «a metà pomeriggio»), mai al minuto, salvo l'ora di un appunto; al massimo 2 paragrafi aperti da un'ora.
Lente «${p.metaphor_domain}»: solo le immagini del copione, al massimo 2.
${memoryOfRepetitions(memory)}

# FATTI E FANTASIA
${FACTS_RULES}

# DIVIETI DI SUPERFICIE
Misure: mai cifre o numeri in lettere di temperatura, umidità, battito, saturazione, velocità, durate («16°», «sedici gradi», «70 bpm»); vietate gradi, centigradi, percento, percentuale, bpm, pulsazioni, battiti al minuto, saturazione dell'ossigeno, km/h. Intensità → corpo, contrasto, progressione.
Corpo: cuore/battito/polso al massimo una volta e solo se oggi c'è un picco a corpo fermo; senza picco, zero. Un picco in movimento è fatica del passo, mai presagio. Passo rapido ≠ corsa.
Schermo: mai come oggetto in scena (niente «specchio nero», «schermo», «oggetto tascabile»); conta ciò che rivela — un desiderio di luoghi lontani, qualcuno con cui si parla, un'attesa —, al massimo una volta.
Lessico vietato ovunque: smartphone, telefono, cellulare, app, WhatsApp, Instagram, social, GPS, notifiche, sveglia digitale, smartwatch.
Lingua: mai la stessa parola piena in frasi vicine né tre volte nel capitolo (niente tic come «geometria», «precisione», «perimetro»); mai «X di X»; davanti ai nomi propri le preposizioni si articolano («della Casa…», «al Tavolo…», «nell'Archivio…», mai «de La», «a Il», «ne L'»).

# LUOGHI
Nomi stabiliti in \`established_locations\` alla lettera e immutabili; nome pieno alla prima apparizione, poi nome comune; mai arredi dedotti dal nome. Le descrizioni provvisorie delle scene («luogo di fatica…», «tratto di strada…») non entrano mai nella prosa. I luoghi nuovi prendono il nome del copione (\`nuovi_luoghi\`) e si registrano in \`established_locations\`, restituito completo.

# CHIUSURA
${closingRule(cutoff, p.name)}

# TITOLO E MISURA
Titolo e sottotitolo: quelli del copione, ritoccati solo se il testo lo chiede; fuori da \`chapter_text\`.
Misura: 550-800 parole, 6-9 paragrafi; ogni scena dell'Atto II ne merita almeno 120. La lunghezza va alle scene, mai a meteo ripetuto o riassunti. \`chapter_text\`: solo prosa, paragrafi divisi da riga vuota, niente markdown.

# STATO RESTITUITO — fatti, non slogan
\`character_portrait\`: ciò che il lettore sa ora di ${p.name}, max 3 frasi, da comportamenti e scelte, senza parole del profilo. \`previous_chapter_summary\`: dal Giorno 1 a oggi — luoghi, appunti, anomalie, svolte, conservando il modo degli appunti — chiuso dal passo avanti di oggi sul filo. \`recurring_motifs\`: max 3 elementi concreti che tornano, mai nomi di luogo. \`unresolved_tensions\`: domande documentate rimaste aperte (appunto senza esito, luogo nuovo lasciato a metà, notte fuori casa, sobbalzo da fermo), ognuna con luogo e momento.

Solo JSON valido, senza commenti:
{
  "chapter_number": ${book.current_day},
  "chapter_title": "titolo",
  "chapter_subtitle": "una riga",
  "chapter_text": "corpo del capitolo",
  "updated_story_state": {
    "character_portrait": "",
    "previous_chapter_summary": "fatti dal Giorno 1 alla fine del Giorno ${book.current_day}",
    "last_chapter_ending_state": "AT_HOME_RESTING oppure OUTSIDE_CLIFFHANGER oppure OUTSIDE_AWAY",
    "established_locations": {"<ogni chiave ricevuta>": "<nome invariato, o appena battezzato>"},
    "recurring_motifs": [],
    "unresolved_tensions": []
  }
}`;
}

function closingRule(cutoff, name) {
  const base = `L'Atto III si costruisce sui dati dalle 19:00 in poi, senza annunciare l'ora: la tensione del giorno tocca il punto più alto e si scioglie solo in parte. Eventi serali significativi si raccontano come scena; permanenza di routine in poche righe tese sul filo, niente bilanci o meditazioni. Ultima frase: la domanda finale del copione, resa concreta e legata al filo — il lettore deve chiedersi cosa farà, dove andrà, se tornerà, chi risponderà. Mai ${name} che va a dormire, mai la notte che cala, niente stanchezza o «domani si vedrà», salvo un appunto serale che li registri. Mai agganci fabbricati (messaggi misteriosi, presagi senza referente).`;
  if (cutoff === "OUTSIDE_HIGH_ACTIVITY") return `${base} Stato finale OUTSIDE_HIGH_ACTIVITY: ancora fuori, in attività — chiudi in medias res. Scrivi OUTSIDE_CLIFFHANGER.`;
  if (cutoff === "OUTSIDE_AWAY") return `${base} Stato finale OUTSIDE_AWAY: ancora fuori casa — immagine aperta su quel fatto. Scrivi OUTSIDE_AWAY.`;
  return `${base} Stato finale AT_HOME_RESTING: chiusura in casa, fili aperti sì, interruzioni per strada no. Scrivi AT_HOME_RESTING.`;
}

export function buildUserPrompt(payload) {
  const first = Number(payload.book_config.current_day) <= 1;
  return `JSON unico della giornata: sola fonte dei fatti.

${JSON.stringify(payload, null, 2)}

Scrivi il Capitolo ${payload.book_config.current_day} seguendo il copione. Solo l'oggetto JSON richiesto.
Controllo finale (se un punto cade, riscrivi prima di rispondere): prima frase = immagine d'apertura, non il risveglio; Atto I con dove/quando/chi${first ? " e ritratto in azione" : ""}; Atto II con le scene del copione, ognuna con gesto, dettaglio dei sensi e pensiero; svolta sentita, non nominata; Atto III semi-aperto sulla domanda finale; nessuna parola del mestiere (obiettivo, ostacolo, esito, svolta), nessuna parola del profilo, nessuno schermo in scena; preposizioni articolate davanti ai nomi; nessuna misura; nessun paragrafo aperto da «luogo + ora»; 550-800 parole.`;
}

export function buildExpansionPrompt(payload, draft) {
  return `Capitolo troppo corto (${countWordsLocal(draft.chapter_text)} parole). Riscrivi l'intero JSON a 550-800 parole, 6-9 paragrafi, con le regole e il copione del system prompt. Allunga così: ogni scena dell'Atto II diventa di almeno 120 parole, con un gesto, un dettaglio dei sensi, un pensiero in discorso indiretto libero e una reazione, più il ponte di tensione verso la scena successiva; l'Atto III diventa una scena vera (dove, un gesto, un pensiero) prima della domanda finale. Niente fatti nuovi, niente routine dilatata, niente astrazioni. Atto III sempre ≤2 paragrafi.

JSON di giornata:
${JSON.stringify(payload)}

Bozza:
${JSON.stringify(draft)}`;
}

function countWordsLocal(text) {
  return (String(text || "").trim().match(/\S+/g) || []).length;
}

export function buildRepairPrompt(payload, draft, words) {
  return `Parole vietate nel JSON: ${words.join(", ")}. Riscrivi l'intero JSON sostituendole con immagini coerenti col genere ${payload.book_config.genre}, senza misure né fatti nuovi. Conserva titolo, sottotitolo, fatti, tre atti, lunghezza.

${JSON.stringify(draft)}`;
}

export function buildMeasurePrompt(payload, draft, hits) {
  return `Misure da bollettino nel capitolo: ${hits.join(", ")}. Riscrivi l'intero JSON: le misure spariscono (al massimo resta una condizione dell'aria senza numeri); il corpo resta solo in un unico momento a corpo fermo davvero decisivo. Conserva fatti, titolo, sottotitolo, luoghi alla lettera, tre atti, lunghezza.

${JSON.stringify(draft)}`;
}

export function buildStylePrompt(payload, draft, issues) {
  return `Correggi solo questi problemi: ${issues.join("; ")}. Riscrivi l'intero JSON con le regole e il copione del system prompt. Le parole del mestiere (obiettivo, ostacolo, esito, svolta) e quelle del profilo spariscono: al loro posto un gesto o un pensiero che fa sentire la stessa cosa. Se l'apertura è il risveglio, il capitolo comincia invece dall'immagine d'apertura del copione. Luoghi stabiliti alla lettera; quelli provvisori battezzati con il nome del copione. Lunghezza 550-800 parole: se serve tagliare, taglia routine e meteo, mai le scene dell'Atto II. Conserva fatti, tre atti e finale semi-aperto.

${JSON.stringify(draft)}`;
}

// ---------------------------------------------------------------------------
// Frontespizio

export function buildClosingPrompt(book) {
  const last = book.days.at(-1);
  const memory = last?.story_state_after || {};
  const titles = book.days.map((day) => day.chapter?.chapter_title).filter(Boolean);
  const chapters = book.days
    .map((day) => {
      const excerpt = String(day.chapter?.chapter_text || "").replace(/\s+/g, " ").trim().slice(0, 420);
      const subtitle = day.chapter?.chapter_subtitle ? `\n${day.chapter.chapter_subtitle}` : "";
      return `Capitolo ${day.day} — ${day.chapter.chapter_title}${subtitle}\n${excerpt}`;
    })
    .join("\n\n");
  const protagonist = book.book_config.protagonist;
  const banned = profileLabelStems(protagonist).map((stem) => `${stem}…`).join(", ");

  return {
    system: `Editor di un romanzo già scritto in tre atti: capitoli legati da un unico filo, una sola biografia. Frontespizio solo dai fatti documentati, senza inventare eventi. ${genderVoice(protagonist.gender)}
book_title: nasce dal filo conduttore (la domanda, il desiderio, il luogo che conta), mai generico; deve essere diverso da ogni titolo di capitolo (${titles.map((t) => `«${t}»`).join(", ")}) e non riprenderne le parole piene. subtitle: una riga, approfondisce senza anticipare fatti assenti. epigraph: una frase guadagnata dal racconto, senza attribuzione. back_cover: 140-180 parole, terza persona, prosa continua, al presente — apre su una scena concreta del libro, presenta il protagonista da ciò che fa e desidera, pone la domanda drammatica del romanzo e accenna alla salita della tensione senza svelare lo scioglimento; non è un indice dei luoghi. Non attribuire esiti che i capitoli non dichiarano e non cambiare il modo degli appunti. Preposizioni articolate davanti ai nomi propri («della Casa…», «al Tavolo…»). Vietati: età, parole del profilo (${banned}), schermi e oggetti tecnologici («specchio nero» compreso), frasi riciclate dai capitoli, sintesi passe-partout. Parole vietate: smartphone, telefono, app, social, GPS, notifiche, smartwatch. Solo JSON valido:
{
  "book_title": "titolo del romanzo",
  "subtitle": "sottotitolo breve",
  "epigraph": "una frase di epigrafe",
  "back_cover": "quarta di copertina tra 140 e 180 parole"
}`,
    user: `Genere: ${book.book_config.genre}
Protagonista: ${protagonist.name}
Durata: ${book.book_config.total_days} giorni

Filo conduttore: ${memory.through_line || "non dichiarato"}
Ciò che il lettore sa del protagonista: ${memory.character_portrait || "non dichiarato"}

Arco completo:
${memory.previous_chapter_summary || ""}

Motivi ricorrenti: ${(memory.recurring_motifs || []).join("; ") || "nessuno"}
Tensioni aperte: ${(memory.unresolved_tensions || []).join("; ") || "nessuna"}

Voci dei capitoli:
${chapters}`,
  };
}
