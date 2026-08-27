"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { menuApi, type MenuItemPayload } from "@/lib/api/menu";

export const menuKey = ["menu"] as const;

export function useMenu() {
  return useQuery({
    queryKey: menuKey,
    queryFn: () => menuApi.config().then((r) => r.data),
  });
}

/**
 * Every mutation refetches the whole menu.
 *
 * The editor is a low-frequency surface — unlike the venue map's drag loop,
 * nothing here fires per frame — so one refetch is simpler and always correct,
 * rather than reconciling optimistic writes across three related collections.
 */
export function useMenuMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: menuKey });

  return {
    setMode: useMutation({
      mutationFn: menuApi.setMode,
      onSuccess: invalidate,
    }),
    createCategory: useMutation({
      mutationFn: menuApi.createCategory,
      onSuccess: invalidate,
    }),
    updateCategory: useMutation({
      mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof menuApi.updateCategory>[1]) =>
        menuApi.updateCategory(id, payload),
      onSuccess: invalidate,
    }),
    removeCategory: useMutation({
      mutationFn: menuApi.removeCategory,
      onSuccess: invalidate,
    }),
    createLabel: useMutation({
      mutationFn: menuApi.createLabel,
      onSuccess: invalidate,
    }),
    removeLabel: useMutation({
      mutationFn: menuApi.removeLabel,
      onSuccess: invalidate,
    }),
    createItem: useMutation({
      mutationFn: menuApi.createItem,
      onSuccess: invalidate,
    }),
    updateItem: useMutation({
      mutationFn: ({ id, ...payload }: { id: string } & Partial<MenuItemPayload>) =>
        menuApi.updateItem(id, payload),
      onSuccess: invalidate,
    }),
    removeItem: useMutation({
      mutationFn: menuApi.removeItem,
      onSuccess: invalidate,
    }),
  };
}
