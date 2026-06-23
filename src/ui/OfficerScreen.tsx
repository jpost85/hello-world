/**
 * The Court screen — a full roster of the warlord's officers, the prisoners they
 * hold, and the wandering heroes within reach. This is the home of officer
 * management: read a retainer's stats, traits and treasures at a glance, court a
 * wandering hero or a captive into service, or decide a prisoner's fate.
 */
import type { ReactNode } from "react";
import {
  effectiveStats,
  recruitableIn,
  type GameState,
  type Officer,
  type OfficerTrait,
} from "../engine/index.ts";
import type { UseGame } from "./useGame.ts";

const TRAIT_LABEL: Record<OfficerTrait, string> = {
  valiant: "Valiant",
  strategist: "Strategist",
  administrator: "Administrator",
  farmer: "Farmer",
  orator: "Orator",
  cavalier: "Cavalier",
  archer: "Archer",
  admiral: "Admiral",
  pacifier: "Pacifier",
};

interface Props {
  state: GameState;
  humanId: string;
  isHumanTurn: boolean;
  game: UseGame;
  onClose: () => void;
}

export function OfficerScreen({ state, humanId, isHumanTurn, game, onClose }: Props) {
  const provName = (id: string | null) => (id ? state.map.provinces.find((p) => p.id === id)?.name ?? id : "—");
  const mine = Object.keys(state.provinces).filter((id) => state.provinces[id].ownerId === humanId);

  const court = state.officers
    .filter((o) => o.alive && o.ownerId === humanId)
    .sort((a, b) => b.war - a.war);
  const prisoners = state.officers.filter((o) => o.alive && o.captiveOf === humanId);
  const courtable = mine.flatMap((id) => recruitableIn(state, id, humanId)).filter((o) => o.captiveOf === null);
  const atLarge = state.officers.filter(
    (o) => o.alive && o.ownerId === null && o.captiveOf === null && !mine.includes(o.provinceId ?? ""),
  );

  const canAct = isHumanTurn;
  const canRecruit = isHumanTurn && state.commandPointsRemaining > 0;

  function Card({ o, children }: { o: Officer; children?: ReactNode }) {
    const s = effectiveStats(o);
    const items = o.items.map((id) => state.items.find((it) => it.id === id)?.name).filter(Boolean) as string[];
    return (
      <div className="court-card">
        <div className="court-top">
          <span className="court-name">{o.name}</span>
          <span className="court-loc">{provName(o.provinceId)}</span>
        </div>
        <div className="court-stats">
          <span title="War">武 {s.war}</span>
          <span title="Intellect">智 {s.intellect}</span>
          <span title="Politics">政 {s.politics}</span>
          <span title="Charisma">魅 {s.charisma}</span>
          <span title="Leadership">統 {s.leadership}</span>
          <span className={o.loyalty < 40 ? "loy low" : "loy"} title="Loyalty">忠 {o.loyalty}</span>
        </div>
        {(o.traits.length > 0 || items.length > 0) && (
          <div className="court-tags">
            {o.traits.map((t) => (
              <span key={t} className="tag trait">{TRAIT_LABEL[t]}</span>
            ))}
            {items.map((n) => (
              <span key={n} className="tag item">{n}</span>
            ))}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer court" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">Court · {court.length} officers <button onClick={onClose}>✕</button></div>

        {!isHumanTurn && <div className="panel-note">You may only treat with officers on your own turn.</div>}

        {prisoners.length > 0 && (
          <section className="court-section">
            <h3>Prisoners</h3>
            {prisoners.map((o) => (
              <Card key={o.id} o={o}>
                <div className="court-acts">
                  <button disabled={!canRecruit} onClick={() => game.recruitOfficer(o.provinceId!, o.id)}>Recruit</button>
                  <button disabled={!canAct} onClick={() => game.releasePrisoner(o.id)}>Release</button>
                  <button className="danger" disabled={!canAct} onClick={() => game.executePrisoner(o.id)}>Execute</button>
                </div>
              </Card>
            ))}
          </section>
        )}

        {courtable.length > 0 && (
          <section className="court-section">
            <h3>Heroes in your lands</h3>
            {courtable.map((o) => (
              <Card key={o.id} o={o}>
                <div className="court-acts">
                  <button disabled={!canRecruit} onClick={() => game.recruitOfficer(o.provinceId!, o.id)}>Recruit to court</button>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="court-section">
          <h3>Retainers</h3>
          {court.map((o) => (
            <Card key={o.id} o={o} />
          ))}
        </section>

        {atLarge.length > 0 && (
          <section className="court-section">
            <h3>Heroes at large</h3>
            <p className="hint">Seize their province to court them.</p>
            {atLarge.map((o) => (
              <div key={o.id} className="court-faint">
                <span>{o.name}</span>
                <span className="court-loc">{provName(o.provinceId)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
