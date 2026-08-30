/**
 * The page for someone who has two minutes and no reason to trust us.
 *
 * The control room shows a decision being made; this shows how to check it.
 * Every claim on the rest of the site has a command here that either confirms
 * it or does not, run against the same deployed service — which is the only
 * form of evidence that survives a sceptical reader.
 */

/** Paste the YouTube URL here after uploading; the embed hides itself until then. */
const VIDEO_URL = "";

const AGENT = "https://secondkey-agent-689501174668.australia-southeast2.run.app";

interface Probe {
  id: string;
  title: string;
  claim: string;
  command: string;
  look: string;
}

const PROBES: Probe[] = [
  {
    id: "status",
    title: "It runs on Google Cloud, on Vertex",
    claim: "Not a laptop, and not an API key baked into a container.",
    command: `curl -s ${AGENT}/status`,
    look:
      'model_backend is "vertex" and model_location is "global" — the service reaches Gemini through the Cloud Run runtime service account, so no key exists inside it. external_write is false.',
  },
  {
    id: "triage",
    title: "The model extracts. It does not decide",
    claim: "Two emails, live. One ordinary, one hostile.",
    command:
      `curl -sX POST ${AGENT}/triage \\\n  -H "Content-Type: application/json" \\\n  -d '{"email_ids":["EM-001","EM-023"]}'`,
    look:
      'On the first: args is what the model extracted — a summary, an intent, the urgency phrases. result is what the deterministic tool returned: the priority, and the rule that fired. On the second — the prompt injection — tool_call is null. It never reached a tool, and it has no priority: the system did not pretend to process it.',
  },
  {
    id: "fleet",
    title: "Three agents, split by what each may do",
    claim: "Takes about 35 seconds. It is really running.",
    command:
      `curl -sX POST ${AGENT}/fleet/run \\\n  -H "Content-Type: application/json" \\\n  -d '{"account_id":"CL-BH","role":"Delivery Manager"}'`,
    look:
      "delegation reports which agent reached for which tool. An agent cannot appear beside a tool its tier was not constructed with — the draft tier holds no write tool at all. Watch the last one: the external tier asked to release a client commitment and the framework's own confirmation protocol stopped it. Nothing was sent.",
  },
];

export function TryItPage() {
  return (
    <main className="try">
      <div className="cover-glow" aria-hidden="true" />

      <header className="cover-top">
        <div className="cover-brand">
          <span className="cover-mark" aria-hidden="true">S</span>
          <span>SecondKey</span>
        </div>
        <a className="cover-toplink" href="/app">
          Open the control room <span aria-hidden="true">→</span>
        </a>
      </header>

      <section className="try-head">
        <p className="cover-eyebrow">Try it yourself</p>
        <h1 className="try-title">Don&rsquo;t take our word for it.</h1>
        <p className="cover-lede">
          Three commands, against the deployed service. Each one checks a claim the rest
          of this site makes. Copy them into any terminal — nothing is simulated on your side.
        </p>
        <p className="try-limit">
          Public demo guard: <code>/triage</code> and <code>/fleet/run</code> share a
          60-request window every 10 minutes. If a 429 response includes <code>Retry-After</code>,
          wait that many seconds and try again.
        </p>
      </section>

      {VIDEO_URL ? (
        <section className="try-video">
          <iframe
            src={VIDEO_URL}
            title="SecondKey demo"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </section>
      ) : null}

      <ol className="try-list">
        {PROBES.map((probe, index) => (
          <li key={probe.id}>
            <div className="try-num" aria-hidden="true">{index + 1}</div>
            <div className="try-body">
              <h2>{probe.title}</h2>
              <p className="try-claim">{probe.claim}</p>
              <pre className="try-cmd" tabIndex={0} role="region" aria-label={`Command for ${probe.title}`}>
                <code>{probe.command}</code>
              </pre>
              <p className="try-look">
                <strong>What to look for. </strong>
                {probe.look}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <section className="try-foot">
        <div>
          <h2>Where the boundary is</h2>
          <p>
            Every action the system can undo, it takes on its own. Everything it cannot undo
            stops and waits for a named person. The line is not &ldquo;important&rdquo; —
            importance is arguable. The line is reversible, and that one is decidable.
          </p>
        </div>
        <ul className="try-links">
          <li><a href="/app">The control room</a></li>
          <li><a href="https://github.com/vcdwio/secondkey">Source on GitHub</a></li>
          <li><a href={`${AGENT}/fleet`}>The capability split, as data</a></li>
        </ul>
      </section>
    </main>
  );
}
