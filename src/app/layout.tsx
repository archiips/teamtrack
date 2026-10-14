import type { Metadata } from "next";
import { Fredoka, Instrument_Serif } from "next/font/google";
import "./globals.css";
// Both SIL OFL 1.1; next/font self-hosts them with the deployment.
const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
export const metadata: Metadata = {
  title: "TeamTrack — Better teams, clearer contributions",
  description:
    "A calmer space for student teamwork. Plan together, share your work, and move forward.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
