import { redirect } from "next/navigation";
import { lmsUser } from "@/lib/lms";
import { LmsLoginForm } from "./login-form";
export const dynamic = "force-dynamic";
export default async function LmsLogin() {
  if (await lmsUser()) redirect("/lms/course");
  return (
    <main className="lms-login">
      <div className="lms-login-card">
        <div className="lms-wordmark">
          <span className="lms-mark">C</span>
          Campus LMS
          <small>demo</small>
        </div>
        <h1>Log in to your courses</h1>
        <p>Use your class demo account.</p>
        <LmsLoginForm />
      </div>
      <p className="lms-login-note">
        A demo learning platform used to show TeamTrack&apos;s LTI 1.3
        integration. Not affiliated with any LMS vendor.
      </p>
    </main>
  );
}
