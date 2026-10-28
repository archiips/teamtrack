export type User = {
  id: string;
  name: string;
  /** Sign-in email (synthetic demo accounts only). */
  email?: string;
  role: "instructor" | "student";
  initials: string;
  color: string;
  active?: boolean;
};
export type Team = {
  id: string;
  name: string;
  memberIds: string[];
  agreement: string;
  agreementVersion: number;
  accepted: string[];
  agreementHistory?: { version: number; body: string; accepted: string[] }[];
};
export type Task = {
  id: string;
  teamId: string;
  title: string;
  description: string;
  ownerId: string;
  status: "todo" | "in_progress" | "done";
  due: string;
  checkpoint: string;
  blocker: string;
  version: number;
};
export type Entry = {
  id: string;
  taskId: string;
  actorId: string;
  body: string;
  url: string;
  at: string;
  kind: "contribution" | "comment";
  version?: number;
};
export type Event = {
  entityId?: string;
  id: string;
  teamId: string;
  actorId: string;
  body: string;
  at: string;
};
export type State = {
  checkpoints?: { id: string; title: string; due: string }[];
  integration?: { lastSync: string | null; error: string | null };
  version: number;
  course: string;
  project: string;
  description: string;
  due: string;
  users: User[];
  teams: Team[];
  tasks: Task[];
  entries: Entry[];
  events: Event[];
};
export type Command = Record<string, unknown> & { type: string };
