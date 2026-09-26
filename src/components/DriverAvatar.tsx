// Stylised driver "bubble": a circle in the driver's colour holding a
// side-profile helmet glyph. Original artwork — real driver photos are
// copyrighted, and the project uses no F1 or team imagery.

/** Helmet glyph paths in a 24x24 box, facing right. */
export function HelmetGlyph({ color }: { color: string }) {
  return (
    <g>
      {/* shell */}
      <path
        d="M4.6 16.6 v-3.4 a7.6 7.6 0 0 1 15.2 -0.4 l0.1 2.2 -1.1 0.5 0.7 1.1 -0.7 1.6 h-13 a1.2 1.2 0 0 1 -1.2 -1.2 z"
        fill={color}
      />
      {/* visor slot */}
      <path
        d="M11.6 10.4 h7.6 a0.9 0.9 0 0 1 0.9 1 l-0.15 1.2 a1 1 0 0 1 -1 0.9 h-6.5 a1.4 1.4 0 0 1 -1.35 -1.6 a1.45 1.45 0 0 1 0.5 -1.5 z"
        fill="var(--bg)"
        opacity="0.88"
      />
      {/* rear vent stripe */}
      <path d="M6.4 8.2 a7.4 7.4 0 0 1 3 -2.4 l0.7 1.3 a5.9 5.9 0 0 0 -2.5 2 z" fill="var(--bg)" opacity="0.35" />
    </g>
  );
}

/** Standalone avatar for HTML contexts (cards, headers). */
export default function DriverAvatar({
  color,
  size = 36,
  title,
}: {
  color: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      style={{ flex: 'none' }}
    >
      {title && <title>{title}</title>}
      <circle cx="12" cy="12" r="11.2" fill={color} opacity="0.14" />
      <circle cx="12" cy="12" r="11.2" fill="none" stroke={color} strokeWidth="1.4" />
      <HelmetGlyph color={color} />
    </svg>
  );
}

/**
 * Raw SVG group for use INSIDE an existing chart svg (e.g. a Recharts dot
 * renderer): bubble centred on (cx, cy).
 */
export function AvatarBubble({
  cx,
  cy,
  r = 9,
  color,
}: {
  cx: number;
  cy: number;
  r?: number;
  color: string;
}) {
  const scale = (r * 2) / 24;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.5} fill="var(--surface)" />
      <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.16" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.4" />
      <g transform={`translate(${cx - r}, ${cy - r}) scale(${scale})`}>
        <HelmetGlyph color={color} />
      </g>
    </g>
  );
}
