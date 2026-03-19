import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNFPA Partnership Catalyst — Asia-Pacific",
  description: "AI-powered tool helping UNFPA Asia-Pacific prepare for funding conversations and partnership development.",
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
                UNFPA Partnership Catalyst
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
                UNFPA Asia-Pacific
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
                  LKYSPP Policy Innovation Team — Rani Opula Rajan, Prachi Sharma, Abhishek Tiwari, Preeti Patil
                </p>
                <p className="mt-0.5">
                  Haojun See, Founder,{" "}
                  <a href="https://ontheground.agency" className="text-blue-500 hover:underline">
                    On The Ground
                  </a>
                </p>
              </div>
              <div className="text-right">
                <p>
                  Lee Kuan Yew School of Public Policy
                </p>
                <p className="mt-0.5">
                  National University of Singapore
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
