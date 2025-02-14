
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  role: string;
  boards: {
    id: string;
    name: string;
    created_at: string;
  }[];
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      fetchWorkspaces();
    } catch (error) {
      console.error("Session error:", error);
      navigate("/auth");
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error("Error signing out:", error);
      // If there's an error but it's just that the session wasn't found,
      // we still want to redirect to auth
      navigate("/auth");
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch workspaces where user is either owner or member
      const { data: workspacesData, error: workspacesError } = await supabase
        .from("workspace_members")
        .select(`
          workspace_id,
          role,
          workspaces (
            id,
            name,
            owner_id
          )
        `)
        .eq("user_id", session.user.id);

      if (workspacesError) throw workspacesError;

      // For each workspace, fetch only the boards the user has access to
      const workspacesWithBoards = await Promise.all(
        workspacesData.map(async (ws) => {
          // If user is the workspace owner, fetch all boards
          if (ws.workspaces.owner_id === session.user.id) {
            const { data: boards } = await supabase
              .from("boards")
              .select("id, name, created_at")
              .eq("workspace_id", ws.workspace_id);
            
            return {
              id: ws.workspaces.id,
              name: ws.workspaces.name,
              owner_id: ws.workspaces.owner_id,
              role: ws.role,
              boards: boards || []
            };
          }

          // If user is a member, get their accessible boards
          const { data: boardMembers } = await supabase
            .from("board_members")
            .select("board_id")
            .eq("user_id", session.user.id);

          const boardIds = (boardMembers || []).map(bm => bm.board_id);

          const { data: memberBoards } = await supabase
            .from("boards")
            .select("id, name, created_at")
            .eq("workspace_id", ws.workspace_id)
            .in("id", boardIds.length ? boardIds : ['']);

          return {
            id: ws.workspaces.id,
            name: ws.workspaces.name,
            owner_id: ws.workspaces.owner_id,
            role: ws.role,
            boards: memberBoards || []
          };
        })
      );

      setWorkspaces(workspacesWithBoards);
    } catch (error: any) {
      console.error("Error fetching workspaces:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Create workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert([
          {
            name: newWorkspaceName.trim(),
            owner_id: session.user.id,
          },
        ])
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      // Add creator as workspace member with owner role
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert([
          {
            workspace_id: workspace.id,
            user_id: session.user.id,
            role: "owner",
          },
        ]);

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Workspace created successfully",
      });

      setIsDialogOpen(false);
      setNewWorkspaceName("");
      fetchWorkspaces();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-workspace-50">
      <nav className="glass-effect fixed top-0 w-full border-b border-workspace-200 px-6 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-workspace-800">
            My Workspaces
          </h1>
          <div className="flex items-center gap-4">
            <Button onClick={handleSignOut} size="sm" variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/workspaces/${workspace.id}`)}
            >
              <CardHeader>
                <CardTitle>{workspace.name}</CardTitle>
                <CardDescription>
                  Role: {workspace.role}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">
                  {workspace.boards.length} board{workspace.boards.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Enter a name for your new workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createWorkspace} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
