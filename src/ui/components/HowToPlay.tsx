import { useEffect } from "react";

/** A dismissible rules overlay. Closes on backdrop click or the Escape key. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>How to Play</h2>
          <button onClick={onClose} title="Close">✕</button>
        </div>
        <div className="modal-body">
          <h3>Goal</h3>
          <p>
            Conquer the map. The last commander with territory standing wins. If no one achieves
            total domination, the player holding the most territory when the turn limit is reached
            takes victory.
          </p>

          <h3>Your turn, in three phases</h3>
          <p>
            <b>Reinforce</b> — Receive new armies (at least 3, plus one for every 3 territories you
            hold) and any region bonuses. Click your territories to place them, then trade in any
            Conquest Card sets you wish.
          </p>
          <p>
            <b>Attack</b> — Click one of your territories (2+ armies), then an adjacent enemy, and
            roll. Keep attacking as long as you like. Conquer at least one territory this turn to
            earn a Conquest Card.
          </p>
          <p>
            <b>Fortify</b> — Make one move of armies between connected territories you own, then end
            your turn.
          </p>

          <h3>Region bonuses</h3>
          <p>
            Hold every territory in a region at the start of your turn to collect its bonus armies.
            Larger or more exposed regions are worth more.
          </p>

          <h3>Combat &amp; dice styles</h3>
          <p>
            The attacker rolls up to 3 dice, the defender up to 2. Highest dice are compared in
            pairs; the defender wins ties. Pick a style each roll:
          </p>
          <ul>
            <li><b>Standard</b> — the classic odds.</li>
            <li><b>Aggressive</b> (attack) — you win ties; (defense) — +1 to your best die.</li>
            <li><b>Cautious</b> — roll one fewer die for steadier, lower-loss exchanges.</li>
          </ul>

          <h3>Generals &amp; fortresses</h3>
          <p>
            A <b>general</b> adds +1 to its side's best die while stationed. Move it during Reinforce
            or Fortify. A <b>fortress</b> gives the defender an extra die — build one by spending two
            armies from a territory's garrison.
          </p>

          <h3>Conquest Cards</h3>
          <p>
            Earn one card on any turn you capture territory. Each shows Infantry 🪖, Cavalry 🐎, or
            Artillery 💣 (plus ⭐ wilds). Trade a set of <b>three alike</b>, <b>three different</b>,
            or any set <b>using a wild</b> for bonus armies. Each set traded is worth more than the
            last. Hold five or more cards and you must trade a set on your turn.
          </p>
        </div>
      </div>
    </div>
  );
}
