"use client";

import React, { useState, useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { ThemeProvider } from "next-themes";

import EntityNode from "@/components/EntityNode";
import { Sidebar } from "@/components/Sidebar";
import { CodeEditorSheet } from "@/components/CodeEditorSheet";

import {
  processDirectoryUpload,
  FileEntry,
  exportProjectToZip,
} from "@/lib/file-system";
import {
  parseMigrations,
  parseModels,
  Table,
  Model,
  inferTargetTable,
} from "@/lib/parsers";

// --- Types needed for Graph ---
type GraphData = {
  nodes: Node[];
  edges: Edge[];
  rawFiles: FileEntry[]; // Keep raw files in memory for editing/exporting
  schema: Record<string, Table>;
  models: Model[];
};

// --- Layout Logic (Same as before) ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", ranksep: 200, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 320, height: 250 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 160,
      y: nodeWithPosition.y - 125,
    };
  });

  return { nodes, edges };
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawFiles, setRawFiles] = useState<FileEntry[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [editNodeData, setEditNodeData] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // --- 1. Graph Builder ---
  const buildGraph = useCallback(
    (files: FileEntry[]) => {
      const migrationFiles = files.filter((f) => f.type === "migration");
      const modelFiles = files.filter((f) => f.type === "model");

      const schema = parseMigrations(migrationFiles);
      const models = parseModels(modelFiles);

      const allTableNames = Object.keys(schema);

      const tempNodes: Node[] = [];
      const tempEdges: Edge[] = [];
      const processedTables = new Set<string>();

      const onEditNode = (data: any) => {
        setEditNodeData(data);
        setIsEditorOpen(true);
      };

      // Models
      models.forEach((model) => {
        const linkedTable = schema[model.table];
        if (linkedTable) processedTables.add(model.table);

        // Find the source file for this model
        const modelFile = modelFiles.find(
          (f) => f.name === `${model.class}.php`
        );
        // Find migration file(s) for this table (Heuristic: file content contains table name)
        // Note: This is a loose match. Ideally, parsers should return file origin.
        const associatedMigrations = migrationFiles.filter(
          (f) =>
            f.content.includes(`'${model.table}'`) ||
            f.content.includes(`"${model.table}"`)
        );

        tempNodes.push({
          id: model.class,
          type: "entity",
          position: { x: 0, y: 0 },
          data: {
            model,
            table: linkedTable || null,
            modelFile,
            migrationFiles: associatedMigrations,
            onEdit: onEditNode,
          },
        });
      });

      // Orphan/Pivot Tables
      Object.values(schema).forEach((table) => {
        if (!processedTables.has(table.name)) {
          const associatedMigrations = migrationFiles.filter((f) =>
            f.content.includes(`'${table.name}'`)
          );

          tempNodes.push({
            id: `tbl_${table.name}`,
            type: "entity",
            position: { x: 0, y: 0 },
            data: {
              model: null,
              table,
              migrationFiles: associatedMigrations,
              onEdit: onEditNode,
            },
          });
        }
      });

      // Edges
      tempNodes.forEach((sourceNode) => {
        const table = sourceNode.data.table as Table | null;
        if (!table) return;

        table.columns.forEach((col) => {
          if (col.isFk) {
            // 1. Check explicit FK mapping
            const explicitFk = table.foreignKeys.find(
              (f) => f.col === col.name
            );
            let targetTableName = explicitFk ? explicitFk.refTable : null;

            // 2. Fallback to Inference (user_id -> users)
            if (!targetTableName) {
              targetTableName = inferTargetTable(col.name, allTableNames);
            }

            if (targetTableName) {
              const targetNode = tempNodes.find(
                (n) =>
                  n.data.table?.name === targetTableName ||
                  n.data.model?.table === targetTableName
              );

              if (targetNode && targetNode.id !== sourceNode.id) {
                tempEdges.push({
                  id: `fk-${table.name}-${col.name}`,
                  source: sourceNode.id,
                  target: targetNode.id,
                  label: col.name,
                  type: "smoothstep", // Smoother lines
                  interactionWidth: 2,
                  animated: false,
                  style: { stroke: "#6366f1", strokeWidth: 1.5, opacity: 0.6 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                });
              }
            }
          }
        });
      });

      const layout = getLayoutedElements(tempNodes, tempEdges);
      setNodes(layout.nodes);
      setEdges(layout.edges);
      setRawFiles(files);
    },
    [setNodes, setEdges]
  );

  // --- 2. Handlers ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setLoading(true);
    try {
      const files = await processDirectoryUpload(e.target.files);
      buildGraph(files);
    } catch (err) {
      console.error(err);
      alert("Parsing failed. See console.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = (
    newModelCode: string | null,
    newMigrationCode: string | null
  ) => {
    // We need to update the `rawFiles` array with new content, then rebuild graph
    const updatedFiles = rawFiles.map((file) => {
      if (
        editNodeData.modelFile &&
        file.path === editNodeData.modelFile.path &&
        newModelCode
      ) {
        return { ...file, content: newModelCode };
      }
      // For migrations, we just update the first match (simplification)
      // In a real app, we need precise file ID matching
      if (
        editNodeData.migrationFiles?.[0] &&
        file.path === editNodeData.migrationFiles[0].path &&
        newMigrationCode
      ) {
        return { ...file, content: newMigrationCode };
      }
      return file;
    });

    setRawFiles(updatedFiles);
    buildGraph(updatedFiles); // Re-run analysis
  };

  const handleExport = () => {
    exportProjectToZip(rawFiles);
  };

  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);

  // --- 3. Render ---
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
        <Sidebar
          loading={loading}
          stats={{
            migrations: rawFiles.filter((f) => f.type === "migration").length,
            models: rawFiles.filter((f) => f.type === "model").length,
          }}
          onFileSelect={handleFileSelect}
          onExport={handleExport}
          filesList={rawFiles}
        />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            className="bg-slate-100 dark:bg-slate-900"
          >
            <Background
              className="dark:bg-slate-950"
              color="#94a3b8"
              gap={24}
              size={1}
            />
            <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-white" />
            <MiniMap
              className="dark:bg-slate-800 dark:border-slate-700"
              nodeColor={(n) => (n.data.table?.isPivot ? "#a855f7" : "#3b82f6")}
            />
          </ReactFlow>
        </div>

        <CodeEditorSheet
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          data={editNodeData}
          onSave={handleSaveChanges}
        />
      </div>
    </ThemeProvider>
  );
}
