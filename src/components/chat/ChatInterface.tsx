import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Send, 
  MessageCircle, 
  Users, 
  AlertTriangle, 
  MapPin,
  Phone,
  X,
  Minimize2,
  Maximize2,
  Mic,
  Camera
} from "lucide-react";
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { VoiceRecorder } from './VoiceRecorder';
import { PhotoSharing } from './PhotoSharing';
import { PullToRefresh } from '@/components/ui/mobile-gestures';
import { useMobile } from '@/hooks/useMobile';
import { isAdminPanelUser } from '@/utils/adminAccess';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'driver' | 'admin' | 'guardian';
  recipient_id?: string;
  recipient_type?: 'driver' | 'admin' | 'guardian' | 'broadcast';
  message: string;
  message_type: 'text' | 'location' | 'emergency' | 'system';
  metadata?: {
    location?: { lat: number; lng: number };
    busNumber?: string;
    emergencyType?: 'accident' | 'breakdown' | 'medical' | 'other';
  };
  created_at: string;
  read_by: string[];
  is_emergency: boolean;
}

interface Recipient {
  id: string;
  name: string;
  type: 'driver' | 'admin' | 'guardian';
  online: boolean;
}

interface ChatInterfaceProps {
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  className?: string;
}

function messageRelevantToUser(m: ChatMessage, uid: string) {
  if (m.sender_id === uid || m.recipient_id === uid) return true;
  if (m.recipient_type === "broadcast" && m.recipient_id == null) return true;
  return false;
}

