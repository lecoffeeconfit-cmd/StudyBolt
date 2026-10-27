export function studyBoltPrivacyPolicyUrl(): string | null {
  return publishedHttpsUrl(Deno.env.get('STUDYBOLT_PRIVACY_POLICY_URL'));
}

export function studyBoltTermsOfServiceUrl(): string | null {
  return publishedHttpsUrl(Deno.env.get('STUDYBOLT_TERMS_OF_SERVICE_URL'));
}

export function studyBoltLegalDocumentsApproved(): boolean {
  return Deno.env.get('STUDYBOLT_LEGAL_DOCUMENTS_APPROVED')?.trim().toLowerCase() === 'true';
}

function publishedHttpsUrl(value: string | undefined): string | null {
  const candidate = value?.trim() ?? '';
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
