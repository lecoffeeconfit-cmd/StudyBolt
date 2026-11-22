export const NATIVE_AUTH_REDIRECT = 'studybolt://auth/callback';

export function readAuthCallback(input: string, webRedirect?: string) {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.username || url.password) return null;
  const native = url.protocol === 'studybolt:' && !url.port && (
    (url.hostname === 'auth' && url.pathname === '/callback')
    || (!url.hostname && url.pathname === '/auth/callback')
  );
  const web = webRedirect ? new URL(webRedirect) : null;
  const hosted = web && url.origin === web.origin && url.pathname === web.pathname && url.searchParams.get('studybolt_auth') === '1';
  if (!native && !hosted) return null;
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const flowId = query.get('sb_flow_id');
  return {
    code: query.get('code'),
    rejected: [query, fragment].some(params => params.has('error') || params.has('error_code') || params.has('error_description')),
    ...(flowId ? { flowId } : {}),
  };
}
