import {
  DM_Sans,
  Fraunces,
  IBM_Plex_Sans,
  Instrument_Serif,
  Karla,
  Space_Grotesk,
} from "next/font/google";

/**
 * Typefaces for the booking-page themes.
 *
 * All six are declared here because next/font only accepts literal, top-level
 * calls — a theme cannot ask for its own pair at render time. `preload: false`
 * is what keeps that from costing anything: the @font-face rules ship, but a
 * browser fetches a font file only once a rendered element actually uses one,
 * so a venue on Sesi downloads Instrument Serif and DM Sans and none of the
 * other four.
 *
 * Each theme's token block in app/booking-themes.css names these variables.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
});
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const FONT_VARIABLES = [
  fraunces.variable,
  karla.variable,
  spaceGrotesk.variable,
  plexSans.variable,
  instrumentSerif.variable,
  dmSans.variable,
].join(" ");

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={FONT_VARIABLES}>{children}</div>;
}
