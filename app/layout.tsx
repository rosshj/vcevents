import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { MotionProvider } from "@/components/motion-provider";
import { StudentSheetProvider } from "@/components/student-sheet";
import { EventSheetProvider } from "@/components/event-sheet";
import { HouseSheetProvider } from "@/components/house-sheet";
import { ScannerProvider } from "@/components/scanner-sheet";
import { FlagsProvider } from "@/components/flags-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/app-shell";
import { APP_NAME, SCHOOL_NAME } from "@/lib/config";
import { evaluateFlags } from "@/lib/flags";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: `House points and event check-in for ${SCHOOL_NAME}`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Extend the page under the status bar / Dynamic Island so each screen's
  // color reaches the very top edge — Safari's glass samples what's there.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Flags are decided on the server so client screens read them with no
  // waterfall and no flash of the wrong UI.
  const flags = await evaluateFlags();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <FlagsProvider flags={flags}>
          <SessionProvider>
            <MotionProvider>
              <ToastProvider>
                <StudentSheetProvider>
                  <EventSheetProvider>
                    <HouseSheetProvider>
                      <ScannerProvider>
                        <AppShell>{children}</AppShell>
                      </ScannerProvider>
                    </HouseSheetProvider>
                  </EventSheetProvider>
                </StudentSheetProvider>
              </ToastProvider>
            </MotionProvider>
          </SessionProvider>
        </FlagsProvider>
      </body>
    </html>
  );
}
