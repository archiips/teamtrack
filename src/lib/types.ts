export type User = {
  id: string;
  name: string;
  /** Sign-in email (synthetic demo accounts only). */
  email?: string;
  role: "instructor" | "student";
  initials: string;
  color: string;
  active?: boolean;
  /** Created this workspace: may edit the brief and checkpoints even as a student. */
  owner?: boolean;
  /** GitHub username, to match this person's commits. */
  github?: string;
};
export type Team = {
  id: string;
  name: string;
  memberIds: string[];
  agreement: string;
  agreementVersion: number;
  accepted: string[];
  agreementHistory?: { version: number; body: string; accepted: string[] }[];
  /** Only the leader proposes agreement changes; see leaderOf for teams without one. */
  leaderId?: string;
  /** A proposed agreement: it replaces the current one once every member approves. */
  proposal?: { body: string; by: string; at: string; approvals: string[] };
  /** The team's repo, readable through the TeamTrack GitHub App installation. */
  github?: { installationId: number; repo: string; by: string; at: string };
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
  /** Code people use to join this workspace (own-account workspaces only). */
  inviteCode?: string;
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
