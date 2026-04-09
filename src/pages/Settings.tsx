import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AppShell from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import { getUserDoc, updateUserDoc, onUserScans, deleteScanFull } from "@/lib/firestore";
import { updatePassword, deleteUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User, Scan } from "@/types";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user: authUser, signOut } = useAuthStore();
  const [userData, setUserData] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Notifications
  const [onScanComplete, setOnScanComplete] = useState(false);
  const [onCriticalFinding, setOnCriticalFinding] = useState(false);
  const [notifEmail, setNotifEmail] = useState("");

  // API Keys
  const [claudeKey, setClaudeKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [showClaude, setShowClaude] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Danger
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!authUser?.uid) return;
    (async () => {
      const doc = await getUserDoc(authUser.uid);
      if (doc) {
        setUserData(doc);
        setDisplayName(doc.displayName ?? "");
        setOnScanComplete(doc.notificationPrefs?.onScanComplete ?? false);
        setOnCriticalFinding(doc.notificationPrefs?.onCriticalFinding ?? false);
        setNotifEmail(doc.notificationPrefs?.notificationEmail ?? "");
        setClaudeKey(doc.apiKeys?.claudeApiKey ?? "");
        setResendKey(doc.apiKeys?.resendApiKey ?? "");
      }
      setLoading(false);
    })();
    const unsub = onUserScans(authUser.uid, setScans);
    return unsub;
  }, [authUser?.uid]);

  const saveProfile = async () => {
    if (!authUser?.uid) return;
    setSaving(true);
    try {
      await updateUserDoc(authUser.uid, { displayName });
      if (newPassword) {
        if (newPassword !== confirmNewPassword) {
          toast.error("Passwords do not match");
          setSaving(false);
          return;
        }
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        }
      }
      toast.success("Settings saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    }
    setSaving(false);
  };

  const saveNotifications = async () => {
    if (!authUser?.uid) return;
    setSaving(true);
    try {
      await updateUserDoc(authUser.uid, {
        notificationPrefs: { onScanComplete, onCriticalFinding, notificationEmail: notifEmail },
      } as any);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const saveApiKeys = async () => {
    if (!authUser?.uid) return;
    setSaving(true);
    try {
      await updateUserDoc(authUser.uid, {
        apiKeys: { claudeApiKey: claudeKey, resendApiKey: resendKey },
      } as any);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const deleteAllScans = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setSaving(true);
    try {
      await Promise.all(scans.map((s) => deleteScanFull(s.scanId)));
      toast.success("All scans deleted");
      setDeleteConfirmText("");
    } catch {
      toast.error("Failed to delete scans");
    }
    setSaving(false);
  };

  const deleteAccount = async () => {
    if (!authUser?.uid) return;
    try {
      // Delete user Firestore doc
      const { deleteDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      await deleteDoc(doc(db, "users", authUser.uid));
      // Delete Firebase auth account
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      await signOut();
      navigate("/");
      toast.success("Account deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>

        <Tabs defaultValue="profile">
          <TabsList className="bg-muted">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="apikeys">API Keys</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={authUser?.email ?? ""} disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Scan Complete Notifications</p>
                    <p className="text-xs text-muted-foreground">Email me when a scan completes</p>
                  </div>
                  <Switch checked={onScanComplete} onCheckedChange={setOnScanComplete} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Critical Finding Alerts</p>
                    <p className="text-xs text-muted-foreground">Email me when critical findings are detected</p>
                  </div>
                  <Switch checked={onCriticalFinding} onCheckedChange={setOnCriticalFinding} />
                </div>
                <div className="space-y-2">
                  <Label>Notification Email</Label>
                  <Input
                    type="email"
                    placeholder="notifications@example.com"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                  />
                </div>
                <Button onClick={saveNotifications} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apikeys" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Claude API Key</Label>
                  <div className="relative">
                    <Input
                      type={showClaude ? "text" : "password"}
                      placeholder="sk-ant-..."
                      value={claudeKey}
                      onChange={(e) => setClaudeKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClaude(!showClaude)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showClaude ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resend API Key</Label>
                  <div className="relative">
                    <Input
                      type={showResend ? "text" : "password"}
                      placeholder="re_..."
                      value={resendKey}
                      onChange={(e) => setResendKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResend(!showResend)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showResend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  These keys are stored securely and used only for your scans.
                </p>
                <Button onClick={saveApiKeys} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save API Keys
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="space-y-4 mt-4">
            <Card className="bg-card border-severity-critical/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-severity-critical">
                  <AlertTriangle className="h-4 w-4" /> Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete All Scans</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete all {scans.length} scans and their findings.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder='Type "DELETE" to confirm'
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-60"
                    />
                    <Button
                      variant="destructive"
                      disabled={deleteConfirmText !== "DELETE" || saving}
                      onClick={deleteAllScans}
                    >
                      Delete All Scans
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete Account</p>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete your account and all data. This cannot be undone.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Delete Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your account, all scans, and all findings. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteAccount} className="bg-severity-critical text-primary-foreground">
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Settings;
