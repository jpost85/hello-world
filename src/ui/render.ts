import type {
  DiplomaticAction,
  GameState,
  GlobalParamKey,
  IndependenceOutcome,
  PolicyAxisKey,
  Rival,
} from "../types";
import { FACTIONS, getFaction } from "../data/factions";
import { PROJECTS } from "../data/projects";
import { PHASE_BY_KEY, PHASE_ORDER } from "../data/phases";
import { IDEOLOGIES, IDEOLOGY_BY_KEY } from "../data/ideologies";
import { POLICY_AXES } from "../data/policies";
import { INTEREST_GROUPS } from "../data/politics";
import { STANCE_LABEL, TRAIT_BY_ID } from "../data/rivals";
import { ANTAGONIST } from "../data/antagonist";
import { paramProgress } from "../engine/terraforming";
import { effectiveProduction } from "../engine/survival";
import { dominantIdeology } from "../engine/ideology";
import { rivalName } from "../engine/diplomacy";
import { stillnessMood } from "../engine/antagonist";
import { availableTech, projectBlockedReason } from "../engine/game";

/** Callbacks the UI invokes; wired up in main.ts. */
export interface UIController {
  onStartProject(projectId: string): void;
  onSetResearch(techId: string): void;
  onSetPolicy(axis: PolicyAxisKey, optionId: string): void;
  onResolveIndependence(outcome: IndependenceOutcome): void;
  onDiplomaticAction(rivalId: string, action: DiplomaticAction): void;
  onDiplomacyResponse(eventId: string, optionId: string): void;
  onAntagonistAction(action: "strike" | "fund"): void;
  onEndTurn(): void;
  onSelectFaction(factionId: string): void;
  onRestart(): void;
  /** Re-render without advancing the game (e.g. after switching tabs). */
  onRerender(): void;
}

type Tab = "colony" | "society" | "diplomacy" | "history";
let activeTab: Tab = "colony";

// ---------------------------------------------------------------------------
// Faction select screen
// ---------------------------------------------------------------------------

