import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'LOVIGIN ONE LOGIN',
  description: 'One Login Page for all LOVIGIN Apps',
  icons: {
    icon: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    title: 'LOVIGIN ONE LOGIN',
    description: 'One Login Page for all LOVIGIN Apps',
    images: ['/favicon.ico'],
  },
  alternates: {
    canonical: 'https://auth.lovig.in',
  },
  creator: 'LOVIGIN LTD',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
