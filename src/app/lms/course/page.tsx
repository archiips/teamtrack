import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSE, lmsUser, roster } from "@/lib/lms";
import { seed } from "@/lib/seed";
export const dynamic = "force-dynamic";
const tabs = [
  { id: "home", name: "Home" },
  { id: "people", name: "People" },
  { id: "teamtrack", name: "TeamTrack" },
] as const;
const day = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
export default async function Course({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await lmsUser();
  if (!user) redirect("/lms");
  const requested = (await searchParams).tab;
  const tab = tabs.find((t) => t.id === requested)?.id || "home";
  const course = seed(),
    people = roster(),
    teacher = people.find((u) => u.role === "instructor");
  return (
    <div className="lms-shell">
      <nav className="lms-global" aria-label="Global">
        <span className="lms-mark">C</span>
        <span className="lms-global-item">
          <span className="lms-avatar">{user.initials}</span>
          Account
        </span>
        <Link className="lms-global-item active" href="/lms/course">
          <span className="lms-glyph">▦</span>
          Courses
        </Link>
        <form action="/lms/api/logout" method="post">
          <button className="lms-global-item">
            <span className="lms-glyph">⎋</span>
            Log out
          </button>
        </form>
      </nav>
      <div className="lms-main">
        <header className="lms-header">
          <span className="lms-crumb">
            {COURSE.code} <span>›</span> {tabs.find((t) => t.id === tab)?.name}
          </span>
          <span className="lms-who">
            {user.name} · {user.role === "instructor" ? "Teacher" : "Student"}
            <span className="lms-demo-tag">Demo LMS</span>
          </span>
        </header>
        <div className="lms-body">
          <nav className="lms-course-nav" aria-label="Course">
            <small>{COURSE.term}</small>
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`/lms/course?tab=${t.id}`}
                className={t.id === tab ? "active" : ""}
                aria-current={t.id === tab ? "page" : undefined}
              >
                {t.name}
              </Link>
            ))}
          </nav>
          {tab === "teamtrack" ? (
            <div className="lms-tool-wrap">
              <div className="lms-tool-bar">
                <span>TeamTrack · opened from this course</span>
                <a href="/lms/api/launch" target="_blank" rel="noopener">
                  Open in new tab ↗
                </a>
              </div>
              <iframe
                className="lms-tool"
                src="/lms/api/launch"
                title="TeamTrack"
                allow="clipboard-write"
              />
            </div>
          ) : tab === "people" ? (
            <section className="lms-content">
              <h1>People</h1>
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="lms-avatar">{u.initials}</span>
                        {u.name}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.role === "instructor" ? "Teacher" : "Student"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : (
            <section className="lms-content">
              <div className="lms-banner">
                <small>
                  {COURSE.code} · {COURSE.term}
                </small>
                <h1>{COURSE.title}</h1>
                <p>{teacher?.name}</p>
              </div>
              <div className="lms-grid">
                <div>
                  <article className="lms-card">
                    <h2>Announcement</h2>
                    <p className="lms-meta">
                      {teacher?.name} · {day(course.checkpoints![0].due)}
                    </p>
                    <p>
                      Teams are set for the {course.project} project. Plan your
                      work, share evidence and raise blockers in TeamTrack. It
                      is in the course menu on the left, and you&apos;re signed
                      in automatically.
                    </p>
                    <Link
                      className="lms-button"
                      href="/lms/course?tab=teamtrack"
                    >
                      Open TeamTrack
                    </Link>
                  </article>
                  <article className="lms-card">
                    <h2>Project brief</h2>
                    <p>
                      <strong>{course.project}.</strong> {course.description}
                    </p>
                  </article>
                </div>
                <aside className="lms-card">
                  <h2>Coming up</h2>
                  <ul className="lms-todo">
                    {course.checkpoints!.map((c) => (
                      <li key={c.id}>
                        <strong>{c.title} checkpoint</strong>
                        <span>Due {day(c.due)}</span>
                      </li>
                    ))}
                    <li>
                      <strong>Final presentation</strong>
                      <span>Due {day(course.due)}</span>
                    </li>
                  </ul>
                </aside>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
