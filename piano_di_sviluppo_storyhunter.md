# 📖 Storyhunter — Documento di Specifiche e Piano di Sviluppo (MVP)

## 1. Visione del Progetto e Filosofia Narrativa

**Storyhunter** è un'applicazione mobile che trasforma la routine quotidiana dell'utente in un'opera letteraria, agendo come un biografo invisibile. Attraverso il monitoraggio passivo di spostamenti, meteo, abitudini di utilizzo dello smartphone e parametri biometrici (affiancati da brevi appunti manuali opzionali), l'algoritmo rielabora ogni sera la giornata in un capitolo narrativo.

### Pilastri Progettuali Definiti

1. **Trasfigurazione Metaforica Totale:** Il narratore non rompe mai la quarta parete tecnologica. Parole come *smartphone, WhatsApp, Instagram, GPS, notifiche* o *smartwatch* sono bandite e sostituite da metafore coerenti con il genere letterario scelto.
1-bis. **Luoghi Veri:** La storia si svolge nella città vera e nei luoghi veri dei dati (vie, piazze, parchi, quartieri dal reverse geocoding), chiamati con il loro nome e detti come li direbbe chi ci vive (*«in quel di Milano»*, *«in Vittorio Emanuele»*). La casa è «casa», al massimo con il quartiere. Vietato inventare vie, locali, insegne o nomi letterari dei luoghi.
2. **Infallibilità Poetica (Zero Editing):** Non è previsto l'editing del testo generato. Se i sensori rilevano un battito cardiaco accelerato mentre l'utente è fermo (magari per una rampa di scale o un caffè), il narratore lo interpreta come verità emotiva assoluta (paura, batticuore, suspense).
3. **Continuità e Memoria di Stato:** I capitoli non sono episodi isolati ma seguono un arco drammaturgico progressivo ($3\text{--}7$ giorni nel prototipo), mantenendo memoria di luoghi, personaggi e tensioni irrisolte.
4. **Lettura a Scelta (Capitoli Sigillati):** Ogni capitolo generato entra nel *Taccuino del Narratore* come "sigillato". L'utente decide giorno per giorno se aprirlo subito o conservarlo per scoprire l'intero romanzo impaginato solo alla fine del periodo.

---

## 2. Architettura Tecnica e Stack Consigliato

Per la fase di prototipazione, il focus mobile primario è **Android**, poiché offre API di sistema accessibili per il monitoraggio dell'utilizzo delle app e delle sveglie rispetto alle restrizioni sandbox di iOS, affiancato da una **Dashboard Web in Localhost** per la simulazione rapida su PC.

| Livello | Tecnologia Consigliata | Funzione Specifica |
| :--- | :--- | :--- |
| **Frontend Mobile** | **Flutter** o **React Native** | Gestione UI, Onboarding, Taccuino appunti attivi, lettore capitoli e background services. |
| **Storage Locale (Edge)** | **SQLite** o **Hive / Isar** | Accumulo locale dei micro-eventi e creazione dei 4 pacchetti giornalieri (Micro-Batching). |
| **Raccolta OS & Sensori** | `UsageStatsManager`, `AlarmManager`, **Health Connect API** | Lettura aggregata tempo di schermo/doomscrolling, messaggistica, orario sveglia, battito cardiaco ($\text{HR}$), saturazione ($\text{SpO}_2$) e stress. |
| **Geolocalizzazione & Meteo** | `Geolocator` (Geofencing) + **OpenWeatherMap API** | Rilevamento cluster di sosta ($> 15\text{ min}$) e spostamenti significativi ($> 200\text{ m}$), incrociati con il meteo. |
| **Ambiente di Simulazione PC** | **Node.js / FastAPI** + **React / HTML Dashboard** (in `localhost`) | Creazione e invio di giornate simulate (a slot o come JSON unico) per testare il motore AI senza telefono. |
| **Backend & Aggregatore** | **Supabase** o **Firebase** (Firestore + Cloud Functions) | Ricezione dei 4 micro-batch giornalieri, fusione serale in un **unico JSON**, gestione `StoryState.json` e cronjob delle `23:59`. |
| **Motore AI Narrativo** | **Claude 3.5 Sonnet** o **GPT-4o** (Structured Outputs) | Ricezione del JSON unico di fine giornata, scrittura del capitolo e aggiornamento della memoria narrativa. |
| **Motore Editoriale** | **WeasyPrint** o `pdfmake` | Impaginazione automatica a fine ciclo (frontespizio, divisione in capitoli, esportazione PDF/ePub). |

