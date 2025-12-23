import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wand2,
  Loader2,
  Key,
  ChevronUp,
  ChevronDown,
  Settings2,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { generateSchemaWithAI } from "@/lib/ai";
import {
  generateLaravelMigration,
  generateLaravelModel,
} from "@/lib/generators";

interface AIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (files: any[]) => void;
  nodes?: any[];
}

export function AIAssistant({
  open,
  onOpenChange,
  onGenerate,
  nodes = [],
}: AIAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("groq_api_key");
    if (storedKey) setApiKey(storedKey);
  }, []);

  const handleSaveKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem("groq_api_key", key);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("Please enter a Groq API Key first.");
      setShowSettings(true);
      return;
    }
    if (!prompt) {
      setError("Please describe your project.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Prepare Context from existing nodes
      const currentSchemaContext =
        nodes.length > 0
          ? nodes
              .filter((n) => n.data?.table)
              .map((n) => {
                const t = n.data.table;
                const cols = t.columns
                  .map(
                    (c: any) => `${c.name}:${c.type}${c.nullable ? "?" : ""}`
                  )
                  .join(", ");
                return `Table: ${t.name} (Columns: ${cols})`;
              })
              .join("\n")
          : undefined;

      // 2. Get Schema from AI
      const schema = await generateSchemaWithAI(
        prompt,
        apiKey,
        currentSchemaContext
      );

      // 3. Convert to Files
      const timestamp = new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, "")
        .slice(0, 14);
      const newFiles: any[] = [];

      // Helper to find existing file for a table
      const findExistingMigration = (tableName: string) => {
        const node = nodes.find((n) => n.data?.table?.name === tableName);
        return node?.data?.migrationFiles?.[0]; // Assuming first migration is the create one
      };

      const findExistingModel = (modelName: string) => {
        // Models are usually inferred from table name, but let's check files if possible
        // The node stores 'modelFile'
        const node = nodes.find(
          (n) =>
            n.data?.model?.class === modelName ||
            n.data?.table?.name === modelName.toLowerCase() + "s"
        );
        return node?.data?.modelFile;
      };

      // Migrations
      schema.tables.forEach((table, index) => {
        const existingFile = findExistingMigration(table.name);

        let path, name, ts;
        if (existingFile) {
          // Reuse existing path and filename to overwrite
          path = existingFile.path;
          name = existingFile.name;
          // Extract timestamp from filename if possible, or just use current
          ts = timestamp;
        } else {
          // Create new
          ts = (BigInt(timestamp) + BigInt(index)).toString();
          name = `${ts}_create_${table.name}_table.php`;
          path = `/database/migrations/${name}`;
        }

        newFiles.push({
          name,
          path,
          content: generateLaravelMigration(table, ts),
          type: "migration",
        });
      });

      // Models
      const modelsProcessed = new Set<string>();
      const modelRelations: Record<string, any[]> = {};
      schema.relations.forEach((rel) => {
        if (!modelRelations[rel.fromModel]) modelRelations[rel.fromModel] = [];
        modelRelations[rel.fromModel].push(rel);
      });

      const toPascal = (s: string) =>
        s
          .replace(/(?:^\w|[A-Z]|\b\w)/g, (w) => w.toUpperCase())
          .replace(/_/g, "")
          .replace(/s$/, "");

      schema.tables.forEach((table) => {
        const modelName = toPascal(table.name);
        if (!modelsProcessed.has(modelName)) {
          const existingModelFile = findExistingModel(modelName);

          newFiles.push({
            name: existingModelFile
              ? existingModelFile.name
              : `${modelName}.php`,
            path: existingModelFile
              ? existingModelFile.path
              : `/app/Models/${modelName}.php`,
            content: generateLaravelModel(
              modelName,
              table.name,
              modelRelations[modelName] || []
            ),
            type: "model",
          });
          modelsProcessed.add(modelName);
        }
      });

      onGenerate(newFiles);
      setPrompt("");
      setIsExpanded(false); // Minimize after success
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 transition-all duration-300 ease-in-out">
      <div className="bg-background border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col">
        {/* Header / Title Bar */}
        <div
          className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer border-b border-border/50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Wand2 className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">AI Architect</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* API Key Settings (Collapsible) */}
        {showSettings && (
          <div className="p-4 bg-muted/10 border-b border-border/50 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <Label
                htmlFor="apiKey"
                className="flex items-center gap-2 text-xs"
              >
                <Key className="h-3 w-3" /> Groq API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={handleSaveKey}
                  className="h-8 text-xs bg-background"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setShowSettings(false)}
                >
                  Done
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Key is stored locally in your browser.
              </p>
            </div>
          </div>
        )}

        {/* Main Input Area */}
        <div
          className={`p-4 transition-all duration-300 ${
            isExpanded ? "h-64" : "h-auto"
          }`}
        >
          <div className="relative h-full flex flex-col gap-3">
            <Textarea
              placeholder="Describe your project (e.g., 'Create a blog with posts and comments') or changes (e.g., 'Add phone number to users table')..."
              className={`resize-none bg-background font-mono text-sm border-0 focus-visible:ring-0 p-0 shadow-none ${
                isExpanded ? "flex-1" : "h-10 min-h-[40px]"
              }`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground">
                {nodes.length > 0
                  ? `${nodes.length} existing tables in context`
                  : "Start from scratch"}
              </span>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={loading || !prompt}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                ) : (
                  <Wand2 className="w-3 h-3 mr-2" />
                )}
                {loading ? "Thinking..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
