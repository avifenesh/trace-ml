# Pull Request

## Summary

What changed, why it was needed, and what a learner or maintainer will observe.

## Validation

List the exact automated checks and action tests that passed.

## Checklist

- [ ] The change is focused and includes relevant tests.
- [ ] `make check` passes.
- [ ] `make test-e2e` passes, or N/A is explained above.
- [ ] Native changes were tested with `make install` and `make smoke` on the
  named operating system, or N/A is explained above.
- [ ] Course claims use primary or authoritative sources and update the
  research registry, or N/A is explained above.
- [ ] Generated manifests are synchronized with their source, or N/A is
  explained above.
- [ ] The helper remains page-grounded and cannot create, select, reorder, or
  unlock material, or N/A is explained above.
- [ ] No credentials, learner data, private account content, or
  machine-specific paths were added.
- [ ] README, changelog, security guidance, and contributor guidance are
  updated where needed.

## Review Notes

Call out security boundaries, known limitations, migration effects, and anything
that deserves focused reviewer attention.
