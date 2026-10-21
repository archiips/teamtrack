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
    <html
      lang="en"
      className={`${display.variable} ${serif.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved or system theme before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tt-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
