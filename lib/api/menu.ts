import { api } from "@/lib/api/client";
import type {
  ItemEnvelope,
  MenuCategory,
  MenuConfig,
  MenuItem,
  MenuLabel,
  MenuMode,
  PublicMenu,
} from "@/lib/types";

/**
 * Guest-facing menu (no auth — tenant comes from the slug). Every venue
 * publishes one; `ordering_enabled` in the payload gates the ordering UI.
 */
export const publicMenuApi = {
  get: (slug: string) =>
    api.get<ItemEnvelope<PublicMenu>>(`public/${slug}/menu`, { auth: false }),
};

/** Staff menu editor. Gated server-side by role:owner,manager. */
export const menuApi = {
  config: () => api.get<ItemEnvelope<MenuConfig>>("menu"),

  setMode: (mode: MenuMode) => api.patch<ItemEnvelope<MenuConfig>>("menu/mode", { mode }),

  createCategory: (payload: { name: string; description?: string | null }) =>
    api.post<ItemEnvelope<MenuCategory>>("menu/categories", payload),
  updateCategory: (
    id: string,
    payload: { name?: string; description?: string | null; is_active?: boolean },
  ) => api.patch<ItemEnvelope<MenuCategory>>(`menu/categories/${id}`, payload),
  removeCategory: (id: string) => api.delete<null>(`menu/categories/${id}`),
  reorderCategories: (ids: string[]) =>
    api.post<ItemEnvelope<MenuCategory[]>>("menu/categories/reorder", { ids }),

  createLabel: (payload: { name: string; color: string }) =>
    api.post<ItemEnvelope<MenuLabel>>("menu/labels", payload),
  updateLabel: (id: string, payload: { name?: string; color?: string }) =>
    api.patch<ItemEnvelope<MenuLabel>>(`menu/labels/${id}`, payload),
  removeLabel: (id: string) => api.delete<null>(`menu/labels/${id}`),

  createItem: (payload: MenuItemPayload) =>
    api.post<ItemEnvelope<MenuItem>>("menu/items", payload),
  updateItem: (id: string, payload: Partial<MenuItemPayload>) =>
    api.patch<ItemEnvelope<MenuItem>>(`menu/items/${id}`, payload),
  removeItem: (id: string) => api.delete<null>(`menu/items/${id}`),
  reorderItems: (ids: string[]) =>
    api.post<ItemEnvelope<MenuCategory[]>>("menu/items/reorder", { ids }),
};

/**
 * Menu photos go through the SHARED image endpoint, not a bespoke one — it
 * already enforces mimes and size, and menu images are ordinary raster uploads
 * with none of the venue map's SVG-sanitising needs.
 */
export function uploadMenuImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "menu");
  return api.upload<ItemEnvelope<{ url: string; path: string; disk: string }>>(
    "uploads/image",
    form,
  );
}

export interface MenuItemPayload {
  menu_category_id: string;
  menu_label_id?: string | null;
  name: string;
  description?: string | null;
  /** TRUE cents (IDR × 100). */
  price_cents?: number;
  image_url?: string | null;
  image_path?: string | null;
  image_disk?: string | null;
  is_active?: boolean;
}
