function publishedHttpsUrl(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
}

export const LEGAL_URLS = {
  privacyPolicy: publishedHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)
    || 'https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy',
  termsOfService: publishedHttpsUrl(process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL)
    || 'https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice',
} as const;

// Public links can be displayed before the legal copy is finalized. Paid access
// stays disabled until the operator explicitly confirms the published policies.
export const hasApprovedLegalDocuments = Boolean(
  LEGAL_URLS.privacyPolicy
  && LEGAL_URLS.termsOfService
  && process.env.EXPO_PUBLIC_LEGAL_DOCUMENTS_APPROVED?.trim().toLowerCase() === 'true',
);
