"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Rendered size of the square crop frame, in CSS pixels. */
const FRAME = 260;
/** Edge of the exported square. Generous enough for retina without being huge. */
const OUTPUT = 512;
const MAX_ZOOM = 4;

type Loaded = { img: HTMLImageElement; url: string; file: File };

/**
 * Square (1:1) image cropper.
 *
 * Zoom starts at "contain", not "cover", so the entire image is visible the
 * moment the dialog opens. That matters for logos: most are wide wordmarks, and
 * a cropper that opens zoomed-to-fill would silently chop the ends off the
 * venue's name. Zooming out to letterbox with transparent padding is a
 * legitimate outcome here, not a degenerate one.
 */
export function ImageCropperDialog({
  file,
  open,
  onCancel,
  onCropped,
  title = "Crop your logo",
  description = "Drag to reposition, zoom to fit. The area inside the square is what guests will see.",
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  title?: string;
  description?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Decode the picked file once per file, and hand back the object URL when
  // we're done with it so a long settings session doesn't leak blobs.
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      setLoaded({ img, url, file });
      setZoom(1);
      // Centre the image in the frame at contain scale.
      const s = Math.min(FRAME / img.naturalWidth, FRAME / img.naturalHeight);
      setOffset({
        x: (FRAME - img.naturalWidth * s) / 2,
        y: (FRAME - img.naturalHeight * s) / 2,
      });
    };
    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Derived, not reset in an effect: a decoded image belongs to the file it came
  // from, so a newly picked file simply has nothing loaded yet.
  const loadedFile = loaded?.file === file ? loaded : null;

  const containScale = loadedFile
    ? Math.min(FRAME / loadedFile.img.naturalWidth, FRAME / loadedFile.img.naturalHeight)
    : 1;
  const scale = containScale * zoom;
  const drawnW = loadedFile ? loadedFile.img.naturalWidth * scale : 0;
  const drawnH = loadedFile ? loadedFile.img.naturalHeight * scale : 0;

  /**
   * Keep the image sensibly placed: when an axis is larger than the frame it
   * must cover it (no transparent gap you didn't ask for); when it's smaller it
   * stays inside. Without this you can drag the logo clean off the canvas.
   */
  const clamp = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const axis = (v: number, drawn: number) =>
        drawn >= FRAME
          ? Math.min(0, Math.max(FRAME - drawn, v))
          : Math.min(FRAME - drawn, Math.max(0, v));
      return { x: axis(x, w), y: axis(y, h) };
    },
    [],
  );

  function applyZoom(next: number) {
    if (!loadedFile) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    const s = containScale * z;
    const w = loadedFile.img.naturalWidth * s;
    const h = loadedFile.img.naturalHeight * s;

    // Zoom about the frame's centre so the subject doesn't drift away.
    const cx = FRAME / 2;
    const cy = FRAME / 2;
    const ratio = s / scale;
    setOffset(clamp(cx - (cx - offset.x) * ratio, cy - (cy - offset.y) * ratio, w, h));
    setZoom(z);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!loadedFile) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !loadedFile) return;
    setOffset(
      clamp(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py), drawnW, drawnH),
    );
  }

  function endDrag() {
    drag.current = null;
  }

  async function confirm() {
    if (!loadedFile) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The frame is FRAME css px; the export is OUTPUT px. Same geometry, scaled.
    const k = OUTPUT / FRAME;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      loadedFile.img,
      offset.x * k,
      offset.y * k,
      drawnW * k,
      drawnH * k,
    );

    // PNG, so a logo with a transparent background stays transparent instead of
    // gaining a black box.
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (blob) onCropped(blob);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-lg border border-border active:cursor-grabbing"
            style={{
              width: FRAME,
              height: FRAME,
              // A checkerboard reads as "transparent" rather than "white", so a
              // logo with an alpha channel isn't mistaken for a broken crop.
              backgroundImage:
                "linear-gradient(45deg,var(--muted) 25%,transparent 25%),linear-gradient(-45deg,var(--muted) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--muted) 75%),linear-gradient(-45deg,transparent 75%,var(--muted) 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {loadedFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loadedFile.url}
                alt=""
                aria-hidden
                draggable={false}
                className="pointer-events-none absolute select-none"
                style={{
                  left: offset.x,
                  top: offset.y,
                  width: drawnW,
                  height: drawnH,
                  maxWidth: "none",
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom out"
              onClick={() => applyZoom(zoom - 0.25)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Zoom in"
              onClick={() => applyZoom(zoom + 0.25)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!loadedFile} onClick={() => void confirm()}>
            Use this crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
