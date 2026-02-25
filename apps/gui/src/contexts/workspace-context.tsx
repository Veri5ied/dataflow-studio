import { createContext, useContext } from "react";

type WorkspaceContextValue = {
  workspaceId?: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({});

export const WorkspaceProvider = WorkspaceContext.Provider;

export const useWorkspace = () => useContext(WorkspaceContext);
