import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata = { title: "Faceless Avatar Assistant", description: "Talk to a faceless flat-style AI avatar" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
