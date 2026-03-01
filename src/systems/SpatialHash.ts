export class SpatialHash<T> {
  private readonly cellSize: number;
  private readonly getPos: (item: T) => { x: number; y: number };
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number, getPos: (item: T) => { x: number; y: number }) {
    this.cellSize = cellSize;
    this.getPos = getPos;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const pos = this.getPos(item);
    const key = this.cellKey(
      Math.floor(pos.x / this.cellSize),
      Math.floor(pos.y / this.cellSize),
    );
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  // Returns all items whose position falls within `radius` pixels of (x, y).
  query(x: number, y: number, radius: number): T[] {
    const results: T[] = [];
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);
    const r2 = radius * radius;

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.cellKey(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const pos = this.getPos(item);
          const dx = pos.x - x;
          const dy = pos.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(item);
          }
        }
      }
    }

    return results;
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }
}
