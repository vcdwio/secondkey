# Verge Consulting ContextOps Demo Data Pack

Version 1.0 · Entirely fictional · No real people, companies, credentials or customer data

## What is included

- One consulting-company tenant with ten employees.
- Seven client accounts across logistics, business services, training, retail/wholesale, accounting services, e-commerce and sales outsourcing.
- Thirty linked emails, twelve calendar events, eight meetings, eight call logs, nine tickets, staff capacity, CRM and finance-admin records.
- Active and archived policies, seven mock research briefs, noisy and adversarial records, a flagship context packet, expected decision output and twenty-five eval scenarios.

## Recommended demo

Start with 02_DEMO_STORY.md, then load scenarios/context_packets/flagship_context_packet.json and compare the result with scenarios/flagship_monday_capacity_crisis.json.

## Safety

All email domains end in .example. Demo mode enforces external_write=false. No external messages, CRM changes, payments, calendar changes or client commitments may execute.

## Important design point

The visible product is the business decision queue. Trigger, orchestration, context retrieval, decision policy, approval, execution and audit remain shared platform services.
