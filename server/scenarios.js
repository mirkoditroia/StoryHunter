function place(extra) {
  return {
    kind: "home",
    zone: "",
    start: "",
    end: "",
    movement: "STILL",
    hr_avg: 68,
    hr_peak: null,
    hr_peak_time: "",
    peak_while_still: false,
    spo2: 98,
    stress: "low",
    ...extra,
  };
}

function slot(id, extra) {
  return {
    id,
    included: true,
    weather: "",
    doomscrolling_minutes: 0,
    messaging_minutes: 0,
    wake_time: "",
    places: [],
    notes: [],
    notes_text: "",
    ...extra,
  };
}

function sleep(start, end, hr = 56) {
  return place({ kind: "home", start, end, hr_avg: hr, spo2: 97, stress: "low" });
}

function home(start, end, hr, extra = {}) {
  return place({ kind: "home", start, end, hr_avg: hr, ...extra });
}

function walk(zone, start, end, hr, extra = {}) {
  return place({
    kind: "street",
    zone,
    start,
    end,
    movement: "WALKING",
    hr_avg: hr,
    spo2: 98,
    ...extra,
  });
}

function ride(zone, start, end, hr, extra = {}) {
  return place({
    kind: "street",
    zone,
    start,
    end,
    movement: "TRANSIT",
    hr_avg: hr,
    spo2: 98,
    ...extra,
  });
}

function desk(start, end, hr, extra = {}) {
  return place({
    kind: "work",
    start,
    end,
    hr_avg: hr,
    stress: "moderate",
    spo2: 98,
    ...extra,
  });
}

function day(parts) {
  return [
    slot("SLOT_1_NIGHT", parts.night),
    slot("SLOT_2_MORNING", parts.morning),
    slot("SLOT_3_AFTERNOON", parts.afternoon),
    slot("SLOT_4_EVENING", parts.evening),
  ];
}

