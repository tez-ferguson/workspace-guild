
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

interface Invitation {
  id: string;
  workspace_id: string;
  workspace: {
    name: string;
  };
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
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
      await Promise.all([
        fetchWorkspaces(),
        fetchInvitations(),
      ]);
    } catch (error) {
      console.error("Session error:", error);
      navigate("/auth");
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("workspace_invitations")
        .select(`
          id,
          workspace_id,
          workspaces (
            name
          )
        `)
        .eq("invited_email", user.email);

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  };

  const acceptInvitation = async (invitationId: string, workspaceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Add user to workspace_members
      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert([{
          workspace_id: workspaceId,
          user_id: user.id,
          role: "member"
        }]);

      if (memberError) throw memberError;

      // Delete the invitation
      const { error: deleteError } = await supabase
        .from("workspace_invitations")
        .delete()
        .eq("id", invitationId);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: "You have joined the workspace",
      });

      // Refresh workspaces and invitations
      await Promise.all([
        fetchWorkspaces(),
        fetchInvitations(),
      ]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error("Error signing out:", error);
      navigate("/auth");
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch workspaces where user is either owner or member
      const { data: workspaceMembers, error: memberError } = await supabase
        .from("workspace_members")
        .select(`
          role,
          workspace: workspaces (
            id,
            name,
            owner_id,
            boards (
              id,
              name,
              created_at
            )
          )
        `)
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // Transform the data to match our Workspace interface
      const transformedWorkspaces = workspaceMembers?.map(member => ({
        id: member.workspace.id,
        name: member.workspace.name,
        owner_id: member.workspace.owner_id,
        role: member.role,
        boards: member.workspace.boards || []
      })) || [];

      setWorkspaces(transformedWorkspaces);
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

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Create workspace
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

      // Add creator as workspace member with owner role
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
        {invitations.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Pending Invitations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {invitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardHeader>
                    <CardTitle>{invitation.workspace.name}</CardTitle>
                    <CardDescription>You've been invited to join this workspace</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => acceptInvitation(invitation.id, invitation.workspace_id)}
                      className="w-full"
                    >
                      Accept Invitation
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

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

        {workspaces.length === 0 && invitations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-workspace-500">
              You don't have any workspaces yet. Create one or wait for an invitation.
            </p>
          </div>
        )}
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
