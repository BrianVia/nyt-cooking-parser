import * as iso8601 from "iso8601-duration";

export function convertIsoToHumanReadable(iso: string) {
  const parsed = iso8601.parse(iso);
  let humanParts: string[] = [];
  if (parsed.hours) {
    humanParts.push(`${parsed.hours} hour${parsed.hours > 1 ? "s" : ""}`);
  }
  if (parsed.minutes) {
    humanParts.push(`${parsed.minutes} minute${parsed.minutes > 1 ? "s" : ""}`);
  }
  return humanParts.join(" ");
}

console.log(convertIsoToHumanReadable("PT1H25M"));
