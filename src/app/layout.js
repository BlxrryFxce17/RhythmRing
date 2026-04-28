import "./globals.css";

export const metadata = {
  title: "RhythmRing | Collaborative Music Creation",
  description: "Turn everyday sounds into community-made music with Gemini AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
