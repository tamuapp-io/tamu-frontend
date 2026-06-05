import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_WIDTH = 542;
const LOGO_HEIGHT = 210;

type TamuLogoProps = {
  className?: string;
  /** Render height in px; width scales from the wordmark aspect ratio. */
  height?: number;
};

/** Chocolate wordmark — use on light backgrounds. */
export function TamuLogo({ className, height = 22 }: TamuLogoProps) {
  const width = Math.round(height * (LOGO_WIDTH / LOGO_HEIGHT));

  return (
    <Image
      src="/logo.png"
      alt="Tamu"
      width={width}
      height={height}
      className={cn("h-auto w-auto object-contain object-left", className)}
      priority
    />
  );
}

type TamuIconProps = {
  className?: string;
  size?: number;
};

/** Beige-on-chocolate app mark — favicon source; works on light and dark UI. */
export function TamuIcon({ className, size = 28 }: TamuIconProps) {
  return (
    <Image
      src="/icon.png"
      alt="Tamu"
      width={size}
      height={size}
      className={cn("rounded-lg object-cover", className)}
      priority
    />
  );
}
