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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2, Key } from "lucide-react";
import { generateSchemaWithAI } from "@/lib/ai";
import {
  generateLaravelMigration,
  generateLaravelModel,
} from "@/lib/generators";

interface AIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (files: any[]) => void;
}

export function AIAssistant({
  open,
  onOpenChange,
  onGenerate,
}: AIAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "generating">("input");
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
      return;
    }
    if (!prompt) {
      setError("Please describe your project.");
      return;
    }

    setLoading(true);
    setError(null);
    setStep("generating");

    try {
      // 1. Get Schema from AI
      const schema = await generateSchemaWithAI(prompt, apiKey);

      // 2. Convert to Files
      const timestamp = new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, "")
        .slice(0, 14);
      const newFiles: any[] = [];

      // Migrations
      schema.tables.forEach((table, index) => {
        // Add 1 second to timestamp to ensure order
        const ts = (BigInt(timestamp) + BigInt(index)).toString();

        newFiles.push({
          name: `${ts}_create_${table.name}_table.php`,
          path: `/database/migrations/${ts}_create_${table.name}_table.php`,
          content: generateLaravelMigration(table, ts),
          type: "migration",
        });
      });

      // Models
      const modelsProcessed = new Set<string>();

      // We need to group relations by model
      const modelRelations: Record<string, any[]> = {};
      schema.relations.forEach((rel) => {
        if (!modelRelations[rel.fromModel]) modelRelations[rel.fromModel] = [];
        modelRelations[rel.fromModel].push(rel);
      });

      // Identify all unique models from tables (assuming table name -> Model Name)
      const toPascal = (s: string) =>
        s
          .replace(/(?:^\w|[A-Z]|\b\w)/g, (w) => w.toUpperCase())
          .replace(/_/g, "")
          .replace(/s$/, ""); // simplistic

      schema.tables.forEach((table) => {
        // Try to find if a model was explicitly named in relations, otherwise guess
        // This is a bit tricky. We'll generate models for every table that isn't a pivot.
        // For simplicity, let's assume the AI gave us relations using Model names.
        // We will generate a Model file for every "fromModel" and "toModel" seen,
        // PLUS any table that looks like an entity.

        // Better strategy: Just generate models for every table (singularized)
        const modelName = toPascal(table.name);
        if (!modelsProcessed.has(modelName)) {
          newFiles.push({
            name: `${modelName}.php`,
            path: `/app/Models/${modelName}.php`,
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
      onOpenChange(false);
      setPrompt("");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setStep("input");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="min-w-[35vw] sm:max-w-[40vw] flex flex-col p-0 bg-background border-r border-border"
      >
        <div className="p-6 border-b flex items-center justify-between bg-muted/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-4 h-4 text-primary" />
              <SheetTitle className="text-sm font-bold uppercase tracking-tight">
                AI Architect
              </SheetTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Describe your project, and I'll generate the database schema and
              models for you using Llama 3.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* API Key Section */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-2">
              <Key className="h-4 w-4" /> Groq API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="gsk_..."
              value={apiKey}
              onChange={handleSaveKey}
              className="bg-background"
            />
            <p className="text-[10px] text-muted-foreground">
              Key is stored locally in your browser.
            </p>
          </div>

          {/* Prompt Section */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Project Description</Label>
            <Textarea
              id="prompt"
              placeholder="e.g. A library management system where Users can borrow Books. Books have Authors and Categories..."
              className="h-60 resize-none bg-background font-mono text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-muted/20">
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt || !apiKey}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Schema...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Project
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
