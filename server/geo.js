// Luoghi veri. Con dati reali il telefono manda, per ogni tappa, l'esito del
// reverse geocoding (città, quartiere, via, nome del posto se c'è): la prosa
// usa quelli, mai nomi inventati. Il simulatore, che conosce solo tipo di
// luogo e zona, li prende da questo stradario di vie, parchi e quartieri veri.

const ZONES = ["centro", "nord", "sud", "est", "ovest"];

// Stradario minimo per città. `at` è come lo si dice («al Parco Sempione»),
// `alt` la forma colloquiale, quando esiste («in Vittorio Emanuele»).
const GAZETTEER = {
  Milano: {
    centro: {
      districts: [["Brera", "a Brera"], ["Magenta", "in zona Magenta"], ["Cinque Vie", "alle Cinque Vie"]],
      streets: [
        { name: "corso Vittorio Emanuele II", alt: "in Vittorio Emanuele", district: "Duomo" },
        { name: "via Dante", district: "Cordusio" },
        { name: "corso Garibaldi", district: "Brera" },
        { name: "via Torino", district: "Duomo" },
      ],
      parks: [
        { name: "Parco Sempione", at: "al Parco Sempione", district: "Sempione" },
        { name: "Giardini Indro Montanelli", at: "ai Giardini Montanelli", district: "Porta Venezia" },
      ],
    },
    nord: {
      districts: [["Isola", "all'Isola"], ["NoLo", "a NoLo"], ["Niguarda", "a Niguarda"]],
      streets: [
        { name: "via Borsieri", district: "Isola" },
        { name: "viale Monza", district: "NoLo" },
        { name: "via Padova", district: "NoLo" },
        { name: "viale Zara", district: "Zara" },
      ],
      parks: [
        { name: "Parco Nord", at: "al Parco Nord", district: "Niguarda" },
        { name: "Biblioteca degli Alberi", at: "alla Biblioteca degli Alberi", district: "Porta Nuova" },
      ],
    },
    sud: {
      districts: [["Navigli", "sui Navigli"], ["Porta Romana", "a Porta Romana"], ["Ticinese", "in Ticinese"]],
      streets: [
        { name: "alzaia Naviglio Grande", at: "sull'alzaia del Naviglio Grande", district: "Navigli" },
        { name: "corso di Porta Romana", district: "Porta Romana" },
        { name: "corso San Gottardo", district: "Ticinese" },
        { name: "ripa di Porta Ticinese", at: "sulla ripa di Porta Ticinese", district: "Navigli" },
      ],
      parks: [
        { name: "Parco Ravizza", at: "al Parco Ravizza", district: "Bocconi" },
        { name: "Parco Baravalle", at: "al Parco Baravalle", district: "Ticinese" },
      ],
    },
    est: {
      districts: [["Porta Venezia", "a Porta Venezia"], ["Città Studi", "a Città Studi"], ["Lambrate", "a Lambrate"]],
      streets: [
        { name: "corso Buenos Aires", alt: "in Buenos Aires", district: "Porta Venezia" },
        { name: "via Lecco", district: "Porta Venezia" },
        { name: "via Pacini", district: "Città Studi" },
        { name: "via Conte Rosso", district: "Lambrate" },
      ],
      parks: [
        { name: "Parco Lambro", at: "al Parco Lambro", district: "Lambro" },
        { name: "Parco Forlanini", at: "al Parco Forlanini", district: "Forlanini" },
      ],
    },
    ovest: {
      districts: [["CityLife", "a CityLife"], ["De Angeli", "in zona De Angeli"], ["San Siro", "a San Siro"]],
      streets: [
        { name: "corso Vercelli", district: "Magenta" },
        { name: "via Washington", district: "De Angeli" },
        { name: "piazza Piemonte", district: "Wagner" },
      ],
      parks: [
        { name: "Monte Stella", at: "al Monte Stella", district: "QT8" },
        { name: "Parco di Trenno", at: "al Parco di Trenno", district: "Trenno" },
      ],
    },
  },
  Roma: {
    centro: {
      districts: [["Monti", "a Monti"], ["Campo de' Fiori", "a Campo de' Fiori"], ["Prati", "a Prati"]],
      streets: [
        { name: "via del Corso", alt: "sul Corso", district: "Tridente" },
        { name: "via dei Coronari", district: "Ponte" },
        { name: "via Nazionale", district: "Monti" },
      ],
      parks: [
        { name: "Villa Borghese", at: "a Villa Borghese", district: "Pinciano" },
        { name: "Giardino degli Aranci", at: "al Giardino degli Aranci", district: "Aventino" },
      ],
    },
    nord: {
      districts: [["Parioli", "ai Parioli"], ["Trieste", "in zona Trieste"], ["Flaminio", "al Flaminio"]],
      streets: [
        { name: "viale Libia", district: "Trieste" },
        { name: "via Salaria", district: "Salario" },
        { name: "viale Parioli", district: "Parioli" },
      ],
      parks: [
        { name: "Villa Ada", at: "a Villa Ada", district: "Salario" },
        { name: "Villa Torlonia", at: "a Villa Torlonia", district: "Nomentano" },
      ],
    },
    sud: {
      districts: [["Garbatella", "alla Garbatella"], ["Testaccio", "a Testaccio"], ["Ostiense", "in zona Ostiense"]],
      streets: [
        { name: "via Ostiense", district: "Ostiense" },
        { name: "via Marmorata", district: "Testaccio" },
        { name: "via delle Sette Chiese", district: "Garbatella" },
      ],
      parks: [
        { name: "Parco della Caffarella", at: "alla Caffarella", district: "Appio Latino" },
        { name: "Parco degli Acquedotti", at: "al Parco degli Acquedotti", district: "Tuscolano" },
      ],
    },
    est: {
      districts: [["San Lorenzo", "a San Lorenzo"], ["Pigneto", "al Pigneto"], ["Centocelle", "a Centocelle"]],
      streets: [
        { name: "via del Pigneto", district: "Pigneto" },
        { name: "via dei Volsci", district: "San Lorenzo" },
        { name: "via Tiburtina", district: "Tiburtino" },
      ],
      parks: [{ name: "Villa Gordiani", at: "a Villa Gordiani", district: "Prenestino" }],
    },
    ovest: {
      districts: [["Trastevere", "a Trastevere"], ["Monteverde", "a Monteverde"], ["Aurelio", "all'Aurelio"]],
      streets: [
        { name: "viale di Trastevere", district: "Trastevere" },
        { name: "via della Lungaretta", district: "Trastevere" },
        { name: "via Gregorio VII", district: "Aurelio" },
      ],
      parks: [
        { name: "Villa Doria Pamphilj", at: "a Villa Pamphilj", district: "Monteverde" },
        { name: "Gianicolo", at: "al Gianicolo", district: "Trastevere" },
      ],
    },
  },
  Torino: {
    centro: {
      districts: [["Quadrilatero", "nel Quadrilatero"], ["Centro", "in centro"]],
      streets: [
        { name: "via Roma", district: "Centro" },
        { name: "via Garibaldi", district: "Quadrilatero" },
        { name: "via Po", district: "Centro" },
      ],
      parks: [{ name: "Giardini Reali", at: "ai Giardini Reali", district: "Centro" }],
    },
    nord: {
      districts: [["Aurora", "in Aurora"], ["Barriera di Milano", "in Barriera"], ["Borgo Dora", "a Borgo Dora"]],
      streets: [
        { name: "corso Giulio Cesare", district: "Aurora" },
        { name: "via Cigna", district: "Barriera di Milano" },
        { name: "corso Vercelli", district: "Barriera di Milano" },
      ],
      parks: [{ name: "Parco Dora", at: "al Parco Dora", district: "Borgo Vittoria" }],
    },
    sud: {
      districts: [["San Salvario", "a San Salvario"], ["Lingotto", "al Lingotto"], ["Crocetta", "alla Crocetta"]],
      streets: [
        { name: "via Nizza", district: "San Salvario" },
        { name: "via Madama Cristina", district: "San Salvario" },
        { name: "corso Unione Sovietica", district: "Lingotto" },
      ],
      parks: [{ name: "Parco del Valentino", at: "al Valentino", district: "San Salvario" }],
    },
    est: {
      districts: [["Vanchiglia", "in Vanchiglia"], ["Borgo Po", "a Borgo Po"]],
      streets: [
        { name: "via Santa Giulia", district: "Vanchiglia" },
        { name: "corso Casale", district: "Borgo Po" },
        { name: "corso Regina Margherita", district: "Vanchiglia" },
      ],
      parks: [
        { name: "Parco Michelotti", at: "al Parco Michelotti", district: "Borgo Po" },
        { name: "Monte dei Cappuccini", at: "al Monte dei Cappuccini", district: "Borgo Po" },
      ],
    },
    ovest: {
      districts: [["San Paolo", "a San Paolo"], ["Cit Turin", "a Cit Turin"], ["Pozzo Strada", "a Pozzo Strada"]],
      streets: [
        { name: "corso Francia", district: "Cit Turin" },
        { name: "via di Nanni", district: "San Paolo" },
        { name: "corso Peschiera", district: "San Paolo" },
      ],
      parks: [
        { name: "Parco Ruffini", at: "al Ruffini", district: "Pozzo Strada" },
        { name: "Parco della Pellerina", at: "alla Pellerina", district: "Parella" },
      ],
    },
  },
  Bologna: {
    centro: {
      districts: [["Quadrilatero", "nel Quadrilatero"], ["Centro storico", "in centro"]],
      streets: [
        { name: "via dell'Indipendenza", alt: "in via Indipendenza", district: "Centro storico" },
        { name: "via Rizzoli", district: "Centro storico" },
        { name: "via del Pratello", district: "Pratello" },
      ],
      parks: [{ name: "Parco della Montagnola", at: "alla Montagnola", district: "Centro storico" }],
    },
    nord: {
      districts: [["Bolognina", "in Bolognina"], ["Navile", "al Navile"], ["Corticella", "a Corticella"]],
      streets: [
        { name: "via Matteotti", district: "Bolognina" },
        { name: "via di Corticella", district: "Corticella" },
        { name: "via Ferrarese", district: "Navile" },
      ],
      parks: [{ name: "Villa Angeletti", at: "a Villa Angeletti", district: "Navile" }],
    },
    sud: {
      districts: [["Santo Stefano", "a Santo Stefano"], ["Colli", "sui colli"], ["Murri", "in zona Murri"]],
      streets: [
        { name: "via Santo Stefano", district: "Santo Stefano" },
        { name: "via Castiglione", district: "Santo Stefano" },
        { name: "via Murri", district: "Murri" },
      ],
      parks: [{ name: "Giardini Margherita", at: "ai Giardini Margherita", district: "Santo Stefano" }],
    },
    est: {
      districts: [["San Vitale", "a San Vitale"], ["Mazzini", "in zona Mazzini"], ["Cirenaica", "in Cirenaica"]],
      streets: [
        { name: "strada Maggiore", district: "San Vitale" },
        { name: "via San Vitale", district: "San Vitale" },
        { name: "via Mazzini", district: "Mazzini" },
      ],
      parks: [{ name: "Giardini Lunetta Gamberini", at: "alla Lunetta Gamberini", district: "Mazzini" }],
    },
    ovest: {
      districts: [["Saragozza", "a Saragozza"], ["Porto", "in zona Porto"]],
      streets: [
        { name: "via Saragozza", district: "Saragozza" },
        { name: "via Saffi", district: "Porto" },
        { name: "via del Pratello", district: "Porto" },
      ],
      parks: [{ name: "Villa Spada", at: "a Villa Spada", district: "Saragozza" }],
    },
  },
  Napoli: {
    centro: {
      districts: [["Centro storico", "nel centro storico"], ["Quartieri Spagnoli", "ai Quartieri Spagnoli"]],
      streets: [
        { name: "via Toledo", district: "Toledo" },
        { name: "via dei Tribunali", district: "Centro storico" },
        { name: "via San Biagio dei Librai", alt: "a Spaccanapoli", district: "Centro storico" },
      ],
      parks: [{ name: "Villa Comunale", at: "alla Villa Comunale", district: "Chiaia" }],
    },
    nord: {
      districts: [["Capodimonte", "a Capodimonte"], ["Sanità", "alla Sanità"], ["Arenella", "all'Arenella"]],
      streets: [
        { name: "via Foria", district: "San Carlo all'Arena" },
        { name: "via Santa Teresa degli Scalzi", district: "Stella" },
        { name: "corso Amedeo di Savoia", district: "Capodimonte" },
      ],
      parks: [{ name: "Bosco di Capodimonte", at: "al Bosco di Capodimonte", district: "Capodimonte" }],
    },
    sud: {
      districts: [["Chiaia", "a Chiaia"], ["Santa Lucia", "a Santa Lucia"]],
      streets: [
        { name: "via Caracciolo", alt: "sul lungomare", district: "Chiaia" },
        { name: "via Partenope", district: "Santa Lucia" },
        { name: "via Chiaia", district: "Chiaia" },
      ],
      parks: [{ name: "Villa Comunale", at: "alla Villa Comunale", district: "Chiaia" }],
    },
    est: {
      districts: [["Vasto", "al Vasto"], ["Poggioreale", "a Poggioreale"], ["Centro Direzionale", "al Centro Direzionale"]],
      streets: [
        { name: "corso Garibaldi", district: "Vasto" },
        { name: "corso Umberto I", alt: "sul Rettifilo", district: "Pendino" },
        { name: "via Galileo Ferraris", district: "Poggioreale" },
      ],
      parks: [],
    },
    ovest: {
      districts: [["Vomero", "al Vomero"], ["Posillipo", "a Posillipo"], ["Fuorigrotta", "a Fuorigrotta"]],
      streets: [
        { name: "via Scarlatti", district: "Vomero" },
        { name: "via Luca Giordano", district: "Vomero" },
        { name: "via Posillipo", district: "Posillipo" },
      ],
      parks: [
        { name: "Parco Virgiliano", at: "al Parco Virgiliano", district: "Posillipo" },
        { name: "Villa Floridiana", at: "alla Floridiana", district: "Vomero" },
      ],
    },
  },
};

