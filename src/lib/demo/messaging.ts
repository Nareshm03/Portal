/**
 * Demo Messaging Adapter
 * 
 * Provides a localStorage-backed messaging system for demo mode when Supabase
 * is unavailable. Matches the Supabase messaging interface for seamless
 * switching between demo and live modes.
 */

// Storage keys - SHARED across both buyer and traveler workspaces
const STORAGE_PREFIX = "portal_demo_messages_shared_";
const CONVERSATIONS_KEY = "conversations";
const MESSAGES_KEY = "messages";

// Demo user IDs
export const DEMO_BUYER_ID = "buyer-demo-01";
export const DEMO_TRAVELER_ID = "traveler-demo-01";

// Match Supabase conversation interface
export interface DemoConversation {
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

// Match Supabase message interface
export interface DemoMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// Initial demo conversations (buyer perspective)
const INITIAL_BUYER_CONVERSATIONS: DemoConversation[] = [
  {
    id: "demo-conv-01",
    requestId: "req-1042",
    buyerId: "buyer-demo-01",
    travellerId: "traveler-demo-01",
    request: {
      id: "req-1042",
      product_title: "Leica Q3 compact camera",
      product_category: "Cameras & optics",
      status: "MATCHED",
    },
    otherParticipant: {
      id: "traveler-demo-01",
      name: "Meera Kapoor",
      role: "traveller",
    },
    latestMessage: {
      content: "I can collect it from Ginza on the 12th. Would you like the spare battery added as well?",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      senderId: "traveler-demo-01",
    },
    unreadCount: 1,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-conv-02",
    requestId: "req-1039",
    buyerId: "buyer-demo-01",
    travellerId: "demo-traveler-02",
    request: {
      id: "req-1039",
      product_title: "Goyard Saint Louis tote",
      product_category: "Designer fashion",
      status: "QUOTED",
    },
    otherParticipant: {
      id: "demo-traveler-02",
      name: "Arjun Shah",
      role: "traveller",
    },
    latestMessage: {
      content: "The boutique has the GM in black. I'll send condition photos before I pay.",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      senderId: "demo-traveler-02",
    },
    unreadCount: 0,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-conv-03",
    requestId: "req-1034",
    buyerId: "buyer-demo-01",
    travellerId: "demo-traveler-03",
    request: {
      id: "req-1034",
      product_title: "Nike Air Max 1 'Patta'",
      product_category: "Footwear",
      status: "REQUESTED",
    },
    otherParticipant: {
      id: "demo-traveler-03",
      name: "Rhea Nair",
      role: "traveller",
    },
    latestMessage: {
      content: "Happy to carry these — would you like the original box kept, or is flat packing easier?",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      senderId: "demo-traveler-03",
    },
    unreadCount: 1,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Initial demo messages (full conversation threads)
const INITIAL_BUYER_MESSAGES: Record<string, DemoMessage[]> = {
  "demo-conv-01": [
    {
      id: "msg-01-01",
      sender_id: "buyer-demo-01",
      receiver_id: "traveler-demo-01",
      content: "Hi Meera, thank you for the quote on the Leica Q3. Are you able to collect it from the Tokyo Ginza store?",
      read_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-01-02",
      sender_id: "traveler-demo-01",
      receiver_id: "buyer-demo-01",
      content: "Yes, absolutely! I'll be in Tokyo from the 10th to the 13th of December.",
      read_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-01-03",
      sender_id: "buyer-demo-01",
      receiver_id: "traveler-demo-01",
      content: "Perfect timing. The store confirmed they have the black version in stock.",
      read_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-01-04",
      sender_id: "traveler-demo-01",
      receiver_id: "buyer-demo-01",
      content: "I can collect it from Ginza on the 12th. Would you like the spare battery added as well?",
      read_at: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "demo-conv-02": [
    {
      id: "msg-02-01",
      sender_id: "buyer-demo-01",
      receiver_id: "demo-traveler-02",
      content: "Hello Arjun, I'm interested in your quote for the Goyard tote. Will you be visiting the Paris boutique?",
      read_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-02-02",
      sender_id: "demo-traveler-02",
      receiver_id: "buyer-demo-01",
      content: "Yes, I can visit their main store on Rue Saint-Honoré. Do you have a preferred size?",
      read_at: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-02-03",
      sender_id: "buyer-demo-01",
      receiver_id: "demo-traveler-02",
      content: "The GM size in black with tan trim would be ideal.",
      read_at: new Date(Date.now() - 24.2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-02-04",
      sender_id: "demo-traveler-02",
      receiver_id: "buyer-demo-01",
      content: "The boutique has the GM in black. I'll send condition photos before I pay.",
      read_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  "demo-conv-03": [
    {
      id: "msg-03-01",
      sender_id: "demo-traveler-03",
      receiver_id: "buyer-demo-01",
      content: "I saw your request for the Nike Air Max 1 Patta release. I can check both the Amsterdam flagship and Patta store.",
      read_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "msg-03-02",
      sender_id: "demo-traveler-03",
      receiver_id: "buyer-demo-01",
      content: "Happy to carry these — would you like the original box kept, or is flat packing easier?",
      read_at: null,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

// Storage helpers - SHARED storage (not user-specific)
function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  
  try {
    const stored = localStorage.getItem(getStorageKey(key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
}

// Demo messaging operations
export function getDemoConversations(userId: string): DemoConversation[] {
  console.log('[getDemoConversations] Loading for user:', userId);
  
  // MIGRATION: Check for old user-specific keys and migrate to shared storage
  const oldBuyerKey = `portal_demo_messages_buyer-demo-01_conversations`;
  const oldTravelerKey = `portal_demo_messages_traveler-demo-01_conversations`;
  
  if (typeof window !== "undefined") {
    const oldBuyerData = localStorage.getItem(oldBuyerKey);
    const oldTravelerData = localStorage.getItem(oldTravelerKey);
    
    if (oldBuyerData || oldTravelerData) {
      console.log('[getDemoConversations] Migrating from old user-specific storage...');
      // Clear old keys
      localStorage.removeItem(oldBuyerKey);
      localStorage.removeItem(oldTravelerKey);
      localStorage.removeItem(`portal_demo_messages_buyer-demo-01_messages`);
      localStorage.removeItem(`portal_demo_messages_traveler-demo-01_messages`);
    }
  }
  
  // Load from SHARED storage
  let conversations = loadFromStorage<DemoConversation[]>(
    CONVERSATIONS_KEY,
    []
  );

  console.log('[getDemoConversations] Found in shared storage:', conversations.length);

  // First time: seed with initial data
  if (conversations.length === 0) {
    console.log('[getDemoConversations] Seeding initial conversations');
    conversations = INITIAL_BUYER_CONVERSATIONS;
    saveToStorage(CONVERSATIONS_KEY, conversations);
  }

  // CRITICAL FIX: Validate conversation structure
  // If conversations exist but don't have required fields, re-seed
  const hasValidStructure = conversations.every(
    (conv) => conv.id && conv.buyerId && conv.travellerId && conv.request && conv.otherParticipant
  );
  
  if (!hasValidStructure && conversations.length > 0) {
    console.warn('[getDemoConversations] Invalid conversation structure detected, re-seeding...');
    conversations = INITIAL_BUYER_CONVERSATIONS;
    saveToStorage(CONVERSATIONS_KEY, conversations);
  }

  // Filter conversations for this user (buyer or traveler)
  const userConversations = conversations
    .filter((conv) => conv.buyerId === userId || conv.travellerId === userId)
    .map((conv) => {
      // Calculate unread count for THIS user by checking messages
      const allMessages = loadFromStorage<Record<string, DemoMessage[]>>(MESSAGES_KEY, {});
      const convMessages = allMessages[conv.id] || [];
      const unreadCount = convMessages.filter(
        (msg) => msg.receiver_id === userId && !msg.read_at
      ).length;

      // Adjust otherParticipant based on current user perspective
      if (conv.buyerId === userId) {
        // User is the buyer, show traveler as other participant
        return {
          ...conv,
          unreadCount,
        };
      } else {
        // User is the traveler, show buyer as other participant
        const buyerName = conv.buyerId === DEMO_BUYER_ID ? "Ananya Rao" : "Buyer";
        return {
          ...conv,
          otherParticipant: {
            id: conv.buyerId,
            name: buyerName,
            role: "buyer",
          },
          unreadCount,
        };
      }
    });

  console.log('[getDemoConversations] User conversations:', userConversations.length);

  // Sort by updated date (most recent first)
  return userConversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getDemoMessages(userId: string, conversationId: string): DemoMessage[] {
  console.log('[getDemoMessages] Loading messages for user:', userId, 'conversation:', conversationId);
  
  // MIGRATION: Check for old user-specific message keys
  const oldBuyerMsgKey = `portal_demo_messages_buyer-demo-01_messages`;
  const oldTravelerMsgKey = `portal_demo_messages_traveler-demo-01_messages`;
  
  if (typeof window !== "undefined") {
    const oldBuyerMsg = localStorage.getItem(oldBuyerMsgKey);
    const oldTravelerMsg = localStorage.getItem(oldTravelerMsgKey);
    
    if (oldBuyerMsg || oldTravelerMsg) {
      console.log('[getDemoMessages] Migrating messages from old user-specific storage...');
      // Clear old message keys (already cleared in getDemoConversations, but double-check)
      localStorage.removeItem(oldBuyerMsgKey);
      localStorage.removeItem(oldTravelerMsgKey);
    }
  }
  
  const allMessages = loadFromStorage<Record<string, DemoMessage[]>>(
    MESSAGES_KEY,
    {}
  );

  console.log('[getDemoMessages] Messages in shared storage:', Object.keys(allMessages).length, 'conversations');

  // First time: seed with initial data
  if (Object.keys(allMessages).length === 0) {
    console.log('[getDemoMessages] Seeding initial messages');
    saveToStorage(MESSAGES_KEY, INITIAL_BUYER_MESSAGES);
    return INITIAL_BUYER_MESSAGES[conversationId] || [];
  }

  return allMessages[conversationId] || [];
}

export function sendDemoMessage(
  userId: string,
  conversationId: string,
  content: string,
  receiverId: string
): DemoMessage {
  console.log('[sendDemoMessage] Sending message from:', userId, 'to:', receiverId);
  
  // Create new message
  const newMessage: DemoMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sender_id: userId,
    receiver_id: receiverId,
    content: content.trim(),
    read_at: null,
    created_at: new Date().toISOString(),
  };

  // Load existing messages from SHARED storage
  const allMessages = loadFromStorage<Record<string, DemoMessage[]>>(
    MESSAGES_KEY,
    {}
  );

  // Add new message
  if (!allMessages[conversationId]) {
    allMessages[conversationId] = [];
  }
  allMessages[conversationId].push(newMessage);

  // Save messages to SHARED storage
  saveToStorage(MESSAGES_KEY, allMessages);

  // Update conversation's latest message and timestamp (NO unread count - calculated dynamically)
  const conversations = loadFromStorage<DemoConversation[]>(
    CONVERSATIONS_KEY,
    []
  );

  const updatedConversations = conversations.map((conv) => {
    if (conv.id === conversationId) {
      return {
        ...conv,
        latestMessage: {
          content: newMessage.content,
          createdAt: newMessage.created_at,
          senderId: newMessage.sender_id,
        },
        updatedAt: newMessage.created_at,
      };
    }
    return conv;
  });

  saveToStorage(CONVERSATIONS_KEY, updatedConversations);

  console.log('[sendDemoMessage] Message saved to shared storage');
  
  // Dispatch storage event to trigger UI update in ALL tabs/windows
  window.dispatchEvent(new StorageEvent('storage', {
    key: getStorageKey(MESSAGES_KEY),
    newValue: JSON.stringify(allMessages),
  }));

  // Only schedule auto-reply if sender is buyer (don't create infinite loops)
  if (userId === DEMO_BUYER_ID) {
    console.log('[sendDemoMessage] Scheduling traveler reply...');
    
    // Schedule simulated traveler reply after 2-3 seconds
    setTimeout(() => {
      const replyContent = generateTravelerReply(content, conversationId);
      const travelerReply: DemoMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender_id: receiverId,
        receiver_id: userId,
        content: replyContent,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      console.log('[sendDemoMessage] Generating traveler reply:', replyContent.substring(0, 50) + '...');

      // Load and update messages from SHARED storage
      const currentMessages = loadFromStorage<Record<string, DemoMessage[]>>(
        MESSAGES_KEY,
        {}
      );
      
      if (!currentMessages[conversationId]) {
        currentMessages[conversationId] = [];
      }
      currentMessages[conversationId].push(travelerReply);
      saveToStorage(MESSAGES_KEY, currentMessages);

      // Update conversation in SHARED storage
      const currentConversations = loadFromStorage<DemoConversation[]>(
        CONVERSATIONS_KEY,
        []
      );
      
      const updatedConvs = currentConversations.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            latestMessage: {
              content: travelerReply.content,
              createdAt: travelerReply.created_at,
              senderId: travelerReply.sender_id,
            },
            updatedAt: travelerReply.created_at,
          };
        }
        return conv;
      });
      
      saveToStorage(CONVERSATIONS_KEY, updatedConvs);

      // Dispatch storage event to trigger UI update
      window.dispatchEvent(new StorageEvent('storage', {
        key: getStorageKey(MESSAGES_KEY),
        newValue: JSON.stringify(currentMessages),
      }));
      
      console.log('[sendDemoMessage] Traveler reply saved and event dispatched');
    }, 2000 + Math.random() * 1000); // 2-3 seconds delay
  }

  return newMessage;
}

// Generate contextual traveler reply based on buyer message
function generateTravelerReply(buyerMessage: string, _conversationId: string): string {
  const message = buyerMessage.toLowerCase();
  
  // Battery/spare parts
  if (message.includes('battery') || message.includes('spare')) {
    return "Absolutely! I'll include the spare battery. It's available at the store for an additional ¥8,500.";
  }
  
  // Yes/confirmation
  if (message.match(/^(yes|sure|okay|ok|sounds good|perfect|great)/i)) {
    return "Perfect! I'll proceed with that. Let me know if you need anything else.";
  }
  
  // Thank you
  if (message.includes('thank')) {
    return "You're welcome! Happy to help with your request.";
  }
  
  // Price/cost questions
  if (message.includes('price') || message.includes('cost') || message.includes('much')) {
    return "I'll send you the exact price once I confirm availability at the store. Should be within your budget.";
  }
  
  // Photos/pictures
  if (message.includes('photo') || message.includes('picture') || message.includes('image')) {
    return "Of course! I'll take detailed photos before purchasing and send them to you for approval.";
  }
  
  // When/timing questions
  if (message.includes('when') || message.includes('time') || message.includes('date')) {
    return "I'm planning to visit the store on the 12th. I can send updates as soon as I have more details.";
  }
  
  // Where/location questions
  if (message.includes('where') || message.includes('location') || message.includes('store')) {
    return "I'll be visiting the main flagship store in the city center. They usually have the best stock.";
  }
  
  // Box/packaging
  if (message.includes('box') || message.includes('packaging') || message.includes('package')) {
    return "I can keep the original box if you'd like, or I can pack it more securely without the box to save space.";
  }
  
  // Color/variant
  if (message.includes('color') || message.includes('colour') || message.includes('version')) {
    return "I'll confirm the exact color and variant with the store before purchasing. They should have what you need.";
  }
  
  // Questions (ends with ?)
  if (message.includes('?')) {
    return "Good question! Let me check on that and get back to you shortly.";
  }
  
  // Default contextual replies
  const genericReplies = [
    "Thanks for confirming! I'll keep you updated on the progress.",
    "Understood. I'll make sure everything is taken care of.",
    "No problem at all. Let me know if you have any other questions.",
    "Great! I'll proceed with your request and keep you posted.",
    "Perfect timing! I'll handle this for you.",
  ];
  
  return genericReplies[Math.floor(Math.random() * genericReplies.length)];
}

export function markDemoMessagesRead(
  userId: string,
  conversationId: string
): number {
  const allMessages = loadFromStorage<Record<string, DemoMessage[]>>(
    MESSAGES_KEY,
    {}
  );

  const messages = allMessages[conversationId] || [];
  let markedCount = 0;

  // Mark unread messages as read (for messages where user is receiver)
  const updatedMessages = messages.map((msg) => {
    if (msg.receiver_id === userId && !msg.read_at) {
      markedCount++;
      return {
        ...msg,
        read_at: new Date().toISOString(),
      };
    }
    return msg;
  });

  // Save updated messages to SHARED storage
  allMessages[conversationId] = updatedMessages;
  saveToStorage(MESSAGES_KEY, allMessages);

  // No need to update conversation unreadCount - it's calculated dynamically

  return markedCount;
}

export function clearDemoMessages(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(getStorageKey(CONVERSATIONS_KEY));
    localStorage.removeItem(getStorageKey(MESSAGES_KEY));
  } catch (error) {
    console.error("Failed to clear demo messages:", error);
  }
}
