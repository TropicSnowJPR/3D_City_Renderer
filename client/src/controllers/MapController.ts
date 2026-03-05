import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { ConfigService } from "../services/ConfigService.js";
import type { LayerGroup } from "leaflet";

export class MapController {
  REUSED_DATA: string;
  private CCONFIG: ConfigService;
  GEOJSON: { radius: number; latlng: any };
  private MAP: L.Map | undefined | null;
  private MARKER_OVERLAY: LayerGroup<any>;
  private REMOVE_LOCK: boolean;
  private DEFAULT_MAP_LAT: number;
  private DEFAULT_MAP_LNG: number;
  private DEFAULT_MAP_ZOOM: number;
  constructor() {
    this.CCONFIG = new ConfigService();
    this.GEOJSON = { latlng: null, radius: 0 };
    this.MAP = L.map("map");
    this.REUSED_DATA = "";
    this.MARKER_OVERLAY = null;
    this.REMOVE_LOCK = false;

    this.DEFAULT_MAP_LAT = 50.978_719_713_351_71
    this.DEFAULT_MAP_LNG = 11.030_949_354_171_755
    this.DEFAULT_MAP_ZOOM = 18;
  }

  async onStart() {
    this.MAP.setView([this.DEFAULT_MAP_LAT, this.DEFAULT_MAP_LNG], this.DEFAULT_MAP_ZOOM);

    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}",
      {

        attribution:
          '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: "png",
        maxZoom: 19,
      },
    ).addTo(this.MAP);

    if (this.MAP.pm) {
      this.MAP.pm.addControls({
        cutPolygon: false,
        dragMode: false,
        drawCircle: true,
        drawCircleMarker: false,
        drawFreehand: false,
        drawMarker: false,
        drawPolygon: false,
        drawPolyline: false,
        drawRectangle: false,
        drawText: false,
        editMode: false,
        position: "topleft",
        removalMode: true,
        rotateMode: false,
      });

      const response = await fetch("http://localhost:3000/api/object/index/");
      const objectJson = await response.json();

      for (const [id] of Object.entries(objectJson.objects)) {
        const res = await fetch(
          `http://localhost:3000/api/object/${id}/geo`,
        );
        const data = await res.json();
        const circle = L.circle([data.latlng.lat, data.latlng.lng], {
          color: "#FFA31B",
          fillColor: "#FAA31B",
          fillOpacity: 0.3,
          id: id,
          radius: data.radius,
        }).addTo(this.MAP);
        circle
          .bindPopup(`Press ENTER to select [${id}] or Press R to rename.`)
          .on("click",(event: any) => {
            console.log(event);
            this.onPopUp(event, id);
          });
      }

      const response_points = await fetch(
        "http://localhost:3000/api/point/index/",
      );
      const pointJson = await response_points.json();

      const MarkerOverlay = [];

      for (const [id] of Object.entries(pointJson.objects)) {
        const res = await fetch(
          "http://localhost:3000/api/point/" + id + "/geo",
        );
        const data = await res.json();
        const marker = L.marker([data.lat, data.lng], { id: id }).addTo(
          this.MAP,
        );
        marker.bindPopup(data.name);
        MarkerOverlay.push(marker);
      }
      this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
      this.MAP.addLayer(this.MARKER_OVERLAY);

      this.MAP.on("popupclose", () => {
        this.MAP.off("keypress");
      });

      this.MAP.on("pm:remove", async (event: any) => {
        this.REMOVE_LOCK = true;
        if (event.shape === "Circle") {
          await fetch(
            "http://localhost:3000/api/object/" +
              event.layer.options.id +
              "/delete",
          );
          this.MAP.removeLayer(event.target);
        } else if (event.shape === "Marker") {
          await fetch(
            "http://localhost:3000/api/point/" +
              event.layer.options.id +
              "/delete",
          );
        }
        this.REMOVE_LOCK = false;
      });

      this.MAP.on("pm:create", async (event: any) => {
        const data = event.layer;
        if (data._mRadius && data._latlng) {
          this.GEOJSON = {
            latlng: data._latlng,
            radius: data._mRadius.toFixed(2),
          };
        }

        if (event.shape === "Circle") {
          this.CCONFIG.setConfigValue("radius", data._mRadius.toFixed(2));
          this.CCONFIG.setConfigValue("latitude", data._latlng.lat);
          this.CCONFIG.setConfigValue("longitude", data._latlng.lng);

          const el = document.querySelector("#map");
          if (el) {
            el.remove();
          }
          this.MAP = undefined;
        } else if (event.shape === "Text") {
          try {
            this.MAP.once("click", async (event_2: any) => {
              const geoJson = {
                lat: event_2.latlng.lat,
                lng: event_2.latlng.lng,
                name: event.layer.options.text,
                type: "Point",
              };
              fetch("http://localhost:3000/api/point/", {
                body: JSON.stringify({
                  GEOJSON: geoJson,
                  type: "Point",
                }),
                headers: {
                  "Content-Type": "application/json",
                },
                method: "POST",
              }).then((res) => res.json());

              await this.sleep(500);
              const response_points = await fetch(
                "http://localhost:3000/api/point/index/",
              );
              const pointJson = await response_points.json();

              this.MAP.removeLayer(event.layer);
              this.MAP.removeLayer(this.MARKER_OVERLAY);
              const MarkerOverlay = [];

              for (const [id] of Object.entries(pointJson.objects)) {
                const res = await fetch(
                  "http://localhost:3000/api/point/" + id + "/geo",
                );
                const data = await res.json();
                const marker = L.marker([data.lat, data.lng], { id: id }).addTo(
                  this.MAP,
                );
                marker.bindPopup(data.name);
                MarkerOverlay.push(marker);
              }
              this.MARKER_OVERLAY = L.layerGroup(MarkerOverlay);
              this.MAP.addLayer(this.MARKER_OVERLAY);
            });
          } catch (error) {
            console.warn(error);
          }
        }
      });
    }

    this.MAP.on("contextmenu", this.contextMenuDisabled);
  }

  contextMenuDisabled(e: L.LeafletMouseEvent) {
    e.originalEvent.preventDefault();
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private haversine(a: number[], b: number[]) {
    if (a.length !== 2 || b.length !== 2) {
      throw new Error("Invalid input: expected two coordinate pairs");
    }
    if (
      a[0] === undefined ||
      a[1] === undefined ||
      b[0] === undefined ||
      b[1] === undefined
    ) {
      throw new Error("Invalid input: coordinates must be defined");
    }
    const R = 6_371_000; // Meters
    const toRad = (d: number) => (d * Math.PI) / 180;

    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);

    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  onPopUp(event: any, id: any) {
    if (id === undefined) {
      // oxlint-disable-next-line no-unused-expressions
      event.target.o;
    }
    this.MAP.on("keypress", async (e: any) => {
      if (e.originalEvent.key === "Enter") {
        const data = event.target;
        this.GEOJSON = {
          latlng: data._latlng,
          radius: data._mRadius,
        };

        this.CCONFIG.setConfigValue("radius", data._mRadius);
        this.CCONFIG.setConfigValue("latitude", data._latlng.lat);
        this.CCONFIG.setConfigValue("longitude", data._latlng.lng);

        this.REUSED_DATA = await fetch(
          "http://localhost:3000/api/object/" + id + "/data",
        ).then((res) => res.json());

        const el = document.querySelector("#map");
        if (el) {
          el.remove();
        }

        this.MAP = null;
      } else if (e.originalEvent.key === "r") {
        const overlay = document.querySelector("#input-overlay");
        const input = document.querySelector("#name-input");
        const button = document.querySelector("#button-input");

        if (!input || !button || !overlay) {
          console.warn("Input elements not found");
          return;
        }
        if (overlay) {
          overlay.style.display = "block";
        }
        if (input) {
          // @ts-expect-error
          input.value = "";
          input.focus();
        }

        // @ts-expect-error
        if (button._renameHandler)
          {button.removeEventListener("click", button._renameHandler);}
        // @ts-expect-error
        if (input._keyHandler)
          {input.removeEventListener("keydown", input._keyHandler);}

        const renameHandler = async () => {
          // @ts-expect-error
          const newId = input.value.trim();
          if (!newId) {return;}
          const circle = event.target;
          console.log(circle.options.id);
          const {id} = circle.options;

          try {
            const res = await fetch(
              `http://localhost:3000/api/object/${encodeURIComponent(id)}/rename?newid=${encodeURIComponent(newId)}`,
              {
                method: "POST",
              },
            );
            if (!res.ok) {
              console.log(res.ok);
              console.log(res);
              overlay.style.display = "none";
              const errText = await res.text();
              console.warn("Rename failed:", res.status, errText);
              return;
            }
          } catch (error) {
            console.warn(error);
            return;
          }

          // Update client-side circle metadata and popup
          circle.options.id = newId;
          circle
            .bindPopup(
              "Press ENTER to select [" + newId + "] or Press R to rename.",
            )
            .on("click", (event: any) => {
              this.onPopUp(event, newId);
            });

          overlay.style.display = "none";
        };

        // @ts-expect-error
        button._renameHandler = renameHandler;
        button.addEventListener("click", renameHandler);

        const keyHandler = (ke: { key: string }) => {
          if (ke.key === "Enter") {renameHandler();}
          if (ke.key === "Escape") {overlay.style.display = "none";}
        };

        // @ts-expect-error
        input._keyHandler = keyHandler;
        input.addEventListener("keydown", keyHandler);
      }
    });
  }

  mapActive(): boolean {
    /*
    * Returns true if the map is active (i.e., not removed after selection), false otherwise
    * */
    return this.MAP !== null;
  }

  getGeoJSON(): { radius: number; latlng: any } {
    return this.GEOJSON;
  }
}
