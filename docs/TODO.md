# Product TODO

[Documentation index](README.md) · [Project guide](../README.md)

This roadmap records what Gen2 0.0.2 implements and what is planned.

## Implemented in the local build

- [x] Evidence correlation across readable source types: public pages, supported APIs, profiles, repositories, publications, events and text-based public PDF CVs/resumes.
- [x] Weighted matching clues, source grouping, contradiction vetoes, explainable working matches and bounded follow-up research. Marks are heuristic, not a calibrated probability.
- [x] Standalone supplied-email syntax/mail-domain DNS checks with masked output and an own-details/authorized-subject notice. No mailbox ownership or breach conclusion.

## Company and organization research

- [ ] Add a dedicated organization workflow rather than reusing person-focused biography prompts and full-name searches.
- [ ] Correlate legal entity names, registration identifiers, official domains, brands, products and public organizational affiliations.
- [ ] Add jurisdiction-aware official registry connectors and distinguish current, former and similarly named entities.
- [ ] Model parent/subsidiary, product, supplier and public professional-role relationships with dated, cited evidence.
- [ ] Separate people from organizations during identity resolution; shared names or domains cannot silently merge entity types.
- [ ] Add organization-specific articles, input examples and regression fixtures. Existing `--type` input does not establish a complete company-research feature.

## Privacy cleanup and exposure audit

- [ ] Add an explicit audit workflow for the user's own information or subjects who have given permission.
- [ ] Implement consent/ownership verification, access controls, sensitive-data retention and safe export rules. The present email tool displays an authorization notice; it does not verify authorization.
- [ ] Inventory authorized public email/address exposure with source URLs, observation dates, masked display and removal guidance.
- [ ] Add local redaction, removal tracking, rechecks and deletion controls before retaining precise personal addresses.
- [ ] Consider an official breach-notification provider for verified, authorized email owners. Return exposure metadata only; never retrieve passwords, credential dumps or breach contents.
- [ ] Define terms, provider authentication, verified-owner requirements, budgets, rate limits and audit logs before implementing breach checks.

Public availability does not establish accuracy, ownership, consent to contact or permission to republish personal information. Public-source matches remain research hypotheses with inspectable evidence. Self-reported CV credentials and organizational claims need independent confirmation.

## Document coverage

- [ ] OCR for image-only/scanned documents, with clear error/coverage reporting.
- [ ] Additional structured file formats such as DOCX, subject to bounded parsing and sanitization.
- [ ] Live authorized accuracy benchmarks and threshold calibration. Current matching regression fixtures do not measure population-wide identity accuracy.
