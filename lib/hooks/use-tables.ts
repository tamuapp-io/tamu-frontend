"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tablesApi, type ListTablesQuery } from "@/lib/api/tables";
import type { CreateTablePayload, Table, UpdateTablePayload } from "@/lib/types";

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

type TablePositionsPayload = Array<{
  id: string;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}>;

/**
 * Drag-and-drop on the floor plan calls this on every drop. We optimistically
 * patch every cached `tables` list with the new coordinates so the UI doesn't
 * snap the just-dropped table back to its old spot while the API is in flight.
 *
 * On error we restore the pre-drop snapshot; on settled (success or failure)
 * we still invalidate so any divergence between optimistic state and the
 * server's authoritative response is reconciled.
 */
export function useUpdateTablePositions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (positions: TablePositionsPayload) =>
      (await tablesApi.updatePositions(positions)).data,
    onMutate: async (positions) => {
      await qc.cancelQueries({ queryKey: tablesKeys.all });

      // Snapshot every list variant currently in the cache so we can roll
      // back on error. Each entry is [queryKey, previousData].
      const snapshots = qc.getQueriesData<Table[] | undefined>({
        queryKey: tablesKeys.all,
      });

      const byId = new Map(positions.map((p) => [p.id, p] as const));

      for (const [key, prev] of snapshots) {
        if (!Array.isArray(prev)) continue;
        const next = prev.map((t) => {
          const patch = byId.get(t.id);
          if (!patch) return t;
          return {
            ...t,
            position: {
              ...t.position,
              x: patch.pos_x ?? t.position.x,
              y: patch.pos_y ?? t.position.y,
              width: patch.width ?? t.position.width,
              height: patch.height ?? t.position.height,
              rotation: patch.rotation ?? t.position.rotation,
            },
          };
        });
        qc.setQueryData(key, next);
      }

      return { snapshots };
    },
    onError: (_err, _positions, context) => {
      if (!context?.snapshots) return;
      for (const [key, prev] of context.snapshots) {
        qc.setQueryData(key, prev);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: tablesKeys.all });
    },
  });
}
