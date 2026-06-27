import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameState } from "../../engine/index.ts";
import { FlagBadge } from "./Flag.tsx";

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

  // Map ownerId → { factionId, color } for the FlagBadge.
  const factionOf = useMemo(() => {
    const colorMap = new Map(state.factions.map((f) => [f.id, f.color]));
    return (ownerId: string | null): { id: string; color: string } => {
      if (!ownerId) return { id: "__none__", color: "#444" };
      const player = state.players.find((p) => p.id === ownerId);
      const fid = player?.factionId ?? "__none__";
      return { id: fid, color: colorMap.get(fid) ?? "#444" };
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

  // Army-count badges are scaled ~25% larger than the original sizes for
  // legibility (geo maps draw them smaller relative to their dense regions).
  const badgeScale = isGeo ? 0.6875 : 1.25;

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

  // Board container ref — used to read actual pixel dimensions for initial zoom.
  const boardRef = useRef<HTMLDivElement>(null);

  // Portrait mode: on narrow/tall screens we switch to `slice` so the map fills
  // the board height. The slice creates a horizontal window into the landscape
  // viewBox; overlayX is the left edge of that window in viewBox units.
  const [isPortrait, setIsPortrait] = useState(false);
  const portraitRef = useRef({ overlayX: 0, screenVbW: vbW });

  // Set the initial view when the map changes: zoom to fit the mapArea in the
  // visible board, centered. Uses RAF so layout is complete before measuring.
  useEffect(() => {
    const area = state.map.mapArea;
    const raf = requestAnimationFrame(() => {
      const el = boardRef.current;
      const bw = el?.clientWidth ?? vbW;
      const bh = el?.clientHeight ?? vbH;
      if (!bw || !bh) { setIsPortrait(false); setView({ x: 0, y: 0, k: 1 }); return; }

      const portrait = bw < bh;
      setIsPortrait(portrait);

      if (!area) { setView({ x: 0, y: 0, k: 1 }); return; }

      if (portrait) {
        // `slice` scales so the board HEIGHT is filled; the content overflows
        // horizontally and the user pans left/right to explore.
        const sliceScale = Math.max(bw / vbW, bh / vbH);
        const screenVbW  = bw / sliceScale;          // visible width in vb units
        const overlayX   = (vbW - screenVbW) / 2;   // left edge of visible window
        portraitRef.current = { overlayX, screenVbW };

        // Center the view on the mapArea centroid horizontally; k=1 fills height.
        const mcx = area.x + area.width  / 2;
        const mcy = area.y + area.height / 2;
        const k   = 1;
        const x   = clamp(overlayX + screenVbW / 2 - mcx * k,
                          overlayX + screenVbW - vbW * k, overlayX);
        const y   = clamp(vbH / 2 - mcy * k, vbH * (1 - k), 0);
        setView({ x, y, k });
      } else {
        portraitRef.current = { overlayX: 0, screenVbW: vbW };
        // `meet` fits the whole viewBox; zoom so mapArea fills ~88% of height.
        const meetScale = Math.min(bw / vbW, bh / vbH);
        const kFillH  = (bh * 0.88) / (area.height * meetScale);
        const kMaxPan = (bw * 2.0)  / (area.width  * meetScale);
        const k = Math.max(1, Math.min(4, Math.min(kFillH, kMaxPan)));
        const mcx = area.x + area.width  / 2;
        const mcy = area.y + area.height / 2;
        const x = clamp(vbW / 2 - mcx * k, vbW * (1 - k), 0);
        const y = clamp(vbH / 2 - mcy * k, vbH * (1 - k), 0);
        setView({ x, y, k });
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // In portrait/slice mode the horizontal bounds differ: the slice window is
  // centred at vbW/2, so valid tx ranges from (overlayX + screenVbW - vbW*k)
  // to overlayX rather than the meet-mode [vbW*(1-k), 0].
  const clampPan = useCallback(
    (x: number, y: number, k: number): [number, number] => {
      if (isPortrait) {
        const { overlayX, screenVbW } = portraitRef.current;
        return [
          clamp(x, overlayX + screenVbW - vbW * k, overlayX),
          clamp(y, vbH * (1 - k), 0),
        ];
      }
      return [
        clamp(x, vbW * (1 - k), 0),
        clamp(y, vbH * (1 - k), 0),
      ];
    },
    [vbW, vbH, isPortrait],
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
    <div className="board" ref={boardRef}>
      <svg
        ref={svgRef}
        className={dragging ? "grabbing" : "grab"}
        viewBox={viewBox}
        preserveAspectRatio={isPortrait ? "xMidYMid slice" : "xMidYMid meet"}
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
          <filter id="tornSheet" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="16" />
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
          </filter>
          <clipPath id="mapWindow">
            <rect x={area.x} y={area.y} width={area.width} height={area.height} />
          </clipPath>
        </defs>
        {/* Dark backdrop (the desk) behind the torn parchment sheet. */}
        <rect x={0} y={0} width="100%" height="100%" fill="#15110b" />
        {/* Parchment sheet with ragged, scorched outer edges (fixed behind the map). */}
        <g filter="url(#tornSheet)">
          <rect x={20} y={20} width={vbW - 40} height={vbH - 40} fill="url(#parchment)" />
          <rect
            className="paper-grain"
            x={20}
            y={20}
            width={vbW - 40}
            height={vbH - 40}
            filter="url(#paperGrain)"
          />
        </g>
        {/* Fixed ocean window — the sea showing through the frame. */}
        <rect className="ocean" x={area.x} y={area.y} width={area.width} height={area.height} />
        {/* The map layers pan/zoom INSIDE the fixed frame (clipped to the window). */}
        <g clipPath="url(#mapWindow)">
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {/* Backdrop: all world landmasses in a dull colour so non-playable land
            shows instead of bare ocean when panning near the map edges. */}
        {state.map.backdrop && (
          <path d={state.map.backdrop} fill="#9e9272" stroke="#7a7058" strokeWidth={0.5} />
        )}
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
              {/* Flag badge sits at the territory centroid. */}
              <g transform={`translate(${p.x},${p.y}) scale(${badgeScale})`}>
                <FlagBadge
                  id={factionOf(ts.ownerId).id}
                  color={factionOf(ts.ownerId).color}
                  armies={ts.armies}
                  hasFortress={ts.hasFortress}
                  hasGeneral={generalAt.has(t.id)}
                />
              </g>
            </g>
          );
        })}
        </g>
        </g>
        {/* Fixed scorched border framing the window (hides the clip edge). */}
        <rect
          className="burnt-frame"
          x={area.x}
          y={area.y}
          width={area.width}
          height={area.height}
          fill="none"
          filter="url(#torn)"
        />
        {/* Aged darkening at the sheet's edges (fixed). */}
        <rect className="vignette" x={0} y={0} width="100%" height="100%" fill="url(#vignette)" />
      </svg>
      <div className="zoom-controls">
        <button title="Zoom in" onClick={() => zoomButton(1.4)}>+</button>
        <button title="Zoom out" onClick={() => zoomButton(1 / 1.4)}>−</button>
        <button title="Reset view" onClick={() => {
          const area = state.map.mapArea;
          if (isPortrait && area) {
            const { overlayX, screenVbW } = portraitRef.current;
            const mcx = area.x + area.width / 2;
            const mcy = area.y + area.height / 2;
            setView({
              x: clamp(overlayX + screenVbW / 2 - mcx, overlayX + screenVbW - vbW, overlayX),
              y: clamp(vbH / 2 - mcy, vbH * (1 - 1), 0),
              k: 1,
            });
          } else {
            setView({ x: 0, y: 0, k: 1 });
          }
        }}>⤢</button>
      </div>
    </div>
  );
}
