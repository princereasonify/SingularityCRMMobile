/**
 * Google Places through the backend proxy (RoutePlanController) — the key stays server-side.
 * Mirrors web's src/api/placesService.js. Responses are Google's own JSON shapes:
 * { status, predictions[] } and { status, result }.
 */
import { apiClient } from './client';

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

export interface PlaceDetailsResult {
  formatted_address?: string;
  name?: string;
  types?: string[];
  address_components?: { long_name: string; short_name: string; types: string[] }[];
}

export const placesService = {
  autocomplete: (input: string) =>
    apiClient.get<{ status: string; predictions: PlacePrediction[] }>('/routes/places/autocomplete', { params: { input } }),

  details: (placeId: string, fields = 'formatted_address,address_components,name,types') =>
    apiClient.get<{ status: string; result: PlaceDetailsResult }>('/routes/places/details', { params: { placeId, fields } }),
};
