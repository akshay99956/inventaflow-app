import { describe, expect, test } from "bun:test";
import { shouldShowBrowserWarning } from "./browserCompatibility";

const check = (name, supported, essential = true) => ({ name, supported, essential, description: "" });
describe("browser warning rules", () => {
  test("unsupported essential features show a warning", () => {
    expect(shouldShowBrowserWarning([check("Local storage", false)], null)).toBe(true);
  });
  test("unsupported optional features also show a warning", () => {
    expect(shouldShowBrowserWarning([check("Quick sharing", false, false)], null)).toBe(true);
  });
  test("all supported features show no warning", () => {
    expect(shouldShowBrowserWarning([check("Local storage", true)], null)).toBe(false);
  });
  test("dismissal hides the same unsupported features", () => {
    expect(shouldShowBrowserWarning([check("Local storage", false)], "Local storage")).toBe(false);
  });
  test("a different unsupported feature is not hidden by an earlier dismissal", () => {
    expect(shouldShowBrowserWarning([check("Quick sharing", false, false)], "Local storage")).toBe(true);
  });
});