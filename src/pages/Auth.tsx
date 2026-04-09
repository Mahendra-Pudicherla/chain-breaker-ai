import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import { createUserDoc } from "@/lib/firestore";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuthStore();

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState("");

  const [focused, setFocused] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError("");
    setSignInLoading(true);
    try {
      await signIn(signInEmail, signInPassword);
      navigate("/dashboard");
    } catch (err: any) {
      setSignInError(err?.message ?? "Failed to sign in");
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError("");

    if (signUpPassword !== confirmPassword) {
      setSignUpError("Passwords do not match");
      return;
    }
    if (signUpPassword.length < 6) {
      setSignUpError("Password must be at least 6 characters");
      return;
    }

    setSignUpLoading(true);
    try {
      await signUp(signUpEmail, signUpPassword);
      const { auth } = await import("@/lib/firebase");
      const user = auth.currentUser;
      if (user) {
        await createUserDoc(user.uid, {
          email: signUpEmail,
          displayName: fullName,
        });
      }
      navigate("/dashboard");
    } catch (err: any) {
      setSignUpError(err?.message ?? "Failed to create account");
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.success("Reset email sent", {
      description: "Check your inbox for password reset instructions.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground">Origin</span>
        </div>

        <Card
          className="bg-card border-border transition-shadow duration-300"
          style={{
            boxShadow: focused ? "0 0 40px rgba(99,102,241,0.1)" : "none",
          }}
        >
          <Tabs defaultValue="signin">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              <TabsContent value="signin" className="mt-0 space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-password">Password</Label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="si-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                    />
                  </div>
                  {signInError && (
                    <p className="text-xs text-severity-critical animate-error-slide">{signInError}</p>
                  )}
                  <Button type="submit" className="w-full h-10" disabled={signInLoading}>
                    {signInLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full Name</Label>
                    <Input id="su-name" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" placeholder="you@example.com" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" placeholder="••••••••" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-confirm">Confirm Password</Label>
                    <Input id="su-confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>
                  {signUpError && (
                    <p className="text-xs text-severity-critical animate-error-slide">{signUpError}</p>
                  )}
                  <Button type="submit" className="w-full h-10" disabled={signUpLoading}>
                    {signUpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
