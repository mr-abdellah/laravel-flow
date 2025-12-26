"use client";

import React, { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { Sidebar } from "@/components/Sidebar";
import EntityNode from "@/components/EntityNode";
import { parseProjectData } from "@/lib/parsers";
import { getLayoutedElements } from "@/lib/layout";
import {
  generateSQL,
  generateLaravelMigration,
  generateTypeScriptInterfaces,
  generateLaravelModel,
} from "@/lib/generators";

import { useUser, useUpdateApiKey } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  MessageSquare,
  Send,
  Plus,
  Settings,
  ChevronRight,
  ChevronLeft,
  Database,
  Wand2,
  Bot,
  User,
  Search,
  Check,
} from "lucide-react";
import api from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { SupabaseEditor } from "@/components/SupabaseEditor";

const nodeTypes = { entity: EntityNode };

interface Chat {
  id: number;
  title: string;
  created_at: string;
}

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

const pluralize = (str: string) => {
  if (str.endsWith("s")) return str;
  if (str.endsWith("y") && !/[aeiou]y$/.test(str)) {
    return str.slice(0, -1) + "ies";
  }
  if (/(s|sh|ch|x|z)$/.test(str)) {
    return str + "es";
  }
  return str + "s";
};

const singularize = (str: string) => {
  if (str.endsWith("ies")) return str.slice(0, -3) + "y";
  if (str.endsWith("es") && /(s|sh|ch|x|z)es$/.test(str))
    return str.slice(0, -2);
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
};

const toPascalCase = (str: string) =>
  str.replace(/(^\w|_\w)/g, (m) => m.replace("_", "").toUpperCase());

