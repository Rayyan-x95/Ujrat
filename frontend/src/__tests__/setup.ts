// Unit tests must never reach the network: CI has no Supabase env, so a live
// call fails as "fetch failed" instead of the assertion. Stub the repo/RPC.
globalThis.fetch = (() =>
  Promise.reject(new Error('Network access is disabled in unit tests'))) as typeof fetch;

// Test setup and environment mocks
if (typeof window !== 'undefined') {
  let store: Record<string, string> = Object.create(null);
  const localStorageMock: Storage = {
    getItem: (key: string): string | null => (key in store ? store[key] ?? null : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = Object.create(null);
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  } catch {
    // Fallback if defined
  }
}
