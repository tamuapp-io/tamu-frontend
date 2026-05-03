"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tablesApi, type ListTablesQuery } from "@/lib/api/tables";
import type { CreateTablePayload, UpdateTablePayload } from "@/lib/types";

export const tablesKeys = {
  all: ["tables"] as const,
  list: (q: ListTablesQuery) => [...tablesKeys.all, "list", q] as const,
  detail: (id: string) => [...tablesKeys.all, "detail", id] as const,
};

export function useTablesList(query: ListTablesQuery = {}) {
  return useQuery({
    queryKey: tablesKeys.list(query),
    queryFn: async () => (await tablesApi.list(query)).data,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTablePayload) =>
      (await tablesApi.create(payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: tablesKeys.all }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTablePayload }) =>
      (await tablesApi.update(id, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: tablesKeys.all }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => tablesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tablesKeys.all }),
  });
}

export function useUpdateTablePositions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      positions: Array<{
        id: string;
        pos_x?: number;
        pos_y?: number;
        width?: number;
        height?: number;
        rotation?: number;
      }>,
    ) => (await tablesApi.updatePositions(positions)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: tablesKeys.all }),
  });
}
