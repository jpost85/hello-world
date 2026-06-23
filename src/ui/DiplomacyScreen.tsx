/**
 * The Diplomacy screen — the realm seen as a web of warlords. For each rival it
 * shows their strength, your standing with them, and any standing pact, with the
 * verbs to court an alliance, sue for a ceasefire, or tear an agreement up.
 */
import {
  areAllied,
  inCeasefire,
  provincesOf,
  relationOf,
  type GameState,
} from "../engine/index.ts";
import type { UseGame } from "./useGame.ts";

interface Props {
  state: GameState;
  humanId: string;
  isHumanTurn: boolean;
  game: UseGame;
  onClose: () => void;
}

function standing(rel: number): string {
  if (rel >= 50) return "Friendly";
  if (rel >= 15) return "Cordial";
  if (rel > -15) return "Neutral";
  if (rel > -50) return "Wary";
  return "Hostile";
}

export function DiplomacyScreen({ state, humanId, isHumanTurn, game, onClose }: Props) {
  const others = state.players.filter((p) => p.id !== humanId && !p.isEliminated);
  const canAct = isHumanTurn;
  const canPropose = isHumanTurn && state.commandPointsRemaining > 0;

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer dipl" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">Diplomacy <button onClick={onClose}>✕</button></div>
        {!isHumanTurn && <div className="panel-note">Envoys ride only on your own turn.</div>}

        {others.map((p) => {
          const faction = state.factions.find((f) => f.id === p.id);
          const rel = relationOf(state, humanId, p.id);
          const allied = areAllied(state, humanId, p.id);
          const truce = inCeasefire(state, humanId, p.id);
          const ceasefire = state.pacts.find(
            (x) => x.kind === "ceasefire" && [x.a, x.b].includes(humanId) && [x.a, x.b].includes(p.id),
          );
          const turnsLeft = ceasefire?.untilTurn ? Math.max(0, ceasefire.untilTurn - state.turn) : 0;
          const provs = provincesOf(state, p.id).length;
          const troops = provincesOf(state, p.id).reduce((t, id) => t + state.provinces[id].troops, 0);
          const pct = (rel + 100) / 2; // 0..100 for the bar

          return (
            <div key={p.id} className="dipl-card" style={{ borderColor: faction?.color ?? "#555" }}>
              <div className="dipl-top">
                <span className="dipl-name" style={{ color: faction?.color }}>{p.name}</span>
                <span className="dipl-might">{provs} prov · {troops.toLocaleString()}</span>
              </div>

              <div className="dipl-status">
                {allied ? <span className="pact ally">Allied</span>
                  : truce ? <span className="pact truce">Ceasefire · {turnsLeft}s</span>
                  : <span className="pact none">{standing(rel)}</span>}
              </div>

              <div className="rel-bar"><div className="rel-fill" style={{ width: `${pct}%` }} /></div>

              <div className="dipl-acts">
                {allied || truce ? (
                  <button className="danger" disabled={!canAct} onClick={() => game.breakPact(p.id)}>Break Pact</button>
                ) : (
                  <>
                    <button disabled={!canPropose} onClick={() => game.proposePact(p.id, "ceasefire")}>Offer Ceasefire</button>
                    <button disabled={!canPropose} onClick={() => game.proposePact(p.id, "alliance")} title="Needs warm relations">Offer Alliance</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
