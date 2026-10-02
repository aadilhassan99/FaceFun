import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human Counter — Face Detection",
  description: "Count visible faces in your webcam or an uploaded image, privately in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
