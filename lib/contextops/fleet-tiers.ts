/**
 * The agent tiers, for the web app.
 *
 * A presentation-side mirror of `agent/src/fleet.ts`: the agent service owns the
 * real tool arrays, and the browser bundle must not import the ADK to render a
 * summary of them. `agent/tests/fleet.test.ts` asserts the two stay in step, so
 * a tier renamed in one place fails the suite rather than drifting quietly.
 */
export interface FleetTierSummary {
  name: string;
  label: string;
  canWrite: boolean;
  canReachClients: boolean;
  humanGate: "never" | "beyond role limits" | "always";
}

export const FLEET_TIERS: FleetTierSummary[] = [
  {
    name: "draft_agent",
    label: "Draft",
    canWrite: false,
    canReachClients: false,
    humanGate: "never",
  },
  {
    name: "internal_commit_agent",
    label: "Internal execution",
    canWrite: true,
    canReachClients: false,
    humanGate: "beyond role limits",
  },
  {
    name: "external_commitment_agent",
    label: "External commitment",
    canWrite: true,
    canReachClients: true,
    humanGate: "always",
  },
];
