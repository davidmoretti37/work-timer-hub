import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Clock, LogOut, History, LayoutDashboard, Users, Calendar, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";
import ThemeSwitch from "./ThemeSwitch";

interface NavbarProps {
  isAdmin?: boolean;
}

const Navbar = ({ isAdmin }: NavbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    // Prefer local sign-out to avoid 403s from global scope
    try {
      // @ts-expect-error - scope is supported at runtime
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {}

    // Fallback attempt (ignore errors like 403)
    try { await supabase.auth.signOut(); } catch (_) {}

    // Hard clear any cached auth tokens
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
    } catch (_) {}

    navigate("/auth", { replace: true });
    // Ensure UI reflects logged-out state
    window.location.reload();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b-2 bg-gray-100 dark:bg-neutral-800" style={{boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.3), 0 4px 8px -2px rgba(0, 0, 0, 0.15)', borderBottomColor: 'hsl(90 15% 50%)'}}>
      <div className="container mx-auto px-4">
        <div className="flex h-24 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-lg" style={{color: 'hsl(90 15% 50%)'}}>
            <Clock className="h-6 w-6 text-primary" />
            <span>TimeTrack</span>
          </Link>

          <div className="flex justify-center flex-1">
            <div className="h-24 flex items-center">
              <Dock>
                <DockItem>
                  <DockIcon>
                    <Link to="/dashboard" className="flex items-center justify-center w-full h-full">
                      <LayoutDashboard className="h-4 w-4 text-gray-700 dark:text-white hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>Dashboard</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/history" className="flex items-center justify-center w-full h-full">
                      <History className="h-4 w-4 text-gray-700 dark:text-white hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>History</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/calendar" className="flex items-center justify-center w-full h-full">
                      <Calendar className="h-4 w-4 text-gray-700 dark:text-white hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>Calendar</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/pto" className="flex items-center justify-center w-full h-full">
                      <FileText className="h-4 w-4 text-gray-700 dark:text-white hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>Forms</DockLabel>
                </DockItem>

                {isAdmin && (
                  <DockItem>
                    <DockIcon>
                      <Link to="/admin" className="flex items-center justify-center w-full h-full">
                        <Users className="h-4 w-4 text-gray-700 dark:text-white hover:text-primary transition-colors" />
                      </Link>
                    </DockIcon>
                    <DockLabel>Admin</DockLabel>
                  </DockItem>
                )}

                <DockItem>
                  <DockIcon>
                    <button onClick={handleLogout} className="flex items-center justify-center w-full h-full">
                      <LogOut className="h-4 w-4 text-gray-700 dark:text-white hover:text-destructive transition-colors" />
                    </button>
                  </DockIcon>
                  <DockLabel>Logout</DockLabel>
                </DockItem>
              </Dock>
            </div>
          </div>

          <div className="flex items-center justify-end w-20">
            <ThemeSwitch />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