const SCENARIOS = [
  {
    id: "sveglia_sette_ufficio_dieci",
    name: "Sveglia alle sette, ufficio alle dieci",
    description:
      "Sveglia alle 07:00, resta in casa, alle 10:00 esce a piedi e alle 10:30 è in ufficio. Pranzo al tavolo, rientro la sera.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 6°, aria ferma, umidità 80%",
          places: [sleep("00:20", "05:50", 56)],
        },
        morning: {
          weather: "Sereno, 8°, vento da nord 16 km/h",
          wake_time: "07:00",
          doomscrolling_minutes: 24,
          messaging_minutes: 8,
          places: [
            home("07:00", "09:58", 73),
            walk("centro", "10:00", "10:22", 101),
            desk("10:28", "11:55", 76),
          ],
        },
        afternoon: {
          weather: "Poco nuvoloso, 14°, vento debole",
          doomscrolling_minutes: 6,
          messaging_minutes: 22,
          places: [
            desk("12:05", "12:55", 74),
            place({ kind: "cafe", zone: "centro", start: "13:05", end: "13:50", hr_avg: 82 }),
            desk("14:02", "17:34", 77),
          ],
        },
        evening: {
          weather: "Sereno, 11°, vento in calo",
          doomscrolling_minutes: 29,
          messaging_minutes: 7,
          places: [walk("centro", "18:06", "18:28", 97), home("18:38", "23:05", 66)],
        },
      }),
  },
  {
    id: "turno_notte",
    name: "Turno di notte",
    description:
      "Dorme di giorno. Sveglia alle 19:00, resta in casa, alle 22:00 esce e arriva al lavoro. A mezzanotte è ancora lì.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 5°, vento freddo da nord 12 km/h",
          doomscrolling_minutes: 11,
          messaging_minutes: 16,
          places: [desk("00:08", "05:32", 72)],
        },
        morning: {
          weather: "Sereno, 7°, sole basso, vento debole",
          places: [ride("centro", "06:08", "06:40", 84), sleep("06:48", "11:55", 54)],
        },
        afternoon: {
          weather: "Sereno, 15°, vento da sud 8 km/h",
          places: [sleep("12:00", "17:52", 53)],
        },
        evening: {
          weather: "Sereno, 11°, vento debole",
          wake_time: "19:00",
          doomscrolling_minutes: 26,
          messaging_minutes: 12,
          places: [
            home("19:00", "21:50", 71),
            ride("centro", "22:00", "22:24", 90),
            desk("22:30", "23:59", 74),
          ],
        },
      }),
  },
  {
    id: "turno_anticipo",
    name: "Turno anticipato",
    description: "Sveglia alle 06:12, mezzo pubblico fino all'ufficio, giornata lunga, rientro entro le 19.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 4°, aria ferma",
          places: [sleep("00:10", "05:40", 54)],
        },
        morning: {
          weather: "Sereno, 7°, vento da est 11 km/h",
          wake_time: "06:12",
          doomscrolling_minutes: 8,
          messaging_minutes: 5,
          places: [home("06:12", "07:05", 74), ride("centro", "07:12", "07:48", 80), desk("07:55", "11:55", 75)],
        },
        afternoon: {
          weather: "Poco nuvoloso, 12°, vento moderato",
          doomscrolling_minutes: 3,
          messaging_minutes: 18,
          places: [desk("12:00", "17:15", 76)],
        },
        evening: {
          weather: "Sereno, 9°, vento in calo",
          doomscrolling_minutes: 16,
          messaging_minutes: 4,
          places: [ride("centro", "18:05", "18:38", 78), home("18:48", "22:30", 63)],
        },
      }),
  },
  {
    id: "pendolare_pioggia",
    name: "Pendolare sotto la pioggia",
    description:
      "Sveglia alle 07:16, treno sotto la pioggia, ufficio fino a tardi. Alle 15:18 il battito sale a 134 da fermo.",
    build: () =>
      day({
        night: {
          weather: "Coperto, 7°, umidità 88%, vento debole",
          places: [sleep("00:35", "05:55", 57)],
        },
        morning: {
          weather: "Pioggia leggera, 8°, vento da est 14 km/h",
          wake_time: "07:16",
          doomscrolling_minutes: 14,
          messaging_minutes: 6,
          places: [
            home("07:16", "08:05", 73),
            ride("centro", "08:12", "08:55", 88, { stress: "moderate" }),
            desk("09:02", "11:55", 78),
          ],
        },
        afternoon: {
          weather: "Pioggia moderata, 9°, raffiche a 28 km/h",
          doomscrolling_minutes: 11,
          messaging_minutes: 17,
          places: [
            desk("12:08", "17:40", 75, {
              hr_peak: 134,
              hr_peak_time: "15:18",
              peak_while_still: true,
              spo2: 99,
            }),
          ],
        },
        evening: {
          weather: "Pioggia fine, 8°, vento in calo",
          doomscrolling_minutes: 24,
          messaging_minutes: 9,
          places: [ride("centro", "18:12", "18:58", 86), home("19:08", "23:20", 67)],
        },
      }),
  },
  {
    id: "lavoro_da_casa",
    name: "Lavoro da casa",
    description:
      "Sveglia alle 08:32 dopo uno scrolling a letto. Resta in casa, esce solo per un caffè a metà pomeriggio.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 9°, aria ferma, umidità 74%",
          doomscrolling_minutes: 16,
          places: [home("00:12", "01:05", 68), sleep("01:05", "05:55", 57)],
        },
        morning: {
          weather: "Sereno, 13°, vento debole",
          wake_time: "08:32",
          doomscrolling_minutes: 42,
          messaging_minutes: 12,
          places: [sleep("06:00", "08:28", 56), home("08:32", "11:50", 70)],
        },
        afternoon: {
          weather: "Poco nuvoloso, 18°, vento da ovest 9 km/h",
          doomscrolling_minutes: 18,
          messaging_minutes: 15,
          places: [
            walk("centro", "12:25", "12:42", 96),
            place({ kind: "cafe", zone: "centro", start: "12:48", end: "14:05", hr_avg: 80 }),
            walk("centro", "14:10", "14:28", 94),
            home("14:35", "17:45", 68),
          ],
        },
        evening: {
          weather: "Sereno, 15°, brezza",
          doomscrolling_minutes: 33,
          messaging_minutes: 7,
          places: [home("18:20", "23:10", 65)],
        },
      }),
  },
  {
    id: "ufficio_e_corsa",
    name: "Ufficio e corsa serale",
    description: "Sveglia alle 07:22, ufficio ordinario, dalle 18:35 corsa al parco con battito fino a 156, poi casa.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 5°, aria ferma",
          places: [sleep("00:25", "05:48", 55)],
        },
        morning: {
          weather: "Sereno, 9°, vento da nord 12 km/h",
          wake_time: "07:22",
          doomscrolling_minutes: 12,
          messaging_minutes: 6,
          places: [home("07:22", "08:08", 76), walk("centro", "08:14", "08:36", 104), desk("08:42", "11:55", 77)],
        },
        afternoon: {
          weather: "Poco nuvoloso, 16°, vento leggero",
          doomscrolling_minutes: 4,
          messaging_minutes: 11,
          places: [desk("12:10", "17:25", 76)],
        },
        evening: {
          weather: "Sereno, 13°, vento debole",
          doomscrolling_minutes: 9,
          messaging_minutes: 4,
          places: [
            walk("nord", "18:15", "18:32", 108),
            place({
              kind: "park",
              zone: "nord",
              start: "18:35",
              end: "19:28",
              movement: "WALKING",
              hr_avg: 128,
              hr_peak: 156,
              hr_peak_time: "19:05",
              peak_while_still: false,
              spo2: 97,
              stress: "high",
            }),
            walk("nord", "19:34", "19:52", 112),
            home("20:05", "22:50", 64),
          ],
        },
      }),
  },
  {
    id: "sabato_lento",
    name: "Sabato lento",
    description: "Notte corta con scrolling, sveglia alle 09:48, parco e caffè nel primo pomeriggio, sera in casa.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 16°, aria ferma, umidità 62%",
          doomscrolling_minutes: 24,
          places: [home("00:05", "00:48", 70), sleep("00:48", "05:55", 58)],
        },
        morning: {
          weather: "Sereno, 18°, vento debole",
          wake_time: "09:48",
          doomscrolling_minutes: 38,
          messaging_minutes: 5,
          places: [sleep("06:00", "09:48", 55), home("09:48", "11:55", 69)],
        },
        afternoon: {
          weather: "Sole, 24°, vento da sud 10 km/h",
          doomscrolling_minutes: 6,
          messaging_minutes: 8,
          places: [
            walk("nord", "12:40", "13:05", 92),
            place({
              kind: "park",
              zone: "nord",
              start: "13:10",
              end: "14:35",
              movement: "WALKING",
              hr_avg: 99,
              spo2: 98,
            }),
            place({ kind: "cafe", zone: "nord", start: "15:00", end: "16:10", hr_avg: 78 }),
            walk("nord", "16:15", "16:35", 90),
          ],
        },
        evening: {
          weather: "Sereno, 19°, brezza",
          doomscrolling_minutes: 19,
          messaging_minutes: 8,
          places: [home("18:10", "22:40", 67)],
        },
      }),
  },
  {
    id: "giornata_fiacca",
    name: "Giornata fiacca",
    description: "Sveglia alle 10:18, quasi sempre in casa, lunga visione passiva, una passeggiata breve alle 16.",
    build: () =>
      day({
        night: {
          weather: "Nebbia, 9°, visibilità bassa",
          places: [sleep("00:40", "05:50", 60)],
        },
        morning: {
          weather: "Coperto, 11°, umidità alta",
          wake_time: "10:18",
          doomscrolling_minutes: 36,
          messaging_minutes: 4,
          places: [sleep("06:00", "10:18", 58), home("10:18", "11:55", 72)],
        },
        afternoon: {
          weather: "Nuvoloso, 13°, vento assente",
          doomscrolling_minutes: 88,
          messaging_minutes: 12,
          places: [home("12:00", "15:50", 70), walk("sud", "16:00", "16:22", 86), home("16:30", "17:50", 68)],
        },
        evening: {
          weather: "Coperto, 12°, aria ferma",
          doomscrolling_minutes: 54,
          messaging_minutes: 20,
          places: [home("18:05", "23:40", 65)],
        },
      }),
  },
  {
    id: "commissioni_sud",
    name: "Commissioni in zona sud",
    description: "Sveglia alle 08:04, spostamento a sud, una sosta in un luogo nuovo, caffè, rientro a metà pomeriggio.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 8°, aria ferma",
          places: [sleep("00:15", "05:45", 56)],
        },
        morning: {
          weather: "Sereno, 12°, vento da sud 9 km/h",
          wake_time: "08:04",
          doomscrolling_minutes: 6,
          messaging_minutes: 9,
          places: [
            home("08:04", "09:05", 74),
            ride("sud", "09:12", "09:38", 79),
            place({ kind: "unknown", zone: "sud", start: "09:44", end: "11:20", hr_avg: 81, stress: "low" }),
          ],
        },
        afternoon: {
          weather: "Nuvole in arrivo, 16°, vento moderato",
          doomscrolling_minutes: 8,
          messaging_minutes: 14,
          places: [
            place({ kind: "cafe", zone: "sud", start: "12:15", end: "13:05", hr_avg: 83 }),
            walk("sud", "13:12", "13:48", 97),
            ride("sud", "13:55", "14:28", 77),
            home("14:40", "17:35", 68),
          ],
        },
        evening: {
          weather: "Coperto, 14°, vento debole",
          doomscrolling_minutes: 12,
          messaging_minutes: 31,
          places: [home("18:30", "22:55", 66)],
        },
      }),
  },
  {
    id: "pranzo_al_parco",
    name: "Pranzo lungo al parco",
    description: "Sveglia alle 07:36, ufficio la mattina, più di un'ora a piedi nel parco, poi di nuovo al lavoro.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 6°, umidità 77%",
          places: [sleep("00:30", "05:52", 55)],
        },
        morning: {
          weather: "Sereno, 10°, vento da nord 10 km/h",
          wake_time: "07:36",
          doomscrolling_minutes: 14,
          messaging_minutes: 8,
          places: [home("07:36", "08:20", 73), walk("centro", "08:26", "08:48", 100), desk("08:54", "11:55", 76)],
        },
        afternoon: {
          weather: "Poco nuvoloso, 17°, vento leggero",
          doomscrolling_minutes: 4,
          messaging_minutes: 13,
          places: [
            desk("12:00", "12:20", 74),
            walk("centro", "12:25", "12:40", 98),
            place({
              kind: "park",
              zone: "centro",
              start: "12:42",
              end: "13:55",
              movement: "WALKING",
              hr_avg: 106,
            }),
            place({ kind: "cafe", zone: "centro", start: "14:05", end: "14:40", hr_avg: 82 }),
            desk("14:50", "17:48", 77),
          ],
        },
        evening: {
          weather: "Sereno, 14°, brezza",
          doomscrolling_minutes: 22,
          messaging_minutes: 5,
          places: [walk("centro", "18:10", "18:34", 95), home("18:42", "23:00", 66)],
        },
      }),
  },
  {
    id: "cena_fuori",
    name: "Cena fuori e rientro",
    description:
      "Sveglia alle 07:55 e ufficio di giorno. Alle 19:05 esce, cena fuori, è a casa prima di mezzanotte.",
    build: () =>
      day({
        night: {
          weather: "Poco nuvoloso, 8°, vento debole",
          places: [sleep("00:20", "05:50", 57)],
        },
        morning: {
          weather: "Nuvoloso, 12°, vento da ovest 13 km/h",
          wake_time: "07:55",
          doomscrolling_minutes: 10,
          messaging_minutes: 9,
          places: [home("07:55", "08:40", 75), ride("centro", "08:48", "09:15", 81), desk("09:20", "11:55", 77)],
        },
        afternoon: {
          weather: "Schiarite, 16°, vento moderato",
          doomscrolling_minutes: 7,
          messaging_minutes: 16,
          places: [desk("12:05", "17:10", 76)],
        },
        evening: {
          weather: "Sereno, 13°, vento in calo",
          doomscrolling_minutes: 6,
          messaging_minutes: 34,
          places: [
            ride("centro", "19:05", "19:28", 78),
            place({ kind: "cafe", zone: "centro", start: "19:35", end: "21:00", hr_avg: 84 }),
            place({
              kind: "unknown",
              zone: "centro",
              start: "21:12",
              end: "22:35",
              hr_avg: 86,
              stress: "moderate",
            }),
            ride("centro", "22:42", "23:05", 80),
            home("23:12", "23:48", 71),
          ],
        },
      }),
  },
  {
    id: "giorno_di_treno",
    name: "Treno e città nuova",
    description: "Sveglia alle 06:38, lungo viaggio in treno, cammina in una zona nuova a est, rientra in serata.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 4°, aria ferma",
          places: [sleep("00:05", "05:40", 55)],
        },
        morning: {
          weather: "Nebbia bassa, 6°, poi schiarite",
          wake_time: "06:38",
          doomscrolling_minutes: 33,
          messaging_minutes: 6,
          places: [home("06:38", "07:15", 76), ride("est", "07:22", "11:55", 74)],
        },
        afternoon: {
          weather: "Sereno, 13°, vento da est 15 km/h",
          doomscrolling_minutes: 5,
          messaging_minutes: 8,
          places: [
            ride("est", "12:00", "13:05", 73),
            walk("est", "13:12", "14:20", 101),
            place({ kind: "cafe", zone: "est", start: "14:30", end: "15:35", hr_avg: 81 }),
            ride("centro", "15:50", "17:55", 75),
          ],
        },
        evening: {
          weather: "Sereno, 10°, vento debole",
          doomscrolling_minutes: 14,
          messaging_minutes: 4,
          places: [ride("centro", "18:00", "18:48", 76), home("18:55", "22:50", 66)],
        },
      }),
  },
  {
    id: "picco_da_fermo",
    name: "Picco di battito da fermo",
    description: "Giornata d'ufficio ordinaria. Alle 16:42, seduto, il battito sale a 138 e la saturazione resta al 99%.",
    build: () =>
      day({
        night: {
          weather: "Coperto, 8°, umidità 83%",
          places: [sleep("00:22", "05:48", 56)],
        },
        morning: {
          weather: "Nuvoloso, 11°, vento da nord 9 km/h",
          wake_time: "07:08",
          doomscrolling_minutes: 16,
          messaging_minutes: 10,
          places: [home("07:08", "07:55", 74), walk("centro", "08:02", "08:26", 99), desk("08:32", "11:50", 76)],
        },
        afternoon: {
          weather: "Nuvoloso, 14°, vento debole",
          doomscrolling_minutes: 8,
          messaging_minutes: 14,
          places: [
            desk("12:15", "17:50", 74, {
              hr_peak: 138,
              hr_peak_time: "16:42",
              peak_while_still: true,
              spo2: 99,
              stress: "moderate",
            }),
          ],
        },
        evening: {
          weather: "Schiarite, 12°, aria più secca",
          doomscrolling_minutes: 20,
          messaging_minutes: 6,
          places: [walk("centro", "18:08", "18:30", 94), home("18:40", "22:55", 66)],
        },
      }),
  },
  {
    id: "domenica_a_piedi",
    name: "Domenica a piedi",
    description: "Sveglia alle 08:55, lunga camminata a ovest, sosta al parco e in un locale, rientro nel pomeriggio.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 11°, aria ferma",
          places: [sleep("00:50", "05:55", 57)],
        },
        morning: {
          weather: "Sereno, 15°, vento debole",
          wake_time: "08:55",
          doomscrolling_minutes: 20,
          messaging_minutes: 4,
          places: [sleep("06:00", "08:55", 55), home("08:55", "10:20", 70), walk("ovest", "10:28", "11:55", 103)],
        },
        afternoon: {
          weather: "Sole, 21°, vento da ovest 8 km/h",
          doomscrolling_minutes: 3,
          messaging_minutes: 7,
          places: [
            place({
              kind: "park",
              zone: "ovest",
              start: "12:00",
              end: "13:20",
              movement: "WALKING",
              hr_avg: 108,
            }),
            place({ kind: "cafe", zone: "ovest", start: "13:40", end: "14:45", hr_avg: 79 }),
            walk("ovest", "14:55", "15:30", 98),
            home("15:45", "17:40", 67),
          ],
        },
        evening: {
          weather: "Sereno, 17°, brezza",
          doomscrolling_minutes: 11,
          messaging_minutes: 6,
          places: [home("18:20", "22:30", 64)],
        },
      }),
  },
  {
    id: "pomeriggio_di_messaggi",
    name: "Pomeriggio di messaggi",
    description:
      "Sveglia alle 07:41, ufficio normale. Nel pomeriggio i messaggi occupano 68 minuti; la sera scrolling lungo sul divano.",
    build: () =>
      day({
        night: {
          weather: "Nuvoloso, 9°, vento debole",
          places: [sleep("00:18", "05:42", 56)],
        },
        morning: {
          weather: "Nuvoloso, 12°, umidità 70%",
          wake_time: "07:41",
          doomscrolling_minutes: 11,
          messaging_minutes: 8,
          places: [home("07:41", "08:28", 75), walk("centro", "08:34", "08:52", 98), desk("08:58", "11:55", 78)],
        },
        afternoon: {
          weather: "Coperto, 14°, vento da est 12 km/h",
          doomscrolling_minutes: 4,
          messaging_minutes: 68,
          places: [desk("12:00", "17:35", 81)],
        },
        evening: {
          weather: "Pioggia leggera, 12°, vento in calo",
          doomscrolling_minutes: 46,
          messaging_minutes: 9,
          places: [ride("centro", "18:05", "18:28", 82), home("18:40", "23:15", 70)],
        },
      }),
  },
  {
    id: "fuori_fino_a_mezzanotte",
    name: "Fuori fino a mezzanotte",
    description:
      "Giornata di lavoro, poi esce verso ovest. Dalle 21:15 è fermo in un luogo nuovo e a mezzanotte non è rientrato. Picco a 127 alle 23:41.",
    build: () =>
      day({
        night: {
          weather: "Sereno, 7°, aria ferma",
          places: [sleep("00:30", "05:50", 56)],
        },
        morning: {
          weather: "Sereno, 11°, vento da ovest 10 km/h",
          wake_time: "08:05",
          doomscrolling_minutes: 13,
          messaging_minutes: 7,
          places: [home("08:05", "08:50", 74), walk("centro", "08:55", "09:18", 99), desk("09:24", "11:55", 76)],
        },
        afternoon: {
          weather: "Poco nuvoloso, 17°, vento moderato",
          doomscrolling_minutes: 6,
          messaging_minutes: 12,
          places: [desk("12:05", "17:05", 75)],
        },
        evening: {
          weather: "Sereno, 14°, vento debole",
          doomscrolling_minutes: 4,
          messaging_minutes: 26,
          places: [
            home("18:10", "19:40", 72),
            ride("ovest", "19:50", "20:15", 84),
            walk("ovest", "20:20", "21:10", 112),
            place({
              kind: "unknown",
              zone: "ovest",
              start: "21:15",
              end: "23:59",
              movement: "STILL",
              hr_avg: 94,
              hr_peak: 127,
              hr_peak_time: "23:41",
              peak_while_still: true,
              spo2: 98,
              stress: "high",
            }),
          ],
        },
      }),
  },
  {
    id: "casa_tutto_il_giorno",
    name: "Casa tutto il giorno",
    description: "Sveglia alle 09:15, non esce. Piove fuori. Visione passiva lunga, battito da riposo.",
    build: () =>
      day({
        night: {
          weather: "Pioggia leggera, 10°, umidità 91%",
          doomscrolling_minutes: 8,
          places: [sleep("00:30", "05:50", 58)],
        },
        morning: {
          weather: "Pioggia moderata, 11°, vento da sud 16 km/h",
          wake_time: "09:15",
          doomscrolling_minutes: 58,
          messaging_minutes: 6,
          places: [sleep("06:00", "09:15", 56), home("09:15", "11:55", 68)],
        },
        afternoon: {
          weather: "Pioggia leggera, 12°, vento in calo",
          doomscrolling_minutes: 47,
          messaging_minutes: 10,
          places: [home("12:10", "17:40", 70)],
        },
        evening: {
          weather: "Coperto, 11°, pioggia cessata",
          doomscrolling_minutes: 29,
          messaging_minutes: 4,
          places: [home("18:15", "23:05", 64)],
        },
      }),
  },
];

