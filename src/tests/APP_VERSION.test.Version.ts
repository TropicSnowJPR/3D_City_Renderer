import { test, expect } from "vitest";
import { APP_VERSION } from "../core/Version.js";

test('APP_VERSION is defined and follows semantic versioning', () => {
    expect(APP_VERSION).toBeDefined();
    expect(typeof APP_VERSION).toBe('string');

    const semverRegex = /^\d+\.\d+\.\d+(-\S+)?$/;
    expect(semverRegex.test(APP_VERSION)).toBe(true);
});