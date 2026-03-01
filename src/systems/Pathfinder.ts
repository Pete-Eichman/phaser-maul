import { PriorityQueue } from '@/utils/PriorityQueue';

export interface GridPos {
  row: number;
  col: number;
}

interface PathNode {
  pos: GridPos;
  g: number;
  f: number;
  parent: PathNode | null;
}

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function heuristic(a: GridPos, b: GridPos): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function nodeKey(pos: GridPos): string {
  return `${pos.row},${pos.col}`;
}

/**
 * Finds the shortest path on a tile grid using A* with Manhattan distance.
 * Walkable tiles: any value !== 0 (path=1, spawn/exit zones=2).
 * Returns simplified waypoints in tile coordinates {x: col, y: row},
 * collapsing straight runs to corner points only.
 * Returns [] if no path exists.
 */
export function findPath(
  grid: number[][],
  start: GridPos,
  end: GridPos,
): { x: number; y: number }[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (rows === 0 || cols === 0) return [];
  if (start.row === end.row && start.col === end.col) {
    return [{ x: start.col, y: start.row }];
  }

  const isWalkable = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] !== 0;

  const queue = new PriorityQueue<PathNode>();
  // closed set: positions we've already expanded with their optimal g
  const closed = new Set<string>();

  const startNode: PathNode = {
    pos: start,
    g: 0,
    f: heuristic(start, end),
    parent: null,
  };
  queue.enqueue(startNode, startNode.f);

  while (queue.size > 0) {
    const current = queue.dequeue()!;
    const ck = nodeKey(current.pos);

    // Manhattan distance is consistent, so first pop is always optimal
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (current.pos.row === end.row && current.pos.col === end.col) {
      const raw: GridPos[] = [];
      let node: PathNode | null = current;
      while (node) {
        raw.unshift(node.pos);
        node = node.parent;
      }
      return simplifyPath(raw).map((p) => ({ x: p.col, y: p.row }));
    }

    for (const [dr, dc] of DIRS) {
      const nr = current.pos.row + dr;
      const nc = current.pos.col + dc;
      if (!isWalkable(nr, nc)) continue;
      if (closed.has(`${nr},${nc}`)) continue;

      const g = current.g + 1;
      const neighbor: PathNode = {
        pos: { row: nr, col: nc },
        g,
        f: g + heuristic({ row: nr, col: nc }, end),
        parent: current,
      };
      queue.enqueue(neighbor, neighbor.f);
    }
  }

  return [];
}

/**
 * Collapses a tile-by-tile A* path into corner waypoints only.
 * The start and end are always kept; intermediate tiles are kept only
 * at direction changes, which is where enemies actually turn.
 */
function simplifyPath(path: GridPos[]): GridPos[] {
  if (path.length <= 2) return path;

  const result: GridPos[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const dr1 = path[i].row - path[i - 1].row;
    const dc1 = path[i].col - path[i - 1].col;
    const dr2 = path[i + 1].row - path[i].row;
    const dc2 = path[i + 1].col - path[i].col;
    if (dr1 !== dr2 || dc1 !== dc2) {
      result.push(path[i]);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}
