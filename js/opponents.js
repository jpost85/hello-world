/*
 * The Gauntlet — legendary national sides to run through, cup-style.
 *
 * Each opponent is rated on three lines (att / mid / def, 0-100) and belongs
 * to one of two tiers:
 *
 *   group    — strong sides, but a notch below the all-time greats. The early
 *              "group stage" is drawn from here.
 *   knockout — the all-time great teams. The latter "knockout" rounds are
 *              drawn from here, building to the strongest side as the final.
 *
 * Each run draws a fresh bracket (see js/game.js → buildBracket), so no two
 * cups are the same. GAUNTLET sets how many matches come from each tier.
 */
window.GAUNTLET = { group: 3, knockout: 7 };

window.OPPONENTS = [
  // ============================ Group stage tier ============================
  { tier: "group", name: "Sweden",         year: 1958, flag: "🇸🇪", tag: "Hosts' Golden Run",      att: 79, mid: 78, def: 75, blurb: "Riding home advantage all the way to the final." },
  { tier: "group", name: "Portugal",       year: 1966, flag: "🇵🇹", tag: "Eusébio Emerges",        att: 81, mid: 79, def: 76, blurb: "The Black Panther drags Portugal to the semis." },
  { tier: "group", name: "Poland",         year: 1974, flag: "🇵🇱", tag: "Lato's Bronze",          att: 80, mid: 79, def: 77, blurb: "Grzegorz Lato fires them onto the podium." },
  { tier: "group", name: "USSR",           year: 1966, flag: "🇷🇺", tag: "Yashin's Wall",          att: 79, mid: 80, def: 80, blurb: "The Black Spider guards the net behind a stout side." },
  { tier: "group", name: "Belgium",        year: 1986, flag: "🇧🇪", tag: "Surprise Semifinalists", att: 80, mid: 80, def: 78, blurb: "Ceulemans leads an unlikely run to the last four." },
  { tier: "group", name: "Croatia",        year: 1998, flag: "🇭🇷", tag: "Šuker's Bronze",         att: 81, mid: 82, def: 78, blurb: "A debut tournament and a third-place finish." },
  { tier: "group", name: "Denmark",        year: 1992, flag: "🇩🇰", tag: "Danish Dynamite",        att: 79, mid: 80, def: 81, blurb: "Gatecrashers who stunned Europe as champions." },
  { tier: "group", name: "Colombia",       year: 1990, flag: "🇨🇴", tag: "Valderrama's Flair",     att: 80, mid: 81, def: 76, blurb: "El Pibe orchestrates the most flamboyant side around." },
  { tier: "group", name: "Nigeria",        year: 1994, flag: "🇳🇬", tag: "Super Eagles Soar",      att: 80, mid: 80, def: 77, blurb: "A fearless golden generation announces itself." },
  { tier: "group", name: "Cameroon",       year: 1990, flag: "🇨🇲", tag: "Indomitable Lions",      att: 79, mid: 79, def: 75, blurb: "Roger Milla and the dancing corner flag." },
  { tier: "group", name: "Mexico",         year: 1986, flag: "🇲🇽", tag: "Hosts on the Rise",      att: 79, mid: 79, def: 78, blurb: "Negrete's scissor-kick lights up home turf." },
  { tier: "group", name: "Romania",        year: 1994, flag: "🇷🇴", tag: "Hagi's Generation",      att: 80, mid: 82, def: 77, blurb: "The Maradona of the Carpathians pulls the strings." },
  { tier: "group", name: "Czechoslovakia", year: 1976, flag: "🇨🇿", tag: "European Champions",     att: 80, mid: 81, def: 80, blurb: "Panenka's chip wins a shootout for the ages." },
  { tier: "group", name: "Chile",          year: 1962, flag: "🇨🇱", tag: "Bronze at Home",         att: 78, mid: 78, def: 77, blurb: "A spirited host nation reaches the semifinals." },

  // ============================ Knockout tier ============================
  { tier: "knockout", name: "Uruguay",      year: 1950, flag: "🇺🇾", tag: "Maracanazo",              att: 83, mid: 83, def: 83, blurb: "Silenced 200,000 in the Maracanã to take the cup." },
  { tier: "knockout", name: "England",      year: 1966, flag: "🏴",  tag: "Wingless Wonders",        att: 83, mid: 83, def: 84, blurb: "World champions on home soil, led by Bobby Moore." },
  { tier: "knockout", name: "Hungary",      year: 1954, flag: "🇭🇺", tag: "Mighty Magyars",          att: 84, mid: 83, def: 78, blurb: "Puskás and a side unbeaten for six straight years." },
  { tier: "knockout", name: "Argentina",    year: 1978, flag: "🇦🇷", tag: "Kempes' Triumph",         att: 84, mid: 83, def: 82, blurb: "El Matador's goals deliver a first world title." },
  { tier: "knockout", name: "France",       year: 1984, flag: "🇫🇷", tag: "Platini's Euro",          att: 85, mid: 88, def: 82, blurb: "Platini scores nine in one tournament. Unreal." },
  { tier: "knockout", name: "Netherlands",  year: 1974, flag: "🇳🇱", tag: "Total Football",          att: 86, mid: 87, def: 81, blurb: "Cruyff's revolutionaries who changed the sport." },
  { tier: "knockout", name: "Netherlands",  year: 1988, flag: "🇳🇱", tag: "European Kings",          att: 86, mid: 86, def: 83, blurb: "Gullit and Van Basten finally land silverware." },
  { tier: "knockout", name: "Brazil",       year: 1958, flag: "🇧🇷", tag: "Pelé Announces Himself",  att: 89, mid: 87, def: 82, blurb: "A 17-year-old Pelé takes the world by storm." },
  { tier: "knockout", name: "Brazil",       year: 1982, flag: "🇧🇷", tag: "Beautiful Losers",        att: 90, mid: 89, def: 80, blurb: "Zico, Sócrates, Falcão — the great nearly-men." },
  { tier: "knockout", name: "Brazil",       year: 1994, flag: "🇧🇷", tag: "Romário & Bebeto",        att: 87, mid: 84, def: 85, blurb: "Pragmatic and ruthless — a fourth star." },
  { tier: "knockout", name: "Brazil",       year: 2002, flag: "🇧🇷", tag: "The Three R's",           att: 90, mid: 88, def: 85, blurb: "Ronaldo, Rivaldo and Ronaldinho in full flow." },
  { tier: "knockout", name: "Argentina",    year: 1986, flag: "🇦🇷", tag: "Maradona's Masterpiece",  att: 88, mid: 86, def: 82, blurb: "One man drags a nation to glory almost alone." },
  { tier: "knockout", name: "Argentina",    year: 2022, flag: "🇦🇷", tag: "Scaloneta",               att: 89, mid: 87, def: 86, blurb: "Messi finally lifts it with a side that never breaks." },
  { tier: "knockout", name: "West Germany",  year: 1974, flag: "🇩🇪", tag: "Der Kaiser's Crown",      att: 87, mid: 86, def: 85, blurb: "Beckenbauer and Müller win it on home soil." },
  { tier: "knockout", name: "Germany",      year: 1990, flag: "🇩🇪", tag: "Matthäus Marshals",       att: 86, mid: 86, def: 86, blurb: "A relentless, balanced machine of a team." },
  { tier: "knockout", name: "Germany",      year: 2014, flag: "🇩🇪", tag: "Die Mannschaft",          att: 86, mid: 88, def: 87, blurb: "Ask Brazil about the 7-1. Ruthless." },
  { tier: "knockout", name: "France",       year: 1998, flag: "🇫🇷", tag: "Les Bleus",               att: 84, mid: 87, def: 86, blurb: "Zidane at his peak behind an iron defence." },
  { tier: "knockout", name: "France",       year: 2018, flag: "🇫🇷", tag: "Pace to Burn",            att: 87, mid: 86, def: 87, blurb: "Mbappé, Griezmann and Kanté blur past everyone." },
  { tier: "knockout", name: "Spain",        year: 2008, flag: "🇪🇸", tag: "La Furia's Euro",         att: 84, mid: 90, def: 85, blurb: "The tiki-taka era begins with a long-awaited title." },
  { tier: "knockout", name: "Spain",        year: 2010, flag: "🇪🇸", tag: "Tiki-Taka",               att: 85, mid: 91, def: 87, blurb: "Xavi and Iniesta passed the world to death." },
  { tier: "knockout", name: "Italy",        year: 1982, flag: "🇮🇹", tag: "Catenaccio Kings",        att: 84, mid: 82, def: 86, blurb: "Paolo Rossi's redemption behind a granite back line." },
  { tier: "knockout", name: "Italy",        year: 2006, flag: "🇮🇹", tag: "Azzurri Steel",           att: 84, mid: 85, def: 88, blurb: "Cannavaro marshals the meanest defence of its era." },
  { tier: "knockout", name: "Brazil",       year: 1970, flag: "🇧🇷", tag: "The Greatest of All Time", att: 95, mid: 90, def: 85, blurb: "Pelé, Jairzinho, Tostão, Gérson, Rivelino. The ultimate test." },
];
