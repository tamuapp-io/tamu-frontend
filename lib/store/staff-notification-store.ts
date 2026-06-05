"use client";

import { create } from "zustand";

export type StaffNotificationKind = "booking" | "whatsapp";

export interface StaffNotification {
  id: string;
  kind: StaffNotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

type NewStaffNotification = Omit<StaffNotification, "createdAt" | "read"> & {
  createdAt?: string;
};

interface StaffNotificationState {
  items: StaffNotification[];
  add: (item: NewStaffNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markKindRead: (kind: StaffNotificationKind) => void;
}

const MAX_ITEMS = 50;

export const useStaffNotificationStore = create<StaffNotificationState>((set, get) => ({
  items: [],

  add: (item) => {
    const createdAt = item.createdAt ?? new Date().toISOString();
    const next: StaffNotification = { ...item, createdAt, read: false };

    set((state) => {
      const withoutDuplicate = state.items.filter((row) => row.id !== next.id);
      return {
        items: [next, ...withoutDuplicate].slice(0, MAX_ITEMS),
      };
    });
  },

  markRead: (id) => {
    set((state) => ({
      items: state.items.map((row) =>
        row.id === id ? { ...row, read: true } : row,
      ),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      items: state.items.map((row) => ({ ...row, read: true })),
    }));
  },

  markKindRead: (kind) => {
    set((state) => ({
      items: state.items.map((row) =>
        row.kind === kind ? { ...row, read: true } : row,
      ),
    }));
  },
}));

export function staffNotificationUnreadCount(items: StaffNotification[]): number {
  return items.filter((row) => !row.read).length;
}