function messageMatchesThread(m: ChatMessage, uid: string, thread: Recipient | null) {
  if (!messageRelevantToUser(m, uid)) return false;
  if (!thread) return true;
  if (m.recipient_type === "broadcast" && m.recipient_id == null) return true;
  const a = m.sender_id;
  const b = m.recipient_id;
  const t = thread.id;
  return (a === uid && b === t) || (a === t && b === uid);
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  isMinimized = false, 
  onToggleMinimize,
  className = ""
}) => {
  const { user } = useSimpleAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showRecipients, setShowRecipients] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selectedRecipientRef = useRef<Recipient | null>(null);
  selectedRecipientRef.current = selectedRecipient;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get available recipients
  useEffect(() => {
    const fetchRecipients = async () => {
      if (!user) return;

      try {
        const recipientsList: Recipient[] = [];
        
        if (user.user_type === 'driver') {
          // Drivers can chat with admins and guardians of their students
          const { data: admins } = await supabase
            .from('profiles')
            .select('id, username')
            .in('user_type', ['admin', 'guardian_admin']);

          if (admins) {
            recipientsList.push(...admins.map(admin => ({
              id: admin.id,
              name: admin.username,
              type: 'admin' as const,
              online: true
            })));
          }

          // Get guardians of students assigned to this driver
          const { data: guardians } = await supabase
            .from('students')
            .select(`
              guardian_profile_id,
              guardian_name,
              profiles!students_guardian_profile_id_fkey(id, username, user_type)
            `)
            .not('guardian_profile_id', 'is', null);

          if (guardians) {
            const uniqueGuardians = new Map();
            guardians.forEach(guardian => {
              if (guardian.guardian_profile_id && guardian.profiles) {
                uniqueGuardians.set(guardian.guardian_profile_id, {
                  id: guardian.guardian_profile_id,
                  name: guardian.guardian_name,
                  type: 'guardian' as const,
                  online: true
                });
              }
            });
            recipientsList.push(...Array.from(uniqueGuardians.values()));
          }
        } else if (isAdminPanelUser(user.user_type)) {
          // School admins and parent coordinators can chat with all drivers and guardians
          const { data: drivers } = await supabase
            .from('drivers')
            .select('profile_id, name');

          if (drivers) {
            recipientsList.push(...drivers.map(driver => ({
              id: driver.profile_id,
              name: driver.name,
              type: 'driver' as const,
              online: true
            })));
          }

          const { data: guardians } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('user_type', 'guardian');

          if (guardians) {
            recipientsList.push(...guardians.map(guardian => ({
              id: guardian.id,
              name: guardian.username,
              type: 'guardian' as const,
              online: true
            })));
          }
        } else if (user.user_type === 'guardian') {
          // Guardians can chat with admins and their child's driver
          const { data: admins } = await supabase
            .from('profiles')
            .select('id, username')
            .in('user_type', ['admin', 'guardian_admin']);

          if (admins) {
            recipientsList.push(...admins.map(admin => ({
              id: admin.id,
              name: admin.username,
              type: 'admin' as const,
              online: true
            })));
          }

          // Drivers for this guardian’s students (avoid .single() — multiple children possible)
          const { data: studentRows } = await supabase
            .from("students")
            .select(
              `
              driver_id,
              drivers ( profile_id, name )
            `,
            )
            .eq("guardian_profile_id", user.id)
            .not("driver_id", "is", null);

          const seenDrivers = new Set<string>();
          for (const row of studentRows || []) {
            const driverRel = row.drivers;
            const driverRow = Array.isArray(driverRel) ? driverRel[0] : driverRel;
            const pid = driverRow?.profile_id;
            if (pid && !seenDrivers.has(pid)) {
              seenDrivers.add(pid);
              recipientsList.push({
                id: pid,
                name: driverRow.name || "Driver",
                type: "driver" as const,
                online: true,
              });
            }
          }
        }

        setRecipients(recipientsList);
      } catch (error) {
        console.error('Error fetching recipients:', error);
      }
    };

    fetchRecipients();
  }, [user]);

  // Subscribe to real-time inserts (per-user channel; thread-scoped when a contact is selected)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat_messages:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          if (!messageRelevantToUser(newMessage, user.id)) return;
          const thread = selectedRecipientRef.current;
          if (!messageMatchesThread(newMessage, user.id, thread)) return;

          setMessages((prev) => {
            if (prev.some((x) => x.id === newMessage.id)) return prev;
            return [...prev, newMessage].sort(
              (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime(),
            );
          });

          if (newMessage.is_emergency && newMessage.sender_id !== user.id) {
            toast.error(`Emergency: ${newMessage.message}`, { duration: 10000 });
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, selectedRecipient]);

  // Load history: full inbox when no contact selected; direct thread (+ broadcasts) when selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;

      try {
        let query = supabase.from("chat_messages").select("*");

        if (selectedRecipient) {
          const rid = selectedRecipient.id;
          query = query
            .or(
              `and(sender_id.eq.${user.id},recipient_id.eq.${rid}),and(sender_id.eq.${rid},recipient_id.eq.${user.id}),and(recipient_type.eq.broadcast,recipient_id.is.null)`,
            )
            .order("created_at", { ascending: true });
        } else {
          query = query
            .or(
              `sender_id.eq.${user.id},recipient_id.eq.${user.id},and(recipient_type.eq.broadcast,recipient_id.is.null)`,
            )
            .order("created_at", { ascending: true })
            .limit(300);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []) as ChatMessage[];
        const sorted = [...rows].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );

        if (selectedRecipient) {
          setMessages(
            sorted.filter((m) => messageMatchesThread(m, user.id, selectedRecipient)),
          );
        } else {
          setMessages(sorted);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast.error("Could not load chat history.");
      }
    };

    void fetchMessages();
  }, [user, selectedRecipient]);

  const sendMessage = async (messageType: 'text' | 'emergency' = 'text') => {
    if (!user || !newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const messageData = {
        sender_id: user.id,
        sender_name: user.username || user.email,
        sender_type: user.user_type,
        recipient_id: selectedRecipient?.id || null,
        recipient_type: selectedRecipient?.type || 'broadcast',
        message: newMessage,
        message_type: messageType,
        is_emergency: messageType === 'emergency',
        metadata: {},
        read_by: [user.id]
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([messageData])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error('Failed to send message. Please check your connection.');
      }

      setNewMessage('');
      
      if (messageType === 'emergency') {
        toast.success('Emergency message sent to all users');
      } else {
        toast.success('Message sent successfully');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendLocationMessage = async () => {
    if (!user || !navigator.geolocation) {
      toast.error('Location sharing not available');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const messageData = {
          sender_id: user.id,
          sender_name: user.username || user.email,
          sender_type: user.user_type,
          recipient_id: selectedRecipient?.id || null,
          recipient_type: selectedRecipient?.type || 'broadcast',
          message: 'Location shared',
          message_type: 'location' as const,
          is_emergency: false,
          metadata: {
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          },
          read_by: [user.id]
        };

        const { data, error } = await supabase
          .from('chat_messages')
          .insert([messageData])
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          throw new Error('Failed to share location. Please check your connection.');
        }
        
        toast.success('Location shared successfully');
      } catch (error: any) {
        console.error('Error sharing location:', error);
        toast.error(error.message || 'Failed to share location');
      }
    }, (error) => {
      console.error('Geolocation error:', error);
      toast.error('Failed to get location. Please enable location access.');
    });
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'admin': return 'bg-red-500';
      case 'driver': return 'bg-blue-500';
      case 'guardian': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (!user) return null;

  return (
    <Card className={`${className} ${isMinimized ? 'h-14' : 'h-96'} transition-all duration-300 ease-in-out`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Live Chat
          {selectedRecipient && !isMinimized && (
            <Badge variant="outline" className="ml-2">
              {selectedRecipient.name} ({selectedRecipient.type})
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecipients(!showRecipients)}
            >
              <Users className="h-4 w-4" />
            </Button>
          )}
          {onToggleMinimize && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMinimize}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="p-0 h-full flex flex-col">
          {showRecipients && (
            <div className="border-b p-4">
              <h4 className="font-medium mb-2">Select Contact:</h4>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  <Button
                    variant={!selectedRecipient ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setSelectedRecipient(null);
                      setShowRecipients(false);
                    }}
                    className="w-full justify-start"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Broadcast to All
                  </Button>
                  {recipients.map((recipient) => (
                    <Button
                      key={recipient.id}
                      variant={selectedRecipient?.id === recipient.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setSelectedRecipient(recipient);
                        setShowRecipients(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarFallback className={`text-xs text-white ${getUserTypeColor(recipient.type)}`}>
                          {getUserInitials(recipient.name)}
                        </AvatarFallback>
                      </Avatar>
                      {recipient.name}
                      <Badge variant="outline" className="ml-auto text-xs">
                        {recipient.type}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.sender_id === user.id ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                      {message.sender_id !== user.id && (
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className={`text-xs text-white ${getUserTypeColor(message.sender_type)}`}>
                            {getUserInitials(message.sender_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {message.sender_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.sender_id === user.id 
                        ? 'bg-primary text-primary-foreground' 
                        : message.is_emergency
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted'
                    }`}>
                      {message.is_emergency && (
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs font-bold">EMERGENCY</span>
                        </div>
                      )}
                      {message.message_type === 'location' && message.metadata?.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>Location shared</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const { lat, lng } = message.metadata!.location!;
                              window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
                            }}
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm">{message.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <Separator />

          <div className="p-4">
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={sendLocationMessage}
                disabled={loading}
              >
                <MapPin className="h-4 w-4" />
              </Button>
              {user.user_type === 'driver' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setNewMessage('EMERGENCY - Need immediate assistance!');
                    setTimeout(() => sendMessage('emergency'), 100);
                  }}
                  disabled={loading}
                >
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
                disabled={loading}
                className="flex-1"
              />
              <Button 
                onClick={() => sendMessage()} 
                disabled={loading || !newMessage.trim()}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ChatInterface;