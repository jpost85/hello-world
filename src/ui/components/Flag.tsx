import type { ReactNode } from "react";

/**
 * Compact, historically-flavoured faction flags drawn as inline SVG (viewBox
 * 0 0 60 40) — no image assets, so they stay in the single-file build. These are
 * recognizable period approximations (Napoleonic / colonial / Crimean era), not
 * pixel-exact heraldry. Unknown ids (generic / neutral factions) fall back to a
 * solid colour drawn from the faction's map colour.
 */
const W = 60;
const H = 40;

const FLAGS: Record<string, ReactNode> = {
  // United Kingdom — Union Jack (simplified construction).
  britain: (
    <>
      <rect width={W} height={H} fill="#012169" />
      <path d="M0,0 60,40 M60,0 0,40" stroke="#fff" strokeWidth={8} />
      <path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" strokeWidth={3} />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth={12} />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth={7} />
    </>
  ),
  // France — tricolore.
  france: (
    <>
      <rect width={20} height={H} fill="#0055A4" />
      <rect x={20} width={20} height={H} fill="#fff" />
      <rect x={40} width={20} height={H} fill="#EF4135" />
    </>
  ),
  // Russia — white-blue-red civil ensign.
  russia: (
    <>
      <rect width={W} height={13.3} fill="#fff" />
      <rect y={13.3} width={W} height={13.4} fill="#0039A6" />
      <rect y={26.7} width={W} height={13.3} fill="#D52B1E" />
    </>
  ),
  // Austrian Empire — Habsburg black over gold.
  austria: (
    <>
      <rect width={W} height={20} fill="#1a1a1a" />
      <rect y={20} width={W} height={20} fill="#F2C200" />
    </>
  ),
  // Prussia — black over white.
  prussia: (
    <>
      <rect width={W} height={20} fill="#161616" />
      <rect y={20} width={W} height={20} fill="#fff" />
    </>
  ),
  // German Empire — black-white-red.
  germany: (
    <>
      <rect width={W} height={13.3} fill="#161616" />
      <rect y={13.3} width={W} height={13.4} fill="#fff" />
      <rect y={26.7} width={W} height={13.3} fill="#C8102E" />
    </>
  ),
  // Ottoman Empire — red with crescent and star.
  ottoman: (
    <>
      <rect width={W} height={H} fill="#C8102E" />
      <circle cx={26} cy={20} r={9} fill="#fff" />
      <circle cx={30} cy={20} r={7.2} fill="#C8102E" />
      <path d="M40 20 l5.5 1.8 -3.4 4.7 0 -5.8 -3.4 4.7z" fill="#fff" transform="rotate(18 41 20)" />
    </>
  ),
  // Spain — red-yellow-red (yellow double height).
  spain: (
    <>
      <rect width={W} height={10} fill="#AA151B" />
      <rect y={10} width={W} height={20} fill="#F1BF00" />
      <rect y={30} width={W} height={10} fill="#AA151B" />
    </>
  ),
  // Portugal (monarchy) — blue hoist, white fly.
  portugal: (
    <>
      <rect width={24} height={H} fill="#1B3A8B" />
      <rect x={24} width={36} height={H} fill="#fff" />
      <circle cx={24} cy={20} r={6} fill="none" stroke="#C8102E" strokeWidth={2.5} />
    </>
  ),
  // Netherlands — red-white-blue.
  netherlands: (
    <>
      <rect width={W} height={13.3} fill="#AE1C28" />
      <rect y={13.3} width={W} height={13.4} fill="#fff" />
      <rect y={26.7} width={W} height={13.3} fill="#21468B" />
    </>
  ),
  // Italy — green-white-red.
  italy: (
    <>
      <rect width={20} height={H} fill="#009246" />
      <rect x={20} width={20} height={H} fill="#fff" />
      <rect x={40} width={20} height={H} fill="#CE2B37" />
    </>
  ),
  // Sardinia / Savoy — white cross on red.
  sardinia: (
    <>
      <rect width={W} height={H} fill="#C8102E" />
      <rect x={26} y={6} width={8} height={28} fill="#fff" />
      <rect x={14} y={16} width={32} height={8} fill="#fff" />
    </>
  ),
  // Belgium — black-yellow-red.
  belgium: (
    <>
      <rect width={20} height={H} fill="#1a1a1a" />
      <rect x={20} width={20} height={H} fill="#FAE042" />
      <rect x={40} width={20} height={H} fill="#ED2939" />
    </>
  ),
  // Persia (Qajar) — green-white-red with a golden sun.
  persia: (
    <>
      <rect width={W} height={13.3} fill="#239F40" />
      <rect y={13.3} width={W} height={13.4} fill="#fff" />
      <rect y={26.7} width={W} height={13.3} fill="#DA0000" />
      <circle cx={30} cy={20} r={5.5} fill="#E0A92E" />
    </>
  ),

  // --- Minor / regional powers ---

  // Maratha — saffron (bhagwa) swallowtail.
  maratha: <polygon points="0,0 60,0 48,20 60,40 0,40" fill="#EF7D18" />,
  // Mysore — the Tiger of Mysore: orange field with black tiger stripes.
  mysore: (
    <>
      <rect width={W} height={H} fill="#D35400" />
      {[8, 20, 32, 44, 56].map((x) => (
        <path key={x} d={`M${x},40 L${x - 11},0`} stroke="#1a1a1a" strokeWidth={3.4} />
      ))}
    </>
  ),
  // Sikh Empire — saffron Nishan Sahib with a navy Khanda (approximated).
  sikh: (
    <>
      <rect width={W} height={H} fill="#E8861A" />
      <circle cx={30} cy={20} r={7} fill="none" stroke="#13294b" strokeWidth={2.5} />
      <rect x={28.5} y={5} width={3} height={30} fill="#13294b" />
    </>
  ),
  // Mughal Empire — green with a gold crescent.
  mughal: (
    <>
      <rect width={W} height={H} fill="#14753F" />
      <circle cx={32} cy={20} r={8} fill="#E0B13A" />
      <circle cx={36} cy={20} r={6.5} fill="#14753F" />
    </>
  ),
  // Mamluk Sultanate — gold with a white crescent.
  mamluks: (
    <>
      <rect width={W} height={H} fill="#C9A23A" />
      <circle cx={30} cy={20} r={8} fill="#fff" />
      <circle cx={26} cy={20} r={6.5} fill="#C9A23A" />
    </>
  ),
  // Khedivate of Egypt — red with white crescent and three stars.
  egypt: (
    <>
      <rect width={W} height={H} fill="#B81C1C" />
      <circle cx={25} cy={20} r={8} fill="#fff" />
      <circle cx={28} cy={20} r={6.5} fill="#B81C1C" />
      <circle cx={41} cy={13} r={1.6} fill="#fff" />
      <circle cx={44} cy={20} r={1.6} fill="#fff" />
      <circle cx={41} cy={27} r={1.6} fill="#fff" />
    </>
  ),
  // Ethiopia — green-yellow-red with a golden emblem.
  ethiopia: (
    <>
      <rect width={W} height={13.3} fill="#078930" />
      <rect y={13.3} width={W} height={13.4} fill="#FCDD09" />
      <rect y={26.7} width={W} height={13.3} fill="#DA121A" />
      <circle cx={30} cy={20} r={5} fill="#0a2a66" />
    </>
  ),
  // Boer Republics — the Transvaal Vierkleur.
  boers: (
    <>
      <rect width={W} height={13.3} fill="#DE2910" />
      <rect y={13.3} width={W} height={13.4} fill="#fff" />
      <rect y={26.7} width={W} height={13.3} fill="#002395" />
      <rect width={16} height={H} fill="#007A3D" />
    </>
  ),
};

export function Flag({
  id,
  color,
  size = 22,
}: {
  id: string;
  color: string;
  size?: number;
}) {
  return (
    <svg
      className="flag"
      width={size}
      height={(size * H) / W}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      {FLAGS[id] ?? <rect width={W} height={H} fill={color} />}
    </svg>
  );
}
