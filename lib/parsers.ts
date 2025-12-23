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
}

// Add this helper to the top of your parsers.ts
const pluralize = (str: string) => (str.endsWith("s") ? str : str + "s");
const singularize = (str: string) =>
  str.endsWith("s") ? str.slice(0, -1) : str;

export const inferTargetTable = (
  columnName: string,
  allTableNames: string[]
): string | null => {
  if (!columnName.endsWith("_id")) return null;
  const base = columnName.replace("_id", "");

  // Try direct plural (user_id -> users)
  const plural = pluralize(base);
  if (allTableNames.includes(plural)) return plural;

  // Try exact match (rare but happens)
  if (allTableNames.includes(base)) return base;

  return null;
};

// --- Migration Parsing ---
export const parseMigrations = (
  files: { content: string }[]
): Record<string, Table> => {
  const tables: Record<string, Table> = {};

  files.forEach((f) => {
    // 1. Create Table Pattern
    const createRegex =
      /Schema::create\s*\(['"](\w+)['"],\s*function\s*\(Blueprint\s*\$table\)\s*\{([\s\S]*?)\}\);/g;
    let match;

    while ((match = createRegex.exec(f.content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      const columns: Column[] = [];
      const fks: { col: string; refTable: string }[] = [];

      // Helper: Add Column
      const addCol = (
        name: string,
        type: string,
        isPk = false,
        isFk = false
      ) => {
        columns.push({ name, type, isPk, isFk, nullable: false });
      };

      // 1. Standard Columns
      const colRegex = /\$table->(\w+)\(['"]([\w_]+)['"]\)/g;
      let colMatch;
      while ((colMatch = colRegex.exec(body)) !== null) {
        addCol(colMatch[2], colMatch[1]);
      }

      // 2. ID / BigIncrements / UUID
      if (body.includes("$table->id()")) addCol("id", "bigIncrements", true);
      if (body.includes("$table->uuid('id')")) addCol("id", "uuid", true);

      // 3. Foreign IDs (Laravel 7+)
      const foreignIdRegex = /\$table->foreignId\(['"](\w+)['"]\)/g;
      while ((colMatch = foreignIdRegex.exec(body)) !== null) {
        addCol(colMatch[1], "foreignId", false, true);
        // Infer reference: user_id -> users
        const inferredTable = colMatch[1].replace("_id", "") + "s";
        fks.push({ col: colMatch[1], refTable: inferredTable });
      }

      // 4. Polymorphic (Morphs)
      // $table->morphs('taggable') -> create taggable_id (uint) and taggable_type (string)
      const morphRegex = /\$table->morphs\(['"](\w+)['"]\)/g;
      while ((colMatch = morphRegex.exec(body)) !== null) {
        const prefix = colMatch[1];
        addCol(`${prefix}_id`, "unsignedBigInteger", false, true);
        addCol(`${prefix}_type`, "string");
      }

      // 5. Explicit FK Constraints
      // $table->foreign('user_id')->references('id')->on('users');
      const fkConstraintRegex =
        /foreign\(['"](\w+)['"]\)->references\(['"]\w+['"]\)->on\(['"](\w+)['"]\)/g;
      while ((colMatch = fkConstraintRegex.exec(body)) !== null) {
        // Update existing FK or add new
        fks.push({ col: colMatch[1], refTable: colMatch[2] });
        const col = columns.find((c) => c.name === colMatch[1]);
        if (col) col.isFk = true;
      }

      // Heuristic: Is this a pivot table?
      // Usually detected if table name has underscore (singular_singular) and 2 FKs
      const isPivot =
        tableName.includes("_") && !tableName.endsWith("s") && fks.length >= 2;

      tables[tableName] = {
        name: tableName,
        columns,
        foreignKeys: fks,
        isPivot,
      };
    }
  });

  return tables;
};

// --- Model Parsing ---
export const parseModels = (
  files: { content: string; name: string }[]
): Model[] => {
  return files.map((f) => {
    const content = f.content;
    const className = f.name.replace(".php", "");

    // 1. Detect Explicit Table
    const tableMatch = /protected\s+\$table\s*=\s*['"](\w+)['"];/.exec(content);
    // Default Laravel Strategy: Snake case plural (User -> users)
    const tableName = tableMatch
      ? tableMatch[1]
      : className.toLowerCase() + "s";

    // 2. Detect Relations
    const relations: { method: string; type: string; target: string }[] = [];

    // Regex for: public function posts() { return $this->hasMany(Post::class); }
    // Handles: hasOne, hasMany, belongsTo, belongsToMany, morphMany
    const relRegex =
      /public\s+function\s+(\w+)\(\)\s*\{[\s\S]*?\$this->(\w+)\(\s*(?:['"]([\w\\]+)['"]|(\w+)::class)/g;

    let match;
    while ((match = relRegex.exec(content)) !== null) {
      const relationMethod = match[1]; // e.g., 'posts'
      const relationType = match[2]; // e.g., 'hasMany'
      let targetModel = match[3] || match[4]; // e.g., 'Post'

      // Cleanup namespace
      if (targetModel) targetModel = targetModel.split("\\").pop()!;

      relations.push({
        method: relationMethod,
        type: relationType,
        target: targetModel,
      });
    }

    return { class: className, table: tableName, relations };
  });
};
