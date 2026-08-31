import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wellness Twin",
  description:
    "A personal wellness companion that helps you understand changes in your work patterns.",
  icons: {
    icon: [
      {
        url: "/wellness-twin-logo-black.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/wellness-twin-logo-transparent.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/wellness-twin-logo-black.png",
    apple: "/wellness-twin-logo-black.png",
  },
};

const themeInitScript = `
  try {
    const saved = localStorage.getItem('wellness-theme-preference');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_) {
    document.documentElement.classList.remove('dark');
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/wellness-twin-logo-black.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/wellness-twin-logo-transparent.png" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="min-h-full flex flex-col bg-[#F7F8FA] text-slate-900 dark:bg-[#20201e] dark:text-[#cfcfce] transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}