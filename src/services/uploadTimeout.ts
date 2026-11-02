/** Race a native upload against a timeout and cancel its underlying request. */
export async function withUploadTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  cancel: () => void | Promise<void>,
  timeoutError: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        void Promise.resolve(cancel()).catch(() => undefined);
      } catch {
        // Preserve the timeout error even if native cancellation is unavailable.
      }
      reject(timeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
