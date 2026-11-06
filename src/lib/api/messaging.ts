const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface SendMessageParams {
  conversationId?: string;
  requestId: string;
  receiverId: string;
  content: string;
}

export async function sendMessage(token: string, params: SendMessageParams) {
  const res = await fetch(`${API_BASE}/messaging/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Failed to send message' } }));
    throw new Error(error.error?.message || 'Failed to send message');
  }

  return res.json();
}

export async function getConversations(token: string) {
  const res = await fetch(`${API_BASE}/messaging/conversations`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function getMessages(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE}/messaging/conversations/${conversationId}/messages`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function markMessagesRead(token: string, conversationId: string) {
  const res = await fetch(`${API_BASE}/messaging/mark-read`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ conversationId }),
  });

  if (!res.ok) throw new Error('Failed to mark messages as read');
  return res.json();
}
