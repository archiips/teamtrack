"use client";
import { useState } from "react";
import {
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  Unplug,
} from "lucide-react";
import { commitBreakdown, daysSinceCommit } from "@/lib/insights";
import type { RepoActivity } from "@/lib/github";
import type { Command, State, Team, User } from "@/lib/types";

export type GithubData = RepoActivity | { error: string };
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

/** A team's GitHub repo: connect it, or see commits per member and recent work. */
export function GithubPanel({
  team,
  s,
  userId,
  canManage,
  data,
  busy,
  avatar,
  command,
}: {
  team: Team;
  s: State;
  userId: string;
  canManage: boolean;
  data?: GithubData;
  busy: boolean;
  avatar: (u: User) => React.ReactNode;
  command: (c: Command, message?: string) => Promise<boolean>;
}) {
  const me = s.users.find((u) => u.id === userId);
  const members = s.users.filter((u) => team.memberIds.includes(u.id));
  const connect = `/api/github/connect?teamId=${encodeURIComponent(team.id)}`;
  if (!team.github)
    return (
      <section className="panel github-panel">
        <div className="panel-title">
          <div>
            <h2>GitHub</h2>
            <p>See commits and merged pull requests next to your tasks.</p>
          </div>
          <GitCommitHorizontal size={21} />
        </div>
        <div className="github-body">
          {canManage ? (
            <>
              <p className="form-note">
                Works with private repos. TeamTrack reads the commit list and
                pull requests only, never your code.
              </p>
              <div className="github-actions">
                <a className="primary" href={`${connect}&install=1`}>
                  Connect GitHub repo
                </a>
                <a className="text-button" href={connect}>
                  Already installed? Pick the repo
                </a>
              </div>
            </>
          ) : (
            <p className="form-note">
              Your team leader can connect the team’s repo.
            </p>
          )}
          {me && team.memberIds.includes(userId) && (
            <UsernameForm me={me} busy={busy} command={command} />
          )}
        </div>
      </section>
    );
  const activity = data && "commits" in data ? data : undefined;
  const days = activity ? daysSinceCommit(activity.commits, new Date()) : null;
  const split = activity
    ? commitBreakdown(activity.commits, members)
    : undefined;
  return (
    <section className="panel github-panel">
      <div className="panel-title">
        <div>
          <h2>GitHub</h2>
          <p>
            <a
              href={activity?.url || `https://github.com/${team.github.repo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {team.github.repo}
              <ExternalLink size={12} />
            </a>
            {days !== null && (
              <span className={days >= 7 ? "attention-tag" : "clear-tag"}>
                Last commit {days === 0 ? "today" : `${days}d ago`}
              </span>
            )}
          </p>
        </div>
        <GitCommitHorizontal size={21} />
      </div>
      {data && "error" in data && (
        <div className="github-body">
          <p className="form-note">{data.error}</p>
        </div>
      )}
      {!data && (
        <div className="github-body">
          <p className="form-note">Loading repo activity…</p>
        </div>
      )}
      {split && activity && (
        <>
          <div className="github-members">
            {split.rows.map((r) => (
              <div className="member-row" key={r.user.id}>
                {avatar(r.user)}
                <div>
                  <strong>{r.user.name}</strong>
                  <span>
                    {r.user.github
                      ? r.last
                        ? `Last commit ${ago(r.last)}`
                        : `No commits as @${r.user.github} yet`
                      : "No GitHub username yet"}
                  </span>
                </div>
                <b className="commit-count">
                  {r.commits}
                  <small> commit{r.commits === 1 ? "" : "s"}</small>
                </b>
              </div>
            ))}
            {split.unmatched.length > 0 && (
              <p className="form-note unmatched-note">
                Not matched to anyone:{" "}
                {split.unmatched
                  .slice(0, 4)
                  .map((o) => `${o.author} (${o.commits})`)
                  .join(", ")}
                . Members add their GitHub username below.
              </p>
            )}
          </div>
          <div className="github-recent">
            <h3>Recent commits</h3>
            {activity.commits.slice(0, 5).map((c) => (
              <a
                key={c.sha + c.at}
                className="github-item"
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitCommitHorizontal size={14} />
                <span>
                  {c.message}
                  <small>
                    {c.login || c.name} · {ago(c.at)} · {c.sha}
                  </small>
                </span>
              </a>
            ))}
            {!activity.commits.length && (
              <p className="form-note">No commits yet.</p>
            )}
            {activity.pulls.length > 0 && (
              <>
                <h3>Merged pull requests</h3>
                {activity.pulls.slice(0, 3).map((p) => (
                  <a
                    key={p.number}
                    className="github-item"
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitPullRequest size={14} />
                    <span>
                      #{p.number} {p.title}
                      <small>
                        {p.login} · merged {ago(p.at)}
                      </small>
                    </span>
                  </a>
                ))}
              </>
            )}
          </div>
        </>
      )}
      <div className="github-body">
        {me && team.memberIds.includes(userId) && (
          <UsernameForm me={me} busy={busy} command={command} />
        )}
      </div>
      <div className="panel-foot github-foot">
        <span>
          Commit counts are context, not a contribution score. Last 100 commits.
        </span>
        {canManage && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() =>
              confirm(`Disconnect ${team.github!.repo} from ${team.name}?`) &&
              command(
                { type: "team.github.unlink", teamId: team.id },
                "Repo disconnected",
              )
            }
          >
            <Unplug size={13} />
            Disconnect
          </button>
        )}
      </div>
    </section>
  );
}

function UsernameForm({
  me,
  busy,
  command,
}: {
  me: User;
  busy: boolean;
  command: (c: Command, message?: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(me.github || "");
  return (
    <form
      className="github-login"
      onSubmit={(e) => {
        e.preventDefault();
        void command(
          { type: "profile.github", login: value },
          value ? "GitHub username saved" : "GitHub username removed",
        );
      }}
    >
      <label>
        Your GitHub username
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="octocat"
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
        />
      </label>
      <button
        className="secondary"
        disabled={busy || value.trim() === (me.github || "")}
      >
        Save
      </button>
    </form>
  );
}
