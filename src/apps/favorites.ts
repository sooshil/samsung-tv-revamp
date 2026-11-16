// Pure operations on the ordered favourites list (kept separate from the UI so they can be tested).
export const MAX_FAVORITES = 10;

export function addFavorite(favs: string[], id: string): string[] {
  if (favs.indexOf(id) >= 0 || favs.length >= MAX_FAVORITES) return favs;
  return favs.concat(id);
}

export function removeFavorite(favs: string[], id: string): string[] {
  return favs.filter((x) => x !== id);
}

/** Moves `id` one place earlier (-1) or later (+1); unchanged at the ends or when absent. */
export function moveFavorite(favs: string[], id: string, dir: -1 | 1): string[] {
  const i = favs.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= favs.length) return favs;
  const out = favs.slice();
  out[i] = favs[j];
  out[j] = id;
  return out;
}
