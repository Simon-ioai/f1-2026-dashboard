import type { DriverView } from '../lib/driverInfo';

/**
 * Driver face circle per the handoff: photo cropped so the face fills ~58%
 * of the circle, falling back to the 3-letter code on the driver colour.
 * `ring` draws the two-layer halo (panel gap + driver colour); `ringBg`
 * names the surface the ring floats on (default --panel).
 */
export default function Face({
  d,
  size,
  ring = false,
  ringBg = 'var(--panel)',
  title,
}: {
  d: DriverView;
  size: number;
  ring?: boolean;
  ringBg?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: d.color,
        color: 'var(--on)',
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.max(7, Math.round(size * 0.28)),
        fontWeight: 900,
        flex: 'none',
        boxShadow: ring ? `0 0 0 2px ${ringBg}, 0 0 0 3.5px ${d.color}` : undefined,
      }}
    >
      {d.face ? (
        <span
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            backgroundRepeat: 'no-repeat',
            ...d.face,
          }}
        />
      ) : (
        <span>{d.code}</span>
      )}
    </span>
  );
}
