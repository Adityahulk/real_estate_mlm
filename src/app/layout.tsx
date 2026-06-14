import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AchievementTicker } from "@/components/achievement-ticker";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://shreeshyam.group"),
  title: "Shree Shyam Villa - 2",
  description: "Plot ownership, payments, and referral rewards",
  icons: {
    icon: "/shree-shyam-group-logo.png",
    shortcut: "/shree-shyam-group-logo.png",
    apple: "/shree-shyam-group-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Shree Shyam Group",
    title: "Shree Shyam Villa - 2",
    description: "Plot ownership, payments, and referral rewards",
    images: [{ url: "/shree-shyam-group-logo.png", width: 1254, height: 1254, alt: "Shree Shyam Group logo" }],
  },
  twitter: {
    card: "summary",
    title: "Shree Shyam Villa - 2",
    description: "Plot ownership, payments, and referral rewards",
    images: ["/shree-shyam-group-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased`}>
        <AchievementTicker />
        {children}
      </body>
    </html>
  );
}
