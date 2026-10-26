import { cn } from "@/lib/utils";

// The hero's chandelier (spec 0011 AC-3), copied from the Home board (`Main.dc.html`) with its
// colours mapped to tokens: yellow, the yellow tint, and the two drawing colours. Decorative.
const arms = [
  "M100 72C78 74 42 76 36 54",
  "M100 72C122 74 158 76 164 54",
  "M100 62C84 64 62 64 58 44",
  "M100 62C116 64 138 64 142 44",
] as const;

// Candle centres: the flame top sits 5 above `y`, the sleeve 6 below.
const candles = [
  { x: 36, y: 37 },
  { x: 164, y: 37 },
  { x: 58, y: 27 },
  { x: 142, y: 27 },
] as const;

// Crystal drops: the wire from `top` to `end`, beads at `beads`, then a diamond.
const drops = [
  { x: 50, top: 70, end: 96, beads: [74, 82, 90] },
  { x: 150, top: 70, end: 96, beads: [74, 82, 90] },
  { x: 72, top: 76, end: 94, beads: [80, 88] },
  { x: 128, top: 76, end: 94, beads: [80, 88] },
] as const;

export function HeroChandelier({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      width="200"
      height="160"
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none", className)}
    >
      <circle cx="100" cy="78" r="66" className="fill-yellow" opacity=".06" />
      <circle cx="100" cy="78" r="40" className="fill-yellow" opacity=".08" />
      <line x1="100" y1="0" x2="100" y2="34" className="stroke-illus-08" strokeWidth="2.4" />
      <rect x="95" y="30" width="10" height="6" rx="2" className="fill-yellow" />
      <path d="M93 42h14l-3 24h-8z" className="fill-yellow" />
      <circle cx="100" cy="68" r="5.5" className="fill-yellow" />
      {arms.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          className="stroke-yellow"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ))}
      {candles.map(({ x, y }) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="10" className="fill-yellow" opacity=".2" />
          <rect x={x - 3} y={y + 6} width="6" height="11" rx="1" className="fill-illus-09" />
          <path
            d={`M${x} ${y - 5}C${x + 4} ${y} ${x + 3} ${y + 5} ${x} ${y + 5}C${x - 3} ${y + 5} ${x - 4} ${y} ${x} ${y - 5}Z`}
            className="fill-yellow"
          />
        </g>
      ))}
      {drops.map(({ x, top, end, beads }) => (
        <g key={x}>
          <line x1={x} y1={top} x2={x} y2={end} className="stroke-illus-08" strokeWidth="1.2" />
          {beads.map((cy) => (
            <circle key={cy} cx={x} cy={cy} r="1.9" className="fill-yellow-tint" />
          ))}
          <path
            d={`M${x} ${end}L${x + 3.4} ${end + 5.5}L${x} ${end + 12}L${x - 3.4} ${end + 5.5}Z`}
            className="fill-yellow-tint"
          />
        </g>
      ))}
      <line x1="100" y1="72" x2="100" y2="116" className="stroke-illus-08" strokeWidth="1.4" />
      <circle cx="100" cy="84" r="2.2" className="fill-yellow-tint" />
      <circle cx="100" cy="96" r="2.2" className="fill-yellow-tint" />
      <path d="M100 116L107.48 128.1L100 142.4L92.52 128.1Z" className="fill-yellow-tint" />
    </svg>
  );
}