export default function ArchitectPage() {
  // --- Auth & Router ---
  const { data: user, isLoading: isUserLoading } = useUser();
  const router = useRouter();

  // --- Architect State ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [projectStats, setProjectStats] = useState({
    migrations: 0,
    models: 0,
  });
  const [editingNode, setEditingNode] = useState<any>(null);

  // --- Chat State ---
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newChatTitle, setNewChatTitle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    number | null
  >(null);

  const updateApiKey = useUpdateApiKey();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
    if (user && user.api_key) {
      setApiKey(user.api_key);
    }
  }, [user, isUserLoading, router]);

  // --- Chat Queries ---
  const { data: chats } = useQuery<Chat[]>({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data } = await api.get("/chats");
      return data;
    },
    enabled: !!user,
  });

  const filteredChats = (chats ?? []).filter((chat) => {
    if (!sessionQuery.trim()) return true;
    return chat.title.toLowerCase().includes(sessionQuery.trim().toLowerCase());
  });

  const selectedChat =
    chats?.find((chat) => chat.id === selectedChatId) ?? null;

  const { data: messages, isLoading: isMessagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];
      const { data } = await api.get(`/chats/${selectedChatId}`);
      return data;
    },
    enabled: !!selectedChatId,
    refetchInterval: 5000,
  });

  const formatSessionDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // --- AI Graph Update Logic ---
  const onNodeEdit = useCallback((data: any) => {
    setEditingNode(data);
  }, []);

  const handleSaveNode = useCallback(
    (updatedColumns: any[]) => {
      if (!editingNode) return;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === editingNode.table.name) {
            return {
              ...node,
              data: {
                ...node.data,
                table: {
                  ...node.data.table,
                  columns: updatedColumns,
                },
                onEdit: onNodeEdit, // Ensure onEdit is preserved
              },
            };
          }
          return node;
        })
      );
      setEditingNode(null);
    },
    [editingNode, setNodes, onNodeEdit]
  );

  // --- AI Graph Update Logic ---
  const updateGraphFromAI = useCallback(
    (schema: any) => {
      if (!schema.tables) return;

      const newNodes = schema.tables.map((table: any) => ({
        id: table.name,
        type: "entity",
        position: { x: 0, y: 0 },
        data: {
          table: {
            name: table.name,
            columns: table.columns.map((c: any) => ({
              name: c.name,
              type: c.type,
              nullable: c.nullable,
              isPk: c.name === "id",
              isFk: c.name.endsWith("_id"),
            })),
          },
          onEdit: onNodeEdit,
        },
      }));

      const newEdges: any[] = [];
      const existingEdges = new Set<string>();
      const linkedPairs = new Set<string>(); // "tableA:tableB" (sorted)

      // Create a lookup map of table names for easier searching
      const tableNameMap = new Map<string, string>();
      schema.tables.forEach((table: any) => {
        const tableName = table.name.toLowerCase();
        tableNameMap.set(tableName, table.name);
        // Also add singular version
        const singular = singularize(tableName);
        if (!tableNameMap.has(singular)) {
          tableNameMap.set(singular, table.name);
        }
      });

      // 1. Infer relations from foreign keys (PRIORITY)
      schema.tables.forEach((table: any) => {
        table.columns.forEach((col: any) => {
          if (col.name.endsWith("_id") && col.name !== "id") {
            const fkBase = col.name.replace("_id", "").toLowerCase();
            const source = table.name;

            // Try to find the target table by checking:
            // 1. Exact plural match
            // 2. Exact singular match
            // 3. Pluralized version of the FK base
            let target = tableNameMap.get(fkBase);
            if (!target) {
              target = tableNameMap.get(pluralize(fkBase));
            }

            if (target && source !== target) {
              const edgeId = `${source}-${target}-inferred`;
              newEdges.push({
                id: edgeId,
                source,
                target,
                sourceHandle: `source-${col.name}`,
                targetHandle: `target-id`,
                label: "belongsTo",
                type: "smoothstep",
                animated: true,
                style: { strokeDasharray: "5,5" },
              });

              existingEdges.add(edgeId);
              const pair = [source, target].sort().join(":");
              linkedPairs.add(pair);
            }
          }
        });
      });

      // 2. Add AI-provided relations (Only if not already linked by FK)
      if (schema.relations) {
        schema.relations.forEach((rel: any) => {
          const sourceLower = rel.fromModel.toLowerCase();
          const targetLower = rel.toModel.toLowerCase();

          const source =
            tableNameMap.get(pluralize(sourceLower)) ||
            tableNameMap.get(sourceLower);
          const target =
            tableNameMap.get(pluralize(targetLower)) ||
            tableNameMap.get(targetLower);

          if (source && target) {
            const edgeId = `${source}-${target}-${rel.type}`;
            const pair = [source, target].sort().join(":");

            if (!linkedPairs.has(pair) && !existingEdges.has(edgeId)) {
              newEdges.push({
                id: edgeId,
                source,
                target,
                label: rel.type,
                type: "smoothstep",
                animated: true,
              });
              existingEdges.add(edgeId);
              linkedPairs.add(pair);
            }
          }
        });
      }

      const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(
        newNodes,
        newEdges
      );
      setNodes(layoutNodes);
      setEdges(layoutEdges);
      setProjectStats({
        migrations: 0,
        models: newNodes.length,
      });
    },
    [setNodes, setEdges]
  );

  // Watch for new AI messages containing schema
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Find the latest message that might contain a schema
    const reversedMessages = [...messages].reverse();
    const schemaMessage = reversedMessages.find(
      (msg) =>
        msg.role === "assistant" &&
        (msg.content.includes("```json") || msg.content.trim().startsWith("{"))
    );

    if (schemaMessage && schemaMessage.id !== lastProcessedMessageId) {
      try {
        // Try to parse JSON from the content
        // The AI might wrap JSON in markdown code blocks, strip them
        let cleanContent = schemaMessage.content.trim();
        const jsonMatch =
          cleanContent.match(/```json\n([\s\S]*?)\n```/) ||
          cleanContent.match(/```\n([\s\S]*?)\n```/);

        if (jsonMatch) {
          cleanContent = jsonMatch[1];
        } else if (cleanContent.startsWith("```json")) {
          cleanContent = cleanContent
            .replace(/^```json/, "")
            .replace(/```$/, "");
        } else if (cleanContent.startsWith("```")) {
          cleanContent = cleanContent.replace(/^```/, "").replace(/```$/, "");
        }

        const aiResponse = JSON.parse(cleanContent);
        if (aiResponse.tables && Array.isArray(aiResponse.tables)) {
          updateGraphFromAI(aiResponse);
          setLastProcessedMessageId(schemaMessage.id);
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    }
  }, [messages, updateGraphFromAI, lastProcessedMessageId]);

  // Clear graph when switching chats
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setProjectStats({ migrations: 0, models: 0 });
    setLastProcessedMessageId(null);
  }, [selectedChatId, setNodes, setEdges]);

  const createChat = useMutation({
    mutationFn: async (title: string) => {
      const { data } = await api.post("/chats", { title });
      return data;
    },
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setSelectedChatId(newChat.id);
      setNewChatTitle("");
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      chatId,
      message,
    }: {
      chatId: number;
      message: string;
    }) => {
      const { data } = await api.post(`/chats/${chatId}/send`, { message });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedChatId] });
      setNewMessage("");
    },
  });

  const handleUpdateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiKey.mutate(apiKey, {
      onSuccess: () => setIsApiKeyDialogOpen(false),
    });
  };

  const buildGraph = useCallback(
    (files: any[]) => {
      const { tableStates } = parseProjectData(
        files.filter((f) => f.type === "migration"),
        files.filter((f) => f.type === "model")
      );

      const allTableNames = Object.keys(tableStates);
      const tempNodes = allTableNames.map((tName) => {
        return {
          id: tName,
          type: "entity",
          position: { x: 0, y: 0 },
          data: { table: tableStates[tName] },
        };
      });

      const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(
        tempNodes,
        []
      );
      setNodes(layoutNodes);
      setEdges(layoutEdges);
      setProjectStats({
        migrations: files.filter((f) => f.type === "migration").length,
        models: files.filter((f) => f.type === "model").length,
      });
    },
    [setNodes, setEdges]
  );

  const handleExport = (format: string) => {
    if (!nodes || nodes.length === 0) return;

    const tables = nodes.map((n) => n.data.table);
    let content = "";
    let filename = `export.${format}`;

    if (format === "sql") {
      content = tables.map((t: any) => generateSQL(t)).join("\n\n");
      filename = "database.sql";
    } else if (format === "json") {
      content = JSON.stringify(tables, null, 2);
      filename = "schema.json";
    } else if (format === "migration") {
      content = tables
        .map((t: any) =>
          generateLaravelMigration(
            {
              name: t.name,
              columns: t.columns.map((c: any) => ({
                name: c.name,
                type: c.type,
                nullable: c.nullable,
                isPk: c.isPk,
              })),
            },
            new Date().toISOString()
          )
        )
        .join("\n\n// -----------------------------------------\n\n");
      filename = "migrations.php";
    } else if (format === "ts_interfaces") {
      content = generateTypeScriptInterfaces(tables);
      filename = "types.ts";
    } else if (format === "laravel_models") {
      content = tables
        .map((t: any) => {
          const tableName = t.name;
          const modelName = toPascalCase(singularize(tableName));

          const relevantEdges = edges.filter((e) => e.source === tableName);

          const relations = relevantEdges.map((e) => {
            const targetTable = e.target;
            const relationType = (e.label as string) || "hasMany";

            let methodName = targetTable;
            if (relationType === "belongsTo" || relationType === "hasOne") {
              methodName = singularize(targetTable);
            }

            const toModel = toPascalCase(singularize(targetTable));

            return {
              fromModel: modelName,
              type: relationType,
              toModel: toModel,
              methodName: methodName,
            };
          });

          return generateLaravelModel(
            modelName,
            tableName,
            relations,
            t.columns
          );
        })
        .join("\n\n// -----------------------------------------\n\n");
      filename = "models.php";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onNodeSelect = useCallback(
    (nodeId: string) => {
      if (rfInstance) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          rfInstance.setCenter(
            node.position.x + 150, // Center with some offset
            node.position.y + 100,
            { zoom: 1, duration: 800 }
          );
        }
      }
    },
    [rfInstance, nodes]
  );

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* LEFT SIDEBAR (Architect Tools / File Upload) */}
      <div className="w-64 border-r bg-card flex-col z-10 hidden md:flex shadow-sm">
        <Sidebar
          onBuildGraph={buildGraph}
          loading={false}
          onExport={handleExport}
          onOpenCLI={() => {}}
          nodes={nodes}
          stats={projectStats}
          onNodeSelect={onNodeSelect}
        />
      </div>

      {/* CENTER: ReactFlow Canvas */}
      <div className="flex-1 relative bg-muted/10">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/10"
          onInit={setRfInstance}
        >
          <Background gap={16} size={1} />
          <Controls className="bg-card border-border shadow-sm" />
          <MiniMap className="bg-card border-border shadow-sm" />
        </ReactFlow>
      </div>

      {/* RIGHT SIDEBAR: Chat & Discussion */}
      <div
        className={`flex flex-col border-l bg-background transition-all duration-300 shadow-xl z-20 ${
          isChatSidebarOpen ? "w-[400px]" : "w-0"
        }`}
      >
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/30 backdrop-blur-sm">
          {isChatSidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm leading-none">
                  Architect AI
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[210px]">
                  {selectedChat ? selectedChat.title : "Start a new session"}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
          >
            {isChatSidebarOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isChatSidebarOpen && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat List / Actions */}
            <div className="p-3 border-b flex items-center gap-2 bg-background">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs font-medium border-dashed hover:border-solid hover:bg-muted/50"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" /> New Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start New Session</DialogTitle>
                  </DialogHeader>
                  <div className="flex gap-2 mt-4">
                    <Input
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="Session Name (e.g., E-commerce DB)"
                    />
                    <Button
                      onClick={() => createChat.mutate(newChatTitle)}
                      disabled={!newChatTitle}
                    >
                      Create
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isSessionsDialogOpen}
                onOpenChange={setIsSessionsDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title="Sessions"
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Sessions</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={sessionQuery}
                        onChange={(e) => setSessionQuery(e.target.value)}
                        placeholder="Search sessions..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                      placeholder="New session name..."
                    />
                    <Button
                      onClick={() => createChat.mutate(newChatTitle)}
                      disabled={!newChatTitle}
                    >
                      Create
                    </Button>
                  </div>
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <ScrollArea className="h-80">
                      {filteredChats.length === 0 ? (
                        <div className="p-6 text-sm text-center text-muted-foreground">
                          No sessions found.
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredChats.map((chat) => {
                            const isSelected = selectedChatId === chat.id;
                            return (
                              <button
                                key={chat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChatId(chat.id);
                                  setIsSessionsDialogOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ${
                                  isSelected ? "bg-muted/50" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium truncate">
                                        {chat.title}
                                      </span>
                                      {isSelected && (
                                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {formatSessionDate(chat.created_at)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isApiKeyDialogOpen}
                onOpenChange={setIsApiKeyDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>AI Settings</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={handleUpdateApiKey}
                    className="space-y-4 mt-4"
                  >
                    <Label>OpenAI/Groq API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <Button type="submit" disabled={updateApiKey.isPending}>
                      Save Configuration
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-hidden p-4 bg-muted/10 relative">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6 pb-4">
                  {selectedChatId ? (
                    isMessagesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (
                      messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center mt-1">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-card border text-card-foreground rounded-bl-sm"
                            }`}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed">
                              {msg.content.startsWith("{") ? (
                                <div className="flex items-center gap-2 text-xs italic opacity-90">
                                  <Database className="h-3 w-3" />
                                  <span>Schema Updated</span>
                                </div>
                              ) : (
                                msg.content
                              )}
                            </div>
                          </div>
                          {msg.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center mt-1">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground p-8 opacity-50">
                      <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Wand2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        Welcome to Architect AI
                      </h3>
                      <p className="text-sm max-w-[200px]">
                        Start a new session to design your database structure
                        with AI.
                      </p>
                    </div>
                  )}
                  {sendMessage.isPending && (
                    <div className="flex justify-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                        <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-background">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newMessage.trim() && selectedChatId) {
                    sendMessage.mutate({
                      chatId: selectedChatId,
                      message: newMessage,
                    });
                  }
                }}
                className="relative"
              >
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim() && selectedChatId) {
                        sendMessage.mutate({
                          chatId: selectedChatId,
                          message: newMessage,
                        });
                      }
                    }
                  }}
                  placeholder="Describe your database requirements..."
                  className="pr-12 min-h-[50px] max-h-[150px] resize-none shadow-sm text-sm"
                  disabled={sendMessage.isPending || !selectedChatId}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-lg transition-transform active:scale-95"
                  disabled={
                    !newMessage.trim() ||
                    sendMessage.isPending ||
                    !selectedChatId
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <div className="text-[10px] text-muted-foreground text-center mt-2">
                AI can make mistakes. Review generated schemas.
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button when closed */}
        {!isChatSidebarOpen && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
            <Button
              variant="secondary"
              className="rounded-l-full rounded-r-none h-12 w-6 p-0 shadow-md border-l border-y"
              onClick={() => setIsChatSidebarOpen(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Sheet
        open={!!editingNode}
        onOpenChange={(open) => !open && setEditingNode(null)}
      >
        {editingNode && (
          <SupabaseEditor data={editingNode} onSave={handleSaveNode} />
        )}
      </Sheet>
    </div>
  );
}
