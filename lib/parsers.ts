import { Column, Table, Model } from "@/types";

const pluralize = (str: string) => {
  if (str.endsWith("s")) return str;
  if (str.endsWith("y") && !/[aeiou]y$/.test(str)) {
    return str.slice(0, -1) + "ies";
  }
  if (/(s|sh|ch|x|z)$/.test(str)) {
    return str + "es";
  }
  return str + "s";
};

export const parseProjectData = (migrationFiles: any[], modelFiles: any[]) => {
  const tableStates: Record<string, Table> = {};
  const tableToFileMap: Record<string, string[]> = {};

  // Sort migrations chronologically
  const sortedMigrations = [...migrationFiles].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  sortedMigrations.forEach((file) => {
    const content = file.content;

    // Handle Table Creation
    const createRegex =
      /Schema::create\s*\(['"](\w+)['"],\s*function\s*\(Blueprint\s*\$table\)\s*\{([\s\S]*?)\}\);/g;
    let match;
    while ((match = createRegex.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      tableStates[tableName] = {
        name: tableName,
        columns: parseColumns(body),
        foreignKeys: parseFKs(body),
        isPivot: tableName.split("_").length === 2 && !tableName.endsWith("s"),
      };
      if (!tableToFileMap[tableName]) tableToFileMap[tableName] = [];
      tableToFileMap[tableName].push(file.path);
    }

    // Handle Table Modifications (Schema::table)
    const tableRegex =
      /Schema::table\s*\(['"](\w+)['"],\s*function\s*\(Blueprint\s*\$table\)\s*\{([\s\S]*?)\}\);/g;
    while ((match = tableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      if (tableStates[tableName]) {
        const newCols = parseColumns(body);
        const droppedCols = parseDroppedColumns(body);

        tableStates[tableName].columns = tableStates[tableName].columns.filter(
          (c) => !droppedCols.includes(c.name)
        );

        newCols.forEach((nc) => {
          const index = tableStates[tableName].columns.findIndex(
            (c) => c.name === nc.name
          );
          if (index > -1) tableStates[tableName].columns[index] = nc;
          else tableStates[tableName].columns.push(nc);
        });
        tableToFileMap[tableName].push(file.path);
      }
    }
  });

  // Parse Eloquent Models
  const models: Model[] = modelFiles.map((f) => {
    const className = f.name.replace(".php", "");
    const tableMatch = /protected\s+\$table\s*=\s*['"](\w+)['"];/.exec(
      f.content
    );
    const tableName = tableMatch
      ? tableMatch[1]
      : pluralize(className.toLowerCase());

    const relations: any[] = [];
    const relRegex =
      /public\s+function\s+(\w+)\(\)\s*\{[\s\S]*?\$this->(\w+)\(\s*(?:['"]([\w\\]+)['"]|(\w+)::class)/g;
    let m;
    while ((m = relRegex.exec(f.content)) !== null) {
      relations.push({
        method: m[1],
        type: m[2],
        target: (m[3] || m[4]).split("\\").pop(),
      });
    }

    return { class: className, table: tableName, relations, filePath: f.path };
  });

  return { tableStates, models, tableToFileMap };
};

const parseColumns = (body: string): Column[] => {
  const columns: Column[] = [];
  const colRegex = /\$table->(\w+)\(['"]([\w_]+)['"]\)/g;
  let m;
  while ((m = colRegex.exec(body)) !== null) {
    const matchEndIndex = m.index + m[0].length;
    const remaining = body.slice(matchEndIndex);
    const nextSemi = remaining.indexOf(";");
    const chain = nextSemi !== -1 ? remaining.slice(0, nextSemi) : "";

    columns.push({
      name: m[2],
      type: m[1],
      isPk: false,
      isFk: m[2].endsWith("_id"),
      nullable: chain.includes("->nullable()"),
    });
  }
  if (body.includes("$table->id()"))
    columns.unshift({
      name: "id",
      type: "bigIncrements",
      isPk: true,
      isFk: false,
      nullable: false,
    });
  return columns;
};

const parseDroppedColumns = (body: string): string[] => {
  const dropped: string[] = [];
  const dropRegex = /dropColumn\(['"]([\w_]+)['"]\)/g;
  let m;
  while ((m = dropRegex.exec(body)) !== null) dropped.push(m[1]);
  return dropped;
};

const parseFKs = (body: string) => {
  const fks: { col: string; refTable: string }[] = [];
  const fkRegex =
    /foreign\(['"](\w+)['"]\)->references\(['"]\w+['"]\)->on\(['"](\w+)['"]\)/g;
  let m;
  while ((m = fkRegex.exec(body)) !== null)
    fks.push({ col: m[1], refTable: m[2] });
  return fks;
};

export const inferTargetTable = (
  columnName: string,
  allTableNames: string[]
): string | null => {
  if (!columnName.endsWith("_id")) return null;
  const base = columnName.replace("_id", "");
  const plural = pluralize(base);
  if (allTableNames.includes(plural)) return plural;
  if (allTableNames.includes(base)) return base;
  return null;
};

// Unique Edge ID Generator to fix your console error
export const generateEdgeId = (
  source: string,
  target: string,
  column: string,
  index: number
) => {
  return `e-${source}-${target}-${column}-${index}`;
};

export const generateMigrationContent = (
  originalContent: string,
  tableName: string,
  newColumns: Column[]
): string => {
  // Regex to find the Schema::create block for this table
  const createRegex = new RegExp(
    `(Schema::create\\s*\\(['"]${tableName}['"],\\s*function\\s*\\(Blueprint\\s*\\$table\\)\\s*\\{)([\\s\\S]*?)(\\}\\);)`,
    "g"
  );

  return originalContent.replace(createRegex, (match, start, body, end) => {
    // Generate new column code
    const columnLines = newColumns
      .map((col) => {
        if (col.type === "id" && col.name === "id") {
          return `            $table->id();`;
        }

        // For now, handle simple types.
        // Ideally we would map every type but this covers the basics.
        let line = `            $table->${col.type}('${col.name}')`;

        if (col.nullable) {
          line += "->nullable()";
        }

        line += ";";
        return line;
      })
      .join("\n");

    return `${start}\n${columnLines}\n            $table->timestamps();\n        ${end}`;
  });
};
