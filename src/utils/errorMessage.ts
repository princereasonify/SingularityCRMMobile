/**
 * Centralized error-message extraction for API calls.
 *
 * Mirrors Sales_CRM_Web/src/utils/errorMessage.js so the same failure reads the same way on
 * both clients — a counselor comparing phone and browser should not get two different
 * explanations for one server response.
 *
 * The backend returns ApiResponse<T> as { success, message, data }; axios puts that payload at
 * err.response.data. ASP.NET model-validation failures instead return { errors: { field: [msg] } }.
 *
 * Usage:
 *   try { await api.put(...) } catch (err) { toast.error(getErrorMessage(err, 'Could not save.')); }
 */
export function getErrorMessage(
  err: any,
  fallback = 'Something went wrong. Please try again.',
): string {
  // No response at all — the request never reached the server.
  if (!err?.response) {
    if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      return 'Cannot reach the server. Check your connection.';
    }
    if (err?.code === 'ECONNABORTED') return 'The request timed out. Try again.';
    return fallback;
  }

  const { status, data } = err.response;

  // The API's own message is always the most specific thing available.
  if (data?.message) return String(data.message);

  // ASP.NET validation errors: surface the first field message rather than a generic 400.
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors as Record<string, unknown>)
      .flat()
      .find(Boolean);
    if (first) return String(first);
  }

  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'This conflicts with existing data.';
  if (status === 413) return 'The file is too large.';
  if (status >= 500) return 'Server error. Please try again in a moment.';

  return fallback;
}
