import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Athena — Zaio SOC Lab",
  description:
    "Athena is a browser-based Security Operations Center (SOC) simulation lab by Zaio Institute of Technology for training cybersecurity students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
