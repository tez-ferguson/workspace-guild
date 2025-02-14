import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Settings, Trash2, UserPlus, ArrowLeft, Minus } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  board_permissions?: string[]; // Array of board IDs the member has access to
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
  const [memberBoardPermissions, setMemberBoardPermissions] = useState<{ [key: string]: string[] }>({});
  const [isManageBoardsOpen, setIsManageBoardsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

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

      // Fetch board permissions for all members
      const { data: permissions, error: permissionsError } = await supabase
        .from("board_members")
        .select("board_id, user_id")
        .in(
          "user_id",
          membersData.map((member) => member.users.id)
        );

      if (permissionsError) throw permissionsError;

      // Create a map of member ID to their board permissions
      const permissionsMap: { [key: string]: string[] } = {};
      permissions?.forEach((permission) => {
        if (!permissionsMap[permission.user_id]) {
          permissionsMap[permission.user_id] = [];
        }
        permissionsMap[permission.user_id].push(permission.board_id);
      });

      // Update members with board permissions
      setMembers((prevMembers) =>
        prevMembers.map((member) => ({
          ...member,
          board_permissions: permissionsMap[member.user.id] || [],
        }))
      );

      setMemberBoardPermissions(permissionsMap);
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

  const updateBoardPermissions = async (memberId: string, boardId: string, hasAccess: boolean) => {
    try {
      const userId = members.find((member) => member.id === memberId)?.user.id;

      if (!userId) {
        throw new Error("User ID not found for the given member ID.");
      }

      if (hasAccess) {
        // Add board permission
        const { error: insertError } = await supabase
          .from("board_members")
          .insert({
            board_id: boardId,
            user_id: userId,
          });

        if (insertError) throw insertError;
      } else {
        // Remove board permission
        const { error: deleteError } = await supabase
          .from("board_members")
          .delete()
          .eq("board_id", boardId)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;
      }

      // Update local state
      setMemberBoardPermissions(prev => {
        const updatedPermissions = { ...prev };
        if (hasAccess) {
          updatedPermissions[userId] = [...(updatedPermissions[userId] || []), boardId];
        } else {
          updatedPermissions[userId] = (updatedPermissions[userId] || []).filter(id => id !== boardId);
        }
        return updatedPermissions;
      });

      setMembers((prevMembers) =>
        prevMembers.map((member) =>
          member.id === memberId
            ? {
                ...member,
                board_permissions: hasAccess
                  ? [...(member.board_permissions || []), boardId]
                  : (member.board_permissions || []).filter(id => id !== boardId),
              }
            : member
        )
      );

      toast({
        title: "Success",
        description: `Board permission ${hasAccess ? "granted" : "removed"} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      const email = newMemberEmail.trim();
      let userId;

      // Step 1: Check if user exists in users table
      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (userError) {
        console.error("Error checking existing user:", userError);
        throw new Error("Error checking user existence. Please try again.");
      }

      if (existingUser) {
        userId = existingUser.id;
        console.log("Found existing user:", userId);
      } else {
        // Create new user if they don't exist
        console.log("Creating new user with email:", email);
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([
            {
              email: email,
              name: email.split('@')[0], // Use part before @ as temporary name
            },
          ])
          .select()
          .single();

        if (createError) {
          console.error("Error creating user:", createError);
          throw new Error("Failed to create new user. Please try again.");
        }

        userId = newUser.id;
        console.log("Created new user:", userId);
      }

      // Step 2: Check if user is already a workspace member
      const { data: existingMember, error: existingError } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking existing member:", existingError);
        throw new Error("Error checking membership. Please try again.");
      }

      if (existingMember) {
        throw new Error("User is already a member of this workspace.");
      }

      // Step 3: Add user as a workspace member
      const { data: newMember, error: memberError } = await supabase
        .from("workspace_members")
        .insert([
          {
            workspace_id: id,
            user_id: userId,
            role: "member",
          },
        ])
        .select()
        .single();

      if (memberError) {
        console.error("Error adding workspace member:", memberError);
        throw new Error("Failed to add member to workspace. Please try again.");
      }

      console.log("Added workspace member:", newMember);

      // Step 4: Add board access for selected boards
      if (selectedBoards.length > 0) {
        const boardMembers = selectedBoards.map(boardId => ({
          board_id: boardId,
          user_id: userId
        }));

        const { error: boardMemberError } = await supabase
          .from("board_members")
          .insert(boardMembers);

        if (boardMemberError) {
          console.error("Error adding board members:", boardMemberError);
          throw new Error("Failed to add board access. Please try again.");
        }

        console.log("Added board access for member");
      }

      toast({
        title: "Success",
        description: `Member ${email} added successfully`,
      });

      setIsInviteOpen(false);
      setNewMemberEmail("");
      setSelectedBoards([]);
      await fetchWorkspaceDetails();
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
        description: `Member ${newRole === "owner" ? "promoted to owner" : "demoted to member"}`,
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

  const openManageBoards = (member: Member) => {
    setSelectedMember(member);
    setIsManageBoardsOpen(true);
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
                  {isOwner && <TableHead className="w-32">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    {isOwner && member.user.id !== workspace.owner_id && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMemberRole(member.id, member.role)}
                                >
                                  {member.role === "member" ? (
                                    <Plus className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <Minus className="w-4 h-4 text-orange-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {member.role === "member" ? "Promote to Owner" : "Demote to Member"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManageBoards(member)}
                          >
                            <Settings className="w-4 h-4 text-blue-600" />
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

          {/* Manage Board Permissions Dialog */}
          <Dialog open={isManageBoardsOpen} onOpenChange={setIsManageBoardsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Board Access</DialogTitle>
                <DialogDescription>
                  Select which boards {selectedMember?.user.name} can access
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-4">
                  {boards.map((board) => (
                    <div key={board.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`board-${board.id}`}
                        checked={memberBoardPermissions[selectedMember?.user.id || ""]?.includes(board.id)}
                        onCheckedChange={(checked) => {
                          if (selectedMember) {
                            updateBoardPermissions(selectedMember.id, board.id, !!checked);
                          }
                        }}
                      />
                      <Label htmlFor={`board-${board.id}`}>{board.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default WorkspaceDetails;
