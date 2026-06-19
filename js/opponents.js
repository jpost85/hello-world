/*
 * The Gauntlet — legendary national sides, in escalating order of difficulty.
 *
 * Each opponent is rated on three lines (att / mid / def, 0-100) that the
 * match engine pits against your XI. Ratings climb round by round, with the
 * 1970 Brazil side as the final boss — widely regarded as the greatest team
 * ever assembled.
 */
window.OPPONENTS = [
  {
    name: "Hungary",
    year: 1954,
    flag: "🇭🇺",
    tag: "The Mighty Magyars",
    att: 80, mid: 79, def: 74,
    blurb: "Puskás and the Golden Team that went unbeaten for six years.",
  },
  {
    name: "England",
    year: 1966,
    flag: "🏴",
    tag: "The Wingless Wonders",
    att: 79, mid: 80, def: 80,
    blurb: "World champions on home soil, marshalled by Bobby Moore.",
  },
  {
    name: "Italy",
    year: 1982,
    flag: "🇮🇹",
    tag: "Catenaccio Kings",
    att: 81, mid: 80, def: 84,
    blurb: "Paolo Rossi's redemption and a back line carved from granite.",
  },
  {
    name: "Netherlands",
    year: 1974,
    flag: "🇳🇱",
    tag: "Total Football",
    att: 85, mid: 86, def: 80,
    blurb: "Cruyff's revolutionaries who changed the sport forever.",
  },
  {
    name: "France",
    year: 1998,
    flag: "🇫🇷",
    tag: "Les Bleus",
    att: 84, mid: 87, def: 86,
    blurb: "Zidane at his peak in front of an iron-clad defence.",
  },
  {
    name: "Argentina",
    year: 1986,
    flag: "🇦🇷",
    tag: "Maradona's Masterpiece",
    att: 88, mid: 86, def: 82,
    blurb: "One man dragged a nation to glory almost single-handed.",
  },
  {
    name: "Germany",
    year: 2014,
    flag: "🇩🇪",
    tag: "Die Mannschaft",
    att: 86, mid: 88, def: 87,
    blurb: "A ruthless, machine-like unit — ask Brazil about the 7-1.",
  },
  {
    name: "Spain",
    year: 2010,
    flag: "🇪🇸",
    tag: "Tiki-Taka",
    att: 85, mid: 91, def: 87,
    blurb: "Xavi and Iniesta passed the world to death.",
  },
  {
    name: "Argentina",
    year: 2022,
    flag: "🇦🇷",
    tag: "Scaloneta",
    att: 89, mid: 87, def: 86,
    blurb: "Messi finally lifts the trophy with a side that never breaks.",
  },
  {
    name: "Brazil",
    year: 1970,
    flag: "🇧🇷",
    tag: "The Greatest of All Time",
    att: 95, mid: 90, def: 85,
    blurb: "Pelé, Jairzinho, Tostão, Gérson, Rivelino. The final boss.",
  },
];
