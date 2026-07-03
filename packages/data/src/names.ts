/**
 * Lightweight European name pools used by the procedural generator.
 * Deliberately small — enough to feel varied in the scaffold; expand
 * per-country as the game grows.
 */

export interface Nation {
  code: string;
  name: string;
  first: string[];
  last: string[];
}

export const NATIONS: Nation[] = [
  {
    code: 'ESP',
    name: 'Spain',
    first: ['Sergio', 'Pau', 'Ricky', 'Rudy', 'Juan', 'Marc', 'Alberto', 'Víctor'],
    last: ['Rodríguez', 'Gasol', 'Rubio', 'Fernández', 'Hernangómez', 'Llull', 'Abrines', 'Claver'],
  },
  {
    code: 'SRB',
    name: 'Serbia',
    first: ['Nikola', 'Bogdan', 'Vasilije', 'Nemanja', 'Miloš', 'Aleksa', 'Stefan', 'Marko'],
    last: ['Jokić', 'Bogdanović', 'Micić', 'Bjelica', 'Teodosić', 'Avramović', 'Jović', 'Gudurić'],
  },
  {
    code: 'FRA',
    name: 'France',
    first: ['Victor', 'Rudy', 'Evan', 'Nando', 'Nicolas', 'Théo', 'Frank', 'Élie'],
    last: ['Wembanyama', 'Gobert', 'Fournier', 'De Colo', 'Batum', 'Maledon', 'Ntilikina', 'Okobo'],
  },
  {
    code: 'GRE',
    name: 'Greece',
    first: ['Giannis', 'Kostas', 'Nick', 'Georgios', 'Dimitrios', 'Thanasis', 'Vassilis', 'Ioannis'],
    last: ['Antetokounmpo', 'Calathes', 'Papanikolaou', 'Sloukas', 'Papagiannis', 'Larentzakis', 'Toliopoulos', 'Katsivelis'],
  },
  {
    code: 'LTU',
    name: 'Lithuania',
    first: ['Domantas', 'Jonas', 'Rokas', 'Marius', 'Mindaugas', 'Tadas', 'Ignas', 'Deividas'],
    last: ['Sabonis', 'Valančiūnas', 'Jokubaitis', 'Grigonis', 'Kuzminskas', 'Sedekerskis', 'Brazdeikis', 'Sirvydis'],
  },
  {
    code: 'ITA',
    name: 'Italy',
    first: ['Danilo', 'Simone', 'Nicolò', 'Marco', 'Achille', 'Alessandro', 'Stefano', 'Luigi'],
    last: ['Gallinari', 'Fontecchio', 'Melli', 'Spissu', 'Polonara', 'Pajola', 'Tonut', 'Datome'],
  },
  {
    code: 'GER',
    name: 'Germany',
    first: ['Dennis', 'Franz', 'Maodo', 'Daniel', 'Johannes', 'Andreas', 'Isaac', 'Moritz'],
    last: ['Schröder', 'Wagner', 'Lô', 'Theis', 'Voigtmann', 'Obst', 'Bonga', 'Thiemann'],
  },
  {
    code: 'SLO',
    name: 'Slovenia',
    first: ['Luka', 'Goran', 'Vlatko', 'Klemen', 'Zoran', 'Edo', 'Mike', 'Aleksej'],
    last: ['Dončić', 'Dragić', 'Čančar', 'Prepelič', 'Dragić', 'Murić', 'Tobey', 'Nikolić'],
  },
];

export const NATION_BY_CODE: Record<string, Nation> = Object.fromEntries(
  NATIONS.map((n) => [n.code, n]),
);
