"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlTab } from "@/hooks/useUrlTab";
import {
  type TelemetryGroup,
  type TelemetrySettings,
  useTelemetrySettings,
  useUpdateTelemetrySettings,
} from "@/app/(dashboard)/hooks/telemetry/useTelemetrySettings";
import { GROUP_COPY, PROXY_GROUPS, UI_GROUPS, canEnable, depthOf, toggleGroup, type Requires } from "./telemetryGroups";

const TABS = ["proxy", "ui"] as const;

const destinationText = (settings: TelemetrySettings): string => {
  const every = `every ${settings.flush_interval_seconds} s`;
  switch (settings.destination) {
    case "https":
      return `One JSON report per worker ${every} and on shutdown, by HTTPS POST to LITELLM_TELEMETRY_ENDPOINT. A failed send is retried next window`;
    case "local_table":
      return `One report per worker ${every} and on shutdown, stored in this proxy's LiteLLM_TelemetryReport table for ${settings.retention_days} days. Nothing leaves the proxy. Admins can export from GET /telemetry/reports`;
    case "none":
      return "No database and no LITELLM_TELEMETRY_ENDPOINT, so nothing is collected";
  }
};

function GroupList({ groups, settings }: { groups: readonly TelemetryGroup[]; settings: TelemetrySettings }) {
  const update = useUpdateTelemetrySettings();
  const requires: Requires = new Map(settings.groups.map((info) => [info.group, info.requires ?? null]));
  const enabled = new Set(settings.groups.filter((info) => info.enabled).map((info) => info.group));
  const [error, setError] = useState<string | null>(null);
  const onToggle = (group: TelemetryGroup, on: boolean) => {
    setError(null);
    update.mutate([...toggleGroup(group, on, enabled, requires)], { onError: (e) => setError(e.message) });
  };
  return (
    <ul className="divide-y rounded-md border">
      {groups.map((group) => {
        const copy = GROUP_COPY[group];
        const parent = requires.get(group) ?? null;
        const available = canEnable(group, enabled, requires);
        const locked = !settings.editable || update.isPending;
        const blocked = !available && !enabled.has(group);
        const depth = depthOf(group, requires) - (groups.includes("heartbeat") ? 0 : 1);
        return (
          <li
            key={group}
            data-depth={depth}
            className="flex items-start gap-3 py-2 pr-3"
            style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}
          >
            <Switch
              size="sm"
              aria-label={copy.title}
              checked={enabled.has(group)}
              disabled={locked || blocked}
              onCheckedChange={(on) => onToggle(group, on)}
            />
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div className="text-sm font-medium text-foreground">
                {copy.title}
                {parent !== null && !available && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    needs {GROUP_COPY[parent].title}
                  </span>
                )}
              </div>
              {copy.slices !== undefined && <p>Slices by: {copy.slices}</p>}
              <p>
                {copy.slices !== undefined ? "Counts" : "Sends"}: {copy.counts}
              </p>
              <p>Helps catch: {copy.helps}</p>
            </div>
          </li>
        );
      })}
      {error !== null && <li className="p-3 text-xs text-destructive">{error}</li>}
    </ul>
  );
}

function ReportPreview({ settings }: { settings: TelemetrySettings }) {
  return (
    <section className="space-y-1">
      <h3 className="font-medium">
        {settings.report_is_sample ? "Sample report" : "Last report sent from this worker"}
      </h3>
      <p className="text-xs text-muted-foreground">
        {settings.report_is_sample
          ? "Made-up traffic through the real filter, with the groups that are on (all groups while telemetry is off)"
          : "Exactly what this worker last sent or stored"}
      </p>
      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(settings.report, null, 2)}
      </pre>
    </section>
  );
}

export default function TelemetrySettingsPage() {
  const [tab, setTab] = useUrlTab(TABS, "proxy");
  const { data: settings, isLoading, error } = useTelemetrySettings();
  if (isLoading) return <div className="p-6">Loading telemetry settings...</div>;
  if (settings === undefined)
    return <div className="p-6 text-destructive">Could not load telemetry settings: {error?.message}</div>;
  return (
    <div className="max-w-3xl space-y-5 p-6 text-sm">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Telemetry</h1>
        <p className="text-xs text-muted-foreground">
          Off by default. Each switch adds aggregated counts, never prompts, responses, keys, ids or header values.
          LITELLM_TELEMETRY_DISABLED=true turns everything off
        </p>
      </header>
      <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof TABS)[number])}>
        <TabsList variant="line">
          <TabsTrigger value="proxy">Proxy requests</TabsTrigger>
          <TabsTrigger value="ui">Admin UI</TabsTrigger>
        </TabsList>
        <TabsContent value="proxy" className="space-y-4 pt-4">
          <GroupList groups={PROXY_GROUPS} settings={settings} />
        </TabsContent>
        <TabsContent value="ui" className="space-y-4 pt-4">
          <GroupList groups={UI_GROUPS} settings={settings} />
          <p className="text-xs text-muted-foreground">
            Sent only while Page navigation is on, to this proxy at POST /telemetry/ui_events, and counted into the same
            report as proxy traffic
          </p>
        </TabsContent>
      </Tabs>
      <section className="space-y-1">
        <h3 className="font-medium">How and when it is sent</h3>
        <p className="text-xs text-muted-foreground">{destinationText(settings)}. Changes apply from the next window</p>
      </section>
      <ReportPreview settings={settings} />
    </div>
  );
}
