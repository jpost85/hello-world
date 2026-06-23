/**
 * The organic map. Renders each Han province from its real projected SVG path,
 * tinted by its controlling warlord, with sea routes, troop badges, and
 * selection / reachable-target highlighting. Pure presentation — it reads the
 * state and reports taps upward.
 */
import { useMemo } from "react";
import type { GameState } from "../engine/index.ts";

interface Props {
  state: GameState;
  humanId: string | null;
  selectedId: string | null;
  targetIds: string[];
  onSelect: (provinceId: string) => void;
}

const NEUTRAL = "#6b6357";

export function MapView({ state, humanId, selectedId, targetIds, onSelect }: Props) {
  const colorOf = useMemo(() => {
    const m = new Map(state.factions.map((f) => [f.id, f.color]));
    return (ownerId: string | null) => (ownerId ? m.get(ownerId) ?? NEUTRAL : NEUTRAL);
  }, [state.factions]);

  const posOf = useMemo(() => new Map(state.map.provinces.map((p) => [p.id, p.position])), [state.map]);
  const targets = new Set(targetIds);

  return (
    <svg className="map" viewBox={state.map.viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Map of China">
      <rect x={0} y={0} width="100%" height="100%" fill="#11202b" />

      {/* Sea / strait routes */}
      {(state.map.connectors ?? []).map(([a, b], i) => {
        const pa = posOf.get(a);
        const pb = posOf.get(b);
        if (!pa || !pb) return null;
        return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="connector" />;
      })}

      {/* Provinces */}
      {state.map.provinces.map((prov) => {
        const ps = state.provinces[prov.id];
        const selected = prov.id === selectedId;
        const isTarget = targets.has(prov.id);
        const mine = ps.ownerId === humanId;
        const cls = ["province", selected && "selected", isTarget && "target", mine && "mine"].filter(Boolean).join(" ");
        return (
          <path
            key={prov.id}
            d={prov.path}
            className={cls}
            fill={colorOf(ps.ownerId)}
            onClick={() => onSelect(prov.id)}
          />
        );
      })}

      {/* Badges */}
      {state.map.provinces.map((prov) => {
        const ps = state.provinces[prov.id];
        const { x, y } = prov.position;
        return (
          <g key={`b-${prov.id}`} className="badge" onClick={() => onSelect(prov.id)} pointerEvents="all">
            {ps.wallLevel > 0 && (
              <text x={x} y={y - 16} className="rampart" textAnchor="middle">
                {"⛫".repeat(Math.min(3, ps.wallLevel))}
              </text>
            )}
            <circle cx={x} cy={y} r={11} className="badge-bg" />
            <text x={x} y={y + 4} textAnchor="middle" className="badge-troops">
              {Math.round(ps.troops / 1000)}
            </text>
            <text x={x} y={y + 24} textAnchor="middle" className="badge-name">
              {prov.name.replace(/ Province| \(Capital\)/, "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
