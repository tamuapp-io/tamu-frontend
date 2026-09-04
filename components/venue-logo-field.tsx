"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VenueMark } from "@/components/venue-mark";
import { ImageCropperDialog } from "@/components/image-cropper-dialog";
import { toast } from "@/components/ui/toaster";
import { uploadBrandingImage } from "@/lib/api/settings";
import { ApiError } from "@/lib/api/client";

/** Mirrors the server's own rule (mimes:jpeg,jpg,png,webp,gif, max:5120). */
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Upload control for the venue logo.
 *
 * The preview renders through the same {@link VenueMark} the guest pages use,
 * so what an owner sees here is literally what a guest gets — including the
 * text fallback when no logo is set. That is the whole point: the fallback is a
 * designed state, not an empty box, and an owner should be able to see it.
 */
export function VenueLogoField({
  value,
  venueName,
  onChange,
}: {
  value: string;
  venueName: string;
  onChange: (url: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState<File | null>(null);

  /** Picked from disk — crop before anything is sent. */
  function pick(file: File) {
    // Checked here as well as on the server so the owner gets an instant,
    // specific answer instead of a 422 after a needless upload.
    if (file.size > MAX_BYTES) {
      toast.error("That image is too large", "Logos must be 5 MB or smaller.");
      return;
    }
    setCropping(file);
  }

  async function upload(blob: Blob) {
    setCropping(null);
    setUploading(true);
    try {
      const res = await uploadBrandingImage(
        new File([blob], "logo.png", { type: "image/png" }),
      );
      onChange(res.data.url);
      toast.success("Logo uploaded", "Save to publish it on your booking page.");
    } catch (err) {
      toast.error(
        "Upload failed",
        err instanceof ApiError ? err.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="rs-logo-upload">Logo</Label>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background p-1.5">
          <VenueMark
            name={venueName}
            logoUrl={value}
            logoClassName="max-h-full max-w-full object-contain"
            fallback={
              <span className="px-1 text-center text-sm font-semibold leading-tight tracking-tight">
                {venueName || "Your venue"}
              </span>
            }
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              id="rs-logo-upload"
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pick(file);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                disabled={uploading}
                onClick={() => onChange("")}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {value
              ? "Shown on your booking page through to payment."
              : "Without a logo, guests see your venue name as text."}{" "}
            You&apos;ll crop it to a square. PNG, JPEG, WebP or GIF, up to 5 MB.
          </p>
        </div>
      </div>

      <ImageCropperDialog
        file={cropping}
        open={cropping !== null}
        onCancel={() => setCropping(null)}
        onCropped={(blob) => void upload(blob)}
      />
    </div>
  );
}
