---
name: gen-test
description: "Generate a Vitest integration test for this repo following its real-Postgres fixture pattern (no Prisma mocking). Invoke with /gen-test <what to test>, e.g. /gen-test cancellation refund tiers."
disable-model-invocation: true
---

# /gen-test

Generates a new test file under `tests/` that follows this repo's established pattern: **real integration tests against a real Postgres database, never mocked Prisma calls.** The existing test suite (`tests/availability.test.ts`, `tests/pricing.test.ts`, etc.) explains why in its own comments — mocking Prisma would test nothing meaningful for logic that leans on real constraints (GiST exclusion, indexes, transactional overlap checks).

## Before writing anything

1. Read `tests/helpers/fixtures.ts` in full. It exports fixture builders — currently at least `createTestClub()` and `createTestUser()`, plus date helpers like `nextWeekdayDateKey()` / `nextWeekendDateKey()`. Reuse these; do not hand-roll club/court/sport creation inline unless the test needs a shape the fixtures don't provide.
2. Read one or two existing test files closest to the feature under test (e.g. `tests/availability.test.ts` for anything touching slots/blocking, `tests/pricing.test.ts` for pricing rules) to match structure and naming.
3. If graphify is available (`graphify-out/graph.json` exists), query it first to find the function/module under test and its dependencies rather than grepping cold.

## Required structure

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { <thingUnderTest> } from "@/lib/<module>";
import { createTestClub, nextWeekdayDateKey } from "./helpers/fixtures";

describe("<thingUnderTest>", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;

  beforeAll(async () => {
    fixture = await createTestClub();
  });

  afterEach(async () => {
    // Delete anything the test itself created (reservations, closures, etc.)
    // scoped to fixture.court.id / fixture.club.id — never a blanket deleteMany.
  });

  afterAll(async () => {
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  it("does the specific thing", async () => {
    // Arrange: create only the extra rows this test needs (via prisma.*.create,
    // scoped to the fixture's club/court/sport).
    // Act: call the real function.
    // Assert: on the actual returned/persisted values, not mocks.
  });
});
```

## Rules

- **No `vi.mock()` of `@/lib/prisma` or any Prisma-backed module.** If the thing under test can't be exercised without mocking Prisma, that's a signal to test at a lower level (a pure function), not to add a mock.
- **Clean up what you create.** Use `afterEach` to delete rows the test itself inserted (reservations, closures, pricing rules added mid-test), and `afterAll` to delete the fixture club (cascades via `onDelete: Cascade` in the schema for most children — check `prisma/schema.prisma` before assuming cascade covers a new model).
- **Dates**: use `nextWeekdayDateKey()` / `nextWeekendDateKey()` from fixtures instead of hardcoding a date, so tests don't become flaky as time passes. Convert wall-clock times with `zonedTimeToUtc(dateKey, "HH:mm", fixture.club.timezone)` from `@/lib/timezone` — never construct UTC dates by hand for club-local times.
- **One behavior per `it()`.** Prefer several small, named tests over one large test asserting many things.
- Run the new test in isolation before handing it back: `corepack pnpm test -- <file>`. It needs a real Postgres reachable at the test `DATABASE_URL` (see `.env.test`).
