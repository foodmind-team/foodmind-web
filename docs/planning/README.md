# FoodMind Web Planning Pack

Status: implementation-ready  
Prepared: 31 July 2026  
Target repository: `foodmind-web`  
Protected default branch: `master`

This directory is the implementation hand-off for the FoodMind Web frontend. It
turns the approved proposal, recommendation-first UX clarification, current Web
prototype, and implemented backend contract into a decision-complete delivery
plan.

## Documents

1. [Web frontend development plan](./web-frontend-development-plan.md)
   - Product boundaries and verified baseline
   - Target application architecture and route model
   - UX and responsive behavior
   - Feature-by-feature implementation sequence
   - Codex execution procedure and Definition of Done
2. [Backend API integration plan](./backend-api-integration-plan.md)
   - Browser authentication and same-origin proxy design
   - API operation-to-screen mapping
   - Query keys, invalidation, idempotency, and concurrency rules
   - Error, pagination, media, and contract-drift handling
3. [Git, testing, and delivery plan](./git-testing-and-delivery-plan.md)
   - GitHub Flow, branch and commit rules
   - Pull request sequence and dependency graph
   - CI pipeline, test matrix, deployment, UAT, and release gates
   - Pull request template and evidence requirements

Read the three documents in that order before implementation. When a decision in
one document affects another, the backend API integration plan is authoritative
for wire behavior and the Git/testing plan is authoritative for delivery
workflow.

## Source-of-truth order

When documentation and code disagree, use this order:

1. Frozen formal proposal (`foodmind-docs/Team5_AD_Project_Proposal.docx`)
2. Frozen presentation (`foodmind-docs/FoodMind_Presentation_Proposal.pptx`)
3. Explicit product-owner clarification
4. Accepted architecture decision records
5. `foodmind-docs/FoodMind_AI_Project_Context_and_Tutoring_Guide.md`
6. Backend OpenAPI contract and API conventions
7. Database ERD/schema guides
8. Historical planning/status documents

For exact HTTP behavior, the implemented backend OpenAPI document and backend
tests must be inspected together. A detected mismatch is a contract issue; the
frontend must not invent an undocumented replacement.

## Explicit non-goals

This planning pack does not authorize:

- public social feeds or follower relationships;
- public internet restaurant search;
- maps, ordering, delivery-provider integration, or payment;
- group polls or voting;
- automatic pantry inventory or expiry detection;
- photo recognition;
- push notifications;
- client-side recommendation scoring or analytics calculation;
- direct browser access to the private recommendation/inference service.

## Implementation entry gate

Implementation begins only after an issue is created for the first delivery
slice and the recommendation response status mismatch described in the API plan
is either corrected in the backend OpenAPI document or explicitly accepted as a
temporary blocking dependency.
