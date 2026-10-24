"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Field, HourlyRisk } from "@/lib/types";
import { BAND_COLOR } from "./bands";

// Fields as pulsing dots colored by heat band at the selected hour.
export function FieldMap({
  fields,
  risks,
  hour,
  alerts = {},
  crewLabels = {},
}: {
  fields: Field[];
  risks: HourlyRisk[];
  hour: number;
  alerts?: Record<string, string>;
  crewLabels?: Record<string, string>; // fieldId -> "Crew 1 · Crew 3"
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, { marker: Marker; dot: HTMLDivElement; sub: HTMLSpanElement }>>({});
  const [ready, setReady] = useState(false); // markers exist; lets the styling effect run once they do

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibre }) => {
      if (cancelled || !el.current || map.current) return;
      const m = new maplibre.Map({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [(Math.min(...fields.map((f) => f.lon)) + Math.max(...fields.map((f) => f.lon))) / 2, (Math.min(...fields.map((f) => f.lat)) + Math.max(...fields.map((f) => f.lat))) / 2],
        zoom: 10,
        attributionControl: { compact: true },
      });
      map.current = m;
      const lons = fields.map((f) => f.lon);
      const lats = fields.map((f) => f.lat);
      // Fit after load too: the first fit can run before the container has its final size.
      const fit = () =>
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: { top: 50, bottom: 50, left: 40, right: 200 }, maxZoom: 11, duration: 0 });
      fit();
      m.once("load", fit);
      for (const f of fields) {
        const wrap = document.createElement("div");
        wrap.className = "field-marker";
        const dot = document.createElement("div");
        dot.className = "field-dot";
        const label = document.createElement("span");
        label.className = "field-label";
        label.textContent = f.name;
        const sub = document.createElement("span");
        sub.className = "field-sub";
        label.append(sub);
        wrap.append(dot, label);
        markers.current[f.id] = { marker: new maplibre.Marker({ element: wrap }).setLngLat([f.lon, f.lat]).addTo(m), dot, sub };
      }
      setReady(true);
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
      const temp = r ? `${r.tempF}°F` : "";
      m.sub.textContent = [crewLabels[f.id], temp].filter(Boolean).join(" · ");
    }
  }, [fields, risks, hour, alerts, crewLabels, ready]);

  return <div ref={el} className="h-full w-full" />;
}
