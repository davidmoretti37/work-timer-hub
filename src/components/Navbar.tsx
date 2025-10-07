import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Clock, LogOut, History, LayoutDashboard, Users, Calendar, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";

interface NavbarProps {
  isAdmin?: boolean;
}

const Navbar = ({ isAdmin }: NavbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-24 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
            <Clock className="h-6 w-6 text-primary" />
            <span>TimeTrack</span>
          </Link>

          <div className="flex justify-center flex-1">
            <div className="h-24 flex items-center">
              <Dock>
                <DockItem>
                  <DockIcon>
                    <Link to="/dashboard" className="flex items-center justify-center w-full h-full">
                      <LayoutDashboard className="h-4 w-4 text-foreground hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>Dashboard</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/history" className="flex items-center justify-center w-full h-full">
                      <History className="h-4 w-4 text-foreground hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>History</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/calendar" className="flex items-center justify-center w-full h-full">
                      <Calendar className="h-4 w-4 text-foreground hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>Calendar</DockLabel>
                </DockItem>

                <DockItem>
                  <DockIcon>
                    <Link to="/pto" className="flex items-center justify-center w-full h-full">
                      <FileText className="h-4 w-4 text-foreground hover:text-primary transition-colors" />
                    </Link>
                  </DockIcon>
                  <DockLabel>PTO Request</DockLabel>
                </DockItem>

                {isAdmin && (
                  <DockItem>
                    <DockIcon>
                      <Link to="/admin" className="flex items-center justify-center w-full h-full">
                        <Users className="h-4 w-4 text-foreground hover:text-primary transition-colors" />
                      </Link>
                    </DockIcon>
                    <DockLabel>Admin</DockLabel>
                  </DockItem>
                )}

                <DockItem>
                  <DockIcon>
                    <button onClick={handleLogout} className="flex items-center justify-center w-full h-full">
                      <LogOut className="h-4 w-4 text-foreground hover:text-destructive transition-colors" />
                    </button>
                  </DockIcon>
                  <DockLabel>Logout</DockLabel>
                </DockItem>
              </Dock>
            </div>
          </div>

          <div className="w-20" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
