"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { BuyerShell } from "@/components/buyer/buyer-shell";
import { Badge, SectionHeading } from "@/components/ui";
import { getInitials, buyerProfile } from "@/lib/demo/buyer";
import { supabase } from "@/lib/supabase/client";
import * as messagingAPI from "@/lib/api/messaging";
import * as demoMessaging from "@/lib/demo/messaging";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  requestId: string;
  buyerId: string;
  travellerId: string;
  request: {
    id: string;
    product_title: string;
    product_category: string;
    status: string;
  };
  otherParticipant: {
    id: string;
    name: string;
    role: string;
  };
  latestMessage: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function BuyerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Get auth token
  const getAuthToken = async () => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  };

  // Load conversations
  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);
        
        // Check if Supabase is configured
        if (!supabase) {
          // DEMO MODE: Use demo messaging adapter
          console.log('[DEMO MODE] Loading demo conversations...');
          setDemoMode(true);
          const userId = buyerProfile.id; // Use demo buyer ID
          console.log('[DEMO MODE] User ID:', userId);
          setCurrentUserId(userId);
          
          const demoConversations = demoMessaging.getDemoConversations(userId);
          console.log('[DEMO MODE] Loaded conversations:', demoConversations.length);
          setConversations(demoConversations);
          setLoading(false);
          return;
        }
        
        // LIVE MODE: Use Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to view messages');
          return;
        }
        
        setCurrentUserId(user.id);
        const token = await getAuthToken();
        const result = await messagingAPI.getConversations(token);
        setConversations(result.data || []);
      } catch (err) {
        console.error('Failed to load conversations:', err);
        setError('Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;

    async function loadMessages() {
      if (!selectedConvId) return;
      
      try {
        if (demoMode) {
          // DEMO MODE: Load from demo adapter
          const demoMessages = demoMessaging.getDemoMessages(currentUserId!, selectedConvId);
          setMessages(demoMessages);
          
          // Mark as read in demo mode
          demoMessaging.markDemoMessagesRead(currentUserId!, selectedConvId);
          
          // Update conversation unread count locally
          setConversations(prev =>
            prev.map(c => c.id === selectedConvId ? { ...c, unreadCount: 0 } : c)
          );
        } else {
          // LIVE MODE: Load from Supabase
          const token = await getAuthToken();
          const result = await messagingAPI.getMessages(token, selectedConvId);
          setMessages(result.data || []);
          
          // Mark as read
          await messagingAPI.markMessagesRead(token, selectedConvId);
          
          // Update conversation unread count locally
          setConversations(prev =>
            prev.map(c => c.id === selectedConvId ? { ...c, unreadCount: 0 } : c)
          );
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }

    loadMessages();
  }, [selectedConvId, currentUserId, demoMode]);

  // Subscribe to realtime messages (LIVE MODE ONLY)
  useEffect(() => {
    if (!selectedConvId || !currentUserId || !supabase || demoMode) return;

    const channel = supabase
      .channel(`messages:${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          
          // Update conversation list
          setConversations(prev =>
            prev.map(c =>
              c.id === selectedConvId
                ? {
                    ...c,
                    latestMessage: {
                      content: newMessage.content,
                      createdAt: newMessage.created_at,
                      senderId: newMessage.sender_id,
                    },
                    updatedAt: newMessage.created_at,
                    unreadCount: newMessage.receiver_id === currentUserId ? c.unreadCount + 1 : c.unreadCount,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [selectedConvId, currentUserId, demoMode]);

  // Listen for demo mode storage events (for simulated traveler replies)
  useEffect(() => {
    if (!demoMode || !currentUserId || !selectedConvId) return;

    const handleStorageChange = () => {
      console.log('[Storage Event] Detected change, reloading messages...');
      
      // Reload messages from storage
      const updatedMessages = demoMessaging.getDemoMessages(currentUserId, selectedConvId);
      setMessages(updatedMessages);
      
      // Reload conversations to update unread count and latest message
      const updatedConversations = demoMessaging.getDemoConversations(currentUserId);
      setConversations(updatedConversations);
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [demoMode, currentUserId, selectedConvId]);

  // Handle conversation selection
  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setShowMobileChat(true);
  };

  // Handle back to list
  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConvId(null);
  };

  // Handle send message
  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !selectedConversation || sending || !currentUserId) return;

    try {
      setSending(true);
      
      if (demoMode) {
        // DEMO MODE: Use demo adapter
        const newMessage = demoMessaging.sendDemoMessage(
          currentUserId,
          selectedConversation.id,
          trimmedMessage,
          selectedConversation.otherParticipant.id
        );
        
        // Add message to local state
        setMessages(prev => [...prev, newMessage]);
        
        // Update conversation list
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  latestMessage: {
                    content: newMessage.content,
                    createdAt: newMessage.created_at,
                    senderId: newMessage.sender_id,
                  },
                  updatedAt: newMessage.created_at,
                }
              : c
          )
        );
      } else {
        // LIVE MODE: Use API
        const token = await getAuthToken();
        
        await messagingAPI.sendMessage(token, {
          conversationId: selectedConversation.id,
          requestId: selectedConversation.requestId,
          receiverId: selectedConversation.otherParticipant.id,
          content: trimmedMessage,
        });
      }

      setMessageInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Format timestamp
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const unreadConversations = conversations.filter((c) => c.unreadCount > 0);
  const readConversations = conversations.filter((c) => c.unreadCount === 0);

  if (loading) {
    return (
      <BuyerShell active="messages">
        <header>
          <p className="eyebrow">Communication</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Messages</h1>
        </header>
        <div className="mt-8 text-center text-muted">Loading conversations...</div>
      </BuyerShell>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <BuyerShell active="messages">
        <header>
          <p className="eyebrow">Communication</p>
          <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Messages</h1>
        </header>
        <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Make sure you&apos;re logged in and have accepted quotes from travelers.
          </p>
        </div>
      </BuyerShell>
    );
  }

  return (
    <BuyerShell active="messages">
      <header>
        <div className="flex items-center gap-3">
          <div>
            <p className="eyebrow">Communication</p>
            <h1 className="mt-2.5 text-4xl leading-tight sm:text-5xl">Messages</h1>
          </div>
          {demoMode && (
            <Badge variant="champagne" className="mt-8">
              Demo Mode
            </Badge>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Real-time conversations with travelers carrying your orders.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Conversation list */}
        <div className={`${showMobileChat ? "hidden lg:block" : "block"}`}>
          {unreadConversations.length > 0 && (
            <section>
              <SectionHeading
                eyebrow="Requires attention"
                title={`${unreadConversations.length} unread`}
                actions={<Badge variant="burgundy" dot>{unreadConversations.length}</Badge>}
              />

              <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {unreadConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`group flex w-full gap-4 p-4 text-left transition-colors hover:bg-surface-muted/40 ${
                      selectedConvId === conv.id ? "bg-burgundy/5 border-l-2 border-l-burgundy" : ""
                    }`}
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sapphire text-sm font-semibold text-ivory">
                      {getInitials(conv.otherParticipant.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{conv.otherParticipant.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {conv.latestMessage ? formatMessageTime(conv.latestMessage.createdAt) : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-champagne-ink">
                        {conv.request.product_title}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {conv.latestMessage?.content || "No messages yet"}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="mt-2 size-2.5 shrink-0 rounded-full bg-champagne-strong" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {readConversations.length > 0 && (
            <section className={unreadConversations.length > 0 ? "mt-8" : ""}>
              <SectionHeading eyebrow="Message history" title="Earlier conversations" />

              <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {readConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`group flex w-full gap-4 p-4 text-left transition-colors hover:bg-surface-muted/40 ${
                      selectedConvId === conv.id ? "bg-burgundy/5 border-l-2 border-l-burgundy" : ""
                    }`}
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sapphire text-sm font-semibold text-ivory">
                      {getInitials(conv.otherParticipant.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-muted">{conv.otherParticipant.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {conv.latestMessage ? formatMessageTime(conv.latestMessage.createdAt) : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {conv.request.product_title}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {conv.latestMessage?.content || "No messages yet"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {conversations.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-sm text-muted">No conversations yet</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Accept a quote from a traveler to start messaging
              </p>
            </div>
          )}
        </div>

        {/* Chat interface */}
        <div className={`${showMobileChat || selectedConversation ? "block" : "hidden lg:block"}`}>
          {selectedConversation ? (
            <div className="flex h-[calc(100vh-280px)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border bg-surface-muted/50 px-5 py-4">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="lg:hidden -ml-2 p-2 text-muted transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="size-5" strokeWidth={1.75} />
                </button>

                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sapphire text-sm font-semibold text-ivory">
                  {getInitials(selectedConversation.otherParticipant.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{selectedConversation.otherParticipant.name}</p>
                  <p className="truncate text-xs text-muted">{selectedConversation.request.product_title}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[75%] space-y-1`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${
                          message.sender_id === currentUserId
                            ? "bg-burgundy-deep text-ivory rounded-br-sm"
                            : "bg-surface-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <p
                        className={`text-[0.6875rem] text-muted-foreground px-2 ${
                          message.sender_id === currentUserId ? "text-right" : "text-left"
                        }`}
                      >
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border bg-surface p-4">
                <div className="flex gap-3">
                  <textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus:border-burgundy-deep focus:outline-none focus:ring-1 focus:ring-burgundy-deep max-h-32"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="shrink-0 rounded-lg bg-burgundy-deep p-3 text-ivory transition-colors hover:bg-burgundy-ink disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="size-5" strokeWidth={1.75} />
                  </button>
                </div>
                <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                  {demoMode 
                    ? "Demo mode - messages persist locally but are not sent to real travelers"
                    : "Press Enter to send, Shift+Enter for new line"
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex h-[calc(100vh-280px)] min-h-[500px] flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center">
              <div className="max-w-sm space-y-3">
                <h3 className="text-lg font-medium text-foreground">Select a conversation</h3>
                <p className="text-sm text-muted">Choose a conversation from the list to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </BuyerShell>
  );
}
