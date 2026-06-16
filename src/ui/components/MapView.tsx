import { useMemo } from "react";
import type { GameState } from "../../engine/index.ts";

// Fallback canvas size for legacy maps whose positions are normalised to [0, 1].
const NORM_W = 1000;
const NORM_H = 620;
const R = 17;

interface Props {
  state: GameState;
  from: string | null;
  to: string | null;
  selectable: Set<string>;
  onClick: (id: string) => void;
}

export function MapView({ state, from, to, selectable, onClick }: Props) {
  const isGeo = !!state.map.viewBox;
  const viewBox = state.map.viewBox ?? `0 0 ${NORM_W} ${NORM_H}`;

  const colorOf = useMemo(() => {
    const factionColor = new Map(state.factions.map((f) => [f.id, f.color]));
    return (ownerId: string | null) => {
      if (!ownerId) return "#444";
      const player = state.players.find((p) => p.id === ownerId);
      return factionColor.get(player?.factionId ?? "") ?? "#444";
    };
  }, [state.factions, state.players]);

  // Absolute badge position for a territory (geo maps store absolute coords).
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const t of state.map.territories) {
      m.set(
        t.id,
        isGeo
          ? { x: t.position.x, y: t.position.y }
          : { x: t.position.x * NORM_W, y: t.position.y * NORM_H },
      );
    }
    return m;
  }, [state.map, isGeo]);

  // Legacy circle maps draw adjacency lines; geo maps rely on shared borders.
  const edges = useMemo(() => {
    if (isGeo) return [];
    const seen = new Set<string>();
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const t of state.map.territories) {
      for (const adj of t.adjacentTo) {
        const key = [t.id, adj].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const a = pos.get(t.id)!;
        const b = pos.get(adj)!;
        if (Math.abs(a.x - b.x) > NORM_W * 0.45) continue;
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
    return out;
  }, [state.map, pos, isGeo]);

  const generalAt = useMemo(() => {
    const m = new Map<string, true>();
    for (const g of state.generals) if (g.territoryId) m.set(g.territoryId, true);
    return m;
  }, [state.generals]);

  // Sea routes drawn as dashed connecting lines. Long Pacific crossings (e.g.
  // Alaska↔Far East Russia) are split into two stubs that run off opposite edges.
  const [vbW] = useMemo(() => {
    const parts = viewBox.split(/\s+/).map(Number);
    return [parts[2] || NORM_W, parts[3] || NORM_H];
  }, [viewBox]);

  const seaLines = useMemo(() => {
    const links = state.map.connectors ?? [];
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const [a, b] of links) {
      const pa = pos.get(a);
      const pb = pos.get(b);
      if (!pa || !pb) continue;
      if (Math.abs(pa.x - pb.x) > vbW / 2) {
        const left = pa.x < pb.x ? pa : pb;
        const right = pa.x < pb.x ? pb : pa;
        segs.push({ x1: left.x, y1: left.y, x2: 0, y2: left.y });
        segs.push({ x1: right.x, y1: right.y, x2: vbW, y2: right.y });
      } else {
        segs.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
      }
    }
    return segs;
  }, [state.map.connectors, pos, vbW]);

  const badgeScale = isGeo ? 0.55 : 1;

  return (
    <div className="board">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {isGeo && <rect className="ocean" x={0} y={0} width="100%" height="100%" />}
        {state.map.decorations?.map((d, i) => (
          <g key={`decor-${i}`} className="decoration">
            <path d={d.path} fill={d.fill} />
            <text className="decor-label" x={d.position.x} y={d.position.y}>
              {d.name}
            </text>
          </g>
        ))}
        {edges.map((e, i) => (
          <line key={i} className="edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
        ))}
        {seaLines.map((e, i) => (
          <line key={`sea-${i}`} className="sea-link" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
        ))}
        {state.map.territories.map((t) => {
          const p = pos.get(t.id)!;
          const ts = state.territories[t.id];
          const classes = ["territory"];
          if (selectable.has(t.id)) classes.push("selectable");
          if (t.id === from || t.id === to) classes.push("selected");

          return (
            <g key={t.id} className={classes.join(" ")} onClick={() => onClick(t.id)}>
              <title>{t.name}</title>
              {t.path ? (
                <path d={t.path} fill={colorOf(ts.ownerId)} />
              ) : (
                <circle cx={p.x} cy={p.y} r={R} fill={colorOf(ts.ownerId)} />
              )}
              {/* Army-count badge sits at the territory centroid. */}
              <g transform={`translate(${p.x},${p.y}) scale(${badgeScale})`}>
                <circle className="badge-bg" r={11} />
                <text className="badge-text">{ts.armies}</text>
                {ts.hasFortress && (
                  <text className="marker" x={-13} y={-9}>
                    🏰
                  </text>
                )}
                {generalAt.has(t.id) && (
                  <text className="marker" x={5} y={-9}>
                    ⭐
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