export const CITIES = Object.keys(GAZETTEER);
export const DEFAULT_CITY = "Milano";

// In locale il GPS è simulato: ogni libro «vive» in una città fissa, scelta
// dal suo id come la sceglierebbe il telefono di chi lo scrive.
export function simulatedCity(seed = "story") {
  return CITIES[hash(`${seed}:city`) % CITIES.length];
}

// La città del giorno è quella dove stanno i luoghi del giorno (la più frequente).
export function cityOfDay(geos) {
  const counts = new Map();
  for (const geo of geos) {
    const city = String(geo?.city || "").trim();
    if (city) counts.set(city, (counts.get(city) || 0) + 1);
  }
  let best = "";
  for (const [city, count] of counts) if (!best || count > counts.get(best)) best = city;
  return best;
}

export function resolveCity(city) {
  const wanted = String(city || "").trim().toLowerCase();
  return CITIES.find((name) => name.toLowerCase() === wanted) || DEFAULT_CITY;
}

function hash(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed) {
  return list.length ? list[hash(seed) % list.length] : null;
}

function zoneOf(value) {
  const zone = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  return ZONES.includes(zone) ? zone : "centro";
}

// Reverse geocoding simulato: stessa città, stesso libro, stesso tipo e zona
// → stesso luogo vero ogni giorno. La casa e il lavoro non cambiano mai:
// sono i luoghi di sempre di chi vive questa vita. Negli scenari i tragitti a
// piedi sono «in centro»: casa e lavoro stanno lì, perché il percorso torni.
export function simulatedGeo(place, { city, seed = "story" } = {}) {
  const name = resolveCity(city);
  const map = GAZETTEER[name];
  const kind = place?.kind || "home";
  if (kind === "home") {
    const [district] = pick(map.centro.districts, `${seed}:home`);
    return { city: name, district, street: "", poi: "" };
  }
  const zone = zoneOf(place.zone);
  const area = map[zone];
  if (kind === "park") {
    const park = pick(area.parks.length ? area.parks : map.centro.parks, `${seed}:park:${zone}`);
    return { city: name, district: park.district, street: "", poi: park.name, poi_at: park.at };
  }
  const streets = area.streets;
  const index = hash(`${seed}:${kind}:${zone}`) % streets.length;
  // Un indirizzo mai frequentato non cade sulla via del solito tragitto.
  const street = kind === "unknown" ? streets[(index + 1) % streets.length] : streets[index];
  return { city: name, district: street.district, street: street.name, street_at: street.at || "", street_alt: street.alt || "", poi: "" };
}

