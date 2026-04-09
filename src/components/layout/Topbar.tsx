import { useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/scan/new": "New Scan",
  "/scans": "Scan History",
  "/settings": "Settings",
};

function getBreadcrumbs(pathname: string) {
  if (routeLabels[pathname]) return [routeLabels[pathname]];
  if (pathname.includes("/scan/") && pathname.endsWith("/live")) return ["Scans", "Live Monitor"];
  if (pathname.includes("/scan/") && pathname.endsWith("/report")) return ["Scans", "Report"];
  return ["Dashboard"];
}

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const crumbs = getBreadcrumbs(location.pathname);
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <SidebarTrigger className="text-muted-foreground" aria-label="Toggle sidebar" />

      <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="User menu">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
