import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata: Metadata = {
  title: "FırsatRadarı - En Güncel Kampanyalar",
  description:
    "Forum sitelerinden toplanan en güncel indirim ve kampanya fırsatları",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
