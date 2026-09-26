// Driver identity for the redesign: short keys (used for CSS variables and
// face files), portrait crop data, and helpers. Crop values and maths come
// from the design handoff. Any driver without an entry falls back to a
// coloured circle with their 3-letter code.

/** jolpica driverId -> short key used by tokens (--ant) and faces (ant.jpg). */
const SHORT: Record<string, string> = {
  antonelli: 'ant',
  russell: 'rus',
  hamilton: 'ham',
  leclerc: 'lec',
  norris: 'nor',
  max_verstappen: 'ver',
  piastri: 'pia',
  hadjar: 'had',
  lawson: 'law',
  field: 'field',
};

/** [face centre x, face centre y, face width, aspect ratio h/w] — fractions of the image. */
const FACE: Record<string, [number, number, number, number]> = {
  ant: [0.5, 0.31, 0.3, 1.415],
  rus: [0.53, 0.29, 0.25, 1.2],
  ham: [0.56, 0.2, 0.25, 1.57],
  lec: [0.56, 0.3, 0.33, 1.333],
  nor: [0.48, 0.24, 0.28, 1.233],
  ver: [0.59, 0.24, 0.28, 1.321],
  pia: [0.43, 0.23, 0.25, 1.333],
  had: [0.5, 0.22, 0.3, 1.348],
  law: [0.5, 0.28, 0.35, 1.5],
};

export interface DriverView {
  /** short key, e.g. 'ant' */
  key: string;
  code: string;
  /** CSS colour reference, e.g. 'var(--ant)' */
  color: string;
  /** portrait background styles, or null -> render the code instead */
  face: { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | null;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v * 100)).toFixed(1);

/** Build the view-model for any driverId (tracked or not). */
export function driverView(driverId: string, code?: string | null): DriverView {
  const key = SHORT[driverId] ?? driverId.slice(0, 3);
  const known = key in FACE;
  const crop = FACE[key];
  let face: DriverView['face'] = null;
  if (known && crop) {
    const [fx, fy, fw, ar] = crop;
    const z = 0.58 / fw; // face fills ~58% of the circle
    face = {
      backgroundImage: `url(${import.meta.env.BASE_URL}faces/${key}.jpg)`,
      backgroundSize: `${(z * 100).toFixed(0)}% auto`,
      backgroundPosition: `${clamp((0.5 - fx * z) / (1 - z))}% ${clamp((0.5 - fy * z * ar) / (1 - z * ar))}%`,
    };
  }
  return {
    key,
    code: code ?? (driverId === 'field' ? 'FLD' : key.toUpperCase()),
    color: SHORT[driverId] ? `var(--${key})` : 'var(--field)',
    face,
  };
}

export function lastName(fullName: string): string {
  return fullName.split(' ').slice(-1)[0];
}
