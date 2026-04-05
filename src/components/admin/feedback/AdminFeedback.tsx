import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageCircle, 
  Star, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { format } from 'date-fns';

interface FeedbackItem {
  id: string;
  guardian_profile_id: string;
  student_id?: string;
  driver_id?: string;
  feedback_type: string;
  rating: number;
  title: string;
  description: string;
  status: string;
  admin_response?: string;
  admin_responder_id?: string;
  response_date?: string;
  created_at: string;
  profiles?: { username: string } | null;
  students?: { name: string } | null;
  drivers?: { name: string } | null;
}

const AdminFeedback: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [response, setResponse] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user: adminUser } = useSimpleAuth();

  useEffect(() => {
    fetchFeedbacks();
  }, [statusFilter, typeFilter]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);

      // Avoid PostgREST embedded resources — some projects lack FK hints in the schema cache
      // ("Could not find a relationship between parent_feedback and profiles").
      let fbQuery = supabase
        .from("parent_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        fbQuery = fbQuery.eq("status", statusFilter);
      }
      if (typeFilter !== "all") {
        fbQuery = fbQuery.eq("feedback_type", typeFilter);
      }

      const { data: rows, error: fbError } = await fbQuery;
      if (fbError) throw fbError;

      const list = rows ?? [];
      if (list.length === 0) {
        setFeedbacks([]);
        return;
      }

      const guardianIds = [
        ...new Set(
          list
            .map((r) => r.guardian_profile_id as string | undefined)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const studentIds = [
        ...new Set(
          list
            .map((r) => r.student_id as string | undefined)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const driverIds = [
        ...new Set(
          list
            .map((r) => r.driver_id as string | undefined)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const profileMap = new Map<string, { username: string }>();
      const studentMap = new Map<string, { name: string }>();
      const driverMap = new Map<string, { name: string }>();

      if (guardianIds.length > 0) {
        const { data: profs, error: e1 } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", guardianIds);
        if (e1) console.warn("[feedback] profiles:", e1.message);
        profs?.forEach((p) => {
          if (p.id) profileMap.set(p.id, { username: p.username ?? "—" });
        });
      }

      if (studentIds.length > 0) {
        const { data: studs, error: e2 } = await supabase
          .from("students")
          .select("id, name")
          .in("id", studentIds);
        if (e2) console.warn("[feedback] students:", e2.message);
        studs?.forEach((s) => {
          if (s.id) studentMap.set(s.id, { name: s.name ?? "—" });
        });
      }

      if (driverIds.length > 0) {
        const { data: drvs, error: e3 } = await supabase
          .from("drivers")
          .select("id, name")
          .in("id", driverIds);
        if (e3) console.warn("[feedback] drivers:", e3.message);
        drvs?.forEach((d) => {
          if (d.id) driverMap.set(d.id, { name: d.name ?? "—" });
        });
      }

      const merged: FeedbackItem[] = list.map((row) => {
        const guardianId = row.guardian_profile_id as string | undefined;
        const sid = row.student_id as string | undefined;
        const did = row.driver_id as string | undefined;
        return {
          ...(row as FeedbackItem),
          profiles: guardianId ? profileMap.get(guardianId) ?? null : null,
          students: sid ? studentMap.get(sid) ?? null : null,
          drivers: did ? driverMap.get(did) ?? null : null,
        };
      });

      setFeedbacks(merged);
    } catch (error: unknown) {
      console.error("Error fetching feedbacks:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: string }).message)
          : "Failed to fetch feedback data";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const respondToFeedback = async (feedbackId: string) => {
    if (!response.trim()) {
      toast({
        title: "Error",
        description: "Please enter a response",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("parent_feedback")
        .update({
          admin_response: response,
          status: "resolved",
          response_date: new Date().toISOString(),
          ...(adminUser?.id ? { admin_responder_id: adminUser.id } : {}),
        })
        .eq("id", feedbackId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Response sent successfully",
      });

      setResponse('');
      setSelectedFeedback(null);
      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error responding to feedback:', error);
      toast({
        title: "Error",
        description: "Failed to send response",
        variant: "destructive",
      });
    }
  };

  const updateFeedbackStatus = async (feedbackId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('parent_feedback')
        .update({ status: newStatus })
        .eq('id', feedbackId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status updated successfully",
      });

      fetchFeedbacks();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: "destructive",
      in_progress: "secondary",
      resolved: "default",
      closed: "outline"
    };
    
    const icons: Record<string, any> = {
      open: Clock,
      in_progress: AlertTriangle,
      resolved: CheckCircle,
      closed: CheckCircle
    };

    const Icon = icons[status];
    
    return (
      <Badge variant={variants[status]}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      compliment: "default",
      complaint: "destructive",
      suggestion: "secondary",
      safety_concern: "destructive"
    };

    const icons: Record<string, any> = {
      compliment: ThumbsUp,
      complaint: ThumbsDown,
      suggestion: MessageSquare,
      safety_concern: AlertTriangle
    };

    const Icon = icons[type];

    return (
      <Badge variant={variants[type]}>
        <Icon className="h-3 w-3 mr-1" />
        {type.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Parent Feedback System</h2>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Parent Feedback System</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="compliment">Compliments</SelectItem>
              <SelectItem value="complaint">Complaints</SelectItem>
              <SelectItem value="suggestion">Suggestions</SelectItem>
              <SelectItem value="safety_concern">Safety Concerns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feedback List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Feedback ({feedbacks.length})</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {feedbacks.map((feedback) => (
              <Card 
                key={feedback.id} 
                className={`cursor-pointer transition-colors ${
                  selectedFeedback?.id === feedback.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedFeedback(feedback)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                      {getTypeBadge(feedback.feedback_type)}
                      {getStatusBadge(feedback.status)}
                    </div>
                    <div className="flex">
                      {getRatingStars(feedback.rating)}
                    </div>
                  </div>
                  
                  <h4 className="font-medium mb-1">{feedback.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {feedback.description}
                  </p>
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      By: {feedback.profiles?.username || 'Unknown'}
                      {feedback.students?.name && ` (${feedback.students.name})`}
                    </span>
                    <span>{format(new Date(feedback.created_at), 'MMM dd, yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Feedback Detail */}
        <div>
          {selectedFeedback ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Feedback Details
                  </CardTitle>
                  <div className="flex gap-2">
                    {getTypeBadge(selectedFeedback.feedback_type)}
                    {getStatusBadge(selectedFeedback.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{selectedFeedback.title}</h4>
                  <div className="flex mb-2">
                    {getRatingStars(selectedFeedback.rating)}
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({selectedFeedback.rating}/5)
                    </span>
                  </div>
                  <p className="text-sm">{selectedFeedback.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Guardian:</strong> {selectedFeedback.profiles?.username || 'Unknown'}
                  </div>
                  <div>
                    <strong>Date:</strong> {format(new Date(selectedFeedback.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                  {selectedFeedback.students?.name && (
                    <div>
                      <strong>Student:</strong> {selectedFeedback.students.name}
                    </div>
                  )}
                  {selectedFeedback.drivers?.name && (
                    <div>
                      <strong>Driver:</strong> {selectedFeedback.drivers.name}
                    </div>
                  )}
                </div>

                {selectedFeedback.admin_response && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h5 className="font-medium text-green-800 mb-2">Admin Response:</h5>
                    <p className="text-sm text-green-700">{selectedFeedback.admin_response}</p>
                    {selectedFeedback.response_date && (
                      <p className="text-xs text-green-600 mt-2">
                        Responded on {format(new Date(selectedFeedback.response_date), 'MMM dd, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}

                {selectedFeedback.status !== 'resolved' && selectedFeedback.status !== 'closed' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Quick Actions:</label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateFeedbackStatus(selectedFeedback.id, 'in_progress')}
                        >
                          Mark In Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateFeedbackStatus(selectedFeedback.id, 'closed')}
                        >
                          Close
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Response:</label>
                      <Textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Enter your response to this feedback..."
                        rows={4}
                      />
                      <Button
                        className="mt-2"
                        onClick={() => respondToFeedback(selectedFeedback.id)}
                        disabled={!response.trim()}
                      >
                        Send Response
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a feedback item to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeedback;