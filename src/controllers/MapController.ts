import { ConfigService } from "../services/ConfigService.js";
import * as L from "leaflet";
import type { LeafletKeyboardEvent, LeafletMouseEvent} from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";

export class MapController {
  REUSED_DATA: string;
  private CCONFIG: ConfigService;
  private GEOJSON: { radius: number; latlng: { lat: number, lng: number, alt?: number | undefined } };
  private MAP: L.Map | undefined;
  private readonly DEFAULT_MAP_LAT: number;
  private readonly DEFAULT_MAP_LNG: number;
  private readonly DEFAULT_MAP_ZOOM: number;
  constructor() {
    this.CCONFIG = new ConfigService();
    this.GEOJSON = { latlng: { lat: 0, lng: 0 }, radius: 0 };
    this.MAP = L.map("map");
    this.REUSED_DATA = "";
    this.DEFAULT_MAP_LAT = 50.978_719_713_351_71;
    this.DEFAULT_MAP_LNG = 11.030_949_354_171_755;
    this.DEFAULT_MAP_ZOOM = 18;
  }


  /**
   *
   */
  async onStart(): Promise<void> {
    if (!this.MAP) {
      return;
    }
    this.MAP.setView([this.DEFAULT_MAP_LAT, this.DEFAULT_MAP_LNG], this.DEFAULT_MAP_ZOOM);


    L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}", {
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      // oxlint-disable-next-line typescript/ban-ts-comment
      // @ts-expect-error
      ext: "png",
      maxZoom: 19,
    }).addTo(this.MAP);

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

      const response = await fetch("/api/object/index/");
      const objectJson = await response.json();

      for (const [id] of Object.entries(objectJson.objects)) {
        const res = await fetch(`/api/object/${id}/geo`);
        const data = await res.json();
        const circle = L.circle([data.latlng.lat, data.latlng.lng], {
          className: id,
          color: "#FFA31B",
          fillColor: "#FAA31B",
          fillOpacity: 0.3,
          radius: data.radius
        }).addTo(this.MAP);
        circle
          .bindPopup(`Press ENTER to select [${id}] or Press R to rename.`)
          .on("click", (event: L.LeafletMouseEvent) => {
            this.onPopUp(event, id);
          });
      }

      this.MAP.on(
        "popupclose",
        () => {
          if (!this.MAP) {return;}
          this.MAP.off("keypress");
        }
      );

      this.MAP.on(
        "pm:remove",
        async (event: unknown & { layer: L.Layer; shape?: string; } & { layer: {options: { className: string }}} & { target?: unknown }): Promise<void> => {
          if (!this.MAP) {return;}
          if (event.shape === "Circle") {
            await fetch(`/api/object/${event.layer.options.className}/delete`);
            if (event.target instanceof L.Layer) {
              this.MAP.removeLayer(event.target)
            }
          }
        }
      );

      this.MAP.on(
        "pm:create",
        (event: L.LayerEvent & { layer: L.Layer; shape?: string }): void => {
          if (!this.MAP) {return;}

          const {layer} = event;

          if (layer instanceof L.Circle) {
            const radius = layer.getRadius();
            const latlng = layer.getLatLng();

            this.GEOJSON = { latlng, radius };
            this.CCONFIG.setConfigValue("radius", radius);
            this.CCONFIG.setConfigValue("latitude", latlng.lat);
            this.CCONFIG.setConfigValue("longitude", latlng.lng);

            const el = document.querySelector("#map");
            if (el) {el.remove();}
            this.MAP = undefined;

            document.querySelector("#name-input")?.remove()
            document.querySelector("#button-input")?.remove()
            document.querySelector("#input-background")?.remove()

          }
        }
      );
    }

    this.MAP.on("contextmenu", (e => {
      e.originalEvent.preventDefault();
    }));
  }


  /**
   *
   * @param event
   * @param id
   */
  onPopUp(event: LeafletMouseEvent | LeafletKeyboardEvent, id: string): void {
    if (!id || !this.MAP) {
      return;
    }
    this.MAP.on("keypress", async (keyPressEvent: { originalEvent: { key: string } }) => {
      if (keyPressEvent.originalEvent.key === "Enter") {
        const data = event.target;
        this.GEOJSON = { latlng: data._latlng, radius: data._mRadius };

        this.CCONFIG.setConfigValue("radius", data._mRadius);
        this.CCONFIG.setConfigValue("latitude", data._latlng.lat);
        this.CCONFIG.setConfigValue("longitude", data._latlng.lng);

        this.REUSED_DATA = await fetch(`/api/object/${id}/data`).then((res) =>
          res.json(),
        );

        const mapElement = document.querySelector("#map");
        if (mapElement) {
          mapElement.remove();
        }

        this.MAP = undefined;

        document.querySelector("#name-input")?.remove()
        document.querySelector("#button-input")?.remove()
        document.querySelector("#input-background")?.remove()

      } else if (keyPressEvent.originalEvent.key === "r") {
        const overlay: HTMLElement | null = document.querySelector("#input-overlay");
        interface RenameButton extends HTMLButtonElement {
          _renameHandler?: () => void;
        }

        interface KeyInput extends HTMLInputElement {
          _keyHandler?: (e: KeyboardEvent) => void;
        }

        const button = document.querySelector("#button-input") as RenameButton;
        const input = document.querySelector("#name-input") as KeyInput;

        if (!input || !button || !overlay) {
          return;
        }
        if (overlay) {
          overlay.style.display = "block";
        }
        if (input) {
          input.value = "";
          input.focus();
        }

        if (button._renameHandler) {
          button.removeEventListener("click", button._renameHandler);
        }

        if (input._keyHandler) {
          input.removeEventListener("keydown", input._keyHandler);
        }


        /**
         *
         */
        const renameHandler = async (): Promise<void> => {
          const newId = input.value.trim();
          if (!newId) {
            return;
          }
          const circle = event.target;

          try {
            const res = await fetch(
              `/api/object/${encodeURIComponent(id)}/rename?newid=${encodeURIComponent(newId)}`,
              { method: "POST" },
            );
            if (!res.ok) {
              overlay.style.display = "none";
              return;
            }
          } catch {
            return;
          }

          circle.options.id = Number(newId);
          circle
            .bindPopup(`Press ENTER to select ${newId} or Press R to rename.`)
            .on("click", (mousePressEvent: LeafletMouseEvent): void => {
              this.onPopUp(mousePressEvent, newId);
            });

          overlay.style.display = "none";
        };

        button._renameHandler = renameHandler;
        button.addEventListener("click", renameHandler);


        /**
         *
         * @param ke
         */
        const keyHandler = (ke: { key: string }): void => {
          if (ke.key === "Enter") {
            renameHandler();
          }
          if (ke.key === "Escape") {
            overlay.style.display = "none";
          }
        };

        input._keyHandler = keyHandler;
        input.addEventListener("keydown", keyHandler);
      }
    });
  }


  /**
   *
   */
  mapActive(): boolean {
    return this.MAP !== undefined;
  }


  /**
   *
   */
  getGeoJSON(): { radius: number; latlng: { lat: number, lng: number} } {
    return this.GEOJSON;
  }
}
