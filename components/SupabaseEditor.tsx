import React from "react";
import { SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, FileCode, CheckCircle2 } from "lucide-react";

export const SupabaseEditor = ({
  data,
  modelCode,
  setModelCode,
  migCode,
  setMigCode,
  onSave,
}: any) => {
  return (
    <SheetContent
      side="right"
      className="w-[600px] sm:max-w-[50vw] p-0 flex flex-col bg-slate-50 dark:bg-slate-950 border-l dark:border-slate-800"
    >
      <div className="p-6 border-b bg-white dark:bg-slate-950 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Code2 className="text-indigo-500" />{" "}
            {data.model?.class || data.table?.name}
          </h2>
          <p className="text-xs text-slate-500">
            Edit source code for this entity
          </p>
        </div>
        <button
          onClick={onSave}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors"
        >
          <CheckCircle2 size={14} /> Save Changes
        </button>
      </div>

      <Tabs defaultValue="model" className="flex-1 flex flex-col">
        <div className="px-6 bg-white dark:bg-slate-950 border-b">
          <TabsList className="bg-transparent h-12 p-0 gap-6">
            <TabsTrigger
              value="model"
              className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none bg-transparent px-0 h-full"
            >
              Model
            </TabsTrigger>
            <TabsTrigger
              value="migration"
              className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none bg-transparent px-0 h-full"
            >
              Migration
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="model" className="flex-1 m-0 p-0">
          <textarea
            className="w-full h-full p-6 font-mono text-sm bg-transparent outline-none resize-none dark:text-slate-300"
            value={modelCode}
            onChange={(e) => setModelCode(e.target.value)}
          />
        </TabsContent>
        <TabsContent value="migration" className="flex-1 m-0 p-0">
          <textarea
            className="w-full h-full p-6 font-mono text-sm bg-transparent outline-none resize-none dark:text-slate-300"
            value={migCode}
            onChange={(e) => setMigCode(e.target.value)}
          />
        </TabsContent>
      </Tabs>
    </SheetContent>
  );
};
