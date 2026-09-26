// Country flags for the 2026 calendar (flag-icons package, MIT). Static
// imports so Vite bundles only the flags actually used.
import ae from 'flag-icons/flags/4x3/ae.svg';
import at from 'flag-icons/flags/4x3/at.svg';
import au from 'flag-icons/flags/4x3/au.svg';
import az from 'flag-icons/flags/4x3/az.svg';
import be from 'flag-icons/flags/4x3/be.svg';
import bh from 'flag-icons/flags/4x3/bh.svg';
import br from 'flag-icons/flags/4x3/br.svg';
import ca from 'flag-icons/flags/4x3/ca.svg';
import cn from 'flag-icons/flags/4x3/cn.svg';
import es from 'flag-icons/flags/4x3/es.svg';
import gb from 'flag-icons/flags/4x3/gb.svg';
import hu from 'flag-icons/flags/4x3/hu.svg';
import it from 'flag-icons/flags/4x3/it.svg';
import jp from 'flag-icons/flags/4x3/jp.svg';
import mc from 'flag-icons/flags/4x3/mc.svg';
import mx from 'flag-icons/flags/4x3/mx.svg';
import my from 'flag-icons/flags/4x3/my.svg';
import nl from 'flag-icons/flags/4x3/nl.svg';
import qa from 'flag-icons/flags/4x3/qa.svg';
import sa from 'flag-icons/flags/4x3/sa.svg';
import sg from 'flag-icons/flags/4x3/sg.svg';
import us from 'flag-icons/flags/4x3/us.svg';

/** Jolpica country name -> flag asset URL. */
const FLAGS: Record<string, string> = {
  UAE: ae,
  'United Arab Emirates': ae,
  Austria: at,
  Australia: au,
  Azerbaijan: az,
  Belgium: be,
  Bahrain: bh,
  Brazil: br,
  Canada: ca,
  China: cn,
  Spain: es,
  UK: gb,
  'United Kingdom': gb,
  'Great Britain': gb,
  Hungary: hu,
  Italy: it,
  Japan: jp,
  Monaco: mc,
  Mexico: mx,
  Malaysia: my,
  Netherlands: nl,
  Qatar: qa,
  'Saudi Arabia': sa,
  Singapore: sg,
  USA: us,
  'United States': us,
};

export function flagFor(country: string | null | undefined): string | null {
  if (!country) return null;
  return FLAGS[country] ?? null;
}
