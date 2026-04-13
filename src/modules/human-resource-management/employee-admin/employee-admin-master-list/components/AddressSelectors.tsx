"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

// Types for the JSON data structures
type ProvinceData = Record<string, string>;
type CityData = Record<string, string>;
type BarangayData = Record<string, string>;

interface AddressSelectorsProps {
  province: string;
  city: string;
  brgy: string;
  onProvinceChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onBrgyChange: (value: string) => void;
  className?: string;
}

export function AddressSelectors({
  province,
  city,
  brgy,
  onProvinceChange,
  onCityChange,
  onBrgyChange,
  className,
}: AddressSelectorsProps) {
  const [provinceData, setProvinceData] = useState<ProvinceData | null>(null);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [barangayData, setBarangayData] = useState<BarangayData | null>(null);
  
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>("");
  const [selectedCityId, setSelectedCityId] = useState<string>("");

  // Load basic data on mount
  useEffect(() => {
    const loadBundledData = async () => {
      try {
        // We use dynamic imports to keep the main bundle light
        const p = await import("../area_masterlist/provinceData.json");
        const c = await import("../area_masterlist/cityData.json");
        setProvinceData(p.default);
        setCityData(c.default);
      } catch (error) {
        console.error("Failed to load address data", error);
      }
    };
    loadBundledData();
  }, []);

  // Load Barangay data on demand (since it's 1.2MB)
  useEffect(() => {
    if (selectedCityId && !barangayData) {
      const loadBarangays = async () => {
        try {
          const b = await import("../area_masterlist/barangayData.json");
          setBarangayData(b.default);
        } catch (error) {
          console.error("Failed to load barangay data", error);
        }
      };
      loadBarangays();
    }
  }, [selectedCityId, barangayData]);

  // Map Names to IDs when the component mounts or when props change (for initial values)
  useEffect(() => {
    if (provinceData && province && !selectedProvinceId) {
      const entry = Object.entries(provinceData).find(([, name]) => name === province);
      if (entry) setSelectedProvinceId(entry[0]);
    }
  }, [provinceData, province, selectedProvinceId]);

  useEffect(() => {
    if (cityData && city && !selectedCityId) {
      const entry = Object.entries(cityData).find(([, name]) => name === city);
      if (entry) setSelectedCityId(entry[0]);
    }
  }, [cityData, city, selectedCityId]);

  // Computed Options
  const provinceOptions = useMemo(() => {
    if (!provinceData) return [];
    return Object.entries(provinceData)
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [provinceData]);

  const cityOptions = useMemo(() => {
    if (!cityData || !selectedProvinceId) return [];
    return Object.entries(cityData)
      .filter(([id]) => id.startsWith(selectedProvinceId))
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cityData, selectedProvinceId]);

  const barangayOptions = useMemo(() => {
    if (!barangayData || !selectedCityId) return [];
    return Object.entries(barangayData)
      .filter(([id]) => id.startsWith(selectedCityId))
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [barangayData, selectedCityId]);

  const inputCls = "h-10 bg-muted/40 border-transparent focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 rounded-xl text-sm";

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] font-semibold text-foreground/70">
          Province <span className="ml-1 text-red-500">*</span>
        </Label>
        <SearchableSelect
          options={provinceOptions}
          value={selectedProvinceId}
          placeholder="Select Province"
          onValueChange={(id) => {
            const name = provinceData?.[id] || "";
            setSelectedProvinceId(id);
            onProvinceChange(name);
            // Reset downstreams
            setSelectedCityId("");
            onCityChange("");
            onBrgyChange("");
          }}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] font-semibold text-foreground/70">
          City / Municipality <span className="ml-1 text-red-500">*</span>
        </Label>
        <SearchableSelect
          options={cityOptions}
          value={selectedCityId}
          placeholder="Select City"
          disabled={!selectedProvinceId}
          onValueChange={(id) => {
            const name = cityData?.[id] || "";
            setSelectedCityId(id);
            onCityChange(name);
            // Reset downstreams
            onBrgyChange("");
          }}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px] font-semibold text-foreground/70">
          Barangay <span className="ml-1 text-red-500">*</span>
        </Label>
        <SearchableSelect
          options={barangayOptions}
          value={Object.entries(barangayData || {}).find(([id, name]) => id.startsWith(selectedCityId) && name === brgy)?.[0] || ""}
          placeholder="Select Barangay"
          disabled={!selectedCityId}
          onValueChange={(id) => {
            const name = barangayData?.[id] || "";
            onBrgyChange(name);
          }}
          className={inputCls}
        />
      </div>
    </div>
  );
}
