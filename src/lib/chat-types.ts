export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_WORKSPACE_BYTES = 50 * 1024 * 1024;
export type ChatMessage = {
  id: string;
  teamId: string;
  actorId: string;
  name: string;
  initials: string;
  color: string;
  role: "student" | "instructor";
  body: string;
  at: string;
  attachment?: { name: string; bytes: number };
};
export type ChatPage = { messages: ChatMessage[]; hasMore: boolean };
