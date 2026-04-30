"use client";

import { useEffect, useState } from "react";
import type { PsgcItem } from "../types";
import {
    fetchPsgcBarangaysByCity,
    fetchPsgcCitiesByProvince,
    fetchPsgcProvinces,
} from "../providers/fetchProvider";

interface UsePsgcReturn {
    provinces: PsgcItem[];
    cities: PsgcItem[];
    barangays: PsgcItem[];
    isLoadingProvinces: boolean;
    isLoadingCities: boolean;
    isLoadingBarangays: boolean;
}

export function usePsgc(provinceCode?: string, cityCode?: string): UsePsgcReturn {
    const [provinces, setProvinces] = useState<PsgcItem[]>([]);
    const [cities, setCities] = useState<PsgcItem[]>([]);
    const [barangays, setBarangays] = useState<PsgcItem[]>([]);
    const [citiesForProvince, setCitiesForProvince] = useState<string | null>(null);
    const [barangaysForCity, setBarangaysForCity] = useState<string | null>(null);

    const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);

    useEffect(() => {
        let active = true;
        fetchPsgcProvinces()
            .then((data) => {
                if (active) setProvinces(data);
            })
            .finally(() => {
                if (active) setIsLoadingProvinces(false);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        if (!provinceCode) {
            return;
        }

        fetchPsgcCitiesByProvince(provinceCode)
            .then((data) => {
                if (active) {
                    setCities(data);
                    setCitiesForProvince(provinceCode);
                }
            })
            .catch(() => {
                if (active) setCitiesForProvince(provinceCode);
            });

        return () => {
            active = false;
        };
    }, [provinceCode]);

    useEffect(() => {
        let active = true;
        if (!cityCode) {
            return;
        }

        fetchPsgcBarangaysByCity(cityCode)
            .then((data) => {
                if (active) {
                    setBarangays(data);
                    setBarangaysForCity(cityCode);
                }
            })
            .catch(() => {
                if (active) setBarangaysForCity(cityCode);
            });

        return () => {
            active = false;
        };
    }, [cityCode]);

    const visibleCities =
        provinceCode && citiesForProvince === provinceCode ? cities : [];
    const visibleBarangays =
        cityCode && barangaysForCity === cityCode ? barangays : [];
    const loadingCities = !!provinceCode && citiesForProvince !== provinceCode;
    const loadingBarangays = !!cityCode && barangaysForCity !== cityCode;

    return {
        provinces,
        cities: visibleCities,
        barangays: visibleBarangays,
        isLoadingProvinces,
        isLoadingCities: provinceCode ? loadingCities : false,
        isLoadingBarangays: cityCode ? loadingBarangays : false,
    };
}
