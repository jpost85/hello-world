/**
 * The bottom-sheet command panel for the selected province: its garrison and
 * economy, the officers stationed there, and the verbs available this season —
 * Develop / Recruit / Fortify on your own land, March on a neighbour, Scheme on
 * an adjacent rival. Thumb-reachable and one province at a time, by design.
 */
import { useEffect, useState } from "react";
import { recruitableIn, type GameState } from "../engine/index.ts";
import type { UseGame } from "./useGame.ts";

interface Props {
  state: GameState;
  humanId: string | null;
  isHumanTurn: boolean;
  selectedId: string | null;
  game: UseGame;
  onPickTarget: (provinceId: string) => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function ControlPanel({ state, humanId, isHumanTurn, selectedId, game, onPickTarget }: Props) {
  const [marchTo, setMarchTo] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  const prov = selectedId ? state.map.provinces.find((p) => p.id === selectedId) : null;
  const ps = selectedId ? state.provinces[selectedId] : null;

  useEffect(() => {
    setMarchTo(null);
  }, [selectedId]);

  if (!prov || !ps) {
    return <div className="panel empty">Tap a province to inspect it.</div>;
  }

  const ownerFaction = state.factions.find((f) => f.id === ps.ownerId);
  const mine = ps.ownerId === humanId;
  const officers = state.officers
    .filter((o) => o.provinceId === prov.id && o.ownerId === ps.ownerId)
    .sort((a, b) => b.war - a.war);
  const wandering = state.officers.filter((o) => o.provinceId === prov.id && o.ownerId === null);

  const recruitable = humanId && mine ? recruitableIn(state, prov.id, humanId) : [];
  const source = mine ? prov.id : null;
  const beginMarch = (to: string) => {
    setMarchTo(to);
    setAmount(Math.max(1, Math.round(ps.troops * 0.8)));
    onPickTarget(to);
  };

  return (
    <div className="panel">
      <header className="panel-head" style={{ borderColor: ownerFaction?.color ?? "#555" }}>
        <div>
          <div className="panel-title">{prov.name}</div>
          <div className="panel-sub">{ownerFaction ? ownerFaction.name : "Unclaimed"}</div>
        </div>
        <div className="troops-big">{ps.troops.toLocaleString()}<span> troops</span></div>
      </header>

      <div className="troop-line">
        <span className="branch">{ps.garrisonType}</span>
        <span>morale {ps.morale}</span>
        <span>training {ps.training}</span>
        <span>walls {ps.wallLevel}</span>
      </div>

      <div className="stats">
        <Stat label="Gold" value={ps.gold} />
        <Stat label="Food" value={ps.food} />
        <Stat label="Order" value={`${ps.order}%`} />
        <Stat label="Commerce" value={`${ps.commerce}%`} />
        <Stat label="Farming" value={`${ps.agriculture}%`} />
        <Stat label="People" value={`${ps.population}k`} />
      </div>

      {(officers.length > 0 || wandering.length > 0) && (
        <div className="officers">
          {officers.map((o) => (
            <span key={o.id} className="officer" title={`WAR ${o.war} · INT ${o.intellect} · POL ${o.politics} · LDR ${o.leadership} · LOY ${o.loyalty}`}>
              {o.name} <em>武{o.war}</em>
            </span>
          ))}
          {wandering.map((o) => (
            <span key={o.id} className="officer wandering" title="Wandering hero (unrecruited)">
              {o.name} ✦
            </span>
          ))}
        </div>
      )}

      {!isHumanTurn && <div className="panel-note">Awaiting the other warlords…</div>}

      {isHumanTurn && mine && (
        <>
          <div className="actions">
            <button onClick={() => game.develop(prov.id)}>Develop</button>
            <button onClick={() => game.cultivate(prov.id)}>Cultivate</button>
            <button onClick={() => game.recruit(prov.id)}>Recruit</button>
            <button onClick={() => game.train(prov.id)}>Train</button>
            <button onClick={() => game.fortify(prov.id)} disabled={ps.wallLevel >= 5}>Fortify</button>
          </div>
          {recruitable.length > 0 && (
            <div className="recruit-officers">
              {recruitable.map((o) => (
                <div key={o.id} className="recruit-row">
                  <span>{o.captiveOf ? `Prisoner: ${o.name}` : `Wandering: ${o.name}`}</span>
                  <span className="recruit-btns">
                    <button onClick={() => game.recruitOfficer(prov.id, o.id)}>Recruit</button>
                    {o.captiveOf && <button onClick={() => game.releasePrisoner(o.id)}>Release</button>}
                    {o.captiveOf && <button className="danger" onClick={() => game.executePrisoner(o.id)}>Execute</button>}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="march-targets">
            {prov.adjacentTo.map((to) => {
              const t = state.provinces[to];
              const hostile = t.ownerId !== humanId;
              const name = state.map.provinces.find((p) => p.id === to)!.name;
              return (
                <button key={to} className={hostile ? "march hostile" : "march"} onClick={() => beginMarch(to)}>
                  {hostile ? "Attack" : "Move"} → {name.replace(/ Province| \(Capital\)/, "")}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isHumanTurn && !mine && (
        <div className="actions">
          <button onClick={() => game.scheme(prov.id)}>Foment Unrest</button>
          {ps.ownerId && ps.ownerId !== humanId && (
            <>
              <button onClick={() => game.proposePact(ps.ownerId!, "ceasefire")}>Offer Ceasefire</button>
              <button onClick={() => game.proposePact(ps.ownerId!, "alliance")}>Offer Alliance</button>
            </>
          )}
          <span className="hint">Schemes need a bordering province of yours.</span>
        </div>
      )}

      {isHumanTurn && source && marchTo && (
        <div className="march-dialog">
          <div className="march-head">
            March to {state.map.provinces.find((p) => p.id === marchTo)!.name}: <strong>{amount.toLocaleString()}</strong>
          </div>
          <input
            type="range"
            min={1}
            max={state.provinces[source].troops}
            value={Math.min(amount, state.provinces[source].troops)}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <div className="march-buttons">
            <button className="confirm" onClick={() => { game.march(source, marchTo, amount); setMarchTo(null); }}>
              Send
            </button>
            <button onClick={() => setMarchTo(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
