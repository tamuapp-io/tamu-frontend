import { create } from "zustand";

type MobileSidebarState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useMobileSidebarStore = create<MobileSidebarState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
