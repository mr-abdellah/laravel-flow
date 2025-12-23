"use client";

import { useUser, useLogout, useUpdateApiKey } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  LogOut,
  MessageSquare,
  Send,
  Plus,
  Settings,
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

export default function DashboardPage() {
  const { data: user, isLoading: isUserLoading } = useUser();
  const router = useRouter();
  const logout = useLogout();
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newChatTitle, setNewChatTitle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const updateApiKey = useUpdateApiKey();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
    if (user && user.api_key) {
      setApiKey(user.api_key); // Pre-fill API key if exists (encrypted typically not returned, but maybe placeholder)
    }
  }, [user, isUserLoading, router]);

  const { data: chats, isLoading: isChatsLoading } = useQuery<Chat[]>({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data } = await api.get("/chats");
      return data;
    },
    enabled: !!user,
  });

  const { data: messages, isLoading: isMessagesLoading } = useQuery<Message[]>({
    queryKey: ["messages", selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];
      const { data } = await api.get(`/chats/${selectedChatId}`);
      return data;
    },
    enabled: !!selectedChatId,
    refetchInterval: 5000, // Poll every 5s for new messages (simple real-time)
  });

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

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h1 className="font-bold text-lg">My Chats</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Chat</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 mt-4">
                <Input
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  placeholder="Chat Title"
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
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {isChatsLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              chats?.map((chat) => (
                <Button
                  key={chat.id}
                  variant={selectedChatId === chat.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left truncate"
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span className="truncate">{chat.title}</span>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate">{user.name}</span>
            <Dialog
              open={isApiKeyDialogOpen}
              onOpenChange={setIsApiKeyDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>API Key Settings</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateApiKey} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>OpenAI API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-gray-500">
                      Your key is encrypted and stored securely.
                    </p>
                  </div>
                  <Button type="submit" disabled={updateApiKey.isPending}>
                    {updateApiKey.isPending ? "Saving..." : "Save API Key"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => logout.mutate()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full">
        {selectedChatId ? (
          <>
            <div className="flex-1 p-4 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {isMessagesLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="animate-spin" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="text-center text-gray-500 mt-10">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {sendMessage.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    sendMessage.mutate({
                      chatId: selectedChatId,
                      message: newMessage,
                    });
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={sendMessage.isPending}
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sendMessage.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
