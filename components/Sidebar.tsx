import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Download, Layers } from "lucide-react";
import { ToggleTheme } from "./ui/theme-toggle";

interface SidebarProps {
  loading: boolean;
  stats?: { migrations: number; models: number }; // Made optional
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}

export const Sidebar = ({
  loading,
  stats = { migrations: 0, models: 0 }, // Default value prevents crash
  onFileSelect,
  onExport,
}: SidebarProps) => {
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

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="relative">
            <input
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={onFileSelect}
            />
            <Button
              variant="outline"
              className="w-full justify-start h-11"
              disabled={loading}
            >
              <FolderOpen className="mr-2 h-4 w-4 text-primary" />
              {loading ? "Processing..." : "Import Project"}
            </Button>
          </div>

          <Button
            className="w-full justify-start h-11"
            variant="secondary"
            onClick={onExport}
            disabled={stats.models === 0 && stats.migrations === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export Data
          </Button>

          <div className="pt-4 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              Statistics
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground">Migrations</div>
                <div className="text-xl font-semibold text-foreground">
                  {stats.migrations}
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground">Models</div>
                <div className="text-xl font-semibold text-foreground">
                  {stats.models}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      <ToggleTheme />
    </div>
  );
};
