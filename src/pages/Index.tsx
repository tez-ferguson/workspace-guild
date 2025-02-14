
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  _count?: {
    members: number;
    boards: number;
  };
}

const Index = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch workspaces where the user is either owner or member
  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // First get all workspaces where user is owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user.id);

      if (ownedError) throw ownedError;

      // Then get workspaces where user is a member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("role", "member");

      if (memberError) throw memberError;

      // If user is a member of any workspaces, fetch those workspace details
      let memberWorkspaceDetails = [];
      if (memberWorkspaces.length > 0) {
        const { data: details, error: detailsError } = await supabase
          .from("workspaces")
          .select("*")
          .in(
            "id",
            memberWorkspaces.map((w) => w.workspace_id)
          );

        if (detailsError) throw detailsError;
        memberWorkspaceDetails = details || [];
      }

      // Combine and deduplicate workspaces
      const allWorkspaces = [...(ownedWorkspaces || []), ...memberWorkspaceDetails];
      const uniqueWorkspaces = Array.from(
        new Map(allWorkspaces.map((w) => [w.id, w])).values()
      );

      // For each workspace, get the count of members and boards
      const workspacesWithCounts = await Promise.all(
        uniqueWorkspaces.map(async (workspace) => {
          const [{ count: membersCount }, { count: boardsCount }] = await Promise.all([
            supabase
              .from("workspace_members")
              .select("*", { count: 'exact', head: true })
              .eq("workspace_id", workspace.id),
            supabase
              .from("boards")
              .select("*", { count: 'exact', head: true })
              .eq("workspace_id", workspace.id),
          ]);

          return {
            ...workspace,
            _count: {
              members: membersCount || 0,
              boards: boardsCount || 0,
            },
          };
        })
      );

      setWorkspaces(workspacesWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Create the workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert([
          {
            name: newWorkspaceName.trim(),
            owner_id: user.id,
          },
        ])
        .select()
        .single();

      if (workspaceError) throw workspaceError;

      // Add the owner as a workspace member with 'owner' role
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert([
          {
            workspace_id: workspace.id,
            user_id: user.id,
            role: "owner",
          },
        ]);

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Workspace created successfully",
      });

      setIsCreateOpen(false);
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

  return (
    <div className="min-h-screen bg-workspace-50">
      <nav className="glass-effect fixed top-0 w-full border-b border-workspace-200 px-6 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-workspace-800">Workspaces</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hover-lift">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover-lift"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-6 pb-16">
        <div className="grid gap-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="workspace-header">Your Workspaces</h2>
              <p className="text-sm text-workspace-500">
                Manage and collaborate with your teams
              </p>
            </div>
            <Button className="hover-lift" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading workspaces...</div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-8 text-workspace-500">
              No workspaces found. Create your first workspace!
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <Card
                  key={workspace.id}
                  className="workspace-card hover-lift animate-fade-in"
                >
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-workspace-800 mb-2">
                      {workspace.name}
                    </h3>
                    <div className="flex items-center text-sm text-workspace-500 space-x-4">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {workspace._count?.members || 0} members
                      </div>
                      <div>{workspace._count?.boards || 0} boards</div>
                    </div>
                  </div>
                  <div className="border-t border-workspace-200 p-4 bg-workspace-50 rounded-b-lg">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full hover-lift"
                      onClick={() => navigate(`/workspaces/${workspace.id}`)}
                    >
                      View Workspace
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Give your workspace a name to get started
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={createWorkspace} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
