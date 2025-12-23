import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  FolderOpen,
  Download,
  Moon,
  Sun,
  Database,
  Code2,
} from "lucide-react";
import { useTheme } from "next-themes";

interface SidebarProps {
  loading: boolean;
  stats: { migrations: number; models: number };
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  filesList: any[]; // For a file browser view if needed
}

export const Sidebar = ({
  loading,
  stats,
  onFileSelect,
  onExport,
}: SidebarProps) => {
  const { setTheme, theme } = useTheme();

  return (
    <div className="w-[300px] bg-white dark:bg-slate-950 border-r dark:border-slate-800 flex flex-col h-full shadow-xl z-20">
      <div className="p-4 border-b dark:border-slate-800">
        <h1 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
          <Database className="text-indigo-600" />
          LaraGraph
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Static Architecture Visualizer
        </p>
      </div>

      <ScrollArea className="flex-1 p-4 space-y-6">
        {/* Actions */}
        <div className="space-y-3">
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
              className="w-full justify-start"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="mr-2 h-4 w-4" />
              )}
              {loading ? "Scanning..." : "Open Project Root"}
            </Button>
          </div>

          <Button
            className="w-full justify-start"
            variant="secondary"
            onClick={onExport}
            disabled={stats.models === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export Edited Code
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mt-6">
          <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {stats.migrations}
            </div>
            <div className="text-[10px] uppercase text-slate-500 font-bold">
              Migrations
            </div>
          </div>
          <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-pink-600">
              {stats.models}
            </div>
            <div className="text-[10px] uppercase text-slate-500 font-bold">
              Models
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="mt-6 pt-6 border-t dark:border-slate-800">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
            Appearance
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4 mr-1" /> Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4 mr-1" /> Dark
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
