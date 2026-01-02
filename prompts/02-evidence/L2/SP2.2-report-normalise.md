You are editing an evidence document only. Do NOT change code.

If any instruction conflicts with context/00-guardrails.md, guardrails win.
Use context/BOOT_PROMPT.md as the governing boot prompt.

Task:
Normalize and de-duplicate docs/SP2.2-windows-validation.md so it reads as one coherent validation report for SP2.2.2 phases 0–3.

Rules:
- Preserve all factual evidence already captured.
- Remove or move “Original SP2.2 Validation (Historical)” into an Appendix named “Appendix A — Historical notes (not part of SP2.2.2 validation)”.
- Ensure there is only ONE Phase 0, ONE Phase 1, ONE Phase 2, ONE Phase 3 section.
- Ensure Phase 2 and Phase 3 are clearly marked “Pending” until operator completes them.
- Remove duplicated Phase 1 content that appears later in the file.
- Keep all log excerpts already present, but do not add new ones unless already in the document.
- Update the “Verification Summary” and “Validation Conclusion” checkboxes to reflect completed phases only.

Output:
A cleaned docs/SP2.2-windows-validation.md with consistent headings and no contradictions.
