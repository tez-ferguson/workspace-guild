
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Settings, Trash2, UserPlus, ArrowLeft } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Board {
  id: string;
  name: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

const WorkspaceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [newBoardName, setNewBoardName] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNewBoardOpen, setIsNewBoardOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaceDetails();
  }, [id]);

  const fetchWorkspaceDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch workspace details
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", id)
        .single();

      if (workspaceError) throw workspaceError;
      setWorkspace(workspaceData);
      setIsOwner(workspaceData.owner_id === user.id);

      // Fetch workspace members with user details
      const { data: membersData, error: membersError } = await supabase
        .from("workspace_members")
        .select(`
          id,
          role,
          user_id,
          users (
            id,
            name,
            email
          )
        `)
        .eq("workspace_id", id);

      if (membersError) throw membersError;
      setMembers(membersData.map(m => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.users.id,
          name: m.users.name,
          email: m.users.email
        }
      })));

      // Fetch boards
      const { data: boardsData, error: boardsError } = await supabase
        .from("boards")
        .select("*")
        .eq("workspace_id", id);

      if (boardsError) throw boardsError;
      setBoards(boardsData);
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

  const inviteMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(true);

    try {
      // Step 1: Get user_id from email - use eq and single() for exact match
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", newMemberEmail.trim())
        .single();

      if (userError || !userData) {
        throw new Error("User not found. Please ensure the email is correct and the user has signed up.");
      }

      console.log("Found user:", userData);

      // Step 2: Check if user is already a member
      const { data: existingMember, error: existingError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", id)
        .eq("user_id", userData.id)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existingMember) {
        throw new Error("User is already a member of this workspace.");
      }

      console.log("User is not a member yet, proceeding with invitation");

      // Step 3: Add user as a member
      const { data: newMember, error: memberError } = await supabase
        .from("workspace_members")
        .insert([
          {
            workspace_id: id,
            user_id: userData.id,
            role: "member",
          },
        ])
        .select()
        .single();

      if (memberError) {
        console.error("Error adding workspace member:", memberError);
        throw memberError;
      }

      console.log("Added workspace member:", newMember);

      // Step 4: Add board access for selected boards
      if (selectedBoards.length > 0) {
        const boardMembers = selectedBoards.map(boardId => ({
          board_id: boardId,
          user_id: userData.id
        }));

        const { data: newBoardMembers, error: boardMemberError } = await supabase
          .from("board_members")
          .insert(boardMembers)
          .select();

        if (boardMemberError) {
          console.error("Error adding board members:", boardMemberError);
          throw boardMemberError;
        }

        console.log("Added board members:", newBoardMembers);
      }

      toast({
        title: "Success",
        description: `Member ${userData.email} added successfully`,
      });

      setIsInviteOpen(false);
      setNewMemberEmail("");
      setSelectedBoards([]);
      await fetchWorkspaceDetails(); // Add await here
    } catch (error: any) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;
    setIsProcessing(true);

    try {
      // First create the board
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .insert([
          {
            name: newBoardName.trim(),
            workspace_id: id,
          },
        ])
        .select()
        .single();

      if (boardError) throw boardError;

      // Get the current user to add them as a board member
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Add the creator as a board member
      const { error: memberError } = await supabase
        .from("board_members")
        .insert([
          {
            board_id: board.id,
            user_id: user.id,
          },
        ]);

      if (memberError) throw memberError;

      toast({
        title: "Success",
        description: "Board created successfully",
      });

      setIsNewBoardOpen(false);
      setNewBoardName("");
      fetchWorkspaceDetails();
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

  const deleteBoard = async (boardId: string) => {
    try {
      // Delete board (will cascade delete board_members due to FK constraint)
      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", boardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Board deleted successfully",
      });

      fetchWorkspaceDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });

      fetchWorkspaceDetails();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const leaveWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "You have left the workspace",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleMemberRole = async (memberId: string, currentRole: string) => {
    try {
      const newRole = currentRole === "member" ? "owner" : "member";
      
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Member role updated to ${newRole}`,
      });

      fetchWorkspaceDetails();
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

  if (!workspace) {
    return <div className="flex items-center justify-center min-h-screen">Workspace not found</div>;
  }

  return (
    <div className="min-h-screen bg-workspace-50">
      <nav className="glass-effect fixed top-0 w-full border-b border-workspace-200 px-6 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="hover-lift"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-workspace-800">
              {workspace.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsConfirmLeaveOpen(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                Leave Workspace
              </Button>
            )}
            {isOwner && (
              <Button variant="outline" size="sm" className="hover-lift">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-6 pb-16">
        <div className="grid gap-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Members</h2>
              {isOwner && (
                <Button onClick={() => setIsInviteOpen(true)}>
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
                  <TableHead>Role</TableHead>
                  {isOwner && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    {isOwner && member.role !== "owner" && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMemberRole(member.id, member.role)}
                          >
                            {member.role === "member" ? "Promote" : "Demote"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Boards</h2>
              {isOwner && (
                <Button onClick={() => setIsNewBoardOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Board
                </Button>
              )}
            </div>
            {boards.length === 0 ? (
              <p className="text-center py-8 text-workspace-500">
                No boards created yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className="bg-white rounded-lg shadow-sm border border-workspace-200 p-4 hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/boards/${board.id}`)}
                    role="button"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{board.name}</h3>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBoard(board.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Add Member Dialog with Board Selection */}
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Enter the email address and select boards to grant access
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
                {boards.length > 0 && (
                  <div className="space-y-2">
                    <Label>Grant Access to Boards</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {boards.map((board) => (
                        <div key={board.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`board-${board.id}`}
                            checked={selectedBoards.includes(board.id)}
                            onCheckedChange={(checked) => {
                              setSelectedBoards(prev =>
                                checked
                                  ? [...prev, board.id]
                                  : prev.filter(id => id !== board.id)
                              );
                            }}
                          />
                          <Label htmlFor={`board-${board.id}`}>{board.name}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setSelectedBoards([]);
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button onClick={inviteMember} disabled={isProcessing}>
                  {isProcessing ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* New Board Dialog */}
          <Dialog open={isNewBoardOpen} onOpenChange={setIsNewBoardOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Board</DialogTitle>
                <DialogDescription>
                  Give your board a name to get started
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="boardName">Board Name</Label>
                  <Input
                    id="boardName"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="Enter board name"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsNewBoardOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button onClick={createBoard} disabled={isProcessing}>
                  {isProcessing ? "Creating..." : "Create Board"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Confirm Leave Dialog */}
          <Dialog open={isConfirmLeaveOpen} onOpenChange={setIsConfirmLeaveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Leave Workspace</DialogTitle>
                <DialogDescription>
                  Are you sure you want to leave this workspace? You will lose access to all boards and won't be able to rejoin unless invited again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmLeaveOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={leaveWorkspace}
                >
                  Leave Workspace
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default WorkspaceDetails;
