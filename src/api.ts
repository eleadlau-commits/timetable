export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(API_BASE + '/api' + path, options); }
  catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('Cannot reach the backend. Check that the Docker services are running and try again.');
  }
  let body: any;
  try { body = await response.json(); } catch { throw new Error('The backend returned an invalid response.'); }
  if (!response.ok) throw new Error(body.error || 'The request failed.');
  return body as T;
}
