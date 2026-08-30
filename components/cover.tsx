import { FLEET_TIERS } from "@/lib/contextops/fleet-tiers";
import { PORTFOLIO } from "@/lib/contextops/portfolio";

/**
 * The cover.
 *
 * One screen, one claim, one door. It exists because the control room opens
 * mid-decision and never says what the product is — a visitor who has not been
 * told lands inside someone else's Monday morning. The numbers here are read
 * from the same generated portfolio the control room uses, so the cover cannot
 * advertise a system different from the one behind the door.
 */
export function Cover() {
  const reversible = PORTFOLIO.executionPlan.filter((item) => item.reversible).length;
  const irreversible = PORTFOLIO.executionPlan.length - reversible;

  return (
    <main className="cover">
      <div className="cover-glow" aria-hidden="true" />

      <header className="cover-top">
        <div className="cover-brand">
          <span className="cover-mark" aria-hidden="true">S</span>
          <span>SecondKey</span>
        </div>
        {/* People look top-right for the way in. Give them a door there too,
            so the cover never reads as the whole of the thing. The second link
            is for the reader who would rather check than be shown. */}
        <nav className="cover-toplinks">
          <a className="cover-toplink ghost" href="/try">
            Try it yourself
          </a>
          <a className="cover-toplink" href="/app">
            Open the demo <span aria-hidden="true">→</span>
          </a>
        </nav>
      </header>

      <div className="cover-main">
        <div className="cover-copy">
          <p className="cover-eyebrow">Governed enterprise agents</p>
          <h1 className="cover-title">
            Autonomy
            <br />
            until it matters.
          </h1>
          <p className="cover-lede">
            The agent holds the first key. It runs every action it can undo, on its own.
            Everything it cannot undo stops and waits for yours.
          </p>

          {/* A plain anchor, not next/link: this is a once-per-visit full page
              navigation, and the router prefetch buys nothing here. */}
          <a className="cover-cta" href="/app">
            Enter the control room
            <span className="cover-cta-arrow" aria-hidden="true">→</span>
          </a>
          <p className="cover-cta-note">
            <span className="cover-live" aria-hidden="true" />
            Live demo · no sign-in
          </p>
        </div>

        {/*
          The fleet, stated on the cover rather than buried, because the split by
          capability is the product — not a detail a visitor should dig for.
        */}
        <ul className="cover-fleet" aria-label="Agent tiers">
          {FLEET_TIERS.map((tier) => (
            <li key={tier.name}>
              <a href="/app">
              <strong>{tier.label}</strong>
              <span>
                {tier.canReachClients
                  ? "Client-facing"
                  : tier.canWrite
                    ? "Internal, reversible"
                    : "Reads and drafts"}
              </span>
              <em>
                {tier.humanGate === "always"
                  ? "Always waits for a human"
                  : tier.humanGate === "never"
                    ? "Holds no write tool"
                    : "Waits beyond role limits"}
              </em>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <dl className="cover-figures">
        <div>
          <dt>Run unattended</dt>
          <dd>{reversible}<span>{` of ${PORTFOLIO.executionPlan.length} actions`}</span></dd>
        </div>
        <div>
          <dt>Wait for a human</dt>
          <dd>{irreversible}<span> irreversible</span></dd>
        </div>
        <div>
          <dt>Leaves the building</dt>
          <dd>0<span> external writes</span></dd>
        </div>
      </dl>

    </main>
  );
}
