import { describe, expect, it } from "vitest";

import {
  buildAgentActivityTimeline,
  buildRegistrationStatusTimeline,
} from "./registration-status-timeline";

const createdAt = "2026-10-05T14:36:09.181Z";
const updatedAt = "2026-10-05T14:37:25.940Z";

describe("buildRegistrationStatusTimeline", () => {
  it("marks registration confirmed with all steps complete", () => {
    const { phase, steps } = buildRegistrationStatusTimeline({
      registrationState: "RegistrationConfirmed",
      createdAt,
      updatedAt,
    });
    expect(phase).toBe("registration");
    expect(steps.map((s) => s.state)).toEqual([
      "RegistrationRequested",
      "RegistrationConfirmed",
    ]);
    expect(steps.map((s) => s.status)).toEqual(["complete", "complete"]);
    expect(steps[0]?.occurredAt).toBe(createdAt);
    expect(steps[1]?.occurredAt).toBe(updatedAt);
  });

  it("shows in-progress registration at requested", () => {
    const { steps } = buildRegistrationStatusTimeline({
      registrationState: "RegistrationRequested",
      createdAt,
      updatedAt,
    });
    expect(steps.map((s) => s.status)).toEqual(["current", "upcoming"]);
    expect(steps[0]?.occurredAt).toBe(updatedAt);
  });

  it("maps RegistrationInitiated to confirmed step in progress", () => {
    const initiatedAt = "2026-10-05T14:37:00.000Z";
    const { steps } = buildRegistrationStatusTimeline({
      registrationState: "RegistrationInitiated",
      createdAt,
      updatedAt,
      registrationInitiatedAt: initiatedAt,
    });
    expect(steps.map((s) => s.state)).toEqual([
      "RegistrationRequested",
      "RegistrationConfirmed",
    ]);
    expect(steps.map((s) => s.status)).toEqual(["complete", "current"]);
    expect(steps[0]?.occurredAt).toBe(createdAt);
    expect(steps[1]?.occurredAt).toBe(initiatedAt);
  });

  it("shows failed registration at requested step", () => {
    const { steps } = buildRegistrationStatusTimeline({
      registrationState: "RegistrationFailed",
      createdAt,
      updatedAt,
    });
    expect(steps.map((s) => s.status)).toEqual(["failed", "upcoming"]);
  });

  it("appends deregistration steps after completed registration changelog", () => {
    const { steps } = buildAgentActivityTimeline({
      registrationState: "DeregistrationRequested",
      createdAt,
      updatedAt,
    });
    expect(steps.map((s) => s.state)).toEqual([
      "RegistrationRequested",
      "RegistrationConfirmed",
      "DeregistrationRequested",
      "DeregistrationConfirmed",
    ]);
    expect(steps.slice(0, 2).every((s) => s.status === "complete")).toBe(true);
    expect(steps[2]?.status).toBe("current");
  });

  it("uses update flow when metadata update is in flight", () => {
    const { phase, steps } = buildRegistrationStatusTimeline({
      registrationState: "UpdateRequested",
      createdAt,
      updatedAt,
    });
    expect(phase).toBe("update");
    expect(steps.map((s) => s.state)).toEqual([
      "UpdateRequested",
      "UpdateConfirmed",
    ]);
    expect(steps[0]?.status).toBe("current");
  });
});
