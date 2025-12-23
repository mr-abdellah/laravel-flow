import dagre from "dagre";
import { Node, Edge, Position } from "reactflow";

// --- Types ---

export interface Column {
  name: string;
  type: string;
  isPk: boolean;
  isFk: boolean;
  isNullable: boolean;
  attributes: string[];
}

export interface TableSchema {
  name: string;
  columns: Column[];
  foreignKeys: { column: string; onTable: string; references: string }[];
}

export interface ModelDefinition {
  name: string;
  tableName: string | null; // explicitly defined or null
  relations: ModelRelation[];
  fillable: string[];
}

export interface ModelRelation {
  methodName: string;
  type:
    | "hasOne"
    | "hasMany"
    | "belongsTo"
    | "belongsToMany"
    | "morphTo"
    | "morphMany"
    | string;
  relatedModel: string;
}

export interface AnalysisResult {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    tables: Record<string, TableSchema>;
    models: Record<string, ModelDefinition>;
    orphans: string[]; // Tables without models
  };
}

// --- Parsing Logic ---

const parseMigration = (content: string): TableSchema[] => {
  const tables: TableSchema[] = [];

  // Regex to find Schema::create blocks
  const createTableRegex =
    /Schema::create\s*\(['"](\w+)['"],\s*function\s*\(Blueprint\s*\$table\)\s*\{([\s\S]*?)\}\);/g;

  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];

    const columns: Column[] = [];
    const foreignKeys: {
      column: string;
      onTable: string;
      references: string;
    }[] = [];

    // Parse columns: $table->string('email')->nullable();
    const columnRegex =
      /\$table->(\w+)\(['"]([\w_]+)['"](?:,\s*[^)]*)?\)([^;]*);/g;
    let colMatch;

    while ((colMatch = columnRegex.exec(body)) !== null) {
      const type = colMatch[1];
      const name = colMatch[2];
      const extras = colMatch[3];

      columns.push({
        name,
        type,
        isPk: type === "id" || type === "bigIncrements",
        isFk: type === "foreignId",
        isNullable: extras.includes("->nullable()"),
        attributes: [extras.trim()].filter(Boolean),
      });
    }

    // Capture "id()" helper
    if (body.includes("$table->id()")) {
      columns.unshift({
        name: "id",
        type: "bigIncrements",
        isPk: true,
        isFk: false,
        isNullable: false,
        attributes: [],
      });
    }

    // Parse Explicit Foreign Keys
    const fkRegex =
      /\$table->foreign\(['"](\w+)['"]\)->references\(['"](\w+)['"]\)->on\(['"](\w+)['"]\)/g;
    let fkMatch;
    while ((fkMatch = fkRegex.exec(body)) !== null) {
      foreignKeys.push({
        column: fkMatch[1],
        references: fkMatch[2],
        onTable: fkMatch[3],
      });
      // Mark column as FK if parsed earlier
      const col = columns.find((c) => c.name === fkMatch[1]);
      if (col) col.isFk = true;
    }

    tables.push({ name: tableName, columns, foreignKeys });
  }
  return tables;
};

const parseModel = (content: string, filename: string): ModelDefinition => {
  const name = filename.replace(".php", "");

  // Detect custom table
  const tableMatch = /protected\s+\$table\s*=\s*['"](\w+)['"];/.exec(content);
  const tableName = tableMatch ? tableMatch[1] : null;

  // Detect Relations
  const relations: ModelRelation[] = [];
  const relationRegex =
    /public\s+function\s+(\w+)\(\)\s*\{[\s\S]*?return\s+\$this->(\w+)\(\s*(?:['"]?([\w\\]+)['"]?|(\w+)::class)/g;

  let relMatch;
  while ((relMatch = relationRegex.exec(content)) !== null) {
    const methodName = relMatch[1];
    const relationType = relMatch[2];
    // Clean up class name (remove namespace if simple, strictly we should map use statements)
    let relatedModel =
      (relMatch[3] || relMatch[4]).split("\\").pop() || "Unknown";

    relations.push({ methodName, type: relationType, relatedModel });
  }

  return { name, tableName, relations, fillable: [] };
};

// --- Graph Generation (Dagre Layout) ---

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 250;
  const nodeHeight = 300; // Estimate

  dagreGraph.setGraph({ rankdir: "LR" });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

// --- Main Orchestrator ---

export const analyzeProject = (
  migrationFiles: { content: string }[],
  modelFiles: { name: string; content: string }[]
): AnalysisResult => {
  // 1. Build Schema
  const schemaMap: Record<string, TableSchema> = {};
  migrationFiles.forEach((f) => {
    const tables = parseMigration(f.content);
    tables.forEach((t) => (schemaMap[t.name] = t));
  });

  // 2. Build Models
  const modelMap: Record<string, ModelDefinition> = {};
  modelFiles.forEach((f) => {
    const model = parseModel(f.content, f.name);
    modelMap[model.name] = model;
  });

  // 3. Correlate
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Helper to guess table name from model (Laravel pluralizer stub)
  const guessTable = (modelName: string) => modelName.toLowerCase() + "s"; // simplistic pluralizer

  // Create Nodes for Tables
  Object.values(schemaMap).forEach((table) => {
    // Find associated model
    const linkedModel = Object.values(modelMap).find(
      (m) => m.tableName === table.name || guessTable(m.name) === table.name
    );

    nodes.push({
      id: `table-${table.name}`,
      type: "tableNode", // Custom Node Type
      position: { x: 0, y: 0 },
      data: {
        table,
        model: linkedModel || null,
        label: table.name,
      },
    });
  });

  // Create Edges based on Schema Foreign Keys
  Object.values(schemaMap).forEach((table) => {
    table.foreignKeys.forEach((fk) => {
      if (schemaMap[fk.onTable]) {
        edges.push({
          id: `e-${table.name}-${fk.onTable}-${fk.column}`,
          source: `table-${table.name}`,
          target: `table-${fk.onTable}`,
          label: fk.column,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#2563eb" },
        });
      }
    });
  });

  // TODO: Add Model Relationship Edges (virtual edges) if Schema link missing

  const layouted = getLayoutedElements(nodes, edges);

  return {
    nodes: layouted.nodes,
    edges: layouted.edges,
    metadata: {
      tables: schemaMap,
      models: modelMap,
      orphans: Object.keys(schemaMap).filter(
        (t) => !nodes.find((n) => n.data.table.name === t && n.data.model)
      ),
    },
  };
};
