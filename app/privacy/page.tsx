import Link from "next/link";

export const metadata = {
  title: "Privacy — FantasyBoard",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline bg-panel px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            FantasyBoard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-ink">Privacy Policy</h1>
        <p className="mt-1 font-mono text-xs text-ink-faint">Last updated 2026-08-02</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-muted">
          <section>
            <h2 className="font-display text-base font-medium text-ink">What we collect</h2>
            <p className="mt-2">
              If you sign in with Google, we use Firebase Authentication to identify your account and store the
              draft boards you create (player order, draft picks, favorites, and notes) in Firestore, tied to your
              account. If you use FantasyBoard as a guest, your board is stored only in your browser&apos;s local
              storage and is never sent to our servers.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium text-ink">Cookies and advertising</h2>
            <p className="mt-2">
              FantasyBoard uses Google AdSense to show ads. Google and its partners may use cookies and similar
              technologies to serve ads based on your prior visits to this or other websites, including
              personalized ads. You can learn more about how Google uses information from sites that use its
              services, and manage your ad personalization settings, at{" "}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-accent-hover"
              >
                policies.google.com/technologies/partner-sites
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium text-ink">Third parties</h2>
            <p className="mt-2">
              Player rankings, ADP, and stats are fetched from public endpoints operated by ESPN, Fantasy Football
              Calculator, and Sleeper. No personal data about you is shared with those services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-medium text-ink">Contact</h2>
            <p className="mt-2">
              Questions about this policy can be sent to the site owner via the contact information on our GitHub
              repository.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
