/**
 * Google Places result → the fields the sales-document address fields need. Ported verbatim
 * from web's salesDocs/AddressField.jsx parsePlace — same city/state/pincode extraction, same
 * "trim the tail off formatted_address" line-1 logic, so a picked address reads identically on
 * both clients.
 */
import { GST_STATE_CODES } from './salesDocUtils';
import { PlaceDetailsResult } from '../api/placesService';

export interface ParsedPlace {
  line1: string;
  line2: string;
  full: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
}

export function parsePlace(result?: PlaceDetailsResult | null): ParsedPlace {
  const comps = result?.address_components || [];
  const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name || '';
  const state = get('administrative_area_level_1');
  const city = get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2');
  const pincode = get('postal_code');

  const full = (result?.formatted_address || '').replace(/,\s*India$/, '').trim();
  // Line 1 = what is left once city / state / PIN are taken off the end; the place name leads
  // when Google keeps it out of formatted_address (schools and other establishments).
  const tail = new Set([city, state, pincode].filter(Boolean).map((x) => x.toLowerCase()));
  const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length) {
    const last = parts[parts.length - 1].toLowerCase();
    const bare = last.replace(/\s*\d{6}$/, '').trim();
    if (tail.has(last) || tail.has(bare) || /^\d{6}$/.test(last)) parts.pop();
    else break;
  }
  // Only a named place (a school, an office) leads with its name; for a road or area the name is
  // just the first address part again.
  const isNamedPlace = (result?.types || []).some((t) => ['establishment', 'point_of_interest', 'school', 'premise'].includes(t));
  const name = isNamedPlace && result?.name && !full.toLowerCase().startsWith(result.name.toLowerCase()) && parts.length ? result.name : '';
  const line1 = [name, ...parts].filter(Boolean).join(', ');
  const line2 = [city, [state, pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const fullWithName = name ? `${name}, ${full}` : full;

  return { line1, line2, full: fullWithName, city, state, stateCode: GST_STATE_CODES[state] || '', pincode };
}