---

## 3. Flusso di Onboarding e Profilazione

All'apertura dell'app, prima di iniziare il ciclo di tracciamento, l'utente configura il proprio profilo e le regole del libro:

1. **Dati Anagrafici:** Nome, Età, Genere. La città non si chiede: arriva dal GPS (reverse geocoding delle tappe). Nel simulatore locale ogni libro ha un GPS simulato in una città fissa fra Milano, Roma, Torino, Bologna e Napoli.
2. **Durata del Tracciamento (Prototipo):** Scelta tra un minimo di $3$ giorni e un massimo di $7$ giorni.
3. **Genere Letterario:** unico e fisso, *Realismo Magico*: un solo registro rende stabili la prosa e i prompt. La personalizzazione passa dal questionario.
4. **Questionario Attitudinale e sugli Interessi ($5$ Domande):** Determina la voce narrante, il ritmo della prosa e il vocabolario metaforico del protagonista.

### Matrice del Questionario di Onboarding

| # | Domanda | Opzioni di Risposta | Parametro AI Generato (`ProtagonistProfile`) |
| :--- | :--- | :--- | :--- |
| **1** | **La Lente Sensoriale:** *Entri in una città sconosciuta per la prima volta. Cosa cattura subito la tua attenzione?* | **A)** Le forme dei palazzi, le luci, i dettagli visivi e artistici.<br>**B)** I profumi che escono dai forni, i mercati, i sapori di strada.<br>**C)** Il ritmo dei passi, i parchi, l'energia fisica di chi si muove.<br>**D)** I suoni di sottofondo, le voci, la colonna sonora invisibile del luogo. | **Dominio Metaforico:**<br>• A = *Arti Visive & Estetica*<br>• B = *Cucina & Materia*<br>• C = *Sport & Dinamismo corporeo*<br>• D = *Musica & Atmosfera sonora* |
| **2** | **L'Imprevisto:** *Un diluvio improvviso manda all'aria i tuoi piani del pomeriggio. Qual è la tua prima reazione interna?* | **A)** Rido della sfortuna: è l'ennesima gag della giornata.<br>**B)** Cerco subito un piano B logico e ricalcolo i tempi.<br>**C)** Mi godo il caos: cambio strada e vedo dove mi porta.<br>**D)** Lo prendo come un segno del destino e mi chiudo nei miei pensieri. | **Reattività Emotiva:**<br>• A = *Autoironico / Sarcastico*<br>• B = *Razionale / Analitico*<br>• C = *Istintivo / Esploratore*<br>• D = *Malinconico / Riflessivo* |
| **3** | **Il Rifugio (Interessi):** *Hai tre ore libere senza obblighi né notifiche. Come ricarichi davvero la mente?* | **A)** Creando o osservando: una mostra, un film d'autore, un progetto.<br>**B)** Mettendo le mani in pasta: cucinare qualcosa di complesso o scoprire un locale.<br>**C)** Muovendo il corpo: allenamento, corsa, trekking o fatica fisica.<br>**D)** Esplorando mondi: lettura, giochi di strategia o pura contemplazione. | **Archetipo Abitudinario:**<br>• A = *Il Creativo / Esteta*<br>• B = *L'Alchimista / Conviviale*<br>• C = *L'Atleta / Cinestetico*<br>• D = *Il Pensatore / Stratega* |
| **4** | **Il Dialogo Interno:** *Quando ripensi a una giornata appena conclusa, su cosa si fissa la tua memoria?* | **A)** Sulle parole non dette e sugli sguardi incrociati.<br>**B)** Sulle cose concrete che ho concluso o lasciato a metà.<br>**C)** Sulle assurdità e sui paradossi delle persone incontrate.<br>**D)** Sulle sensazioni fisiche: stanchezza, adrenalina, fame, quiete. | **Focus Narrativo:**<br>• A = *Psicologico / Relazionale*<br>• B = *Pragmatico / Obiettivi*<br>• C = *Satirico / Osservazionale*<br>• D = *Viscerale / Sensoriale* |
| **5** | **Il Ruolo nel Mondo:** *Se la tua settimana fosse un film, che tipo di inquadratura ti rappresenterebbe meglio?* | **A)** Un piano sequenza frenetico in mezzo alla folla.<br>**B)** Un dettaglio ravvicinato sulle mani mentre fanno qualcosa.<br>**C)** Un campo lungo e silenzioso visto da una finestra in alto.<br>**D)** Un montaggio alternato pieno di imprevisti e cambi di ritmo. | **Ritmo di Scrittura (Pacing):**<br>• A = *Incalzante e paratattico*<br>• B = *Descrittivo e minuzioso*<br>• C = *Lento, lirico e contemplativo*<br>• D = *Sincopato e dinamico* |

