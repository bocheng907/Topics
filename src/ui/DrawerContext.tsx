import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type DrawerControls = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const noop = () => {};
const fallback: DrawerControls = { isOpen: false, open: noop, close: noop, toggle: noop };

const DrawerContext = createContext<DrawerControls | null>(null);

/** Owns the open state of a role's side drawer. Each role layout provides one. */
export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

/** Safe outside a provider: returns no-op controls. */
export function useDrawer(): DrawerControls {
  return useContext(DrawerContext) ?? fallback;
}
