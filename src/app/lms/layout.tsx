import type { Metadata } from "next";
import "./lms.css";
export const metadata: Metadata = {
  title: "Campus LMS (demo)",
  description: "Demo course site that launches TeamTrack over LTI 1.3.",
};
export default function LmsLayout({ children }: { children: React.ReactNode }) {
  return <div className="lms">{children}</div>;
}
