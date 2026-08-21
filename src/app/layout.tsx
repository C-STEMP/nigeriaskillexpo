import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { antdTheme } from "@/lib/theme/antd-theme";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import "./globals.css";

// Manrope: display/headline face — geometric, confident, carries the big
// KPI numbers and section titles with some real weight.
const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// Inter: body/data/table face — stays legible at small sizes in dense
// leaderboards and forms, doesn't compete with Manrope for attention.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nigeria Skills Expo — Skills Excellence Awards",
  description: "Nigeria Skills Expo Excellence Awards — national assessment and recognition platform for trainees, training providers, technical colleges, instructors, and industry partners.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon.png",
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL as string),
  openGraph: {
    title: "Nigeria Skills Expo — Skills Excellence Awards",
    description: "Nigeria Skills Expo Excellence Awards — national assessment and recognition platform for trainees, training providers, technical colleges, instructors, and industry partners.",
    url: process.env.NEXTAUTH_URL as string,
    siteName: "Nigeria Skills Expo — Skills Excellence Awards",
    images: [
      {
        url: "/constructor_discussion.jpg",
        width: 1200,
        height: 630,
        alt: "Preview image for Nigeria Skills Expo — Skills Excellence Awards"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Nigeria Skills Expo — Skills Excellence Awards",
    description: "Nigeria Skills Expo Excellence Awards — national assessment and recognition platform for trainees, training providers, technical colleges, instructors, and industry partners.",
    // images: [`${new URL(process.env.NEXTAUTH_URL as string)}/assets/constructor_discussion.jpg`]  
    images: [`/constructor_discussion.jpg`]  
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-ink">
        <AuthSessionProvider>
          <AntdRegistry>
            <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
          </AntdRegistry>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
