"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const FULL = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * A timestamp in the viewer's own time zone and locale. The server renders UTC
 * until the browser takes over.
 */
export function LocalTime({ date }: { date: Date | string }) {
  const value = typeof date === "string" ? new Date(date) : date;
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const iso = value.toISOString();
  return (
    <time dateTime={iso} title={iso}>
      {isClient
        ? FULL.format(value)
        : `${iso.replace("T", " ").slice(0, 16)} UTC`}
    </time>
  );
}
