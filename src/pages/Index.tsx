
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Workspace {
  id: string;
  name: string;
  created_at: string;
  role: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch workspaces where user is a member (including role)
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from("workspace_members")
        .select(`
          workspace_id,
          role,
          workspaces (
            id,
            name,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (memberError) throw memberError;

      // Transform the data to match our Workspace interface
      const transformedWorkspaces = memberWorkspaces
        .filter(w => w.workspaces) // Filter out any null workspaces
        .map(w => ({
          id: w.workspaces.id,
          name: w.workspaces.name,
          created_at: w.workspaces.created_at,
          role: w.role
        }));

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
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // First create the workspace
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

      // Add the creator as a workspace member with owner role
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
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-workspace-50">
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Your Workspaces</h1>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Workspace
          </Button>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-workspace-500">No workspaces yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="bg-white rounded-lg shadow-sm border border-workspace-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/workspaces/${workspace.id}`)}
              >
                <h2 className="text-lg font-medium mb-2">{workspace.name}</h2>
                <p className="text-sm text-workspace-500 capitalize">Your role: {workspace.role}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Dialog */}
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
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={createWorkspace} disabled={isProcessing}>
              {isProcessing ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
