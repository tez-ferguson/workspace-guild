
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Board {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
  workspace: {
    name: string;
  };
}

const BoardDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    fetchBoardDetails();
  }, [id]);

  const fetchBoardDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // First check if user has access to this board
      const { data: boardAccess, error: accessError } = await supabase
        .from("board_members")
        .select("id")
        .eq("board_id", id)
        .eq("user_id", user.id)
        .single();

      // Also check if user is workspace owner
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .select(`
          *,
          workspace: workspaces (
            name,
            owner_id
          )
        `)
        .eq("id", id)
        .single();

      if (boardError) throw boardError;

      // User has access if they are either a board member or the workspace owner
      const isWorkspaceOwner = board.workspace.owner_id === user.id;
      const isBoardMember = !!boardAccess;

      if (!isWorkspaceOwner && !isBoardMember) {
        toast({
          title: "Access Denied",
          description: "You don't have access to this board",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setHasAccess(true);
      setBoard(board);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!hasAccess || !board) {
    return <div className="flex items-center justify-center min-h-screen">Access denied</div>;
  }

  return (
    <div className="min-h-screen bg-workspace-50">
      <nav className="glass-effect fixed top-0 w-full border-b border-workspace-200 px-6 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/workspaces/${board.workspace_id}`)}
              className="hover-lift"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {board.workspace.name}
            </Button>
            <h1 className="text-xl font-semibold text-workspace-800">
              {board.name}
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-6 pb-16">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4">Board Content</h2>
          <p className="text-workspace-500">
            This is where your board content will go. You can add columns, cards, and other features as needed.
          </p>
        </div>
      </main>
    </div>
  );
};

export default BoardDetails;
