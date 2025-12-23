import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface CodeEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: any; // The Node Data
  onSave: (modelCode: string | null, migrationCode: string | null) => void;
}

export const CodeEditorSheet = ({
  isOpen,
  onClose,
  data,
  onSave,
}: CodeEditorSheetProps) => {
  const [modelCode, setModelCode] = useState("");
  const [migrationCode, setMigrationCode] = useState("");

  // Load initial data when sheet opens or data changes
  useEffect(() => {
    if (data) {
      setModelCode(data.modelFile?.content || "");
      // If there are multiple migration files (rare for one table, but possible), we pick the first for now
      setMigrationCode(data.migrationFiles?.[0]?.content || "");
    }
  }, [data]);

  const handleSave = () => {
    onSave(
      data.modelFile ? modelCode : null,
      data.migrationFiles?.length ? migrationCode : null
    );
    onClose();
  };

  if (!data) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[90vw] flex flex-col h-full bg-white dark:bg-slate-950">
        <SheetHeader className="mb-4">
          <SheetTitle>
            Edit Entity: {data.model?.class || data.table?.name}
          </SheetTitle>
          <SheetDescription>
            Modify the source code directly. Changes will trigger a re-parse and
            graph update.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          defaultValue="model"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList>
            <TabsTrigger value="model" disabled={!data.modelFile}>
              Model (PHP)
            </TabsTrigger>
            <TabsTrigger
              value="migration"
              disabled={!data.migrationFiles?.length}
            >
              Migration (PHP)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="flex-1 mt-2">
            <Textarea
              className="font-mono text-xs h-full resize-none leading-relaxed dark:bg-slate-900 dark:text-slate-200"
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              spellCheck={false}
            />
          </TabsContent>

          <TabsContent value="migration" className="flex-1 mt-2">
            <Textarea
              className="font-mono text-xs h-full resize-none leading-relaxed dark:bg-slate-900 dark:text-slate-200"
              value={migrationCode}
              onChange={(e) => setMigrationCode(e.target.value)}
              spellCheck={false}
            />
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-4 pt-4 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes & Re-Parse</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
