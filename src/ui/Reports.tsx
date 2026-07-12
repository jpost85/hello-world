/**
 * Player-facing reports: a modal recapping the player's own battle (the sides,
 * the tactical events that fired, the casualties and captures) and a compact
 * card summarising what the other warlords did between the player's turns.
 */
import type { BattleReport } from "../engine/index.ts";
import type { SeasonReport } from "./useGame.ts";

const EVENT_ICON: Record<string, string> = {
  "fire-attack": "🔥",
  ambush: "🏹",
  duel: "⚔️",
  "low-supply": "🌾",
};

function Bar({ start, end, kind }: { start: number; end: number; kind: "you" | "foe" }) {
  const lost = Math.max(0, start - end);
  const pct = start > 0 ? Math.round((end / start) * 100) : 0;
  return (
    <div className={`br-bar ${kind}`}>
      <div className="br-bar-fill" style={{ width: `${pct}%` }} />
      <span className="br-bar-label">{end.toLocaleString()} left · −{lost.toLocaleString()}</span>
    </div>
  );
}

export function BattleReportModal({ report, humanId, onClose }: { report: BattleReport; humanId: string | null; onClose: () => void }) {
  const r = report;
  const tactical = r.events.filter((e) => e.kind !== "rout");
  const iAmAttacker = r.attackerId === humanId;
  const iAmDefender = r.defenderId === humanId;
  const involved = iAmAttacker || iAmDefender;

  // Outcome from the player's point of view (falls back to attacker's for a
  // spectator's report, which the UI doesn't currently surface).
  const outcome = iAmDefender
    ? r.captured ? "Defeat" : "Held the line"
    : r.captured ? "Victory" : "Repulsed";
  const win = iAmDefender ? !r.captured : r.captured;

  // Order the panels so the player's own side sits on top.
  const attackerSide = { name: r.attackerName, type: r.attackerType, officer: r.attackerOfficer, start: r.attackerStart, end: r.attackerEnd, you: iAmAttacker };
  const defenderSide = { name: r.defenderName, type: r.defenderType, officer: r.defenderOfficer, start: r.defenderStart, end: r.defenderEnd, you: iAmDefender };
  const sides = iAmDefender ? [defenderSide, attackerSide] : [attackerSide, defenderSide];

  // Prisoner wording depends on which way the capture went.
  const capture = r.capturedOfficer
    ? iAmDefender
      ? { text: `${r.capturedOfficer} was taken prisoner!`, mine: false }
      : { text: `Captured ${r.capturedOfficer} — judge them in the Court.`, mine: true }
    : null;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal battle-report" onClick={(e) => e.stopPropagation()}>
        <div className={`br-outcome ${win ? "win" : "loss"}`}>{outcome} at {r.provinceName.replace(/ \(Capital\)/, "")}</div>

        {sides.map((sd, i) => (
          <div key={i}>
            {i === 1 && <div className="br-vs">vs</div>}
            <div className="br-side">
              <div className="br-side-head">
                <span>{sd.name}{involved && sd.you ? <em> (you)</em> : null}</span>
                <span className="br-type">{sd.type}{sd.officer ? ` · ${sd.officer}` : ""}</span>
              </div>
              <Bar start={sd.start} end={sd.end} kind={involved ? (sd.you ? "you" : "foe") : "foe"} />
            </div>
          </div>
        ))}

        {r.waterCrossing && <div className="br-note">A river crossing — navies held the advantage.</div>}

        {tactical.length > 0 && (
          <ul className="br-events">
            {tactical.map((e, i) => (
              <li key={i}><span className="br-ev-icon">{EVENT_ICON[e.kind] ?? "•"}</span> {e.message}{e.damage > 0 ? ` (−${e.damage.toLocaleString()})` : ""}</li>
            ))}
          </ul>
        )}

        {capture && <div className={`br-capture ${capture.mine ? "" : "foe"}`}>{capture.text}</div>}

        <button onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}

export function SeasonReportCard({ report, onClose }: { report: SeasonReport; onClose: () => void }) {
  const r = report;
  const sign = (n: number) => (n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString());
  return (
    <div className="season-report">
      <div className="sr-head">
        <span>While you were away — {r.season[0].toUpperCase() + r.season.slice(1)} {r.year} AD</span>
        <button onClick={onClose}>✕</button>
      </div>
      {r.lost.length > 0 && (
        <div className="sr-line lost">Lost: {r.lost.map((p) => p.name.replace(/ Province| \(Capital\)/, "")).join(", ")}</div>
      )}
      {r.gained.length > 0 && (
        <div className="sr-line gained">Gained: {r.gained.map((p) => p.name.replace(/ Province| \(Capital\)/, "")).join(", ")}</div>
      )}
      <div className="sr-deltas">
        <span className={r.troopsDelta < 0 ? "neg" : "pos"}>Troops {sign(r.troopsDelta)}</span>
        <span className={r.goldDelta < 0 ? "neg" : "pos"}>Gold {sign(r.goldDelta)}</span>
      </div>
    </div>
  );
}
