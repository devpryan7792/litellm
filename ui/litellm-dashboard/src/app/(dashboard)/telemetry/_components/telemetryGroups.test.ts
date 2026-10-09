import { describe, expect, it } from "vitest";
import type { TelemetryGroup } from "@/app/(dashboard)/hooks/telemetry/useTelemetrySettings";
import { canEnable, depthOf, toggleGroup, type Requires } from "./telemetryGroups";

const REQUIRES: Requires = new Map<TelemetryGroup, TelemetryGroup | null>([
  ["heartbeat", null],
  ["request_success", "heartbeat"],
  ["token_info", "request_success"],
  ["request_taxonomy", "request_success"],
  ["event_details", "request_taxonomy"],
  ["instance_configuration", "heartbeat"],
  ["page_navigation", "heartbeat"],
]);

const ALL = new Set<TelemetryGroup>(REQUIRES.keys());

describe("toggleGroup", () => {
  it("turning heartbeat off turns every other group off", () => {
    expect(toggleGroup("heartbeat", false, ALL, REQUIRES)).toEqual(new Set());
  });

  it("turning a middle group off keeps its parents and siblings and drops its descendants", () => {
    expect(toggleGroup("request_taxonomy", false, ALL, REQUIRES)).toEqual(
      new Set(["heartbeat", "request_success", "token_info", "instance_configuration", "page_navigation"]),
    );
  });

  it("token info and request taxonomy are set independently of each other", () => {
    const success = new Set<TelemetryGroup>(["heartbeat", "request_success"]);
    expect(toggleGroup("request_taxonomy", true, success, REQUIRES)).toEqual(
      new Set(["heartbeat", "request_success", "request_taxonomy"]),
    );
    expect(toggleGroup("token_info", false, ALL, REQUIRES)).toEqual(
      new Set([...ALL].filter((g) => g !== "token_info")),
    );
  });

  it("a group cannot be turned on before the group it needs", () => {
    const heartbeatOnly = new Set<TelemetryGroup>(["heartbeat"]);
    expect(canEnable("token_info", heartbeatOnly, REQUIRES)).toBe(false);
    expect(toggleGroup("token_info", true, heartbeatOnly, REQUIRES)).toBe(heartbeatOnly);
    expect(toggleGroup("request_success", true, heartbeatOnly, REQUIRES)).toEqual(
      new Set(["heartbeat", "request_success"]),
    );
  });
});

describe("depthOf", () => {
  it("counts the groups above each one so siblings share an indent", () => {
    expect(
      (["heartbeat", "request_success", "token_info", "request_taxonomy", "event_details"] as const).map((g) =>
        depthOf(g, REQUIRES),
      ),
    ).toEqual([0, 1, 2, 2, 3]);
  });
});
