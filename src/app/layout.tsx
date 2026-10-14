import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TeamTrack — Better teams, clearer contributions",
  description:
    "A calmer space for student teamwork. Plan together, share your work, and move forward.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
