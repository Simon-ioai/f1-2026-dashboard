// Two teammate cars on one strip, the median qualifying gap drawn as real
// distance: the faster car leads, the slower trails by a proportional offset.
// Original simplified F1 silhouette — no team liveries or logos.

const CAR_W = 92;
const STRIP_W = 320;
const STRIP_H = 56;
/** A full strip of offset represents this many milliseconds of gap. */
const FULL_SCALE_MS = 500;

function CarGlyph({ color, opacity = 1 }: { color: string; opacity?: number }) {
  // 92x24 box, nose facing right
  return (
    <g opacity={opacity}>
      {/* rear wing */}
      <path d="M1 2 h4 v10 l-3 1 z" fill={color} />
      {/* body: engine cover -> cockpit -> nose */}
      <path
        d="M4 15 l8 -1 c2 -6 6 -9 12 -9 l8 1 5 5 12 1 20 2 22 1 c1 0 1.6 0.8 1.4 1.8 L92 19 l-6 2 H10 c-3 0 -6 -2 -6 -6 z"
        fill={color}
      />
      {/* halo */}
      <path d="M26 6 c4 -3.5 9 -3.5 12 0 l-2 1.6 c-2.4 -2.4 -6 -2.4 -8 0 z" fill={color} />
      {/* front wing */}
      <path d="M84 18 h8 v3 h-10 z" fill={color} />
      {/* wheels */}
      <circle cx="18" cy="19" r="5" fill="var(--ink)" opacity="0.85" />
      <circle cx="18" cy="19" r="2" fill={color} />
      <circle cx="70" cy="19" r="5" fill="var(--ink)" opacity="0.85" />
      <circle cx="70" cy="19" r="2" fill={color} />
    </g>
  );
}

export default function CarDuel({
  gapMs,
  primaryColor,
  partnerColor,
  primaryCode,
  partnerCode,
}: {
  gapMs: number; // signed: negative = primary faster
  primaryColor: string;
  partnerColor: string;
  primaryCode: string | null;
  partnerCode: string | null;
}) {
  const range = STRIP_W - CAR_W - 12;
  const offset = Math.min(Math.abs(gapMs), FULL_SCALE_MS) / FULL_SCALE_MS;
  // Leader parked at the right edge; the trailer sits behind by the gap
  // (never fully overlapping thanks to a minimum visual separation).
  const leadX = STRIP_W - CAR_W - 4;
  const trailX = leadX - Math.max(offset * range * 0.85, 14);
  const primaryLeads = gapMs < 0;
  const [frontX, backX] = [leadX, trailX];
  const front = primaryLeads
    ? { color: primaryColor, code: primaryCode }
    : { color: partnerColor, code: partnerCode };
  const back = primaryLeads
    ? { color: partnerColor, code: partnerCode }
    : { color: primaryColor, code: primaryCode };

  return (
    <svg
      viewBox={`0 0 ${STRIP_W} ${STRIP_H}`}
      width="100%"
      role="img"
      aria-label={`${front.code} ahead of ${back.code} by ${(Math.abs(gapMs) / 1000).toFixed(3)}s median`}
    >
      {/* track surface + start line */}
      <line x1="0" y1="46" x2={STRIP_W} y2="46" stroke="var(--chart-axis)" strokeWidth="1.5" />
      <line x1={STRIP_W - 3} y1="34" x2={STRIP_W - 3} y2="46" stroke="var(--chart-grid)" strokeDasharray="2.5 2.5" strokeWidth="2" />
      {/* trailing car (drawn first, behind); keep its label clear of the leader's */}
      <g transform={`translate(${backX}, 20)`}>
        <CarGlyph color={back.color} opacity={0.92} />
      </g>
      <text
        x={Math.min(backX + 2, frontX - 34)}
        y="14"
        fontSize="9.5"
        fontWeight="700"
        fill="var(--ink-muted)"
      >
        {back.code}
      </text>
      {/* leading car */}
      <g transform={`translate(${frontX}, 20)`}>
        <CarGlyph color={front.color} />
      </g>
      <text x={frontX + 2} y="14" fontSize="9.5" fontWeight="700" fill="var(--ink-muted)">
        {front.code}
      </text>
    </svg>
  );
}
