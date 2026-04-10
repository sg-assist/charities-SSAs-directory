import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Directory — Singapore Charities & SSAs",
  description: "Comprehensive directory of Singapore charities, social service agencies, and caregiving resources with AI-powered search.",
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
                style={{ backgroundColor: "#0891B2" }}
              >
                D
              </div>
              <span className="font-semibold text-slate-900 text-sm leading-tight">
                The Directory
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
                href="/directory"
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                Directory
              </Link>
              <Link
                href="/knowledge"
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              >
                Knowledge Base
              </Link>
              <span className="ml-2 px-3 py-1.5 text-xs text-slate-400">
                Singapore
              </span>
            </nav>
          </div>
        </header>

        {/* Page content */}
        {children}

        {/* Attribution footer */}
        <footer className="border-t border-slate-200 bg-white mt-auto">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
              <div>
                <p className="font-medium text-slate-500 mb-1">Built by</p>
                <p>
                  <a href="https://sgassist.sg" className="text-teal-600 hover:underline">
                    SG Assist Pte Ltd
                  </a>
                  {" x "}
                  <a href="https://ontheground.agency" className="text-teal-600 hover:underline">
                    OTG
                  </a>
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">
                  Singapore Charities &amp; Social Service Agencies Directory
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
