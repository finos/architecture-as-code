import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CALMGuard",
  description: "CALM-native continuous compliance DevSecOps platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-slate-800 border-slate-700 text-slate-100',
                error: 'border-red-500/50',
                warning: 'border-amber-500/50',
              },
            }}
            duration={5000}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
