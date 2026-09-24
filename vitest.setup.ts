import {afterEach, beforeAll, beforeEach, vi} from "vite-plus/test";

const createStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

const resetStorage = (storage: Storage | undefined) => {
  if (!storage) return;

  storage.clear();
  if (vi.isMockFunction(storage.getItem)) {
    vi.mocked(storage.getItem).mockClear();
  }
  if (vi.isMockFunction(storage.setItem)) {
    vi.mocked(storage.setItem).mockClear();
  }
  if (vi.isMockFunction(storage.removeItem)) {
    vi.mocked(storage.removeItem).mockClear();
  }
};

const clearAllCookies = () => {
  if (typeof document !== "undefined" && document.cookie) {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
      }
    }
  }
};

beforeAll(() => {
  const localStorageMock = createStorageMock();
  const sessionStorageMock = createStorageMock();

  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(global, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });

  const globalWithStorage = globalThis as typeof globalThis & {
    localStorage?: Storage;
    sessionStorage?: Storage;
  };
  globalWithStorage.localStorage = localStorageMock;
  globalWithStorage.sessionStorage = sessionStorageMock;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  resetStorage(typeof localStorage !== "undefined" ? localStorage : undefined);
  resetStorage(typeof sessionStorage !== "undefined" ? sessionStorage : undefined);

  clearAllCookies();
});

afterEach(() => {
  clearAllCookies();
  vi.clearAllTimers();
});

global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};
