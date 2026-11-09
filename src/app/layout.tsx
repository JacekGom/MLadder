import type { Metadata, Viewport } from "next";
import "./globals.css";
import InAppBrowserHint from "@/components/InAppBrowserHint";

export const metadata: Metadata = {
  title: "Drabinka muzyczna",
  description: "Wyślij znajomemu piosenki i sprawdź, która wygra drabinkę.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121212",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>
        <InAppBrowserHint />
        {children}
      </body>
    </html>
  );
}