export function renderFactionSelect(root: HTMLElement, ctrl: UIController): void {
  activeTab = "colony";
  root.innerHTML = `
    <div class="screen">
      <h1>APHELION</h1>
      <p class="tagline">
        Terraform a dead world, then watch a civilization emerge from it.
        Choose the faction that takes the first foothold.
      </p>
      <div class="faction-grid">
        ${FACTIONS.map(
          (f) => `
          <button class="faction-card" data-faction="${f.id}" style="--accent:${f.color}">
            <h2>${f.name}</h2>
            <p class="leader">${f.leader}</p>
            <p class="agenda">"${f.agenda}"</p>
            <p class="blurb">${f.blurb}</p>
            <ul class="bonuses">${f.bonuses.map((b) => `<li>${b}</li>`).join("")}</ul>
            <p class="special"><strong>Special:</strong> ${f.special}</p>
          </button>`,
        ).join("")}
      </div>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>("[data-faction]").forEach((btn) => {
    btn.addEventListener("click", () => ctrl.onSelectFaction(btn.dataset.faction!));
  });
}

// ---------------------------------------------------------------------------
// In-game HUD
// ---------------------------------------------------------------------------

export function renderGame(
  state: GameState,
  ctrl: UIController,
  els: { topbar: HTMLElement; sidebar: HTMLElement; logbar: HTMLElement },
): void {
  renderTopbar(state, els.topbar);
  renderSidebar(state, ctrl, els.sidebar);
  renderLog(state, els.logbar);
  wireControls(state, ctrl, els);
}

function renderTopbar(state: GameState, el: HTMLElement): void {
  const faction = getFaction(state.colony.factionId);
  const phase = PHASE_BY_KEY[state.phase];
  const c = state.colony;
  const prod = effectiveProduction(state);
  const res = (label: string, val: number, flow: number) =>
    `<span class="res"><b>${label}</b> ${Math.round(val)}<i>${flow >= 0 ? "+" : ""}${round1(flow)}</i></span>`;

  el.innerHTML = `
    <div class="topbar-inner" style="--accent:${faction.color}">
      <div class="turn">
        <span class="faction-name">${faction.name}</span>
        <span class="turn-no">Turn ${state.turn} · ${phase.name}</span>
      </div>
      <div class="resources">
        ${res("⚡", c.stocks.energy, prod.energy)}
        ${res("⛏", c.stocks.materials, prod.materials)}
        ${res("🌾", c.stocks.food, prod.food)}
        ${res("💰", c.stocks.credits, prod.credits)}
        ${res("🔬", state.currentResearch?.progress ?? 0, prod.research)}
      </div>
      <div class="vitals">
        <span class="res"><b>👤</b> ${c.population}/${c.maxPopulation}</span>
        <span class="res"><b>Morale</b> ${Math.round(c.stability)}</span>
        <span class="res"><b>Habitability</b> ${state.habitability}%</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Sidebar: tabbed (Colony / Society / History)
// ---------------------------------------------------------------------------

function renderSidebar(state: GameState, _ctrl: UIController, el: HTMLElement): void {
  const societyLive = state.phase !== "corporate";
  const societyBadge = societyLive ? "" : ` <span class="lock">🔒</span>`;
  const decisionPending = state.phase === "independence" && !state.independenceOutcome;
  const dipPending = state.pendingDiplomacy.length;
  const dipBadge = societyLive ? (dipPending ? ` (${dipPending})` : "") : ` <span class="lock">🔒</span>`;

  const tabs: { key: Tab; label: string; alert?: boolean }[] = [
    { key: "colony", label: "Colony" },
    { key: "society", label: `Society${societyBadge}`, alert: decisionPending },
    { key: "diplomacy", label: `Diplomacy${dipBadge}`, alert: dipPending > 0 },
    { key: "history", label: `History (${state.chronicle.length})` },
  ];

  const body =
    activeTab === "colony"
      ? colonyTab(state)
      : activeTab === "society"
        ? societyTab(state)
        : activeTab === "diplomacy"
          ? diplomacyTab(state)
          : historyTab(state);

  el.innerHTML = `
    <div class="tabs">
      ${tabs
        .map(
          (t) =>
            `<button class="tab ${activeTab === t.key ? "active" : ""} ${
              t.alert ? "alert" : ""
            }" data-tab="${t.key}">${t.label}</button>`,
        )
        .join("")}
    </div>
    <div class="tab-body">${body}</div>
    <button id="end-turn" class="end-turn">End Turn ▶</button>
    ${state.gameOver ? renderGameOver(state) : ""}
  `;
}

// --- Colony tab -----------------------------------------------------------

function colonyTab(state: GameState): string {
  const paramKeys = Object.keys(state.globalParams) as GlobalParamKey[];
  const meters = paramKeys
    .map((k) => {
      const p = state.globalParams[k];
      return meter(p.label, p.unit, p.value, paramProgress(state, k), p.description);
    })
    .join("");

  const active =
    state.activeProjects
      .map((a) => {
        const p = PROJECTS.find((x) => x.id === a.projectId)!;
        return `<li><span>${p.name}</span><span class="turns">${a.turnsRemaining} turns</span></li>`;
      })
      .join("") || `<li class="empty">No active projects.</li>`;

  const projects = PROJECTS.map((p) => {
    const done = state.completedProjects.includes(p.id);
    const inProgress = state.activeProjects.some((a) => a.projectId === p.id);
    const blocked = projectBlockedReason(state, p);
    const disabled = done || inProgress || blocked;
    const status = done
      ? `<span class="tag done">done</span>`
      : blocked && !inProgress
        ? `<span class="tag blocked">${blocked}</span>`
        : inProgress
          ? `<span class="tag active">building</span>`
          : "";
    const cost = Object.entries(p.cost)
      .map(([k, v]) => `${costIcon(k)}${v}`)
      .join(" ");
    return `
      <div class="project ${p.category}">
        <div class="project-head">
          <span class="project-name">${p.name}${p.repeatable ? ' <span class="rep">↻</span>' : ""}</span>
          ${status}
        </div>
        <p class="project-desc">${p.description}</p>
        <div class="project-foot">
          <span class="project-cost">${cost} · ${p.duration}t</span>
          <button data-start="${p.id}" ${disabled ? "disabled" : ""}>Start</button>
        </div>
      </div>`;
  }).join("");

  const techs = availableTech(state);
  const research = state.currentResearch
    ? `<p class="researching">Researching… (${state.researchedTech.length} techs known)</p>`
    : techs.length
      ? `<select id="tech-select">
          <option value="">— pick research —</option>
          ${techs.map((t) => `<option value="${t.id}">${t.name} (${t.cost})</option>`).join("")}
         </select>`
      : `<p class="empty">All available tech researched.</p>`;

  return `
    <section class="panel">
      <h3>Planetary Terraforming</h3>
      ${meters}
    </section>
    <section class="panel">
      <h3>Active Projects</h3>
      <ul class="active-projects">${active}</ul>
    </section>
    <section class="panel">
      <h3>Research</h3>
      ${research}
    </section>
    <section class="panel">
      <h3>Terraforming Projects</h3>
      <div class="project-list">${projects}</div>
    </section>`;
}

// --- Society tab ----------------------------------------------------------

function societyTab(state: GameState): string {
  const phase = PHASE_BY_KEY[state.phase];
  const phaseIdx = PHASE_ORDER.indexOf(state.phase);
  const track = PHASE_ORDER.map(
    (p, i) =>
      `<span class="phase-step ${i <= phaseIdx ? "reached" : ""} ${
        i === phaseIdx ? "current" : ""
      }">${PHASE_BY_KEY[p].name}</span>`,
  ).join('<span class="phase-arrow">→</span>');

  const phaseCard = `
    <section class="panel phase-card">
      <h3>Era</h3>
      <div class="phase-track">${track}</div>
      <p class="phase-tagline">${phase.tagline}</p>
      <p class="phase-desc">${phase.description}</p>
    </section>`;

  if (state.phase === "corporate") {
    return (
      phaseCard +
      `<section class="panel">
        <p class="empty">
          This is still a corporate operation — profit and planetary
          engineering only. Society, ideology, and politics emerge once the
          world becomes livable and settlers arrive (habitability ≥ 12%).
        </p>
      </section>`
    );
  }

  return (
    phaseCard +
    (state.phase === "independence" && !state.independenceOutcome ? independencePanel() : "") +
    ideologyPanel(state) +
    policiesPanel(state) +
    interestGroupsPanel(state) +
    charactersPanel(state)
  );
}

