"use client";

import { useQuery } from "@tanstack/react-query";
import { walkInsApi, type ListWalkInsQuery } from "@/lib/api/walk-ins";

export const walkInsKeys = {
  all: ["walk-ins"] as const,
  list: (q: ListWalkInsQuery) => [...walkInsKeys.all, "list", q] as const,
};

export function useWalkInsList(query: ListWalkInsQuery = {}) {
  return useQuery({
    queryKey: walkInsKeys.list(query),
    queryFn: async () => walkInsApi.list(query),
  });
}
