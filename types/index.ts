// --- Types ---
export interface Column {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
  nullable: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
  foreignKeys: { col: string; refTable: string }[];
  isPivot: boolean; // Heuristic
}

export interface Model {
  class: string;
  table: string; // inferred or explicit
  relations: { method: string; type: string; target: string }[];
  filePath: string;
}
