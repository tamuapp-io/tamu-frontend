"use client";

import { useQuery } from "@tanstack/react-query";
import { availabilityApi } from "@/lib/api/availability";

export function useAvailability(params: { date: string; party_size: number }, enabled = true) {
  return useQuery({
    queryKey: ["availability", params],
    enabled,
    queryFn: async () => (await availabilityApi.get(params)).data,
  });
}
