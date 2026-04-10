"use client";

/**
 * EmployeeLocationMap.tsx (MapLibre GL JS version)
 *
 * WebGL-accelerated interactive map for HR analytics. Features MapLibre vector tiles
 * for 60fps zooming and ultra-crisp aesthetics, replacing the old DOM-based Leaflet implementation.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup, NavigationControl, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { User } from "../types";
import {
  getPsgcCode,
  PROVINCE_CENTROIDS,
  getProvincePrefix,
  getProvincePrefixByName,
} from "../area_masterlist/psgcCityMap";
import {
  geocodeLocation,
  makeCacheKey,
} from "../area_masterlist/nominatimGeocoder";
import maplibregl from "maplibre-gl";

// ─── Constants ───────────────────────────────────────────────────────────────
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

interface LocationGroup {
  brgy: string;
  city: string;
  province: string;
  employees: User[];
  cacheKey: string;
}

interface GeocodedPin {
  group: LocationGroup;
  coords: { lat: number; lng: number; exact?: boolean } | null;
}

// ─── Data Guards ─────────────────────────────────────────────────────────────
const PLACEHOLDER_LOWER = [
  "select a",
  "select city",
  "select municipality",
  "select barangay",
  "unknown",
  "n/a",
];

function isValidEmployee(emp: User): boolean {
  const deleted = emp.isDeleted ?? emp.is_deleted;
  if (deleted === true) return false;
  if (
    typeof deleted === "object" &&
    deleted !== null &&
    !Array.isArray(deleted) &&
    (deleted as Record<string, number>)[0] === 1
  )
    return false;

  const city = (emp.city ?? "").toLowerCase().trim();
  if (!city || city.length < 2) return false;

  for (const frag of PLACEHOLDER_LOWER) {
    if (city.includes(frag)) return false;
  }
  return true;
}

// ─── Components ──────────────────────────────────────────────────────────────

function SVGPing({ count, isGeocoded }: { count: number; isGeocoded: boolean }) {
  const size = isGeocoded ? (count > 1 ? 40 : 34) : 30;
  const bg = isGeocoded ? "#4f46e5" : "#94a3b8"; // Indigo vs slate
  const label = count > 1 ? String(count) : "●";
  const fontSize = count > 99 ? 9 : count > 9 ? 11 : 13;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size + 8}
      viewBox={`0 0 ${size} ${size + 8}`}
      style={{ cursor: "pointer", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.2))" }}
    >
      <ellipse cx={size / 2} cy={size + 5} rx={size / 2 - 4} ry={3} fill="rgba(0,0,0,0.18)" />
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill={bg} stroke="white" strokeWidth="2.5" />
      <polygon points={`${size / 2 - 5},${size - 3} ${size / 2 + 5},${size - 3} ${size / 2},${size + 4}`} fill={bg} />
      <text
        x={size / 2}
        y={size / 2 + fontSize / 3}
        textAnchor="middle"
        fontFamily="Inter,system-ui,sans-serif"
        fontSize={fontSize}
        fontWeight="700"
        fill="white"
      >
        {label}
      </text>
    </svg>
  );
}

export default function EmployeeLocationMap({ employees }: { employees: User[] }) {
  const mapRef = useRef<MapRef>(null);
  
  const [pins, setPins] = useState<GeocodedPin[]>([]);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPin, setSelectedPin] = useState<GeocodedPin | null>(null);
  
  const mountedRef = useRef(true);

  // Grouping
  const groups = useMemo((): LocationGroup[] => {
    const map: Record<string, LocationGroup> = {};

    for (const emp of employees) {
      if (!isValidEmployee(emp)) continue;

      const brgy = (emp.brgy ?? "").trim();
      const city = (emp.city ?? "").trim();
      const province = (emp.province ?? "").trim();
      const key = makeCacheKey(brgy, city, province);

      if (!map[key]) {
        map[key] = { brgy, city, province, employees: [], cacheKey: key };
      }
      map[key].employees.push(emp);
    }
    return Object.values(map);
  }, [employees]);

  // Geocoding
  useEffect(() => {
    mountedRef.current = true;
    const total = groups.length;
    setTotalCount(total);
    setGeocodedCount(0);
    setSelectedPin(null);

    if (total === 0) {
      setPins([]);
      return;
    }

    const initialPins: GeocodedPin[] = groups.map((group) => ({
      group,
      coords: null,
    }));
    setPins(initialPins);

    let resolved = 0;

    groups.forEach((group, idx) => {
      geocodeLocation(group.brgy, group.city, group.province).then((coords) => {
        if (!mountedRef.current) return;
        resolved++;

        let finalCoords: { lat: number; lng: number; exact?: boolean } | null = coords;
        if (!finalCoords) {
          const psgc = getPsgcCode(group.city, group.province);
          const prefix = psgc ? getProvincePrefix(psgc) : getProvincePrefixByName(group.province);
          if (prefix) {
            const centroid = PROVINCE_CENTROIDS[prefix];
            if (centroid) {
              finalCoords = { lat: centroid[0], lng: centroid[1], exact: false };
            }
          }
        }

        setPins((prev) => {
          const next = [...prev];
          next[idx] = { group, coords: finalCoords };
          return next;
        });

        setGeocodedCount(resolved);
      });
    });

    return () => {
      mountedRef.current = false;
    };
  }, [groups]);

  // Fit bounds when all geocoded
  useEffect(() => {
    if (geocodedCount < 1 || !mapRef.current) return;
    
    // Only fit bounds once completely resolved to avoid jumping
    if (geocodedCount < totalCount && totalCount > 10) return;

    const validPins = pins.filter((p) => p.coords);
    if (validPins.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    validPins.forEach((p) => {
      bounds.extend([p.coords!.lng, p.coords!.lat]);
    });

    mapRef.current.fitBounds(bounds, {
      padding: 60,
      duration: 1500, // Smooth swooping animation
      maxZoom: 13,
    });
  }, [geocodedCount, totalCount, pins]);

  return (
    <div className="h-[500px] w-full rounded-b-3xl overflow-hidden relative border-t bg-slate-50">
      
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 121.0,
          latitude: 14.5,
          zoom: 5,
        }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["clusters"]}
      >
        <NavigationControl position="bottom-right" />

        {/* Render markers */}
        {pins.map((pin, i) => {
          if (!pin.coords) return null;
          const { lat, lng } = pin.coords;
          const count = pin.group.employees.length;
          const isExact = ("exact" in pin.coords) ? !!pin.coords.exact : true;

          return (
            <Marker
              key={`${pin.group.cacheKey}-${i}`}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedPin(pin);
                // Mild centering on selection
                mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
              }}
            >
              <SVGPing count={count} isGeocoded={isExact} />
            </Marker>
          );
        })}

        {/* Selected Popup */}
        {selectedPin && selectedPin.coords && (
          <Popup
            anchor="bottom"
            longitude={selectedPin.coords.lng}
            latitude={selectedPin.coords.lat}
            onClose={() => setSelectedPin(null)}
            closeButton={false}
            offset={selectedPin.group.employees.length > 1 ? 48 : 38} // clear the pin head
            className="z-50"
            maxWidth="320px"
          >
            <div className="p-1 font-sans rounded-2xl">
              <div className="mb-2">
                <p className="font-bold text-slate-800 text-base m-0 leading-tight">
                  {selectedPin.group.brgy || selectedPin.group.city}
                </p>
                <p className="text-xs text-slate-500 m-0 mt-0.5 mb-2">
                  {selectedPin.group.brgy ? `${selectedPin.group.city} · ` : ""}
                  {selectedPin.group.province}
                </p>
                {("exact" in selectedPin.coords && selectedPin.coords.exact) || !("exact" in selectedPin.coords) ? (
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Barangay-Precise
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    City-Level Fallback
                  </span>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 max-h-[180px] overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  {selectedPin.group.employees.length}{" "}
                  {selectedPin.group.employees.length === 1 ? "Employee" : "Employees"}
                </p>
                <ul className="m-0 p-0 list-none text-xs text-slate-600 space-y-1">
                  {selectedPin.group.employees.slice(0, 25).map((e, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                      <span className="truncate">{e.firstName} {e.lastName}</span>
                    </li>
                  ))}
                  {selectedPin.group.employees.length > 25 && (
                    <li className="text-slate-400 italic text-[11px] pt-1">
                      +{selectedPin.group.employees.length - 25} more employees
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Loading Overlay Progress Indicator */}
      {geocodedCount < totalCount && totalCount > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur px-4 py-1.5 rounded-full shadow-lg border border-indigo-100 flex items-center gap-2 pointer-events-none transition-all duration-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
          </span>
          <span className="text-xs font-semibold text-indigo-700 tracking-wide">
            Locating {geocodedCount}/{totalCount}
          </span>
        </div>
      )}
    </div>
  );
}