function ideologyPanel(state: GameState): string {
  const dom = dominantIdeology(state);
  const active = state.phase === "ideological" || state.phase === "independence";
  const max = Math.max(1, ...IDEOLOGIES.map((i) => state.ideology[i.key]));
  const bars = IDEOLOGIES.map((i) => {
    const v = state.ideology[i.key];
    const pct = Math.round((v / max) * 100);
    return `
      <div class="ideo-row ${dom === i.key ? "dominant" : ""}">
        <span class="ideo-name">${i.name}</span>
        <div class="ideo-track"><div class="ideo-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");

  const domDef = dom ? IDEOLOGY_BY_KEY[dom] : null;
  const effect =
    active && domDef
      ? `<p class="ideo-effect"><strong>${domDef.name} society:</strong> ${domDef.blurb}
         <br><span class="pro">+ ${domDef.advantages.join(", ")}</span>
         <br><span class="con">– ${domDef.disadvantages.join(", ")}</span></p>`
      : `<p class="ideo-note">Identity is still forming. A dominant ideology takes
         mechanical effect in the Ideology Emerges era.</p>`;

  return `
    <section class="panel">
      <h3>Ideology ${dom ? `· <span class="dom">${IDEOLOGY_BY_KEY[dom].name}</span>` : ""}</h3>
      ${bars}
      ${effect}
    </section>`;
}

function policiesPanel(state: GameState): string {
  const rows = POLICY_AXES.map((axis) => {
    const current = state.policies[axis.key];
    const opts = axis.options
      .map((o) => `<option value="${o.id}" ${o.id === current ? "selected" : ""}>${o.label}</option>`)
      .join("");
    const curDesc = axis.options.find((o) => o.id === current)?.description ?? "";
    return `
      <div class="policy-row">
        <label>${axis.label}</label>
        <select data-policy="${axis.key}">${opts}</select>
        <p class="policy-desc">${curDesc}</p>
      </div>`;
  }).join("");
  return `
    <section class="panel">
      <h3>Social Engineering</h3>
      <p class="panel-note">Tune the society. Every axis is a trade-off that
         shifts your economy, morale, ideology, and who you please.</p>
      ${rows}
    </section>`;
}

function interestGroupsPanel(state: GameState): string {
  const rows = INTEREST_GROUPS.map((def) => {
    const g = state.interestGroups.find((x) => x.key === def.key)!;
    const sat = Math.round(g.satisfaction);
    const cls = sat < 35 ? "angry" : sat < 55 ? "wary" : "content";
    return `
      <div class="group-row" title="${def.wants}">
        <span class="group-name">${def.name}</span>
        <div class="group-track"><div class="group-fill ${cls}" style="width:${sat}%"></div></div>
        <span class="group-val">${sat}</span>
      </div>`;
  }).join("");
  return `
    <section class="panel">
      <h3>Internal Politics</h3>
      <p class="panel-note">Keep the factions of your own society content —
         discontent bleeds stability.</p>
      ${rows}
    </section>`;
}

function charactersPanel(state: GameState): string {
  if (!state.characters.length) {
    return `<section class="panel"><h3>Notable Colonists</h3>
      <p class="empty">No one of note has risen yet.</p></section>`;
  }
  const list = [...state.characters]
    .reverse()
    .slice(0, 8)
    .map(
      (c) => `
      <div class="char">
        <div class="char-head"><span class="char-name">${c.name}</span>
          <span class="char-role">${c.role}, ${c.age}</span></div>
        <div class="char-traits">${c.traits.map((t) => `<span class="trait">${t.label}</span>`).join("")}</div>
      </div>`,
    )
    .join("");
  return `<section class="panel"><h3>Notable Colonists (${state.characters.length})</h3>${list}</section>`;
}

function independencePanel(): string {
  return `
    <section class="panel decision">
      <h3>⚖ The Question of Independence</h3>
      <p>The world is no longer just a colony. Choose its future:</p>
      <button data-independence="colony">Remain with Earth</button>
      <button data-independence="autonomy">Negotiate Autonomy</button>
      <button data-independence="independent">Declare Independence</button>
    </section>`;
}

// --- Diplomacy tab --------------------------------------------------------

const STANCE_ORDER: Record<string, number> = {
  nemesis: 0, adversary: 1, rival: 2, competitor: 3, partner: 4, ally: 5,
};

function diplomacyTab(state: GameState): string {
  if (state.phase === "corporate") {
    return `
      <section class="panel">
        <h3>Diplomacy</h3>
        <p class="empty">Relations are purely commercial for now — rival
          corporations competing for Earth's contracts. Once your world grows
          into a society, diplomacy becomes personal: rivals will remember what
          you do to them.</p>
      </section>`;
  }

  const events = state.pendingDiplomacy
    .map((e) => {
      const rival = state.rivals.find((r) => r.id === e.rivalId);
      const who = rival ? rivalName(rival) : "A rival";
      const opts = e.options
        .map(
          (o) =>
            `<button data-dip-respond="${e.id}" data-dip-option="${o.id}">${o.label}</button>`,
        )
        .join("");
      return `
        <section class="panel overture">
          <h3>✉ ${who}</h3>
          <p>${e.text}</p>
          <div class="overture-opts">${opts}</div>
        </section>`;
    })
    .join("");

  const stillness = state.antagonist.awakened ? stillnessPanel(state) : "";
  const earth = state.earth.present ? earthPanel(state) : "";

  const living = state.rivals
    .filter((r) => r.alive)
    .sort((a, b) => STANCE_ORDER[a.stance] - STANCE_ORDER[b.stance] || a.rank - b.rank);
  const fallen = state.rivals.filter((r) => !r.alive);

  const rivalCards = living.map((r) => rivalCard(r, state)).join("");
  const fallenCards = fallen.length
    ? `<section class="panel"><h3>Fallen</h3>${fallen
        .map(
          (r) =>
            `<p class="fallen-row">☠ ${getFaction(r.factionId).name} — broken${
              r.grudge > 15 ? ", but their bitterness lingers" : ""
            }.</p>`,
        )
        .join("")}</section>`
    : "";

  return events + stillness + earth + rivalCards + fallenCards;
}

function stillnessPanel(state: GameState): string {
  const a = state.antagonist;
  const mood = stillnessMood(a.threat);
  const appeased = a.appeasedTurns > 0
    ? `<span class="appeased" title="Aggression reduced while funded enclaves hold">appeased (${a.appeasedTurns}t)</span>`
    : "";
  return `
    <section class="panel stillness">
      <div class="rival-head">
        <div>
          <span class="rival-name">☾ ${ANTAGONIST.name}</span>
          <span class="rival-faction">${ANTAGONIST.leader}</span>
        </div>
        <span class="stance-tag stillness-tag">${mood}</span>
      </div>
      <p class="creed">"${ANTAGONIST.creed}"</p>
      <p class="panel-note">${ANTAGONIST.blurb} They win if the world you woke
        falls back to silence.</p>
      <div class="rival-meta">
        <span title="How hard they currently push against the terraforming">threat ${Math.round(a.threat)}</span>
        ${a.quietings ? `<span class="grudge" title="Terraforming regressions they have inflicted">quietings ${a.quietings}</span>` : ""}
        ${appeased}
      </div>
      <div class="disp-track" title="Threat"><div class="disp-fill ${
        a.threat >= 60 ? "angry" : a.threat >= 30 ? "wary" : "content"
      }" style="width:${Math.round(a.threat)}%"></div></div>
      <div class="rival-actions">
        <button data-antag="strike" title="Sweep their cells (40 energy, 30 materials) — stronger under martial policy or militarist ideology">Strike cells</button>
        <button data-antag="fund" title="Fund preservation enclaves (50 credits) — buys ${6} turns of reduced aggression">Fund enclaves</button>
      </div>
    </section>`;
}

function earthPanel(state: GameState): string {
  const s = state.earth.stance;
  const mood = s > 40 ? "content" : s > -20 ? "wary" : "hostile";
  return `
    <section class="panel earth">
      <h3>🌍 Earth</h3>
      <p class="panel-note">The old homeworld now watches you as a power in its
        own right. Its stance toward your autonomy: <strong>${mood}</strong>.</p>
    </section>`;
}

function dispClass(disp: number): string {
  return disp <= -20 ? "angry" : disp < 25 ? "wary" : "content";
}

function rivalCard(r: Rival, state: GameState): string {
  const faction = getFaction(r.factionId);
  const traits = r.traits
    .map((t) => `<span class="trait" title="${TRAIT_BY_ID[t].description}">${TRAIT_BY_ID[t].label}</span>`)
    .join("");
  const dispPct = Math.round((r.disposition + 100) / 2);
  const lastMem = r.memories[r.memories.length - 1];
  const memory = lastMem
    ? `<p class="rival-mem">“…${lastMem.text}.”</p>`
    : "";

  // Standout relationship with another rival.
  let relLine = "";
  const others = state.rivals.filter((o) => o.alive && o.id !== r.id);
  if (others.length) {
    const ally = others.reduce((a, b) => ((r.relations[b.id] ?? 0) > (r.relations[a.id] ?? 0) ? b : a));
    const foe = others.reduce((a, b) => ((r.relations[b.id] ?? 0) < (r.relations[a.id] ?? 0) ? b : a));
    const bits: string[] = [];
    if ((r.relations[ally.id] ?? 0) > 40) bits.push(`allied with ${getFaction(ally.factionId).name}`);
    if ((r.relations[foe.id] ?? 0) < -40) bits.push(`at odds with ${getFaction(foe.factionId).name}`);
    if (bits.length) relLine = `<p class="rival-rel">${bits.join(" · ")}</p>`;
  }

  const canAct = state.phase !== "corporate";
  const actions = canAct
    ? `<div class="rival-actions">
        <button data-dip="${r.id}" data-action="pact" title="Broker a pact (40 credits)">Pact</button>
        <button data-dip="${r.id}" data-action="aid" title="Send aid (30 materials, 20 credits)">Aid</button>
        <button data-dip="${r.id}" data-action="denounce" title="Denounce publicly (free)">Denounce</button>
        <button data-dip="${r.id}" data-action="sabotage" title="Sabotage (30 energy, 20 materials)">Sabotage</button>
      </div>`
    : "";

  return `
    <section class="panel rival stance-${r.stance}">
      <div class="rival-head">
        <div>
          <span class="rival-name">${rivalName(r)}</span>
          <span class="rival-faction">${faction.name}</span>
        </div>
        <span class="stance-tag stance-${r.stance}">${STANCE_LABEL[r.stance]}</span>
      </div>
      <div class="rival-traits">${traits}</div>
      <div class="rival-meta">
        <span title="Standing in the power hierarchy">Rank #${r.rank} · power ${Math.round(r.power)}</span>
        ${r.grudge > 20 ? `<span class="grudge" title="Unavenged slights">grudge ${Math.round(r.grudge)}</span>` : ""}
        ${r.debt > 20 ? `<span class="debt" title="Favors owed to you">owes you</span>` : ""}
      </div>
      <div class="disp-track" title="Disposition toward you">
        <div class="disp-fill ${dispClass(r.disposition)}" style="width:${dispPct}%"></div>
      </div>
      ${memory}
      ${relLine}
      ${actions}
    </section>`;
}

// --- History tab ----------------------------------------------------------

const CHRON_ICON: Record<string, string> = {
  phase: "◈",
  milestone: "★",
  person: "☺",
  breakthrough: "⚗",
  crisis: "⚠",
  politics: "⚑",
};

function historyTab(state: GameState): string {
  if (!state.chronicle.length) {
    return `<section class="panel"><p class="empty">History has not yet been written.</p></section>`;
  }
  const entries = [...state.chronicle]
    .reverse()
    .map(
      (c) => `
      <li class="chron chron-${c.category}">
        <span class="chron-turn">T${c.turn}</span>
        <span class="chron-icon">${CHRON_ICON[c.category] ?? "•"}</span>
        <div>
          <span class="chron-title">${c.title}</span>
          <span class="chron-detail">${c.detail}</span>
        </div>
      </li>`,
    )
    .join("");
  return `
    <section class="panel">
      <h3>The Chronicle of ${getFaction(state.colony.factionId).name}</h3>
      <p class="panel-note">The planet's permanent record — the moments that
         become its history.</p>
      <ul class="chronicle">${entries}</ul>
    </section>`;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function meter(label: string, unit: string, value: number, progress: number, desc: string): string {
  const pct = Math.round(progress * 100);
  return `
    <div class="meter" title="${desc}">
      <div class="meter-head"><span>${label}</span><span>${round1(value)}${unit} · ${pct}%</span></div>
      <div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function renderGameOver(state: GameState): string {
  const won = state.gameOver === "won";
  const title = state.independenceOutcome
    ? { colony: "Continued Union", autonomy: "Negotiated Autonomy", independent: "Independence" }[
        state.independenceOutcome
      ]
    : won
      ? "A New World"
      : "Colony Lost";
  return `
    <div class="game-over ${state.gameOver}">
      <h2>${title}</h2>
      <p>${
        won
          ? "You carried a dead world into history. Review the Chronicle for the story you wrote."
          : "The colony could not survive long enough. The planet keeps its silence."
      }</p>
      <button id="restart">New Game</button>
    </div>`;
}

function renderLog(state: GameState, el: HTMLElement): void {
  const items = state.log
    .slice(-10)
    .reverse()
    .map((e) => `<li class="log-${e.kind}"><span class="log-turn">T${e.turn}</span> ${e.message}</li>`)
    .join("");
  el.innerHTML = `<ul class="log">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function wireControls(
  _state: GameState,
  ctrl: UIController,
  els: { sidebar: HTMLElement },
): void {
  const sb = els.sidebar;

  sb.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab as Tab;
      ctrl.onRerender();
    });
  });

  sb.querySelectorAll<HTMLButtonElement>("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => ctrl.onStartProject(btn.dataset.start!));
  });

  const techSelect = sb.querySelector<HTMLSelectElement>("#tech-select");
  techSelect?.addEventListener("change", () => {
    if (techSelect.value) ctrl.onSetResearch(techSelect.value);
  });

  sb.querySelectorAll<HTMLSelectElement>("[data-policy]").forEach((sel) => {
    sel.addEventListener("change", () =>
      ctrl.onSetPolicy(sel.dataset.policy as PolicyAxisKey, sel.value),
    );
  });

  sb.querySelectorAll<HTMLButtonElement>("[data-independence]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ctrl.onResolveIndependence(btn.dataset.independence as IndependenceOutcome),
    );
  });

  sb.querySelectorAll<HTMLButtonElement>("[data-dip]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ctrl.onDiplomaticAction(btn.dataset.dip!, btn.dataset.action as DiplomaticAction),
    );
  });

  sb.querySelectorAll<HTMLButtonElement>("[data-dip-respond]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ctrl.onDiplomacyResponse(btn.dataset.dipRespond!, btn.dataset.dipOption!),
    );
  });

  sb.querySelectorAll<HTMLButtonElement>("[data-antag]").forEach((btn) => {
    btn.addEventListener("click", () =>
      ctrl.onAntagonistAction(btn.dataset.antag as "strike" | "fund"),
    );
  });

  sb.querySelector<HTMLButtonElement>("#end-turn")?.addEventListener("click", () => ctrl.onEndTurn());
  sb.querySelector<HTMLButtonElement>("#restart")?.addEventListener("click", () => ctrl.onRestart());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function costIcon(key: string): string {
  return { energy: "⚡", materials: "⛏", food: "🌾", credits: "💰" }[key] ?? "";
}
