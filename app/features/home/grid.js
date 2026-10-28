// The rules for Home's widgets: the space under the pages is a grid, 3 columns wide and as many
// rows as fit on the screen. Each widget comes in sizes:
//   wide  → the whole width, 1 row (a strip, like the library's)
//   tall  → 1 column, 3 rows (like the campus card)
//   large → 2 columns, 3 rows (like today's lectures)
// Widgets go in, in order, at the first place they fit (left to right, top to bottom). Tall
// and large ones then stretch down to the bottom when nothing is under them, so Home stays full.

export const COLUMNS = 3;
export const SIZES = {
  wide: { cols: 3, rows: 1 },
  tall: { cols: 1, rows: 3 },
  large: { cols: 2, rows: 3 },
};
export const ROW = 56; // the smallest a row can be, in px
export const GAP = 12;
export const MIN_ROWS = 4; // on a very short screen Home scrolls instead

// How many rows fit in `height` px.
export function rowsFor(height) {
  return Math.max(MIN_ROWS, Math.floor((height + GAP) / (ROW + GAP)));
}

// Places the widgets ([{ id, size }]) on a grid `rows` high. Returns { placed, left }:
// placed → [{ id, size, row, col, cols, rows }] (from 0), left → the widgets that didn't fit.
export function pack(widgets, rows, { stretch = false } = {}) {
  const taken = Array.from({ length: rows }, () => Array(COLUMNS).fill(false));
  const free = (r, c, h, w) => {
    if (r + h > rows || c + w > COLUMNS) return false;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (taken[y][x]) return false;
    return true;
  };
  const mark = (r, c, h, w) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) taken[y][x] = true;
  };
  const placed = [];
  const left = [];
  for (const widget of widgets) {
    const size = SIZES[widget.size];
    let spot = null;
    for (let r = 0; size && !spot && r < rows; r++) {
      for (let c = 0; !spot && c < COLUMNS; c++) if (free(r, c, size.rows, size.cols)) spot = { row: r, col: c };
    }
    if (!spot) {
      left.push(widget);
      continue;
    }
    mark(spot.row, spot.col, size.rows, size.cols);
    placed.push({ ...widget, ...spot, cols: size.cols, rows: size.rows });
  }
  if (stretch) {
    for (const p of placed) {
      if (p.size === 'wide') continue;
      while (free(p.row + p.rows, p.col, 1, p.cols)) {
        mark(p.row + p.rows, p.col, 1, p.cols);
        p.rows += 1;
      }
    }
  }
  return { placed, left };
}

// True if all the widgets fit on a grid `rows` high.
export function fits(widgets, rows) {
  return pack(widgets, rows).left.length === 0;
}

// How many rows the widgets use.
export function usedRows(widgets, rows) {
  return pack(widgets, rows).placed.reduce((most, p) => Math.max(most, p.row + p.rows), 0);
}
