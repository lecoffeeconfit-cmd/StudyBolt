export interface PurchasesIdentitySDK {
  isConfigured: () => Promise<boolean>;
  configure: (configuration: { apiKey: string; appUserID: string }) => void;
  getAppUserID: () => Promise<string>;
  isAnonymous: () => Promise<boolean>;
  logIn: (id: string) => Promise<unknown>;
  logOut: () => Promise<unknown>;
}

/** Serialize identity changes with purchases/restores; verify the SDK's actual cached ID each time. */
export function createRevenueCatIdentityQueue(sdk: PurchasesIdentitySDK, isDeleting: (id: string) => Promise<boolean>) {
  let pending: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work);
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    withUser<T>(userId: string | null, key: string, action: () => Promise<T>): Promise<T> {
      return enqueue(async () => {
        if (userId && await isDeleting(userId)) throw new Error('Account deletion is pending. Retry deletion before using purchases.');
        const configured = await sdk.isConfigured();
        if (!userId) {
          if (configured && !await sdk.isAnonymous()) await sdk.logOut();
          return undefined as T;
        }
        if (!key) throw new Error('Premium checkout is not connected to the app stores yet.');
        if (!configured) sdk.configure({ apiKey: key, appUserID: userId });
        else if (await sdk.getAppUserID() !== userId) await sdk.logIn(userId);
        if (await sdk.getAppUserID() !== userId) throw new Error('Subscription account could not be verified. Please sign in again.');
        return action();
      });
    },
    detach(userId: string): Promise<void> {
      return enqueue(async () => {
        if (await sdk.isConfigured() && await sdk.getAppUserID() === userId && !await sdk.isAnonymous()) await sdk.logOut();
      });
    },
  };
}
