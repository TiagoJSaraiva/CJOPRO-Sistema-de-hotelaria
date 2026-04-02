import type { WorkspaceApp } from "./types";

export function createWorkspaceApp(name: WorkspaceApp["name"], description: string): WorkspaceApp {
  return {
    name,
    description
  };
}
