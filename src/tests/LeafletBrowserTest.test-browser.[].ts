// src/tests/LeafletBrowserTest.test-browser.ts
import { test, expect } from "vitest";

declare global {
  interface Window {
    __mapController?: any;
    __mapController_error?: string;
  }
}

test("MapController initializes map, draws circles, and selecting a circle fetches REUSED_DATA", async () => {
  // Minimal DOM needed by MapController
  document.body.innerHTML = `
    <div id="map" style="width:800px;height:600px"></div>
    <div id="input-overlay" style="display:none"></div>
    <input id="name-input" />
    <button id="button-input"></button>
  `;

  // Stub fetch so MapController receives predictable data
  const originalFetch = (window as any).fetch?.bind(window);
  (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    if (url.includes("/api/object/index/")) {
      return { ok: true, json: async () => ({ objects: { testid: {} } }) } as any;
    }
    if (url.includes("/api/object/testid/geo")) {
      return { ok: true, json: async () => ({ latlng: { lat: 50.0, lng: 10.0 }, radius: 150 }) } as any;
    }
    if (url.includes("/api/object/testid/data")) {
      return { ok: true, json: async () => ({ dummy: "data" }) } as any;
    }
    if (originalFetch) return originalFetch(input as any, init);
    return { ok: false, status: 404, json: async () => ({}) } as any;
  };

  try {
    // Import and start controller (path relative to test file)
    const mod = await import("../controllers/MapController.js");
    // @ts-ignore
    const controller = new mod.MapController();
    (window as any).__mapController = controller;

    // Start it (performs mocked fetch)
    await controller.init();

    // Helper: poll for condition
    const poll = async (fn: () => boolean, timeout = 6000, interval = 100) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          if (fn()) return true;
        } catch {
          // swallow transient errors
        }
        await new Promise((r) => setTimeout(r, interval));
      }
      return false;
    };

    // Wait for the rendered circle (className is the object id: "testid") or a Leaflet interactive path
    const selector = ".testid, svg path.leaflet-interactive";
    const found = await poll(() => !!document.querySelector(selector), 6000);
    expect(found).toBe(true);

    // Simulate click on the circle element (open popup / register key handler)
    const circleEl = document.querySelector(selector) as HTMLElement | null;
    expect(circleEl).not.toBeNull();

    // Dispatch a real DOM click; Leaflet will translate it into a layer click and call onPopUp
    circleEl!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    // Wait briefly to ensure onPopUp registered MAP keypress listener
    await new Promise((r) => setTimeout(r, 200));

    // Now simulate pressing Enter by firing a Leaflet keypress event on the map
    // Access the runtime MAP instance (private in TS but exists at runtime)
    // @ts-ignore
    const mapInstance = (controller as any).MAP;
    expect(mapInstance).toBeDefined();

    // Fire Leaflet 'keypress' with the expected shape: { originalEvent: { key: 'Enter' } }
    // Use try/catch to surface errors that may occur when firing
    try {
      mapInstance.fire("keypress", { originalEvent: { key: "Enter" } });
    } catch (e) {
      // If mapInstance.fire isn't available for any reason, throw so test fails with proper message
      throw new Error("Failed to fire keypress on map instance: " + String(e));
    }

    // Wait for controller to fetch data and remove map (#map removed and mapActive() becomes false)
    const selectionSucceeded = await poll(() => {
      // @ts-ignore
      const inWindow = (window as any).__mapController_error;
      if (inWindow) {
        throw new Error("MapController error: " + inWindow);
      }
      // @ts-ignore
      const ctrl = (window as any).__mapController;
      // If controller no longer active -> selection completed and map destroyed
      return !ctrl || typeof ctrl.mapActive !== "function" ? true : ctrl.mapActive() === false || !document.querySelector("#map");
    }, 6000);

    expect(selectionSucceeded).toBe(true);

    // Verify REUSED_DATA populated with the mocked object
    // @ts-ignore
    const reused = (window as any).__mapController?.REUSED_DATA ?? (controller as any).REUSED_DATA;
    expect(reused).toBeDefined();
    // It should be the JSON object returned by our stub
    expect(reused?.dummy || reused?.dummy === "data" || reused?.dummy === "data" || reused).toBeTruthy();
    // More explicit:
    if (typeof reused === "object" && reused !== null) {
      expect(reused.dummy).toBe("data");
    } else {
      // if stringified, allow JSON parse
      try {
        const parsed = typeof reused === "string" ? JSON.parse(reused) : null;
        if (parsed) expect(parsed.dummy).toBe("data");
      } catch {
        // fallback: fail explicitly so we see the unexpected value
        throw new Error("REUSED_DATA was not the expected object: " + String(reused));
      }
    }
  } finally {
    // restore original fetch
    if (originalFetch) {
      (window as any).fetch = originalFetch;
    } else {
      try { delete (window as any).fetch; } catch {}
    }
  }
});
