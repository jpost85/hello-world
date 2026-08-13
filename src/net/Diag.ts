/**
 * Connection diagnostics: watches an RTCPeerConnection's ICE negotiation and
 * narrates it in plain language, so "we couldn't connect" becomes "your
 * network never found a relay path". Pure observation — changes nothing.
 *
 * Path types, in order of niceness:
 *   host  — a direct local address (same network)
 *   srflx — your public address discovered via STUN (direct over the internet)
 *   relay — a TURN relay address (traffic forwarded through a relay server)
 */

interface Seen {
  host: boolean;
  srflx: boolean;
  relay: boolean;
  gatheringDone: boolean;
}

export function watchPeerConnection(
  pc: RTCPeerConnection,
  onLine: (line: string) => void,
): void {
  const seen: Seen = { host: false, srflx: false, relay: false, gatheringDone: false };

  const mark = (b: boolean): string => (b ? "✓" : seen.gatheringDone ? "✗" : "…");
  const gatherLine = (): string =>
    `paths: local ${mark(seen.host)} · stun ${mark(seen.srflx)} · relay ${mark(seen.relay)}`;

  pc.addEventListener("icecandidate", (e) => {
    const c = e.candidate;
    if (!c) {
      seen.gatheringDone = true;
      onLine(gatherLine());
      return;
    }
    const t = c.type ?? typeFromSdp(c.candidate);
    if (t === "host") seen.host = true;
    else if (t === "srflx" || t === "prflx") seen.srflx = true;
    else if (t === "relay") seen.relay = true;
    onLine(gatherLine());
  });

  pc.addEventListener("icegatheringstatechange", () => {
    if (pc.iceGatheringState === "complete") {
      seen.gatheringDone = true;
      onLine(gatherLine());
    }
  });

  let reportedOutcome = false;
  pc.addEventListener("iceconnectionstatechange", () => {
    const s = pc.iceConnectionState;
    if ((s === "connected" || s === "completed") && !reportedOutcome) {
      reportedOutcome = true;
      void describeSelectedPair(pc).then((detail) => onLine(`Connected — ${detail}`));
    } else if (s === "failed") {
      reportedOutcome = true;
      seen.gatheringDone = true;
      const why = !seen.relay
        ? "no relay path was found (TURN servers unreachable from this network) and direct paths failed"
        : "every path failed, even the relay — this network blocks peer-to-peer traffic outright";
      onLine(`Failed — ${why}. ${gatherLine()}`);
    }
  });
}

/** Explain which candidate pair actually carries the connection. */
async function describeSelectedPair(pc: RTCPeerConnection): Promise<string> {
  try {
    const stats = await pc.getStats();
    const byId = new Map<string, Record<string, unknown>>();
    stats.forEach((r) => byId.set((r as { id: string }).id, r as Record<string, unknown>));

    let pair: Record<string, unknown> | undefined;
    stats.forEach((r) => {
      const rec = r as Record<string, unknown>;
      if (rec.type === "transport" && typeof rec.selectedCandidatePairId === "string") {
        pair = byId.get(rec.selectedCandidatePairId);
      }
    });
    if (!pair) {
      stats.forEach((r) => {
        const rec = r as Record<string, unknown>;
        if (rec.type === "candidate-pair" && rec.state === "succeeded" && (rec.nominated || !pair)) {
          pair = rec;
        }
      });
    }
    if (!pair) return "path details unavailable";

    const local = byId.get(pair.localCandidateId as string);
    const remote = byId.get(pair.remoteCandidateId as string);
    const lt = (local?.candidateType as string) ?? "?";
    const rt = (remote?.candidateType as string) ?? "?";
    const proto = typeof local?.protocol === "string" ? ` · ${(local.protocol as string).toUpperCase()}` : "";

    const kind =
      lt === "relay" || rt === "relay"
        ? "via TURN relay"
        : lt === "host" && rt === "host"
          ? "direct (same network)"
          : "direct (via STUN)";
    return `${kind}${proto} (${lt}↔${rt})`;
  } catch {
    return "path details unavailable";
  }
}

/** Fallback for browsers that omit RTCIceCandidate.type. */
function typeFromSdp(sdp: string): string {
  const m = /\btyp\s+(\w+)/.exec(sdp);
  return m ? m[1] : "";
}
