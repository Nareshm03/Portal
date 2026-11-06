/**
 * Messaging API client for the Portal Express backend.
 *
 * Uses the backend conversation routes:
 *   POST /api/v1/quotes/:quoteId/conversation   — open/get conversation for a quote
 *   GET  /api/v1/conversations                    — list conversations with unread counts
 *   GET  /api/v1/conversations/:id/messages       — paginated messages
 *   POST /api/v1/conversations/:id/messages       — send a message
 *   PATCH /api/v1/conversations/:id/read          — mark conversation as read
 *
 * Falls back to demo mode when the backend is unreachable.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

interface SendMessageParams {
  conversationId?: string;
  requestId: string;
  receiverId: string;
  content: string;
}

interface Conversation {
  id: string;
  quoteId?: string;
  buyerId: string;
  travellerId: string;
  otherParticipantId: string;
  lastReadSeq: number;
  unreadCount: number;
  lastMessage?: {
    seq: number;
    senderId: string;
    body: string;
    createdAt: string;
  } | null;
  createdAt: string;
}

async function fetchJson(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const url = `${API_BASE.replace(/\/+$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    let data: unknown = null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function sendMessage(token: string, params: SendMessageParams) {
  // When a conversationId is provided, send to that conversation.
  // Otherwise, we need to open a conversation first (requires quoteId).
  if (params.conversationId) {
    const res = await fetchJson(`/conversations/${params.conversationId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body: params.content }),
    });
    if (!res.ok) {
      const error = (res.data as any)?.error?.message || "Failed to send message";
      throw new Error(error);
    }
    return res.data;
  }

  // No conversation yet — the caller should open one via
  // POST /quotes/:quoteId/conversation first.
  throw new Error("No conversation ID provided. Open a conversation first.");
}

export async function getConversations(token: string) {
  const res = await fetchJson("/conversations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return { data: res.data as unknown as any[] };
}

export async function getMessages(token: string, conversationId: string) {
  const res = await fetchJson(`/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return { data: res.data as unknown as any[] };
}

export async function markMessagesRead(token: string, conversationId: string) {
  const res = await fetchJson(`/conversations/${conversationId}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to mark messages as read");
  return { data: res.data };
}

/**
 * Open (or return) the conversation for a quote. Requires the quote ID.
 * Both buyer and traveller can call this if they are participants.
 */
export async function openConversationForQuote(
  token: string,
  quoteId: string
) {
  const res = await fetchJson(`/quotes/${quoteId}/conversation`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error = (res.data as any)?.error?.message || "Failed to open conversation";
    throw new Error(error);
  }
  return { data: res.data };
}
