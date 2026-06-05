"use client";

import { create } from "zustand";

interface BookingNotificationState {
  hasNewBooking: boolean;
  signalNewBooking: () => void;
  clearNewBooking: () => void;
}

export const useBookingNotificationStore = create<BookingNotificationState>((set) => ({
  hasNewBooking: false,
  signalNewBooking: () => set({ hasNewBooking: true }),
  clearNewBooking: () => set({ hasNewBooking: false }),
}));
