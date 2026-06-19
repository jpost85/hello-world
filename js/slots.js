/*
 * Draft slots — the "tier picks" that build your XI.
 *
 * The user fills an 11-man 4-3-3 by choosing one legend from each themed
 * slot. Every pool deliberately spans multiple decades so the all-time /
 * all-decade flavour comes through in the choices themselves.
 *
 * line: which line the slot feeds in the match engine (GK | DEF | MID | FWD)
 * pool: candidate player ids (must exist in js/players.js)
 */
window.SLOTS = [
  {
    key: "gk",
    label: "The Goalkeeper",
    line: "GK",
    blurb: "The last line of defence. A great keeper steals points on his own.",
    pool: ["yashin", "banks", "zoff", "schmeichel", "buffon", "casillas", "neuer"],
  },
  {
    key: "libero",
    label: "The Libero",
    line: "DEF",
    blurb: "A commanding centre-back who reads the game and starts attacks.",
    pool: ["beckenbauer", "baresi", "moore", "passarella", "cannavaro", "vandijk"],
  },
  {
    key: "stopper",
    label: "The Stopper",
    line: "DEF",
    blurb: "An uncompromising centre-back who wins every duel.",
    pool: ["puyol", "ramos", "desailly", "thuram", "maldini", "facchetti"],
  },
  {
    key: "rightback",
    label: "The Right-Back",
    line: "DEF",
    blurb: "Lock down the flank — or rampage up it.",
    pool: ["cafu", "lahm", "thuram", "ramos"],
  },
  {
    key: "leftback",
    label: "The Left-Back",
    line: "DEF",
    blurb: "Pace, power and a cannon of a left foot.",
    pool: ["maldini", "robertocarlos", "facchetti"],
  },
  {
    key: "anchor",
    label: "The Engine",
    line: "MID",
    blurb: "The box-to-box heartbeat who covers every blade of grass.",
    pool: ["matthaus", "gullit", "gerrard", "kante", "modric"],
  },
  {
    key: "playmaker",
    label: "The Playmaker",
    line: "MID",
    blurb: "The deep-lying conductor who dictates the tempo.",
    pool: ["pirlo", "xavi", "iniesta", "debruyne", "scholes"],
  },
  {
    key: "number10",
    label: "The No. 10",
    line: "MID",
    blurb: "The creative genius who unlocks any defence.",
    pool: ["zidane", "platini", "zico", "baggio", "socrates", "riquelme"],
  },
  {
    key: "winger",
    label: "The Winger",
    line: "FWD",
    blurb: "Skill, pace and chaos out wide.",
    pool: ["garrincha", "best", "ronaldinho", "cristiano", "mbappe"],
  },
  {
    key: "striker",
    label: "The No. 9",
    line: "FWD",
    blurb: "A pure finisher who lives for goals.",
    pool: ["muller", "vanbasten", "ronaldo", "romario", "batistuta", "lewandowski", "ibrahimovic"],
  },
  {
    key: "talisman",
    label: "The Talisman",
    line: "FWD",
    blurb: "The once-in-a-generation superstar your team is built around.",
    pool: ["pele", "maradona", "messi", "cruyff", "distefano", "puskas", "eusebio", "henry"],
  },
];
