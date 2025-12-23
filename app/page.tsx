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
import { AIAssistant } from "@/components/AIAssistant";
import { CLIViewer } from "@/components/CLIViewer";
import EntityNode from "@/components/EntityNode";
import { Sheet } from "@/components/ui/sheet";

import {
  parseProjectData,
  inferTargetTable,
  generateEdgeId,
  generateMigrationContent,
} from "@/lib/parsers";
import { processDirectoryUpload } from "@/lib/file-system";
import { Column } from "@/types";
import { getLayoutedElements } from "@/lib/layout";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const nodeTypes = { entity: EntityNode };

export default function ArchitectPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawFiles, setRawFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Modal Control
  const [showCLI, setShowCLI] = useState(false);

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

      const tempNodes = allTableNames.map((tName) => {
        const table = tableStates[tName];
        const model = models.find((m) => m.table === tName);

        const modelFile = files.find((f) => f.path === model?.filePath);
        const migrationFiles = files.filter((f) =>
          (tableToFileMap[tName] || []).includes(f.path)
        );

        return {
          id: tName,
          type: "entity",
          position: { x: 0, y: 0 }, // Position will be set by layout
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
          .forEach((col, index) => {
            const target = inferTargetTable(col.name, allTableNames);
            if (target && target !== tName) {
              tempEdges.push({
                // id: `e-${tName}-${target}-${col.name}`,
                id: generateEdgeId(tName, target, col.name, index),
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

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(tempNodes, tempEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
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

  const handleSave = (newColumns?: Column[]) => {
    if (!activeNodeData) return;

    let updatedMigCode = migCode;

    if (newColumns) {
      updatedMigCode = generateMigrationContent(
        migCode,
        activeNodeData.table.name,
        newColumns
      );
      setMigCode(updatedMigCode);
    }

    const updatedFiles = rawFiles.map((f) => {
      if (f.path === activeNodeData.modelFile?.path)
        return { ...f, content: modelCode };
      if (f.path === activeNodeData.migrationFiles?.[0]?.path)
        return { ...f, content: updatedMigCode };
      return f;
    });

    setRawFiles(updatedFiles);
    buildGraph(updatedFiles);
    setActiveNodeData(null);
  };

  const handleExport = async () => {
    const zip = new JSZip();

    rawFiles.forEach((file) => {
      // Create folder structure based on file path
      // Removing the leading slash if present to avoid empty root folder issues
      const relativePath = file.path.startsWith("/")
        ? file.path.slice(1)
        : file.path;
      zip.file(relativePath, file.content);
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "laravel-schema-export.zip");
  };

  const stats = useMemo(
    () => ({
      migrations: rawFiles.filter((f) => f.type === "migration").length,
      models: rawFiles.filter((f) => f.type === "model").length,
    }),
    [rawFiles]
  );

  const handleAIGenerated = (newFiles: any[]) => {
    // Merge with existing files or replace? User asked for "Start from scratch" OR "Add in existing".
    // For now, let's just append to existing files to support both use cases.
    // Ideally we should check for duplicates.

    setRawFiles((prev) => {
      const fileMap = new Map();
      prev.forEach((f) => fileMap.set(f.path, f));
      newFiles.forEach((f) => fileMap.set(f.path, f)); // Overwrite existing

      const unique = Array.from(fileMap.values());
      buildGraph(unique);
      return unique;
    });
  };

  const handleNodeSelect = (nodeId: string) => {
    if (rfInstance) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        rfInstance.setCenter(node.position.x, node.position.y, {
          zoom: 1,
          duration: 800,
        });
      }
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar
        loading={loading}
        stats={stats}
        onFileSelect={handleUpload}
        onExport={handleExport}
        onOpenCLI={() => setShowCLI(true)}
        nodes={nodes}
        onNodeSelect={handleNodeSelect}
      />

      <main className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          className="bg-muted/10"
          onInit={setRfInstance}
        >
          <Background color="var(--color-bg)" gap={24} />
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
            <SupabaseEditor data={activeNodeData} onSave={handleSave} />
          )}
        </Sheet>

        <AIAssistant
          open={true}
          onOpenChange={() => {}}
          onGenerate={handleAIGenerated}
          nodes={nodes}
        />

        <CLIViewer open={showCLI} onOpenChange={setShowCLI} files={rawFiles} />
      </main>
    </div>
  );
}