function slug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function inStreet(geo) {
  return geo.street_at || `in ${geo.street}`;
}

// Da una tappa con il suo geo al luogo del racconto:
// - location_alias: come si chiama in pagina («Parco Sempione», «casa»);
// - location_at: come lo si dice («al Parco Sempione», «a casa, all'Isola»);
// - location_area: quartiere e città, per orientarsi.
// Nessun nome inventato: se manca un nome vero, il luogo resta generico.
export function placeOf(place, geo) {
  const kind = place?.kind || "home";
  const city = geo?.city || DEFAULT_CITY;
  const district = geo?.district || "";
  const area = [district, city].filter(Boolean).join(", ");
  const districtAt = districtLocative(city, district);
  if (kind === "home") {
    return {
      location_id: "loc_home",
      location_alias: "casa",
      location_at: districtAt ? `a casa, ${districtAt}` : "a casa",
      location_area: area,
    };
  }
  const poi = String(geo?.poi || "").trim();
  const street = String(geo?.street || "").trim();
  let alias;
  let at;
  if (kind === "park") {
    alias = poi || (street ? `il giardino di ${street}` : "un parco");
    at = geo?.poi_at || (poi ? `a ${poi}` : street ? `nel giardino di ${street}` : "in un parco");
  } else if (kind === "cafe") {
    alias = poi || (street ? `un locale di ${street}` : "un locale");
    at = poi ? `da ${poi}` : street ? `in un locale di ${street}` : "in un locale";
  } else if (kind === "work") {
    alias = street ? `il lavoro in ${street}` : "il lavoro";
    at = street ? `al lavoro, ${inStreet(geo)}` : "al lavoro";
  } else {
    alias = poi || street || (district ? `una strada ${districtAt}` : "una strada");
    at = poi ? `a ${poi}` : street ? inStreet(geo) : districtAt || "per strada";
  }
  const scene = {
    location_id: `loc_${kind}_${slug(poi || street || district || "generico")}`,
    location_alias: alias,
    location_at: at,
    location_area: area,
  };
  if (geo?.street_alt && !poi) scene.location_also = geo.street_alt;
  return scene;
}

function districtLocative(city, district) {
  if (!district) return "";
  const map = GAZETTEER[city];
  if (map) {
    for (const zone of ZONES) {
      const found = map[zone].districts.find(([name]) => name === district);
      if (found) return found[1];
    }
  }
  return `in zona ${district}`;
}
