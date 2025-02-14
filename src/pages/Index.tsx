
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Settings, Users } from "lucide-react";

const Index = () => {
  const [workspaces, setWorkspaces] = useState([
    { id: 1, name: "Marketing Team", members: 5, boards: 3 },
    { id: 2, name: "Development Team", members: 8, boards: 6 },
  ]);

  return (
    <div className="min-h-screen bg-workspace-50">
      <nav className="glass-effect fixed top-0 w-full border-b border-workspace-200 px-6 py-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-workspace-800">Workspaces</h1>
          <Button variant="outline" size="sm" className="hover-lift">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
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
            <Button className="hover-lift">
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>

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
                      {workspace.members} members
                    </div>
                    <div>{workspace.boards} boards</div>
                  </div>
                </div>
                <div className="border-t border-workspace-200 p-4 bg-workspace-50 rounded-b-lg">
                  <Button variant="secondary" size="sm" className="w-full hover-lift">
                    View Workspace
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