export function hashSeed(value) {
  let hash = 2166136261;
  for (const ch of String(value || "story")) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function scenarioIndex(bookId, day = 1, shift = 0, count = SCENARIOS.length) {
  const total = count || 1;
  const base = hashSeed(bookId) % total;
  const delta = (Number(day) || 1) - 1 + (Number(shift) || 0);
  return ((base + delta) % total + total) % total;
}

export function listScenarios() {
  return SCENARIOS.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    slots: item.build(),
  }));
}

export function scenarioById(id) {
  return listScenarios().find((item) => item.id === id) || null;
}

export function telemetryIsBlank(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return true;
  return slots.every((slot) => {
    const places = Array.isArray(slot?.places) ? slot.places : [];
    return (
      places.length === 0 &&
      !String(slot?.wake_time || "").trim() &&
      !(Number(slot?.doomscrolling_minutes) > 0) &&
      !(Number(slot?.messaging_minutes) > 0)
    );
  });
}

export function applySimulatedTelemetry(slots, { bookId = "", day = 1, shift = 0 } = {}) {
  if (!telemetryIsBlank(slots)) return slots;
  const scenario = listScenarios()[scenarioIndex(bookId, day, shift)];
  const prior = new Map((Array.isArray(slots) ? slots : []).map((slot) => [slot?.id, slot]));
  return scenario.slots.map((slot) => {
    const previous = prior.get(slot.id);
    if (!previous) return slot;
    const notes = Array.isArray(previous.notes) ? previous.notes : [];
    const notesText = String(previous.notes_text || "");
    return {
      ...slot,
      included: previous.included !== false,
      notes,
      notes_text: notesText,
    };
  });
}
