import "ol/ol.css";
import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Style, Icon } from "ol/style";
import { defaults as defaultControls } from "ol/control";
import type { DriverLocation, LocationPoint, TravelTimeResult } from "./mapTypes";
import { fetchDrivingRouteMeters } from "./roadDrivingRoute";

const busSvg = (active: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${active ? "#DC2626" : "#6B7280"}" stroke-width="2"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`;

const schoolSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;

class FreeMapService {
  private map: OlMap | null = null;
  private vectorSource = new VectorSource();
  private schoolLocation: LocationPoint = { lat: 22.783014, lng: 87.773584 };
  private driverFeatures = new Map<string, Feature>();

  async initializeMap(container: HTMLElement, center?: LocationPoint): Promise<OlMap> {
    this.destroyMap();
    const c = center || this.schoolLocation;
    const vectorLayer = new VectorLayer({ source: this.vectorSource });

    this.map = new OlMap({
      target: container,
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
      view: new View({
        center: fromLonLat([c.lng, c.lat]),
        zoom: 12,
      }),
      controls: defaultControls({ attribution: true, zoom: true }),
    });

    this.addSchoolMarker();
    return this.map;
  }

  destroyMap(): void {
    if (this.map) {
      this.map.setTarget(undefined);
      this.map = null;
    }
    this.vectorSource.clear();
    this.driverFeatures.clear();
  }

  private addSchoolMarker(): void {
    const f = new Feature({
      geometry: new Point(fromLonLat([this.schoolLocation.lng, this.schoolLocation.lat])),
    });
    f.setStyle(
      new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(schoolSvg())}`,
          anchor: [0.5, 1],
          scale: 1,
        }),
      }),
    );
    f.setId("school-marker");
    this.vectorSource.addFeature(f);
  }

  clearMarkers(): void {
    this.driverFeatures.forEach((feat) => this.vectorSource.removeFeature(feat));
    this.driverFeatures.clear();
  }

  async addDriverMarker(driver: DriverLocation): Promise<void> {
    if (!this.map) return;
    const existing = this.driverFeatures.get(driver.driverId);
    if (existing) {
      this.vectorSource.removeFeature(existing);
    }
    const f = new Feature({
      geometry: new Point(fromLonLat([driver.lng, driver.lat])),
    });
    f.setStyle(
      new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(busSvg(driver.isActive))}`,
          anchor: [0.5, 1],
          scale: 1,
        }),
      }),
    );
    f.setId(driver.driverId);
    this.vectorSource.addFeature(f);
    this.driverFeatures.set(driver.driverId, f);
  }

  fitBoundsToMarkers(): void {
    if (!this.map) return;
    const extent = this.vectorSource.getExtent();
    if (!extent.every((v) => Number.isFinite(v))) return;
    this.map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 15, duration: 250 });
  }

  /** Pan/zoom after GPS updates (map already initialized). */
  setViewCenter(point: LocationPoint, zoom = 14): void {
    if (!this.map) return;
    this.map.getView().animate({
      center: fromLonLat([point.lng, point.lat]),
      zoom,
      duration: 250,
    });
  }

  updateMapSize(): void {
    this.map?.updateSize();
  }

  getSchoolLocation(): LocationPoint {
    return { ...this.schoolLocation };
  }

  setSchoolLocation(location: LocationPoint): void {
    this.schoolLocation = { ...location };
  }

  /**
   * Driving route via OSRM (see `roadDrivingRoute` / NEXT_PUBLIC_OSRM_URL). Falls back to straight-line estimate.
   */
  async calculateTravelTime(
    origin: LocationPoint,
    destination: LocationPoint,
  ): Promise<TravelTimeResult | null> {
    try {
      const route = await fetchDrivingRouteMeters(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      );
      if (!route) {
        return this.haversineFallback(origin, destination);
      }
      const sec = route.durationSeconds;
      const m = route.distanceMeters;
      return {
        duration: sec,
        distance: m,
        formattedDuration: `${Math.max(1, Math.round(sec / 60))} min`,
        formattedDistance: m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`,
      };
    } catch {
      return this.haversineFallback(origin, destination);
    }
  }

  private haversineFallback(a: LocationPoint, b: LocationPoint): TravelTimeResult {
    const km = this.haversineKm(a, b);
    const hours = km / 35;
    const sec = Math.round(hours * 3600);
    return {
      duration: sec,
      distance: km * 1000,
      formattedDuration: `${Math.max(1, Math.round(sec / 60))} min (est.)`,
      formattedDistance: `${km.toFixed(1)} km (straight line)`,
    };
  }

  private haversineKm(p1: LocationPoint, p2: LocationPoint): number {
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
}

export const freeMapService = new FreeMapService();
