"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Field, HourlyRisk } from "@/lib/types";
import { BAND_COLOR } from "./bands";

// Fields as pulsing dots colored by heat band at the selected hour.
export function FieldMap({ fields, risks, hour, alerts = {} }: { fields: Field[]; risks: HourlyRisk[]; hour: number; alerts?: Record<string, string> }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, { marker: Marker; dot: HTMLDivElement }>>({});

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibre }) => {
      if (cancelled || !el.current || map.current) return;
      const m = new maplibre.Map({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-121.18, 37.88],
        zoom: 9.3,
        attributionControl: { compact: true },
      });
      map.current = m;
      const lons = fields.map((f) => f.lon);
      const lats = fields.map((f) => f.lat);
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, duration: 0 });
      for (const f of fields) {
        const wrap = document.createElement("div");
        wrap.className = "field-marker";
        const dot = document.createElement("div");
        dot.className = "field-dot";
        const label = document.createElement("span");
        label.textContent = f.name;
        wrap.append(dot, label);
        markers.current[f.id] = { marker: new maplibre.Marker({ element: wrap }).setLngLat([f.lon, f.lat]).addTo(m), dot };
      }
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [fields]);

  useEffect(() => {
    for (const f of fields) {
      const r = risks.find((x) => x.fieldId === f.id && Number(x.time.slice(11, 13)) === hour);
      const m = markers.current[f.id];
      if (!m) continue;
      m.dot.style.setProperty("--dot", r ? BAND_COLOR[r.band] : "#8a8278");
      m.dot.dataset.band = r?.band ?? "none";
      m.dot.title = r ? `${r.tempF}°F · WBGT ${r.wbgtF}°F` : "";
      if (alerts[f.id]) m.dot.dataset.alert = alerts[f.id];
      else delete m.dot.dataset.alert;
    }
  }, [fields, risks, hour, alerts]);

  return <div ref={el} className="h-full w-full" />;
}
