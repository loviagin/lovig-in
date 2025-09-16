import { Metadata } from "next";

const metadata: Metadata = {
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

export default function Home() {
  return (
    <main>
    </main>
  );
}