// Brand colour constants for contexts that can't consume CSS custom
// properties — edge-rendered OG images, server-rendered emails. Must be kept
// in sync by hand with the @theme tokens (--color-navy/--color-teal) in
// app/globals.css. App UI should use the Tailwind classes (text-navy,
// bg-teal, etc.) bound to those tokens instead of importing these directly,
// so it re-themes correctly under partner branding.
export const TEAL = "#0d9488";
export const NAVY = "#18284e";
export const BORDER = "#D5DCE8";
export const LIGHT_GREY = "#F3F3F3";
export const LINK_BLUE = "#006FAD";
export const URL_CHIP = "#EBF4FB";
