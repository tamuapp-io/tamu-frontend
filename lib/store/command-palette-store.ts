import { create } from "zustand";

type CommandPaletteState = {
  open: boolean;
  /** Bumps whenever the palette transitions from closed → open (fresh search UX). */
  openSession: number;
  /**
   * Set open state (also bumps `openSession` when transitioning to open).
   */
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  open: false,
  openSession: 0,

  setOpen: (next) =>
    set((s) => {
      const opening = next && !s.open;
      return {
        open: next,
        openSession: opening ? s.openSession + 1 : s.openSession,
      };
    }),

  toggle: () => {
    const s = get();
    const next = !s.open;
    const opening = next && !s.open;
    set({
      open: next,
      openSession: opening ? s.openSession + 1 : s.openSession,
    });
  },
}));
