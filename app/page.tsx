"use client";

import React, { useState, useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { Sidebar } from "@/components/Sidebar";
import { SupabaseEditor } from "@/components/SupabaseEditor";
import EntityNode from "@/components/EntityNode";
import { Sheet } from "@/components/ui/sheet";

import { parseProjectData, inferTargetTable } from "@/lib/parsers";
import { processDirectoryUpload } from "@/lib/file-system";

const nodeTypes = { entity: EntityNode };

export default function ArchitectPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sheet Control
  const [activeNodeData, setActiveNodeData] = useState<any>(null);
  const [modelCode, setModelCode] = useState("");
  const [migCode, setMigCode] = useState("");

  const buildGraph = useCallback(
    (files: any[]) => {
      const { tableStates, models, tableToFileMap } = parseProjectData(
        files.filter((f) => f.type === "migration"),
        files.filter((f) => f.type === "model")
      );

      const allTableNames = Object.keys(tableStates);

      const tempNodes = allTableNames.map((tName, idx) => {
        const table = tableStates[tName];
        const model = models.find((m) => m.table === tName);

        const modelFile = files.find((f) => f.path === model?.filePath);
        const migrationFiles = files.filter((f) =>
          (tableToFileMap[tName] || []).includes(f.path)
        );

        return {
          id: tName,
          type: "entity",
          position: { x: (idx * 300) % 1200, y: Math.floor(idx / 4) * 450 },
          data: {
            table,
            model,
            modelFile,
            migrationFiles,
            onEdit: (data: any) => {
              setActiveNodeData(data);
              setModelCode(data.modelFile?.content || "");
              // Display first migration by default in editor
              setMigCode(data.migrationFiles?.[0]?.content || "");
            },
          },
        };
      });

      const tempEdges: any[] = [];
      allTableNames.forEach((tName) => {
        tableStates[tName].columns
          .filter((c) => c.isFk)
          .forEach((col) => {
            const target = inferTargetTable(col.name, allTableNames);
            if (target && target !== tName) {
              tempEdges.push({
                id: `e-${tName}-${target}-${col.name}`,
                source: tName,
                target: target,
                type: "smoothstep",
                label: col.name,
                labelStyle: {
                  fontSize: 8,
                  fill: "var(--color-muted-foreground)",
                },
                style: {
                  stroke: "var(--color-primary)",
                  strokeWidth: 2,
                  opacity: 0.4,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "var(--color-primary)",
                },
              });
            }
          });
      });

      setNodes(tempNodes);
      setEdges(tempEdges);
    },
    [setNodes, setEdges]
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setLoading(true);
    try {
      const files = await processDirectoryUpload(e.target.files);
      setRawFiles(files);
      buildGraph(files);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!activeNodeData) return;

    const updatedFiles = rawFiles.map((f) => {
      if (f.path === activeNodeData.modelFile?.path)
        return { ...f, content: modelCode };
      if (f.path === activeNodeData.migrationFiles?.[0]?.path)
        return { ...f, content: migCode };
      return f;
    });

    setRawFiles(updatedFiles);
    buildGraph(updatedFiles);
    setActiveNodeData(null);
  };

  const stats = useMemo(
    () => ({
      migrations: rawFiles.filter((f) => f.type === "migration").length,
      models: rawFiles.filter((f) => f.type === "model").length,
    }),
    [rawFiles]
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar
        loading={loading}
        stats={stats}
        onFileSelect={handleUpload}
        onExport={() => {}}
      />

      <main className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          className="bg-muted/10"
        >
          <Background color="var(--color-border)" gap={24} />
          <Controls className="bg-background border-border fill-foreground" />
          <MiniMap
            className="bg-background border-border"
            nodeColor="var(--color-primary)"
          />
        </ReactFlow>

        <Sheet
          open={!!activeNodeData}
          onOpenChange={() => setActiveNodeData(null)}
        >
          {activeNodeData && (
            <SupabaseEditor
              data={activeNodeData}
              modelCode={modelCode}
              setModelCode={setModelCode}
              migCode={migCode}
              setMigCode={setMigCode}
              onSave={handleSave}
            />
          )}
        </Sheet>
      </main>
    </div>
  );
}
