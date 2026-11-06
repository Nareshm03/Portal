/**
 * Messaging API routes
 * Real-time buyer-traveller messaging with Supabase backend
 */

import { Router } from 'express';
import { z } from 'zod';
import { getSupabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';

export const messagingRouter = Router();
const supabase = () => getSupabase();

// Validation schemas
const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
  receiverId: z.string().uuid(),
  content: z.string().min(1).max(4000).trim(),
});

const markReadSchema = z.object({
  conversationId: z.string().uuid(),
});

/**
 * GET /api/messaging/conversations
 * Get all conversations for the authenticated user
 */
messagingRouter.get('/conversations', requireAuth, async (req, res) => {
  const userId = req.user.id;
  
  // Get conversations where user is buyer or traveller
  const { data: conversations, error: convError } = await supabase()
    .from('conversations')
    .select(`
      id,
      request_id,
      buyer_id,
      traveller_id,
      created_at,
      updated_at,
      requests!conversations_request_id_fkey (
        id,
        product_title,
        product_category,
        status
      )
    `)
    .or(`buyer_id.eq.${userId},traveller_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (convError) throw convError;

  // Get the other participant's profile for each conversation
  const conversationsWithProfiles = await Promise.all(
    conversations.map(async (conv) => {
      const otherUserId = conv.buyer_id === userId ? conv.traveller_id : conv.buyer_id;
      
      const { data: profile, error: profileError } = await supabase()
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', otherUserId)
        .single();

      if (profileError) throw profileError;

      // Get latest message in conversation
      const { data: latestMessage } = await supabase()
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get unread count
      const { count: unreadCount } = await supabase()
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('receiver_id', userId)
        .is('read_at', null);

      return {
        id: conv.id,
        requestId: conv.request_id,
        buyerId: conv.buyer_id,
        travellerId: conv.traveller_id,
        request: conv.requests,
        otherParticipant: {
          id: profile.id,
          name: profile.full_name,
          role: profile.role,
        },
        latestMessage: latestMessage ? {
          content: latestMessage.content,
          createdAt: latestMessage.created_at,
          senderId: latestMessage.sender_id,
        } : null,
        unreadCount: unreadCount || 0,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      };
    })
  );

  res.json({ data: conversationsWithProfiles });
});

/**
 * GET /api/messaging/conversations/:id/messages
 * Get all messages in a conversation
 */
messagingRouter.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const conversationId = req.params.id;
  const userId = req.user.id;

  // Verify user is part of this conversation
  const { data: conversation, error: convError } = await supabase()
    .from('conversations')
    .select('buyer_id, traveller_id')
    .eq('id', conversationId)
    .single();

  if (convError) {
    if (convError.code === 'PGRST116') {
      throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    throw convError;
  }

  if (conversation.buyer_id !== userId && conversation.traveller_id !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this conversation');
  }

  // Get all messages in the conversation
  const { data: messages, error: messagesError } = await supabase()
    .from('messages')
    .select('id, sender_id, receiver_id, content, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (messagesError) throw messagesError;

  res.json({ data: messages });
});

/**
 * POST /api/messaging/send
 * Send a new message
 */
messagingRouter.post('/send', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const body = sendMessageSchema.parse(req.body);

  let conversationId = body.conversationId;

  // If no conversation ID, create or get conversation
  if (!conversationId) {
    // Determine if user is buyer or traveller
    const { data: userProfile, error: profileError } = await supabase()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Verify request exists and user has access
    const { data: request, error: requestError } = await supabase()
      .from('requests')
      .select('buyer_id')
      .eq('id', body.requestId)
      .single();

    if (requestError) {
      if (requestError.code === 'PGRST116') {
        throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Request not found');
      }
      throw requestError;
    }

    // Determine buyer and traveller IDs
    let buyerId, travellerId;
    if (userProfile.role === 'buyer') {
      if (request.buyer_id !== userId) {
        throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this request');
      }
      buyerId = userId;
      travellerId = body.receiverId;
    } else {
      buyerId = request.buyer_id;
      travellerId = userId;
    }

    // Get or create conversation
    const { data: convId, error: convError } = await supabase()
      .rpc('get_or_create_conversation', {
        p_request_id: body.requestId,
        p_buyer_id: buyerId,
        p_traveller_id: travellerId,
      });

    if (convError) throw convError;
    conversationId = convId;
  }

  // Insert message
  const { data: message, error: messageError } = await supabase()
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      receiver_id: body.receiverId,
      content: body.content,
    })
    .select('id, conversation_id, sender_id, receiver_id, content, read_at, created_at')
    .single();

  if (messageError) throw messageError;

  res.status(201).json({ data: message });
});

/**
 * PUT /api/messaging/mark-read
 * Mark all messages in a conversation as read
 */
messagingRouter.put('/mark-read', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const body = markReadSchema.parse(req.body);

  const { data: count, error } = await supabase()
    .rpc('mark_messages_read', {
      p_conversation_id: body.conversationId,
      p_user_id: userId,
    });

  if (error) throw error;

  res.json({ data: { markedRead: count } });
});

/**
 * GET /api/messaging/unread-count
 * Get total unread message count for user
 */
messagingRouter.get('/unread-count', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { data: count, error } = await supabase()
    .rpc('get_unread_message_count', {
      p_user_id: userId,
    });

  if (error) throw error;

  res.json({ data: { unreadCount: count || 0 } });
});