---

## 4. Regole di Trasfigurazione e Meccaniche Narrative

### 4.1 Dizionario di Trasfigurazione Metaforica
Il backend traduce le etichette tecniche prima di inviarle al modello AI, applicando vincoli negativi per impedire qualsiasi gergo informatico.

| Dato Tecnico Rilevato | Noir / Hardboiled | Realismo Magico | Commedia Brillante |
| :--- | :--- | :--- | :--- |
| **Sveglia (es. 07:00)** | *"La sirena del mattino squarciò il buio della stanza..."* | *"Il richiamo metallico ruppe l'incantesimo del sonno alle prime luci..."* | *"L'impietoso gong delle sette decretò la fine della pace..."* |
| **Doomscrolling (es. 2h di social)** | *"Rimase ipnotizzato dal rettangolo di vetro luminoso, cercando indizi nelle vite degli altri..."* | *"Fissò a lungo lo specchio nero tascabile, dove scorrevano visioni di mondi lontani e irraggiungibili..."* | *"Cadde nella tana del bianconiglio digitale, ipnotizzato da un carosello infinito di vite altrui..."* |
| **Uso intenso di WhatsApp** | *"Un fitto scambio di dispacci silenziosi e messaggi cifrati tenne occupate nervosamente le sue dita..."* | *"Parole invisibili viaggiavano nell'etere, tessendo una ragnatela di conversazioni mute..."* | *"Un ping-pong frenetico di botta e risposta a distanza che non lasciava tregua ai pollici..."* |
| **Battito Alto + GPS Fermo (Errore accettato)** | *"Il cuore prese a martellare contro le costole. Il pericolo era nella stanza, invisibile ma presente..."* | *"Il sangue accelerò all'improvviso, come se il tempo stesso avesse iniziato a correre più veloce dentro il suo petto..."* | *"Un'improvvisa tachicardia da fermo: ansia esistenziale, caffè di troppo o un'illuminazione improvvisa?"* |
| **Giornata Vuota (GPS fermo a casa, 0 note)** | *"La stanza divenne una cella d'isolamento. Mentre fuori la città continuava a mentire, i fantasmi dei giorni passati bussarono alla porta..."* | *"Le pareti domestiche si dilatarono fino a contenere un intero universo immobile, popolato dai ricordi di ciò che era appena accaduto..."* | *"Una giornata di clausura volontaria in cui il divano divenne un'isola deserta e i pensieri fecero il giro del mondo..."* |

