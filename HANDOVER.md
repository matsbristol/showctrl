# SHOWCTRL Handover

## Project direction

This project is being shaped as a stage-first live event operations system, not a generic festival safety product.

The primary focus is the stage and performers, with a strong emphasis on:
- master show clock
- run-of-show planning
- cue tracking and execution
- performer timing and call windows
- stage management and department coordination
- live operational visibility for backstage teams

The product is intended to support multiple customers, each with their own users, brands, data, backups, permissions, and feature sets.

---

## Core insight from research

We reviewed the current competition, especially Safevenue / Event Safety Hub, and the pattern is clear:
- they are focused on event safety and HMS workflows
- they solve incident management, safety checklists, weather alerts, compliance, and risk reporting
- they are strong in operational safety, not stage execution or performer timing

Our opportunity is to differentiate by covering the operational backbone of the live performance itself:
- timing
- run-of-show
- stage-specific coordination
- cue execution
- performer readiness and stage entry
- department alignment around the master clock

---

## Product positioning

SHOWCTRL should be positioned as:

> The stage execution platform for live events.

Not as a generic event safety platform.

It should be built around:
- master clock
- show timeline
- cue ownership
- performer timing
- live delay management
- backstage clarity

---

## MVP direction

The first version should be deliberately focused.

### MVP scope
- master show clock
- run-of-show planner
- cue manager
- performer timing windows
- delay and adjustment tracking
- department-specific views
- basic dashboard for stage manager / production manager

### Out of scope for MVP
- broad festival compliance
- full safety/HMS modules
- vendor portals
- generic venue operation tooling
- marketing and audience features

---

## Product requirements for the first build

### Functional requirements
- create events
- create several stages per event
- assign several artists per stage per event
- timeline for the show
- calendar date picker for event planning
- event start/end times
- run-of-show items with owners and departments
- cue statuses: pending / live / complete / delayed
- delay logging with reason and impact
- performer call windows
- performer ready / not ready states
- stage-specific view and global view
- role-based access and permissions

### UX requirements
- fast under pressure
- clear ownership
- visible timing state
- mobile/tablet ready
- readable during live operations
- minimal cognitive overload

---

## Multi-customer SaaS direction

The system must be scalable and sellable to multiple customers.

### Architecture direction
- single application codebase
- multi-tenant architecture
- each customer is a tenant
- tenant-specific user database and permissions
- customer-specific features via feature flags
- independent backups and retention policies
- brand customization and white-label support
- optional schema/database isolation for enterprise customers

### Recommended model
Start with:
- shared app layer
- shared database with strict tenant scoping
- role-based access control
- feature flags for product plans
- per-customer branding
- per-customer backup retention

Escalate later to:
- schema-per-tenant or database-per-tenant for large enterprise customers

### Important SaaS features
- tenant settings
- role management
- user management per customer
- event templates
- custom terminology and labels
- feature flags
- audit logs
- billing and subscription management
- backup automation
- SSO for enterprise customers

---

## Pricing direction

Suggested pricing model:
- base platform subscription
- per-seat or per-team cost
- per-active-event pricing
- premium add-ons
- enterprise package with custom setup and support

Example structure:
- Starter: small team
- Pro: active production teams / touring / festival ops
- Enterprise: multi-venue or large org
- White-label / custom: custom deployments

---

## Homepage positioning

Headline idea:

> Keep the show on time. Keep the team aligned.

Subheadline:

> The stage execution platform for live events.

Core value points:
- master clock
- run-of-show planning
- cue control
- performer timing
- live delay management
- department coordination

---

## Recommended next step

The next step is to build an initial working application skeleton with:
- event dashboard
- stage management screen
- artist assignment flows
- calendar date selection
- multi-stage event concept
- run-of-show editor
- basic master clock UI

This should be the first working version to adjust later, not the final product.

---

## Current project state

The repo was initialized and the project structure is expected to be set up as a React + TypeScript app in the workspace at this repository root.

The key outcome is to keep the project grounded in the actual stage operations flow rather than broad event safety tooling.

---

## Decisions to preserve

- Focus on stage and performer operations
- Prioritize clock and planning features over safety modules
- Build a real operational product, not a generic event app
- Make the system sellable to multiple customers via multi-tenant architecture
- Keep the first version practical and adjustable as the product evolves

---

## Example user stories

- As a stage manager, I want a master show clock so all departments stay aligned.
- As a production manager, I want to assign artists to stages and plan timelines per event.
- As a department lead, I want to see only the cues relevant to my team.
- As an artist liaison, I want to track performer call times and readiness.
- As an operations lead, I want to log delays and understand the impact on the show.
- As a customer admin, I want separate users, roles, and data for each client.

---

## Main strategic summary

SHOWCTRL should compete on clarity, timing, and live execution for the stage — not on generic event safety compliance.

The product should feel like the operational control room for the performance itself.

---

## Future directions

Potential next layers after MVP:
- mobile crew app
- push alerts for timing changes
- AI summaries of delays and problems
- centralized venue and backstage planning
- exportable reports
- enterprise integrations
- multi-venue rollups

---

## Final thought

The product should be designed for the people who make the show happen, not the people who only monitor safety paperwork.
