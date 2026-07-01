import type { GameState, GlobalParamKey } from "../types";
import { FACTIONS, getFaction } from "../data/factions";
import { PROJECTS } from "../data/projects";
import { paramProgress } from "../engine/terraforming";
import { effectiveProduction } from "../engine/survival";
import {
  availableTech,
  projectBlockedReason,
} from "../engine/game";

/** Callbacks the UI invokes; wired up in main.ts. */
export interface UIController {
  onStartProject(projectId: string): void;
  onSetResearch(techId: string): void;
  onEndTurn(): void;
  onSelectFaction(factionId: string): void;
  onRestart(): void;
}

// ---------------------------------------------------------------------------
// Faction select screen
// ---------------------------------------------------------------------------

export function renderFactionSelect(root: HTMLElement, ctrl: UIController): void {
  root.innerHTML = `
    <div class="screen">
      <h1>APHELION</h1>
      <p class="tagline">Choose the faction that will make a dead world live.</p>
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
  const c = state.colony;
  const prod = effectiveProduction(state);
  const res = (label: string, val: number, flow: number) =>
    `<span class="res"><b>${label}</b> ${Math.round(val)}<i>${flow >= 0 ? "+" : ""}${round1(flow)}</i></span>`;

  el.innerHTML = `
    <div class="topbar-inner" style="--accent:${faction.color}">
      <div class="turn">
        <span class="faction-name">${faction.name}</span>
        <span class="turn-no">Turn ${state.turn}</span>
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

function meter(label: string, unit: string, value: number, progress: number, desc: string): string {
  const pct = Math.round(progress * 100);
  return `
    <div class="meter" title="${desc}">
      <div class="meter-head"><span>${label}</span><span>${round1(value)}${unit} · ${pct}%</span></div>
      <div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function renderSidebar(state: GameState, _ctrl: UIController, el: HTMLElement): void {
  const paramKeys = Object.keys(state.globalParams) as GlobalParamKey[];

  const meters = paramKeys
    .map((k) => {
      const p = state.globalParams[k];
      return meter(p.label, p.unit, p.value, paramProgress(state, k), p.description);
    })
    .join("");

  const active = state.activeProjects
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
        : "";
    const cost = Object.entries(p.cost)
      .map(([k, v]) => `${costIcon(k)}${v}`)
      .join(" ");
    return `
      <div class="project ${p.category}">
        <div class="project-head">
          <span class="project-name">${p.name}</span>
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
    ? (() => {
        const t = state.researchedTech;
        return `<p class="researching">Researching… ${t.length} techs known</p>`;
      })()
    : techs.length
      ? `<select id="tech-select">
          <option value="">— pick research —</option>
          ${techs.map((t) => `<option value="${t.id}">${t.name} (${t.cost})</option>`).join("")}
         </select>`
      : `<p class="empty">All available tech researched.</p>`;

  el.innerHTML = `
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
    </section>

    <button id="end-turn" class="end-turn">End Turn ▶</button>
    ${state.gameOver ? renderGameOver(state) : ""}
  `;
}

function renderGameOver(state: GameState): string {
  const won = state.gameOver === "won";
  return `
    <div class="game-over ${state.gameOver}">
      <h2>${won ? "A New World" : "Colony Lost"}</h2>
      <p>${won
        ? "Your terraforming reached self-sustaining habitability."
        : "The colony could not survive long enough."}</p>
      <button id="restart">New Game</button>
    </div>`;
}

function renderLog(state: GameState, el: HTMLElement): void {
  const items = state.log
    .slice(-12)
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
  els.sidebar.querySelectorAll<HTMLButtonElement>("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => ctrl.onStartProject(btn.dataset.start!));
  });

  const techSelect = els.sidebar.querySelector<HTMLSelectElement>("#tech-select");
  techSelect?.addEventListener("change", () => {
    if (techSelect.value) ctrl.onSetResearch(techSelect.value);
  });

  els.sidebar.querySelector<HTMLButtonElement>("#end-turn")?.addEventListener("click", () =>
    ctrl.onEndTurn(),
  );
  els.sidebar.querySelector<HTMLButtonElement>("#restart")?.addEventListener("click", () =>
    ctrl.onRestart(),
  );
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
