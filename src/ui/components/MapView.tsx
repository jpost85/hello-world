import { useMemo } from "react";
import type { GameState } from "../../engine/index.ts";

const W = 1000;
const H = 620;
const R = 17;

interface Props {
  state: GameState;
  from: string | null;
  to: string | null;
  selectable: Set<string>;
  onClick: (id: string) => void;
}

export function MapView({ state, from, to, selectable, onClick }: Props) {
  const colorOf = useMemo(() => {
    const factionColor = new Map(state.factions.map((f) => [f.id, f.color]));
    return (ownerId: string | null) => {
      if (!ownerId) return "#444";
      const player = state.players.find((p) => p.id === ownerId);
      return factionColor.get(player?.factionId ?? "") ?? "#444";
    };
  }, [state.factions, state.players]);

  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const t of state.map.territories) {
      m.set(t.id, { x: t.position.x * W, y: t.position.y * H });
    }
    return m;
  }, [state.map]);

  // Build a de-duplicated edge list; skip wrap-around edges that would draw
  // a long line across the whole board (adjacency is still enforced in logic).
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const t of state.map.territories) {
      for (const adj of t.adjacentTo) {
        const key = [t.id, adj].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos.get(t.id)!;
        const b = pos.get(adj)!;
        if (Math.abs(a.x - b.x) > W * 0.45) continue;
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    return out;
  }, [state.map, pos]);

  const generalAt = useMemo(() => {
    const m = new Map<string, true>();
    for (const g of state.generals) if (g.territoryId) m.set(g.territoryId, true);
    return m;
  }, [state.generals]);

  return (
    <div className="board">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {edges.map((e, i) => (
          <line key={i} className="edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
        ))}
        {state.map.territories.map((t) => {
          const p = pos.get(t.id)!;
          const ts = state.territories[t.id];
          const classes = ["territory"];
          if (selectable.has(t.id)) classes.push("selectable");
          if (t.id === from || t.id === to) classes.push("selected");
          return (
            <g
              key={t.id}
              className={classes.join(" ")}
              onClick={() => onClick(t.id)}
              transform={`translate(${p.x},${p.y})`}
            >
              <circle r={R} fill={colorOf(ts.ownerId)} />
              <text>{ts.armies}</text>
              <text className="tname" y={R + 9}>
                {t.name}
              </text>
              {ts.hasFortress && (
                <text className="marker" x={-R} y={-R + 2}>
                  🏰
                </text>
              )}
              {generalAt.has(t.id) && (
                <text className="marker" x={R - 4} y={-R + 2}>
                  ⭐
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
