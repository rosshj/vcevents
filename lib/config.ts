/**
 * House names and colors are placeholders — change them here and the whole
 * app follows. Colors must be dark enough for white text on top.
 */
export const HOUSE_CONFIG = [
  { id: "aquinas", name: "Aquinas", color: "#B91C1C" },
  { id: "brebeuf", name: "Brebeuf", color: "#1D4ED8" },
  { id: "loyola", name: "Loyola", color: "#047857" },
  { id: "xavier", name: "Xavier", color: "#B45309" },
] as const;

export const APP_NAME = "VC House Points";
export const SCHOOL_NAME = "Vancouver College";

export const GRADES = [7, 8, 9, 10, 11, 12] as const;

/** Light tint of a house color for chips and row accents. */
export function houseTint(color: string, pct = 12) {
  return `color-mix(in srgb, ${color} ${pct}%, white)`;
}
