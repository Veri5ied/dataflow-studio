export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export type QueryHistoryItem = {
  id: string;
  workspaceId: string;
  sql: string;
  durationMs: number;
  success: boolean;
  rowsReturned: number;
  executedAt: string;
};
