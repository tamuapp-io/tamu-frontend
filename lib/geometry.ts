/**
 * Plane geometry for venue-map section areas.
 *
 * Mirrors app/Support/Geometry.php, which is the authority — this copy exists
 * so the editor can show which area a table is about to land in while the
 * pointer is still moving, without a round trip.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ray casting. A point exactly on an edge is undefined by design; a boundary
 * pixel either way is not a meaningful distinction for area membership.
 */
export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/** Axis-aligned bounds — what the guest map zooms to when an area is chosen. */
export function boundingBox(polygon: Point[]): Bounds | null {
  if (polygon.length < 3) return null;

  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Area centroid, for placing a section's label. Falls back to the bounding-box
 * centre for degenerate (zero-area) polygons, where the centroid formula
 * divides by zero.
 */
export function centroid(polygon: Point[]): Point | null {
  const n = polygon.length;
  if (n < 3) return null;

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  if (twiceArea === 0) {
    const box = boundingBox(polygon);
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
  }

  return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
}

/** Midpoint of each edge — where the editor offers "insert a vertex here". */
export function edgeMidpoints(polygon: Point[]): Point[] {
  return polygon.map((p, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
  });
}
