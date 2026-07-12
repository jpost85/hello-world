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

export function BattleReportModal({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const r = report;
  const tactical = r.events.filter((e) => e.kind !== "rout");
  const outcome = r.captured ? "Victory" : "Repulsed";
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal battle-report" onClick={(e) => e.stopPropagation()}>
        <div className={`br-outcome ${r.captured ? "win" : "loss"}`}>{outcome} at {r.provinceName.replace(/ \(Capital\)/, "")}</div>

        <div className="br-side">
          <div className="br-side-head">
            <span>{r.attackerName} <em>(you)</em></span>
            <span className="br-type">{r.attackerType}{r.attackerOfficer ? ` · ${r.attackerOfficer}` : ""}</span>
          </div>
          <Bar start={r.attackerStart} end={r.attackerEnd} kind="you" />
        </div>

        <div className="br-vs">vs</div>

        <div className="br-side">
          <div className="br-side-head">
            <span>{r.defenderName}</span>
            <span className="br-type">{r.defenderType}{r.defenderOfficer ? ` · ${r.defenderOfficer}` : ""}</span>
          </div>
          <Bar start={r.defenderStart} end={r.defenderEnd} kind="foe" />
        </div>

        {r.waterCrossing && <div className="br-note">A river crossing — navies held the advantage.</div>}

        {tactical.length > 0 && (
          <ul className="br-events">
            {tactical.map((e, i) => (
              <li key={i}><span className="br-ev-icon">{EVENT_ICON[e.kind] ?? "•"}</span> {e.message}{e.damage > 0 ? ` (−${e.damage.toLocaleString()})` : ""}</li>
            ))}
          </ul>
        )}

        {r.capturedOfficer && <div className="br-capture">Captured: <strong>{r.capturedOfficer}</strong> — judge them in the Court.</div>}

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
