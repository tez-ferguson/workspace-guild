
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface InviteMemberDialogProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteMemberDialog({ workspaceId, isOpen, onClose, onSuccess }: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsInviting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      console.log('Attempting to invoke edge function with:', {
        email: email.trim().toLowerCase(),
        workspaceId,
        invitedBy: user.id,
      });

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: email.trim().toLowerCase(),
          workspaceId,
          invitedBy: user.id,
        },
      });

      console.log('Edge function response:', { data, error });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invitation sent successfully",
      });

      setEmail("");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error in handleInvite:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Enter the email address of the person you want to invite
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              disabled={isInviting}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isInviting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInvite}
            disabled={isInviting}
          >
            {isInviting ? "Sending Invite..." : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}