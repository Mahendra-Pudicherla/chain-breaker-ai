import { useLocation, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 mx-auto">
          <Shield className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-foreground">404</h1>
          <p className="text-lg text-muted-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The page "{location.pathname}" doesn't exist or has been moved.
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
