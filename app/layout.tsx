import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300","400","600","700","800","900"],
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
      <body className={nunito.variable}>
        {children}
      </body>
    </html>
  );
}
