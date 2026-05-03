"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOM_TIMEZONE_SELECT_VALUE,
  VENUE_TIMEZONE_GROUPS,
  getBrowserSuggestedTimezone,
  isPresetVenueTimezone,
} from "@/lib/venue-timezones";
import { cn } from "@/lib/utils";

type VenueTimezonePickerProps = {
  value: string;
  onChange: (iana: string) => void;
  disabled?: boolean;
  /** e.g. id="rs-tz" */
  triggerId?: string;
  className?: string;
  showSuggestFromBrowser?: boolean;
};

export function VenueTimezonePicker({
  value,
  onChange,
  disabled,
  triggerId,
  className,
  showSuggestFromBrowser,
}: VenueTimezonePickerProps) {
  const trimmed = value.trim();
  const detected = useMemo(() => getBrowserSuggestedTimezone(), []);

  const useCustomBranch = trimmed === "" || !isPresetVenueTimezone(trimmed);
  const selectValue = useCustomBranch ? CUSTOM_TIMEZONE_SELECT_VALUE : trimmed;

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(v) => {
          if (v !== CUSTOM_TIMEZONE_SELECT_VALUE) {
            onChange(v);
            return;
          }
          if (trimmed === "" || isPresetVenueTimezone(trimmed)) {
            onChange(detected ?? "Asia/Jakarta");
          }
        }}
      >
        <SelectTrigger id={triggerId} className="h-10">
          <SelectValue placeholder="Choose a common timezone" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {VENUE_TIMEZONE_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.zones.map((z) => (
                <SelectItem key={z.value} value={z.value} className="whitespace-normal">
                  {z.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM_TIMEZONE_SELECT_VALUE} className="whitespace-normal">
            Custom (type any IANA zone)…
          </SelectItem>
        </SelectContent>
      </Select>

      {useCustomBranch && (
        <div className="space-y-1.5">
          <Input
            aria-label="Custom IANA timezone"
            placeholder="e.g. Asia/Makassar or Europe/Zurich"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="text-[11px] text-muted-foreground">
            Use an{" "}
            <a
              className="font-medium underline-offset-4 hover:underline"
              href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
              target="_blank"
              rel="noreferrer"
            >
              IANA timezone
            </a>{" "}
            ID (exact spelling).
          </p>
          {showSuggestFromBrowser ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={disabled || !detected}
              onClick={() => detected && onChange(detected)}
            >
              Use this device&apos;s timezone{detected ? ` (${detected})` : ""}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
