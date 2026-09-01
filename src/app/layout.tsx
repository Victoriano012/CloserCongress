import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-display", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://betterdemocracy3-vcv.vercel.app"),
  title: {
    default: "BetterDemocracy — one vote, several delegates, in your order",
    template: "%s · BetterDemocracy",
  },
  description:
    "Lend your vote on real bills before Congress to an ordered list of single-issue parties. When the first has no opinion on a bill, it abstains and your vote falls through to the next one.",
  openGraph: {
    title: "BetterDemocracy",
    description:
      "Real US bills, an electorate that delegates issue by issue, and a side-by-side comparison with what Congress actually did.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
