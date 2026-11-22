"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "../types";
import { LocalStore } from "./local-store";
import type { DataStore } from "./store";
import { FullPageLoader } from "@/components/ui/spinner";

interface Ctx {
  store: DataStore;
  version: number;
  user: PublicUser | null;
}

const StoreContext = createContext<Ctx | null>(null);

let singleton: DataStore | null = null;
function getStore() {
  // Swap this for a Supabase-backed DataStore when going live.
  singleton ??= new LocalStore();
  return singleton;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [store] = useState(getStore);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let alive = true;
    const unsub = store.subscribe(() => {
      setVersion((v) => v + 1);
      store.getCurrentUser().then((u) => alive && setUser(u));
    });
    store.init().then(async () => {
      const u = await store.getCurrentUser();
      if (!alive) return;
      setUser(u);
      setReady(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [store]);

  if (!ready) return <FullPageLoader />;
  return <StoreContext.Provider value={{ store, version, user }}>{children}</StoreContext.Provider>;
}

function useCtx() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <DataProvider>");
  return ctx;
}

export function useStore() {
  return useCtx().store;
}

export function useAuth() {
  const { store, user } = useCtx();
  return {
    user,
    isOwner: user?.role === "owner",
    isStaff: user?.role === "owner" || user?.role === "admin",
    signIn: store.signIn.bind(store),
    signUp: store.signUp.bind(store),
    signOut: store.signOut.bind(store),
  };
}

/**
 * Runs an async store query and re-runs it whenever the store changes
 * (including changes made in another browser tab).
 */
export function useQuery<T>(fn: (store: DataStore) => Promise<T>, deps: unknown[] = []) {
  const { store, version } = useCtx();
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    fnRef
      .current(store)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((error: Error) => alive && setState((s) => ({ ...s, error, loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, nonce, ...deps]);

  return { ...state, reload };
}
