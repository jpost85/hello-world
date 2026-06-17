import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameState } from "../../engine/index.ts";

// Fallback canvas size for legacy maps whose positions are normalised to [0, 1].
const NORM_W = 1000;
const NORM_H = 620;
const R = 17;
const MAX_ZOOM = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
  const [vbW, vbH] = useMemo(() => {
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

  // --- Pan & zoom ----------------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  // Active touch/mouse pointers and the gesture in progress (pan or pinch).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { type: "pan"; startX: number; startY: number; viewX: number; viewY: number }
    | { type: "pinch"; startDist: number; startMidX: number; startMidY: number; startView: { x: number; y: number; k: number } }
    | null
  >(null);
  const draggedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Reset the view whenever the map changes (e.g. switching boards).
  useEffect(() => {
    setView({ x: 0, y: 0, k: 1 });
  }, [state.map.id]);

  // Convert client (screen) coordinates into the SVG's user space.
  const clientToSvg = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // Keep the scaled content covering the viewport (no panning into empty space).
  const clampPan = useCallback(
    (x: number, y: number, k: number): [number, number] => [
      clamp(x, vbW * (1 - k), 0),
      clamp(y, vbH * (1 - k), 0),
    ],
    [vbW, vbH],
  );

  const zoomAround = useCallback(
    (px: number, py: number, factor: number) => {
      setView((v) => {
        const k = clamp(v.k * factor, 1, MAX_ZOOM);
        const [x, y] = clampPan(px - ((px - v.x) / v.k) * k, py - ((py - v.y) / v.k) * k, k);
        return { x, y, k };
      });
    },
    [clampPan],
  );

  // Wheel zoom (native, non-passive so we can preventDefault the page scroll).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = clientToSvg(e.clientX, e.clientY);
      if (p) zoomAround(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [clientToSvg, zoomAround]);

  // Drag to pan and two-finger pinch to zoom. Window listeners keep a gesture
  // alive outside the SVG; pointercancel ends interrupted touches cleanly.
  useEffect(() => {
    const beginPinch = () => {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      gesture.current = {
        type: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
        startView: { ...viewRef.current },
      };
      draggedRef.current = true;
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = clientToSvg(e.clientX, e.clientY);
      if (!p) return;
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      if (!g) return;

      if (g.type === "pinch") {
        const pts = [...pointers.current.values()];
        if (pts.length < 2) return;
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const k = clamp(g.startView.k * (dist / g.startDist), 1, MAX_ZOOM);
        const cmx = (g.startMidX - g.startView.x) / g.startView.k;
        const cmy = (g.startMidY - g.startView.y) / g.startView.k;
        const [x, y] = clampPan(midX - cmx * k, midY - cmy * k, k);
        setView({ x, y, k });
        draggedRef.current = true;
      } else {
        const dx = p.x - g.startX;
        const dy = p.y - g.startY;
        if (!draggedRef.current && Math.hypot(dx, dy) > 3) {
          draggedRef.current = true;
          setDragging(true);
        }
        if (!draggedRef.current) return;
        setView((v) => {
          const [x, y] = clampPan(g.viewX + dx, g.viewY + dy, v.k);
          return { x, y, k: v.k };
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const remaining = [...pointers.current.values()];
      if (remaining.length === 1) {
        // Dropped from a pinch to one finger — resume panning seamlessly.
        gesture.current = {
          type: "pan",
          startX: remaining[0].x,
          startY: remaining[0].y,
          viewX: viewRef.current.x,
          viewY: viewRef.current.y,
        };
      } else if (remaining.length >= 2) {
        beginPinch();
      } else {
        gesture.current = null;
        setDragging(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clientToSvg, clampPan]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size >= 2) {
      // Second finger down → start a pinch from the current two pointers.
      const pts = [...pointers.current.values()];
      const [a, b] = pts;
      gesture.current = {
        type: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
        startView: { ...viewRef.current },
      };
      draggedRef.current = true;
      setDragging(true);
    } else {
      draggedRef.current = false;
      gesture.current = {
        type: "pan",
        startX: p.x,
        startY: p.y,
        viewX: viewRef.current.x,
        viewY: viewRef.current.y,
      };
    }
  };

  // Suppress the territory click that follows a drag.
  const handleTerritoryClick = (id: string) => {
    if (draggedRef.current) return;
    onClick(id);
  };

  const zoomButton = (factor: number) => zoomAround(vbW / 2, vbH / 2, factor);

  // The drawn map (ocean) rectangle inside the parchment frame.
  const area = state.map.mapArea ?? { x: 0, y: 0, width: vbW, height: vbH };

  return (
    <div className="board">
      <svg
        ref={svgRef}
        className={dragging ? "grabbing" : "grab"}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
      >
        <defs>
          <radialGradient id="parchment" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0" stopColor="#efe3c4" />
            <stop offset="0.7" stopColor="#e2d2a8" />
            <stop offset="1" stopColor="#cab48a" />
          </radialGradient>
          <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
            <stop offset="0.62" stopColor="#000000" stopOpacity="0" />
            <stop offset="1" stopColor="#2a1808" stopOpacity="0.5" />
          </radialGradient>
          <filter id="paperGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.36  0 0 0 0 0.27  0 0 0 0 0.13  0 0 0 0.5 0"
            />
          </filter>
          <filter id="torn">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="16" />
          </filter>
        </defs>
        {/* Parchment sheet (fixed behind the map). */}
        <rect x={0} y={0} width="100%" height="100%" fill="url(#parchment)" />
        <rect className="paper-grain" x={0} y={0} width="100%" height="100%" filter="url(#paperGrain)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {/* Scorched edge around the drawn map, then the ocean over the parchment. */}
        <rect
          className="burnt-edge"
          x={area.x - 10}
          y={area.y - 10}
          width={area.width + 20}
          height={area.height + 20}
          filter="url(#torn)"
        />
        <rect className="ocean" x={area.x} y={area.y} width={area.width} height={area.height} />
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
            <g key={t.id} className={classes.join(" ")} onClick={() => handleTerritoryClick(t.id)}>
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
        </g>
        {/* Aged darkening at the sheet's edges (fixed). */}
        <rect className="vignette" x={0} y={0} width="100%" height="100%" fill="url(#vignette)" />
      </svg>
      <div className="zoom-controls">
        <button title="Zoom in" onClick={() => zoomButton(1.4)}>+</button>
        <button title="Zoom out" onClick={() => zoomButton(1 / 1.4)}>−</button>
        <button title="Reset view" onClick={() => setView({ x: 0, y: 0, k: 1 })}>⤢</button>
      </div>
    </div>
  );
}
