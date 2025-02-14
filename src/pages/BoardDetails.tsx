
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BoardMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const BoardDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState<{ id: string; name: string; workspace_id: string } | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

      // Fetch board details
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select("*")
        .eq("id", id)
        .single();

      if (boardError) throw boardError;
      setBoard(boardData);

      // Check if user is workspace owner
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", boardData.workspace_id)
        .eq("user_id", user.id)
        .single();

      if (!workspaceError) {
        setIsOwner(workspaceData.role === "owner");
      }

      // Fetch board members with user details
      const { data: membersData, error: membersError } = await supabase
        .from("board_members")
        .select(`
          id,
          user_id,
          users (
            id,
            name,
            email
          )
        `)
        .eq("board_id", id);

      if (membersError) throw membersError;
      setMembers(membersData.map(m => ({
        id: m.id,
        user: {
          id: m.users.id,
          name: m.users.name,
          email: m.users.email
        }
      })));
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

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    setIsProcessing(true);

    try {
      // First check if user exists
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", newMemberEmail.trim())
        .single();

      if (userError) {
        throw new Error("User not found. Please ensure the email is correct.");
      }

      // Check if user is already a member
      const { data: existingMember, error: existingError } = await supabase
        .from("board_members")
        .select("id")
        .eq("board_id", id)
        .eq("user_id", userData.id)
        .single();

      if (existingMember) {
        throw new Error("User is already a member of this board.");
      }

      // Add user as a board member
      const { error: memberError } = await supabase
        .from("board_members")
        .insert([
          {
            board_id: id,
            user_id: userData.id,
          },
        ]);

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Member added successfully",
      });

      setIsAddMemberOpen(false);
      setNewMemberEmail("");
      fetchBoardDetails();
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

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("board_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      fetchBoardDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!board) {
    return <div className="flex items-center justify-center min-h-screen">Board not found</div>;
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
              Back to Workspace
            </Button>
            <h1 className="text-xl font-semibold text-workspace-800">
              {board.name}
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-6 pb-16">
        <div className="grid gap-8">
          {/* Board Members Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Board Members</h2>
              {isOwner && (
                <Button onClick={() => setIsAddMemberOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  {isOwner && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      </main>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Board Member</DialogTitle>
            <DialogDescription>
              Enter the email address of the user you want to add to this board
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="member@example.com"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAddMemberOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={addMember} disabled={isProcessing}>
              {isProcessing ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoardDetails;
