import Link from "next/link";
import type { Metadata } from "next";

import { SAMPLE_LIST } from "@/lib/parties";
import { DelegationDiagram } from "@/components/delegation-diagram";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  description:
    "Don't pick a party every four years. Rank single-issue parties by preference, change them whenever you want, and the first with an opinion votes real US bills for you.",
};

export default function Home() {
  return (
    <section className="bd-container grid gap-x-12 gap-y-10 pb-16 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-12">
      <div className="lg:col-span-2">
        <div role="img" aria-label="Closer Congress" className="mb-10 lg:mb-14">
          <Logo
            size={40}
            wordmark
            className="gap-3 text-[var(--bd-navy)] md:gap-4 md:[&>svg]:h-[60px] md:[&>svg]:w-[60px]"
            wordmarkClassName="font-wordmark text-[1.75rem] tracking-tight md:text-[2.75rem]"
          />
        </div>
        <h1 className="font-serif text-3xl font-semibold leading-snug sm:text-4xl lg:text-5xl">
          <span className="block">Don&rsquo;t pick a party every four years.</span>
          <span className="block">Pick your preferences, whenever you want.</span>
        </h1>
        <div className="bd-rule mt-3 rounded-full" />
      </div>
      <div className="lg:order-2 lg:flex lg:flex-col lg:justify-center lg:py-8">
        <p className="max-w-xl text-lg leading-relaxed text-[var(--bd-muted)] xl:text-xl">
          Rank single-issue delegates. Each is silent outside its subject, so the first
          with an opinion on a bill casts your vote.
        </p>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--bd-muted)] xl:text-xl">
          Change your votes whenever you like. Your latest saved list replaces the previous
          one.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 lg:mt-12">
          <Link
            href="/delegate"
            className="rounded-md bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
          >
            Build My List
          </Link>
          <Link
            href="/bills"
            className="rounded-md border border-[var(--bd-line)] bg-white px-5 py-3 font-medium hover:bg-blue-50"
          >
            See the bills
          </Link>
        </div>
      </div>

      <div className="self-start lg:order-1">
        <DelegationDiagram
          caption="My List, walked from the top"
          bill="A bill recognising a religious holiday"
          steps={[
            { slug: SAMPLE_LIST[0], state: "silent", note: "Not its subject. Your vote falls past it." },
            { slug: SAMPLE_LIST[1], state: "votes", note: "Its subject. It votes yes and the walk stops." },
            { slug: SAMPLE_LIST[2], state: "unreached", note: "Never asked. Someone above it spoke." },
          ]}
          outcome={
            <>
              yes, cast by your second delegate.{" "}
              <Link href="/how-it-works" className="bd-link">
                How it works
              </Link>
            </>
          }
        />
      </div>
    </section>
  );
}
