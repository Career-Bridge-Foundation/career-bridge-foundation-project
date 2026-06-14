const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** True for #RGB or #RRGGBB. Shared by the branding route (server) and form (client). */
export function isValidHexColor(s: string): boolean {
  return HEX.test(s)
}
