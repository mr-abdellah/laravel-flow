import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Download,
  Layers,
  Terminal,
  Search,
  Table,
  Wand2,
  Database,
  Code2,
  FileCode,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleTheme } from "./ui/theme-toggle";

interface SidebarProps {
  loading: boolean;
  stats?: { migrations: number; models: number };
  onBuildGraph: (files: any[]) => void;
  onExport: (format: string) => void;
  onOpenCLI: () => void;
  nodes?: any[];
  onNodeSelect?: (nodeId: string) => void;
}

export const Sidebar = ({
  loading,
  stats = { migrations: 0, models: 0 },
  onBuildGraph,
  onExport,
  onOpenCLI,
  nodes = [],
  onNodeSelect,
}: SidebarProps) => {
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setProcessing(true);

    const files = Array.from(e.target.files);
    const processedFiles = await Promise.all(
      files.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            const path = file.webkitRelativePath || file.name;
            let type = "other";
            if (path.includes("database/migrations")) type = "migration";
            if (path.includes("app/Models")) type = "model";

            resolve({
              name: file.name,
              path,
              content,
              type,
            });
          };
          reader.readAsText(file);
        });
      })
    );

    onBuildGraph(processedFiles);
    setProcessing(false);
  };

  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter((node) =>
      node.data?.table?.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [nodes, search]);

  return (
    <div className="w-[280px] bg-card border-r border-border flex flex-col h-full shadow-sm z-20">
      <div className="p-6 border-b border-border">
        <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
          <div className="p-1.5 bg-primary rounded-md">
            <Layers size={18} className="text-primary-foreground" />
          </div>
          LaraGraph
        </h1>
      </div>

      <div className="p-4 pb-0 space-y-2">
        <div className="relative">
          <input
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            className="w-full justify-start h-10"
            disabled={loading || processing}
          >
            <FolderOpen className="mr-2 h-4 w-4 text-primary" />
            {loading || processing ? "Processing..." : "Import Project"}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="w-full justify-start h-9 px-2 text-xs"
                  variant="secondary"
                  disabled={stats.models === 0 && stats.migrations === 0}
                >
                  <Download className="mr-2 h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => onExport("laravel")}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Laravel Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("sql")}>
                  <Database className="mr-2 h-4 w-4" /> SQL (MySQL)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("prisma")}>
                  <Code2 className="mr-2 h-4 w-4" /> Prisma Schema
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("django")}>
                  <FileCode className="mr-2 h-4 w-4" /> Django Models
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("ts_interfaces")}>
                  <FileCode className="mr-2 h-4 w-4" /> TypeScript Interfaces
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("laravel_models")}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Laravel Models
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="w-full justify-start h-9 px-2 text-xs"
              variant="secondary"
              onClick={onOpenCLI}
              disabled={stats.models === 0 && stats.migrations === 0}
            >
              <Terminal className="mr-2 h-3.5 w-3.5" /> CLI
            </Button>
          </div>

          {/* Search & List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Database Tables
              </p>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {nodes.length}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                className="h-8 pl-8 text-xs bg-muted/30"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              {filteredNodes.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  {nodes.length === 0 ? "No tables found" : "No matches"}
                </div>
              ) : (
                filteredNodes.map((node) => (
                  <Button
                    key={node.id}
                    variant="ghost"
                    className="w-full justify-start h-8 px-2 text-sm font-normal hover:bg-muted/50"
                    onClick={() => onNodeSelect?.(node.id)}
                  >
                    <Table className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{node.data?.table?.name}</span>
                  </Button>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              Project Stats
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 p-2 rounded-md border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">
                  Migrations
                </div>
                <div className="text-lg font-semibold text-foreground leading-tight">
                  {stats.migrations}
                </div>
              </div>
              <div className="bg-muted/30 p-2 rounded-md border border-border/50">
                <div className="text-[10px] text-muted-foreground uppercase">
                  Models
                </div>
                <div className="text-lg font-semibold text-foreground leading-tight">
                  {stats.models}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-border">
        <ToggleTheme />
      </div>
    </div>
  );
};