### 4.2 Gestione Casi Limite
* **La "Giornata Vuota" (Bassa Entropia):** Se l'utente non esce di casa, non indossa lo smartwatch e non scrive appunti, il sistema imposta il flag `is_empty_day: true`. L'AI genera un capitolo puramente **introspettivo**, facendo riflettere il protagonista sugli eventi e sulle tensioni irrisolte dei giorni precedenti (`StoryState.json`) attraverso la lente dei suoi interessi (es. *Cucina*, *Arte*, *Sport*).
* **Il Cutoff delle 23:59 e il Cliffhanger:** La giornata si chiude tassativamente alle `23:59` (o prima se l'utente preme "Fine Giornata"). Se alle `23:59` l'utente è ancora fuori casa o ha il battito accelerato, il capitolo si interrompe su un *cliffhanger*. Dalle `00:00` i nuovi dati confluiscono nello Slot 1 del giorno successivo ($N+1$), il cui capitolo riprenderà esattamente da quel momento.

---

## 5. Piano di Impacchettamento Dati: Micro-Batching a 4 Slot + Merge Unico Server-Side

Per evitare il consumo eccessivo di batteria e traffico dati (niente invii continui ogni minuto), ma garantire al tempo stesso che nessun dato vada perso se il telefono si spegne prima di mezzanotte, l'architettura adotta un **sistema a due fasi**:
1. **Fase 1 (Client $\rightarrow$ Backend): Micro-Batching in 4 Slot Orari.**
2. **Fase 2 (Backend $\rightarrow$ Modello AI): Consolidamento in un Unico File JSON di Fine Giornata.**

```
[SMARTPHONE: SQLite Locale]
   ├── Slot 1 (00:00 - 06:00) ──(Sync)──> ┐
   ├── Slot 2 (06:00 - 12:00) ──(Sync)──> │   [BACKEND: Daily Merger]
   ├── Slot 3 (12:00 - 18:00) ──(Sync)──> ├──> Unisce i 4 Slot alle 23:59 ──> [1 JSON UNICO] ──> [LLM API]
   └── Slot 4 (18:00 - 23:59) ──(Sync)──> ┘
```

### 5.1 Fase 1: Raccolta Edge e Invio dei 4 Micro-Batch (Client $\rightarrow$ Server)
Durante il giorno l'app lavora offline salvando i dati nel database locale SQLite solo quando si verificano variazioni rilevanti (**Delta Triggering**):
* **GPS & Meteo:** Registra un punto solo se l'utente si sposta di $> 200\text{ m}$ e crea una " Tappa" solo se la sosta dura $> 15\text{ min}$ (*Dwell Time*), chiamando l'API meteo solo al cambio di tappa.
* **Biometria:** Calcola la media del battito ($\text{HR}$) e dello stress nel blocco orario, ma salva un evento puntuale (`peak_event`) solo se il battito varia di oltre $\pm 20\%$ rispetto alla baseline a riposo.
* **Screen Time & Sveglia:** Interrogati tramite le API di sistema Android (`UsageStatsManager` e `AlarmManager`) solo alla fine di ogni fascia oraria.
* **Calendario:** Gli impegni della giornata letti dal calendario di sistema (`CalendarContract` su Android, `EventKit` su iOS), con titolo, ora di inizio e fine, flag *tutto il giorno* e *ricorrente*. Ogni impegno viaggia nello slot in cui comincia (quelli di tutto il giorno nello Slot 1) come `calendar_events: [{ title, start, end, all_day, recurring }]`. Luogo, partecipanti e note dell'evento non lasciano il telefono.

La giornata è divisa in **4 Fasce Orarie (Slot)**:
1. **Slot 1 — Notte/Alba:** `00:00 – 05:59` (Utile per chi fa tardi la sera prima o per il sonno).
2. **Slot 2 — Mattina:** `06:00 – 11:59` (Sveglia, inizio attività, spostamenti mattutini).
3. **Slot 3 — Pomeriggio:** `12:00 – 17:59` (Pranzo, lavoro/studio, picchi pomeridiani).
4. **Slot 4 — Sera:** `18:00 – 23:59` (Rientro, vita sociale, chiusura giornata).

Alla scadenza di ciascuno slot (es. alle `06:00`, `12:00`, `18:00` e `23:59`, oppure quando l'utente preme manualmente *"Concludi Giornata"*), lo smartphone comprime i dati di quella fascia in un micro-pacchetto da $\sim 2\text{ KB}$ e lo invia al database sul Backend. Se il telefono si scarica alle `21:00`, il server possiede già i primi 3 slot e può comunque generare un capitolo coerente fino al tardo pomeriggio.

### 5.2 Fase 2: Il "Daily Merger" sul Server (Backend $\rightarrow$ Modello AI)
Il modello AI **non riceve mai i 4 slot separati**. Alle `23:59` (o al trigger manuale dell'utente), una Cloud Function sul backend esegue il **Daily Merger**:
1. Recupera dal database tutti gli slot ricevuti per quel giorno (`Slot 1..4`).
2. Unisce le tappe geografiche, gli appunti manuali dell'utente e i picchi biometrici in una **timeline cronologica continua** (`scenes`).
3. Mette in fila gli impegni del calendario (`calendar_events`): ripulisce i titoli (niente link, codici, numeri, nomi di piattaforme; un impegno di salute diventa *«Appuntamento per la salute»*), li classifica (`work`, `social`, `sport`, `errand`, `travel`, `health`, `personal`) e affianca a ognuno il luogo in cui la persona si trovava davvero a quell'ora (`presence`: `HOME`, `AWAY`, `IN_TRANSIT`, `NO_TRACE`, `ALL_DAY`). L'impegno è un programma, la tappa è il fatto: lo scarto fra i due è materiale drammatico.
4. Calcola i totali giornalieri di utilizzo schermo/messaggistica e li trasforma nelle descrizioni metaforiche (`screen_behavior`).
5. Incarna nel medesimo oggetto la configurazione del libro (`book_config`) e la memoria narrativa dei giorni precedenti (`story_state_memory`).
6. Invia **un unico file JSON consolidato** all'API dell'LLM per generare il capitolo.

---

## 6. Struttura del File JSON Unico per l'AI e System Prompt

### 6.1 Schema del JSON Unico di Fine Giornata (`DailyUnifiedPayload.json`)
Questo è l'esatto oggetto monolitico generato dal *Daily Merger* sul backend (o dal Simulatore in Localhost) e passato in un'unica chiamata al modello AI:

```json
{
  "book_config": {
    "total_days": 5,
    "current_day": 3,
    "genre": "Realismo Magico",
    "city": "Milano",
    "protagonist": {
      "name": "Marco",
      "age": 27,
      "gender": "M",
      "metaphor_domain": "Cucina & Materia",
      "emotional_reactivity": "Autoironico / Sarcastico",
      "archetype": "L'Alchimista / Conviviale",
      "narrative_focus": "Psicologico / Relazionale",
      "pacing": "Sincopato e dinamico"
    }
  },
  "story_state_memory": {
    "previous_chapter_summary": "Nel Giorno 2, Marco ha attraversato la città sotto una pioggia sottile, fermandosi al Parco Sempione dove un gabbiano gli ha sottratto il pranzo durante un incontro carico di non detti.",
    "last_chapter_ending_state": "AT_HOME_RESTING",
    "established_locations": {
      "loc_home": "casa",
      "loc_park_parco_sempione": "Parco Sempione",
      "loc_work_via_dante": "il lavoro in via Dante"
    },
    "recurring_motifs": [
      "Il gabbiano ladro come presagio di imprevisti",
      "I pensieri che fermentano come lievito madre"
    ],
    "unresolved_tensions": [
      "Le parole rimaste in sospeso durante l'incontro interrotto nel Giorno 2"
    ]
  },
  "today_unified_telemetry": {
    "date": "2026-10-15",
    "slots_merged": ["SLOT_1_NIGHT", "SLOT_2_MORNING", "SLOT_3_AFTERNOON", "SLOT_4_EVENING"],
    "is_empty_day": false,
    "wake_up_event": {
      "time": "06:45",
      "semantic_translation": "Risveglio brusco prima dell'alba, interruzione netta del sonno"
    },
    "weather_daily_arc": "Mattina limpida e fredda, pomeriggio coperto con vento umido, sera piovosa",
    "screen_behavior_summary": {
      "doomscrolling_level": "HIGH_MORNING",
      "messaging_intensity": "VERY_HIGH_AFTERNOON",
      "semantic_translation": "Lunghe immersioni mattutine nello specchio nero (oltre 50 minuti di visioni passive), seguite nel pomeriggio da una fitta ragnatela di dispacci silenziosi e conversazioni mute a distanza"
    },
    "unified_scenes": [
      {
        "slot_origin": "SLOT_2_MORNING",
        "time_window": "08:30 - 12:30",
        "location_id": "loc_work_via_dante",
        "location_alias": "il lavoro in via Dante",
        "location_at": "al lavoro, in via Dante",
        "location_area": "Cordusio, Milano",
        "weather": "Cielo terso, vento freddo",
        "biometric_vibe": "Concentrazione statica, lieve tensione costante (HR medio 82 bpm, Stress moderato)",
        "user_notes": []
      },
      {
        "slot_origin": "SLOT_3_AFTERNOON",
        "time_window": "13:15 - 14:30",
        "location_id": "loc_park_parco_sempione",
        "location_alias": "Parco Sempione",
        "location_at": "al Parco Sempione",
        "location_area": "Sempione, Milano",
        "weather": "Nuvole basse in rapido movimento",
        "biometric_vibe": "Passo rapido seguito da sosta inquieta (HR 98 bpm)",
        "user_notes": [
          {
            "time": "13:40",
            "text": "Sono tornato sulla panchina di ieri. Il gabbiano mi fissava dal lampione."
          }
        ]
      },
      {
        "slot_origin": "SLOT_4_EVENING",
        "time_window": "19:30 - 23:59",
        "location_id": "loc_unknown_via_pacini",
        "location_alias": "via Pacini",
        "location_at": "in via Pacini",
        "location_area": "Città Studi, Milano",
        "weather": "Pioggia battente",
        "biometric_vibe": "Picco improvviso di adrenalina e tachicardia da fermo alle 21:15 (HR 128 bpm, SpO2 98%)",
        "user_notes": [
          {
            "time": "21:20",
            "text": "Ho bruciato il risotto proprio mentre cercavo di fare colpo."
          }
        ]
      }
    ],
    "calendar_events": [
      {
        "time_window": "21:00 - 23:00",
        "title": "Cena da Chiara",
        "kind": "social",
        "all_day": false,
        "recurring": false,
        "presence": "AWAY",
        "location_id": "loc_unknown_via_pacini",
        "location_alias": "via Pacini",
        "location_at": "in via Pacini"
      }
    ],
    "midnight_cutoff_status": "OUTSIDE_HIGH_ACTIVITY"
  }
}
```

### 6.2 System Prompt del Motore Narrativo (Invariante + Dinamico)

```markdown
Sei un biografo invisibile e uno scrittore d'autore. Il tuo compito è scrivere il Capitolo {{current_day}} di {{total_days}} di un romanzo autobiografico nel genere {{genre}}, basandoti sull'unico file JSON giornaliero fornito.

### REGOLE FERREE DI STILE E MONDO
1. DIVIETO TECNOLOGICO ASSOLUTO: Non usare MAI parole come smartphone, telefono, cellulare, app, WhatsApp, Instagram, social, GPS, notifiche, sveglia digitale o smartwatch. Trasfigura sempre questi concetti usando le metafore fornite in `screen_behavior_summary` e `wake_up_event`, adattandole al genere {{genre}}.
2. VOCE E LENTE DEL PROTAGONISTA: Il protagonista si chiama {{protagonist.name}} ({{protagonist.age}} anni). Filtra ogni descrizione sensoriale, metafora e riflessione attraverso il suo dominio d'interesse primario ({{protagonist.metaphor_domain}}) e il suo archetipo ({{protagonist.archetype}}). Il suo modo di reagire agli imprevisti è {{protagonist.emotional_reactivity}}, con un focus {{protagonist.narrative_focus}} e un ritmo di scrittura {{protagonist.pacing}}.
3. INFALLIBILITÀ POETICA (ACCETTA L'ERRORE): Tratta ogni dato biometrico presente in `biometric_vibe` come una verità emotiva e drammatica assoluta. Se il battito cardiaco è a 128 bpm mentre il protagonista è fermo, deve esserci un reale turbamento, suspense o vertigine emotiva nella scena.
4. CONTINUITÀ E TOPONOMASTICA: Riprendi il filo narrativo da `previous_chapter_summary` e rispetta lo stato finale della notte precedente (`last_chapter_ending_state`). Chiama i luoghi con i loro nomi veri (`location_alias`, `location_at`, `location_area`) e nomina la città come la nominerebbe chi ci vive. Mai vie, locali o nomi letterari inventati: la mappa `established_locations` la tiene il codice, il modello non la modifica.
5. GESTIONE GIORNATA VUOTA: Se `is_empty_day` è `true`, non inventare viaggi o eventi d'azione. Scrivi un capitolo denso, psicologico e introspettivo in cui il protagonista, chiuso nel suo spazio, rielabora `unresolved_tensions` e `recurring_motifs` dei giorni precedenti.
6. CHIUSURA A MEZZANOTTE: Se `midnight_cutoff_status` è `OUTSIDE_HIGH_ACTIVITY`, la giornata si è interrotta nel mezzo dell'azione alle 23:59. Chiudi il capitolo in medias res su un cliffhanger carico di attesa.

### FORMATO DI OUTPUT RICHIESTO (JSON STRUCTURED OUTPUT)
Restituisci esclusivamente un oggetto JSON valido con questa struttura:
{
  "chapter_number": {{current_day}},
  "chapter_title": "Titolo evocativo del capitolo",
  "chapter_text": "Testo completo del capitolo letterario (minimo 800 parole, diviso in paragrafi)...",
  "updated_story_state": {
    "previous_chapter_summary": "Riassunto denso di ciò che è accaduto dal Giorno 1 fino alla fine del Giorno {{current_day}}",
    "last_chapter_ending_state": "AT_HOME_RESTING oppure OUTSIDE_CLIFFHANGER",
    "established_locations": { ...mappa aggiornata con eventuali nuovi luoghi battezzati... },
    "recurring_motifs": [ ...lista aggiornata dei simboli ricorrenti... ],
    "unresolved_tensions": [ ...tensioni ancora aperte per il giorno successivo... ]
  }
}
```

---

## 7. Modalità Simulazione in Localhost (PC Testing Environment)

Per sviluppare, calibrare i prompt e testare interi archi narrativi di $3\text{--}7$ giorni in pochi minuti senza attendere giorni reali né camminare fisicamente con uno smartphone, il progetto include una **Web App di Simulazione in Localhost** (`http://localhost:3000`).

### 7.1 Architettura del Simulatore Locale
Il simulatore condivide lo **stesso identico modulo di Merge e generazione AI** che girerà sul cloud, ma sostituisce i sensori dello smartphone con un'interfaccia di controllo su PC:

1. **Pannello Profilo & Onboarding Rapido:** Permette di selezionare al volo i parametri del protagonista (o scegliere tra profili salvati, es. *"Marco - Realismo Magico - Amante Cucina"* vs *"Elena - Noir - Amante Arte"*) e impostare la durata ($3\text{--}7$ giorni).
2. **Costruttore dei 4 Slot (o Editor JSON Unico):** Per ogni giornata simulata ($G_1, G_2, \dots, G_n$), lo sviluppatore può operare in due modi:
   * **Modalità Visuale a 4 Slot:** Compilare tramite slider e menu a tendina i 4 blocchi orari (*Notte, Mattina, Pomeriggio, Sera*) impostando meteo, ore di doomscrolling, picchi di $\text{HR}$ ($60\text{--}160\text{ bpm}$), tappe GPS simulate e note manuali, cliccando poi su **"Esegui Daily Merger"** per verificare come il backend li fonde nel file `DailyUnifiedPayload.json`.
   * **Modalità Iniezione Diretta JSON:** Incollare o caricare direttamente dal PC un file `DailyUnifiedPayload.json` precompilato per testare istantaneamente la risposta del modello AI.
3. **Generatore Fast-Forward ("Simula Giorno $N$"):** Un pulsante invia il JSON unico all'LLM, mostra a schermo il capitolo generato a fianco del nuovo `StoryState.json` aggiornato e prepara automaticamente lo stato di memoria per il Giorno $N+1$.
4. **Libreria di Preset Scenari (1-Click Test):** Bottoni rapidi per caricare giornate-tipo e verificare la tenuta narrativa dei casi limite:
   * *Preset "Giornata Vuota":* 4 slot tutti a casa, $0$ note, $4\text{ h}$ di scrolling $\rightarrow$ verifica la qualità del capitolo introspettivo.
   * *Preset "Falso Positivo Biometrico":* Utente fermo in ufficio nello Slot 3 ma con $\text{HR}$ a $135\text{ bpm}$ $\rightarrow$ verifica la trasfigurazione poetica dell'errore.
   * *Preset "Notte Brava (Cliffhanger 23:59)":* Slot 4 che termina fuori casa con battito alto + Slot 1 del giorno dopo che riprende alle `00:01` per strada $\rightarrow$ verifica la saldatura narrativa tra i due capitoli.

---

## 8. Roadmap di Sviluppo (Sprint Operativi)

### Sprint 0 — Simulatore Localhost, Daily Merger e Prompt Tuning (Settimana 1)
* Creazione dello script **Daily Merger** (Node.js o Python) che prende fino a 4 oggetti `SlotBatch` e li fonde nell'unico `DailyUnifiedPayload.json`.
* Sviluppo della dashboard web in `localhost` per simulare i 4 slot o iniettare il JSON unico, visualizzando i capitoli generati e l'evoluzione di `StoryState.json`.
* Test di generazione completa su cicli da $3$ e $7$ giorni nel genere unico (Realismo Magico).

### Sprint 1 — App Mobile: Onboarding, UI e Taccuino Attivo (Settimana 2-3)
* Sviluppo del flusso di Onboarding in Flutter/React Native (Anagrafica, selettore $3\text{--}7$ giorni e questionario a $5$ domande).
* Creazione della **Home / Taccuino Attivo**: campo di testo sempre accessibile per gli appunti giornalieri (salvati in SQLite locale con il riferimento allo Slot orario corrente) e pulsante *"Concludi Giornata"*.
* Sviluppo della vista **Taccuino del Narratore** con la logica dei *Capitoli Sigillati* (scelta tra lettura immediata o conservazione per il libro finale).

### Sprint 2 — Raccolta Passiva Edge e Micro-Batching a 4 Slot (Settimana 4-5)
* Implementazione del database locale SQLite per l'accumulo a basso consumo (*Delta Triggering* su GPS $> 200\text{ m}$ e sosta $> 15\text{ min}$, filtro anomalie $\text{HR} \pm 20\%$).
* Integrazione permessi Android (`UsageStatsManager` per screen time e messaggistica, `AlarmManager` per sveglia, `Health Connect` per smartwatch).
* Configurazione del background worker che impacchetta e sincronizza col server i 4 micro-batch giornalieri (`06:00`, `12:00`, `18:00`, `23:59`).

### Sprint 3 — Automazione Cloud e Chiusura delle 23:59 (Settimana 6)
* Configurazione su Supabase/Firebase della tabella `daily_slot_buffers` e della Cloud Function delle `23:59` che unisce i 4 slot nel JSON unico e chiama l'API dell'LLM.
* Gestione del trigger manuale *"Concludi Giornata"* (invio immediato dello slot parziale corrente, esecuzione anticipata del merge e blocco di nuovi input fino alle `00:00`).

### Sprint 4 — Impaginazione Editoriale e Test sul Campo (Settimana 7-8)
* Sviluppo del modulo di chiusura ciclo (generazione automatica del titolo del romanzo e della quarta di copertina basata sull'intero arco dei capitoli).
* Integrazione del motore di rendering editoriale (esportazione in PDF/ePub con tipografia da romanzo, frontespizio e indice).
* Beta test reale su dispositivi Android fisici su archi di $3$ e $7$ giorni.