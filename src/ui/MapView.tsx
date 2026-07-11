/**
 * The organic map. Renders each Han province from its real projected SVG path,
 * tinted by its controlling warlord, with sea routes, troop badges, and
 * selection / reachable-target highlighting.
 *
 * Pan & zoom: the board is small and dense on a phone, so all content lives
 * under a single transformed <g> the player can pinch, drag, wheel, or
 * double-tap to zoom, with +/- and reset controls. Panning is distinguished
 * from tapping by a small movement threshold, so dragging never mis-selects a
 * province. Pure presentation — it reads state and reports taps upward.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../engine/index.ts";

interface Props {
  state: GameState;
  humanId: string | null;
  selectedId: string | null;
  targetIds: string[];
  onSelect: (provinceId: string) => void;
}

const NEUTRAL = "#6b6357";
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const TAP_SLOP = 6; // px of movement below which a press is a tap, not a drag

interface View {
  s: number;
  x: number;
  y: number;
}

function parseViewBox(vb: string | undefined): [number, number, number, number] {
  const parts = (vb ?? "0 0 1000 1000").split(/[\s,]+/).map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 1000, parts[3] || 1000];
}

export function MapView({ state, humanId, selectedId, targetIds, onSelect }: Props) {
  const colorOf = useMemo(() => {
    const m = new Map(state.factions.map((f) => [f.id, f.color]));
    return (ownerId: string | null) => (ownerId ? m.get(ownerId) ?? NEUTRAL : NEUTRAL);
  }, [state.factions]);

  const posOf = useMemo(() => new Map(state.map.provinces.map((p) => [p.id, p.position])), [state.map]);
  const targets = new Set(targetIds);

  const [minX, minY, W, H] = useMemo(() => parseViewBox(state.map.viewBox), [state.map.viewBox]);
  const center = useMemo(() => ({ x: minX + W / 2, y: minY + H / 2 }), [minX, minY, W, H]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setViewState] = useState<View>({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
  }, []);

  // Active pointers (id -> last client position) for pan / pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const gestureStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  // Map a screen point into the SVG's viewBox coordinate space.
  const clientToView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // Keep the content covering the viewport (no panning into the void).
  const clampT = useCallback(
    (x: number, y: number, s: number) => {
      const xLo = (minX + W) * (1 - s);
      const xHi = minX * (1 - s);
      const yLo = (minY + H) * (1 - s);
      const yHi = minY * (1 - s);
      return { x: Math.min(xHi, Math.max(xLo, x)), y: Math.min(yHi, Math.max(yLo, y)) };
    },
    [minX, minY, W, H],
  );

  // Zoom by `factor` keeping the point `focal` (viewBox coords) under the cursor.
  const zoomBy = useCallback(
    (factor: number, focal: { x: number; y: number }) => {
      const v = viewRef.current;
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
      const f = s / v.s;
      const t = clampT(focal.x - f * (focal.x - v.x), focal.y - f * (focal.y - v.y), s);
      setView({ s, x: t.x, y: t.y });
    },
    [clampT, setView],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = viewRef.current;
      const t = clampT(v.x + dx, v.y + dy, v.s);
      setView({ s: v.s, x: t.x, y: t.y });
    },
    [clampT, setView],
  );

  const reset = useCallback(() => setView({ s: 1, x: 0, y: 0 }), [setView]);

  // Wheel zoom (attached manually so we can preventDefault the page scroll).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, clientToView(e.clientX, e.clientY));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomBy, clientToView]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gestureStart.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
      moved.current = true; // a two-finger gesture is never a tap
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current) {
        const midView = clientToView((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomBy(dist / pinchDist.current, midView);
      }
      pinchDist.current = dist;
      return;
    }

    if (gestureStart.current) {
      const d = Math.hypot(e.clientX - gestureStart.current.x, e.clientY - gestureStart.current.y);
      if (d > TAP_SLOP) moved.current = true;
    }
    if (moved.current) {
      const from = clientToView(prev.x, prev.y);
      const to = clientToView(e.clientX, e.clientY);
      panBy(to.x - from.x, to.y - from.y);
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  // Suppress the click that follows a drag / pinch so it doesn't select.
  const guardedSelect = (id: string) => {
    if (moved.current) return;
    onSelect(id);
  };

  const transform = `translate(${view.x} ${view.y}) scale(${view.s})`;

  return (
    <div className="map-stage">
      <svg
        ref={svgRef}
        className="map"
        viewBox={state.map.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Map of China"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onDoubleClick={(e) => zoomBy(1.6, clientToView(e.clientX, e.clientY))}
      >
        <rect x={minX} y={minY} width={W} height={H} fill="#11202b" />

        <g transform={transform}>
          {/* Sea / strait routes */}
          {(state.map.connectors ?? []).map(([a, b], i) => {
            const pa = posOf.get(a);
            const pb = posOf.get(b);
            if (!pa || !pb) return null;
            return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="connector" vectorEffect="non-scaling-stroke" />;
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
                vectorEffect="non-scaling-stroke"
                onClick={() => guardedSelect(prov.id)}
              />
            );
          })}

          {/* Badges */}
          {state.map.provinces.map((prov) => {
            const ps = state.provinces[prov.id];
            const { x, y } = prov.position;
            return (
              <g key={`b-${prov.id}`} className="badge" onClick={() => guardedSelect(prov.id)} pointerEvents="all">
                {ps.wallLevel > 0 && (
                  <text x={x} y={y - 16} className="rampart" textAnchor="middle">
                    {"⛫".repeat(Math.min(3, ps.wallLevel))}
                  </text>
                )}
                <circle cx={x} cy={y} r={11} className="badge-bg" vectorEffect="non-scaling-stroke" />
                <text x={x} y={y + 4} textAnchor="middle" className="badge-troops">
                  {Math.round(ps.troops / 1000)}
                </text>
                <text x={x} y={y + 24} textAnchor="middle" className="badge-name">
                  {prov.name.replace(/ Province| \(Capital\)/, "")}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="zoom-controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.5, center)} disabled={view.s >= MAX_SCALE}>+</button>
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5, center)} disabled={view.s <= MIN_SCALE}>−</button>
        <button aria-label="Reset view" onClick={reset} disabled={view.s === 1}>⤢</button>
      </div>
    </div>
  );
}
