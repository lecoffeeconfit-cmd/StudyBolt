/** Server-side account gate shared by all AI execution endpoints. */
export function requireRegisteredStudyBoltAccount(isAnonymous: boolean | null | undefined): Response | null {
  if (isAnonymous === false) return null;
  return new Response(JSON.stringify({
    error: 'Create a free StudyBolt account to unlock AI study tools and secure cross-device sync.',
    code: 'account_required',
  }), {
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
