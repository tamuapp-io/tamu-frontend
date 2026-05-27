"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOM_DIAL_CODE_VALUE,
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  dialCodeForTimezone,
  dialCodeFromBrowser,
  isPresetDialCode,
  joinE164,
  sanitizeNationalNumber,
  splitE164,
} from "@/lib/dial-codes";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  /** Canonical E.164 value (e.g. "+628123456789") or empty string. */
  value: string;
  /** Emits canonical E.164 ("+628123456789") or empty string when cleared. */
  onChange: (e164: string) => void;
  /** Tenant venue timezone — drives the default dial code suggestion. */
  tenantTimezone?: string | null;
  /** Forwarded to the national-number `<input>` for label association. */
  id?: string;
  /** Forwarded to the national-number `<input>` placeholder. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  /** Forwarded to the national-number `<input>` for HTML5 form behavior. */
  name?: string;
  /** Visually red-highlight the trigger + input. */
  className?: string;
}

/**
 * Two-part phone field: dial-code Select + national number Input.
 *
 *  - `value` is the canonical E.164 string ("+62…") used in API payloads.
 *  - The dial code defaults to the tenant venue's country (heuristic from
 *    its IANA timezone), then the visitor's browser timezone, finally "+62".
 *  - Users can pick "Other…" and type a custom dial code if their country
 *    isn't in the curated list.
 */
export function PhoneInput({
  value,
  onChange,
  tenantTimezone,
  id,
  placeholder = "812 3456 7890",
  disabled,
  invalid,
  required,
  name,
  className,
}: PhoneInputProps) {
  const reactId = useId();
  const inputId = id ?? `phone-${reactId}`;

  const initialFromValue = useMemo(() => splitE164(value), []); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedDial = useMemo(() => {
    if (initialFromValue.dial) return initialFromValue.dial;
    if (tenantTimezone) return dialCodeForTimezone(tenantTimezone);
    return dialCodeFromBrowser() || DEFAULT_DIAL_CODE.code;
  }, [initialFromValue.dial, tenantTimezone]);

  const [dial, setDial] = useState<string>(suggestedDial);
  const [national, setNational] = useState<string>(initialFromValue.national);
  const [customMode, setCustomMode] = useState<boolean>(
    suggestedDial !== "" && !isPresetDialCode(suggestedDial),
  );

  // Sync from controlled `value` changes (e.g. parent reset).
  useEffect(() => {
    const composed = joinE164(dial, national);
    if (value === composed) return;
    const next = splitE164(value);
    if (next.dial) {
      setDial(next.dial);
      setCustomMode(!isPresetDialCode(next.dial));
    }
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(nextDial: string, nextNational: string) {
    onChange(joinE164(nextDial, nextNational));
  }

  const selectValue = customMode ? CUSTOM_DIAL_CODE_VALUE : dial;

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === CUSTOM_DIAL_CODE_VALUE) {
            setCustomMode(true);
            return;
          }
          setCustomMode(false);
          setDial(next);
          emit(next, national);
        }}
      >
        <SelectTrigger
          aria-label="Country dial code"
          className={cn(
            "w-30 shrink-0",
            invalid && "border-destructive ring-destructive",
          )}
        >
          <SelectValue>
            {customMode
              ? `+${dial || "?"}`
              : (() => {
                  const opt = DIAL_CODES.find((d) => d.code === dial);
                  return opt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{opt.flag}</span>
                      <span>+{opt.code}</span>
                    </span>
                  ) : (
                    `+${dial}`
                  );
                })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {DIAL_CODES.map((opt) => (
            <SelectItem key={opt.iso2} value={opt.code}>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden>{opt.flag}</span>
                <span className="font-medium">+{opt.code}</span>
                <span className="text-muted-foreground">{opt.name}</span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_DIAL_CODE_VALUE}>
            Other (type custom code)…
          </SelectItem>
        </SelectContent>
      </Select>

      {customMode ? (
        <Input
          aria-label="Custom dial code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={dial}
          disabled={disabled}
          invalid={invalid}
          placeholder="62"
          onChange={(e) => {
            const next = e.target.value.replace(/\D+/g, "").slice(0, 4);
            setDial(next);
            emit(next, national);
          }}
          className="w-16"
        />
      ) : null}

      <Input
        id={inputId}
        name={name}
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        required={required}
        value={national}
        onChange={(e) => {
          const next = sanitizeNationalNumber(e.target.value);
          setNational(next);
          emit(dial, next);
        }}
        className="flex-1"
      />
    </div>
  );
}
