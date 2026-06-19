/*
 * All-Time World Cup Simulator — Player Database
 *
 * A curated roster of soccer legends spanning the 1950s to the 2020s.
 * Each player has a `pwr` (0-100) representing their effectiveness in their
 * primary role; the match engine reads this when computing line strengths.
 *
 * pos: GK | DEF | MID | FWD
 * pwr: role power used by the engine
 * ovr: overall rating, shown to the player
 *
 * To extend the game, just add entries here and reference their `id` in
 * js/slots.js. Nothing else needs to change.
 */
window.PLAYERS = [
  // ---------------- Goalkeepers ----------------
  { id: "yashin",      name: "Lev Yashin",        pos: "GK",  nation: "USSR",          flag: "🇷🇺", decade: "1960s", club: "Dynamo Moscow",  ovr: 89, pwr: 90 },
  { id: "banks",       name: "Gordon Banks",      pos: "GK",  nation: "England",       flag: "🏴",  decade: "1960s", club: "Stoke City",     ovr: 87, pwr: 88 },
  { id: "zoff",        name: "Dino Zoff",         pos: "GK",  nation: "Italy",         flag: "🇮🇹", decade: "1970s", club: "Juventus",       ovr: 88, pwr: 89 },
  { id: "schmeichel",  name: "Peter Schmeichel",  pos: "GK",  nation: "Denmark",       flag: "🇩🇰", decade: "1990s", club: "Man United",     ovr: 88, pwr: 89 },
  { id: "buffon",      name: "Gianluigi Buffon",  pos: "GK",  nation: "Italy",         flag: "🇮🇹", decade: "2000s", club: "Juventus",       ovr: 90, pwr: 91 },
  { id: "casillas",    name: "Iker Casillas",     pos: "GK",  nation: "Spain",         flag: "🇪🇸", decade: "2000s", club: "Real Madrid",    ovr: 89, pwr: 90 },
  { id: "neuer",       name: "Manuel Neuer",      pos: "GK",  nation: "Germany",       flag: "🇩🇪", decade: "2010s", club: "Bayern Munich",  ovr: 90, pwr: 91 },

  // ---------------- Defenders ----------------
  { id: "beckenbauer", name: "Franz Beckenbauer", pos: "DEF", nation: "Germany",       flag: "🇩🇪", decade: "1970s", club: "Bayern Munich",  ovr: 92, pwr: 90 },
  { id: "baresi",      name: "Franco Baresi",     pos: "DEF", nation: "Italy",         flag: "🇮🇹", decade: "1980s", club: "AC Milan",       ovr: 90, pwr: 91 },
  { id: "moore",       name: "Bobby Moore",       pos: "DEF", nation: "England",       flag: "🏴",  decade: "1960s", club: "West Ham",       ovr: 88, pwr: 89 },
  { id: "passarella",  name: "Daniel Passarella", pos: "DEF", nation: "Argentina",     flag: "🇦🇷", decade: "1970s", club: "River Plate",    ovr: 86, pwr: 85 },
  { id: "maldini",     name: "Paolo Maldini",     pos: "DEF", nation: "Italy",         flag: "🇮🇹", decade: "1990s", club: "AC Milan",       ovr: 91, pwr: 91 },
  { id: "robertocarlos",name: "Roberto Carlos",   pos: "DEF", nation: "Brazil",        flag: "🇧🇷", decade: "1990s", club: "Real Madrid",    ovr: 88, pwr: 86 },
  { id: "facchetti",   name: "Giacinto Facchetti",pos: "DEF", nation: "Italy",         flag: "🇮🇹", decade: "1960s", club: "Inter Milan",    ovr: 86, pwr: 86 },
  { id: "cafu",        name: "Cafu",              pos: "DEF", nation: "Brazil",        flag: "🇧🇷", decade: "2000s", club: "AC Milan",       ovr: 87, pwr: 86 },
  { id: "lahm",        name: "Philipp Lahm",      pos: "DEF", nation: "Germany",       flag: "🇩🇪", decade: "2010s", club: "Bayern Munich",  ovr: 88, pwr: 87 },
  { id: "thuram",      name: "Lilian Thuram",     pos: "DEF", nation: "France",        flag: "🇫🇷", decade: "1990s", club: "Juventus",       ovr: 86, pwr: 87 },
  { id: "cannavaro",   name: "Fabio Cannavaro",   pos: "DEF", nation: "Italy",         flag: "🇮🇹", decade: "2000s", club: "Real Madrid",    ovr: 88, pwr: 89 },
  { id: "puyol",       name: "Carles Puyol",      pos: "DEF", nation: "Spain",         flag: "🇪🇸", decade: "2000s", club: "Barcelona",      ovr: 87, pwr: 88 },
  { id: "ramos",       name: "Sergio Ramos",      pos: "DEF", nation: "Spain",         flag: "🇪🇸", decade: "2010s", club: "Real Madrid",    ovr: 88, pwr: 88 },
  { id: "vandijk",     name: "Virgil van Dijk",   pos: "DEF", nation: "Netherlands",   flag: "🇳🇱", decade: "2010s", club: "Liverpool",      ovr: 89, pwr: 89 },
  { id: "desailly",    name: "Marcel Desailly",   pos: "DEF", nation: "France",        flag: "🇫🇷", decade: "1990s", club: "AC Milan",       ovr: 85, pwr: 86 },

  // ---------------- Midfielders ----------------
  { id: "zidane",      name: "Zinedine Zidane",   pos: "MID", nation: "France",        flag: "🇫🇷", decade: "2000s", club: "Real Madrid",    ovr: 92, pwr: 92 },
  { id: "platini",     name: "Michel Platini",    pos: "MID", nation: "France",        flag: "🇫🇷", decade: "1980s", club: "Juventus",       ovr: 90, pwr: 89 },
  { id: "pirlo",       name: "Andrea Pirlo",      pos: "MID", nation: "Italy",         flag: "🇮🇹", decade: "2000s", club: "AC Milan",       ovr: 88, pwr: 89 },
  { id: "xavi",        name: "Xavi Hernández",    pos: "MID", nation: "Spain",         flag: "🇪🇸", decade: "2000s", club: "Barcelona",      ovr: 89, pwr: 91 },
  { id: "zico",        name: "Zico",              pos: "MID", nation: "Brazil",        flag: "🇧🇷", decade: "1980s", club: "Flamengo",       ovr: 89, pwr: 88 },
  { id: "matthaus",    name: "Lothar Matthäus",   pos: "MID", nation: "Germany",       flag: "🇩🇪", decade: "1990s", club: "Inter Milan",    ovr: 89, pwr: 88 },
  { id: "gullit",      name: "Ruud Gullit",       pos: "MID", nation: "Netherlands",   flag: "🇳🇱", decade: "1980s", club: "AC Milan",       ovr: 88, pwr: 87 },
  { id: "modric",      name: "Luka Modrić",       pos: "MID", nation: "Croatia",       flag: "🇭🇷", decade: "2010s", club: "Real Madrid",    ovr: 89, pwr: 89 },
  { id: "gerrard",     name: "Steven Gerrard",    pos: "MID", nation: "England",       flag: "🏴",  decade: "2000s", club: "Liverpool",      ovr: 87, pwr: 87 },
  { id: "kante",       name: "N'Golo Kanté",      pos: "MID", nation: "France",        flag: "🇫🇷", decade: "2010s", club: "Chelsea",        ovr: 86, pwr: 86 },
  { id: "debruyne",    name: "Kevin De Bruyne",   pos: "MID", nation: "Belgium",       flag: "🇧🇪", decade: "2010s", club: "Man City",       ovr: 89, pwr: 89 },
  { id: "iniesta",     name: "Andrés Iniesta",    pos: "MID", nation: "Spain",         flag: "🇪🇸", decade: "2010s", club: "Barcelona",      ovr: 90, pwr: 90 },
  { id: "baggio",      name: "Roberto Baggio",    pos: "MID", nation: "Italy",         flag: "🇮🇹", decade: "1990s", club: "Juventus",       ovr: 88, pwr: 87 },
  { id: "socrates",    name: "Sócrates",          pos: "MID", nation: "Brazil",        flag: "🇧🇷", decade: "1980s", club: "Corinthians",    ovr: 86, pwr: 86 },
  { id: "riquelme",    name: "Juan Román Riquelme",pos:"MID", nation: "Argentina",     flag: "🇦🇷", decade: "2000s", club: "Villarreal",     ovr: 85, pwr: 86 },
  { id: "scholes",     name: "Paul Scholes",      pos: "MID", nation: "England",       flag: "🏴",  decade: "2000s", club: "Man United",     ovr: 85, pwr: 86 },

  // ---------------- Forwards ----------------
  { id: "pele",        name: "Pelé",              pos: "FWD", nation: "Brazil",        flag: "🇧🇷", decade: "1960s", club: "Santos",         ovr: 95, pwr: 95 },
  { id: "maradona",    name: "Diego Maradona",    pos: "FWD", nation: "Argentina",     flag: "🇦🇷", decade: "1980s", club: "Napoli",         ovr: 94, pwr: 93 },
  { id: "messi",       name: "Lionel Messi",      pos: "FWD", nation: "Argentina",     flag: "🇦🇷", decade: "2010s", club: "Barcelona",      ovr: 95, pwr: 95 },
  { id: "cristiano",   name: "Cristiano Ronaldo", pos: "FWD", nation: "Portugal",      flag: "🇵🇹", decade: "2010s", club: "Real Madrid",    ovr: 93, pwr: 93 },
  { id: "ronaldo",     name: "Ronaldo Nazário",   pos: "FWD", nation: "Brazil",        flag: "🇧🇷", decade: "2000s", club: "Real Madrid",    ovr: 92, pwr: 93 },
  { id: "ronaldinho",  name: "Ronaldinho",        pos: "FWD", nation: "Brazil",        flag: "🇧🇷", decade: "2000s", club: "Barcelona",      ovr: 90, pwr: 90 },
  { id: "vanbasten",   name: "Marco van Basten",  pos: "FWD", nation: "Netherlands",   flag: "🇳🇱", decade: "1980s", club: "AC Milan",       ovr: 90, pwr: 91 },
  { id: "muller",      name: "Gerd Müller",       pos: "FWD", nation: "Germany",       flag: "🇩🇪", decade: "1970s", club: "Bayern Munich",  ovr: 90, pwr: 92 },
  { id: "cruyff",      name: "Johan Cruyff",      pos: "FWD", nation: "Netherlands",   flag: "🇳🇱", decade: "1970s", club: "Ajax",           ovr: 93, pwr: 92 },
  { id: "eusebio",     name: "Eusébio",           pos: "FWD", nation: "Portugal",      flag: "🇵🇹", decade: "1960s", club: "Benfica",        ovr: 89, pwr: 90 },
  { id: "best",        name: "George Best",       pos: "FWD", nation: "N. Ireland",    flag: "🇬🇧", decade: "1970s", club: "Man United",     ovr: 88, pwr: 88 },
  { id: "romario",     name: "Romário",           pos: "FWD", nation: "Brazil",        flag: "🇧🇷", decade: "1990s", club: "Barcelona",      ovr: 88, pwr: 90 },
  { id: "henry",       name: "Thierry Henry",     pos: "FWD", nation: "France",        flag: "🇫🇷", decade: "2000s", club: "Arsenal",        ovr: 88, pwr: 89 },
  { id: "batistuta",   name: "Gabriel Batistuta", pos: "FWD", nation: "Argentina",     flag: "🇦🇷", decade: "1990s", club: "Fiorentina",     ovr: 86, pwr: 88 },
  { id: "garrincha",   name: "Garrincha",         pos: "FWD", nation: "Brazil",        flag: "🇧🇷", decade: "1960s", club: "Botafogo",       ovr: 89, pwr: 89 },
  { id: "distefano",   name: "Alfredo Di Stéfano",pos: "FWD", nation: "Argentina",     flag: "🇦🇷", decade: "1950s", club: "Real Madrid",    ovr: 91, pwr: 90 },
  { id: "puskas",      name: "Ferenc Puskás",     pos: "FWD", nation: "Hungary",       flag: "🇭🇺", decade: "1950s", club: "Real Madrid",    ovr: 90, pwr: 91 },
  { id: "mbappe",      name: "Kylian Mbappé",     pos: "FWD", nation: "France",        flag: "🇫🇷", decade: "2020s", club: "Paris SG",       ovr: 91, pwr: 92 },
  { id: "lewandowski", name: "Robert Lewandowski",pos: "FWD", nation: "Poland",        flag: "🇵🇱", decade: "2020s", club: "Bayern Munich",  ovr: 90, pwr: 91 },
  { id: "ibrahimovic", name: "Zlatan Ibrahimović",pos: "FWD", nation: "Sweden",        flag: "🇸🇪", decade: "2010s", club: "Milan / PSG",    ovr: 88, pwr: 88 },
];

// Lookup helper used across the app.
window.PLAYER_BY_ID = window.PLAYERS.reduce(function (acc, p) {
  acc[p.id] = p;
  return acc;
}, {});
