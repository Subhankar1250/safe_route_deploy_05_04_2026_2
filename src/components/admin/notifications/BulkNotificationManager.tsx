import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  Users, 
  Bell, 
  AlertCircle, 
  CheckCircle, 
  Loader2 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationResult {
  message: string;
  /** FCM registration tokens targeted (one user may have more than one). */
  total_tokens?: number;
  /** Legacy alias — same as total_tokens from Edge Function. */
  total_users?: number;
  sent: number;
  failed: number;
  errors?: string[];
}

const BulkNotificationManager: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('/logo-placeholder.svg');
  const [userTypes, setUserTypes] = useState<string[]>([
    'admin',
    'guardian_admin',
    'driver',
    'guardian',
  ]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<NotificationResult | null>(null);

  const handleUserTypeChange = (type: string, checked: boolean) => {
    setUserTypes(prev => 
      checked 
        ? [...prev, type]
        : prev.filter(t => t !== type)
    );
  };

  const sendBulkNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please enter both title and message');
      return;
    }

    if (userTypes.length === 0) {
      toast.error('Please select at least one user type');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const onlyGuardian =
        userTypes.length === 1 && userTypes[0] === "guardian";
      const onlyAdminSide =
        userTypes.length > 0 &&
        userTypes.every((t) => t === "admin" || t === "guardian_admin");
      const onlyDriver =
        userTypes.length === 1 && userTypes[0] === 'driver';
      let defaultUrl = '/';
      if (onlyGuardian) defaultUrl = '/guardian/dashboard';
      else if (onlyAdminSide) defaultUrl = '/admin/dashboard';
      else if (onlyDriver) defaultUrl = '/driver/dashboard';

      const { data, error } = await supabase.functions.invoke("send-bulk-notification", {
        body: {
          title: title.trim(),
          body: body.trim(),
          icon,
          badge: icon,
          userTypes,
          data: {
            type: "bulk_announcement",
            admin_sent: true,
            url: defaultUrl,
          },
        },
      });

      if (error) {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        let detail = error.message;
        if (ctx?.json) {
          try {
            const j = (await ctx.json()) as { details?: string; error?: string };
            if (j?.details) detail = j.details;
            else if (j?.error) detail = String(j.error);
          } catch {
            /* ignore */
          }
        }
        throw new Error(detail);
      }

      if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }

      setLastResult(data);
      
      if (data.sent > 0) {
        toast.success(`Notification sent to ${data.sent} users successfully!`);
        // Clear form on success
        setTitle('');
        setBody('');
      } else {
        toast.warning('No notifications were sent. Check if users have the app installed.');
      }

      if (data.failed > 0) {
        toast.error(`Failed to send to ${data.failed} users`);
      }

    } catch (error: any) {
      console.error('Error sending bulk notification:', error);
      toast.error(error.message || 'Failed to send notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Send Bulk Push Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Notification Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title..."
              maxLength={100}
            />
            <div className="text-xs text-muted-foreground">
              {title.length}/100 characters
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your message..."
              rows={4}
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground">
              {body.length}/500 characters
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Icon URL (optional)</label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="/logo-placeholder.svg"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Send to User Types</label>
            <div className="flex flex-wrap gap-4">
              {[
                { id: "admin", label: "Admins", color: "bg-red-500" },
                {
                  id: "guardian_admin",
                  label: "Parent coordinators",
                  color: "bg-orange-500",
                },
                { id: "driver", label: "Drivers", color: "bg-blue-500" },
                { id: "guardian", label: "Guardians", color: "bg-green-500" },
              ].map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.id}
                    checked={userTypes.includes(type.id)}
                    onCheckedChange={(checked) => 
                      handleUserTypeChange(type.id, checked as boolean)
                    }
                  />
                  <label 
                    htmlFor={type.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <Badge variant="outline" className="ml-1">
                      <div className={`w-2 h-2 rounded-full ${type.color} mr-2`} />
                      {type.label}
                    </Badge>
                  </label>
                </div>
              ))}
            </div>
            {userTypes.length === 0 && (
              <p className="text-sm text-destructive">
                Please select at least one user type
              </p>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2 text-sm">
              <p>
                <strong>Supabase Realtime</strong> (WebSocket) delivers to logged-in users on the matching
                channel — no Firebase required. Optional <strong>FCM</strong> adds web push when Edge secrets{" "}
                <code className="rounded bg-muted px-1">FCM_SERVICE_ACCOUNT_JSON</code> or{" "}
                <code className="rounded bg-muted px-1">FCM_SERVER_KEY</code> are set.
              </p>
              <p>
                Guardians on the Android app should stay logged in; grant notification permission for tray
                alerts via Capacitor local notifications.
              </p>
            </AlertDescription>
          </Alert>

          <Button
            onClick={sendBulkNotification}
            disabled={loading || !title.trim() || !body.trim() || userTypes.length === 0}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Notifications...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send to All Users
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastResult.sent > 0 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Notification Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {lastResult.total_tokens ?? lastResult.total_users ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">FCM tokens</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {lastResult.sent}
                </div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {lastResult.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {lastResult.errors && lastResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Some notifications failed:</div>
                  <ul className="text-sm space-y-1">
                    {lastResult.errors.slice(0, 3).map((error, index) => (
                      <li key={index} className="truncate">• {error}</li>
                    ))}
                    {lastResult.errors.length > 3 && (
                      <li className="text-muted-foreground">
                        ... and {lastResult.errors.length - 3} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkNotificationManager;