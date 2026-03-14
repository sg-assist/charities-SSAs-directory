import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNFPA PPP Challenge — LKYSPP Policy Innovation Lab",
  description: "Research assistant for the LKYSPP consulting team working on UNFPA's PPP for Climate and Humanitarian Resilience challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900">
        {/* Site header */}
        <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
            {/* Logo / wordmark */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div
                className="h-7 w-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: "#009EDB" }}
              >
                UN
              </div>
              <span className="font-semibold text-slate-900 text-sm leading-tight">
                UNFPA Research Assistant
              </span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                Chat
              </Link>
              <Link
                href="/knowledge"
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                Knowledge Base
              </Link>
              <span className="ml-2 px-3 py-1.5 text-xs text-slate-400">
                LKYSPP Policy Innovation Lab · UNFPA Project B
              </span>
            </nav>
          </div>
        </header>

        {/* Page content */}
        {children}
      </body>
    </html>
  );
}
