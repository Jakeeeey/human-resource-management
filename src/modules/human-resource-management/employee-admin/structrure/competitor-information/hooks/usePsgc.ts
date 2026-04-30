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

    const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);
    const [isLoadingCities, setIsLoadingCities] = useState(false);
    const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);

    useEffect(() => {
        let active = true;
        setIsLoadingProvinces(true);

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
            setCities([]);
            setBarangays([]);
            return;
        }

        setIsLoadingCities(true);
        setCities([]);
        setBarangays([]);

        fetchPsgcCitiesByProvince(provinceCode)
            .then((data) => {
                if (active) setCities(data);
            })
            .finally(() => {
                if (active) setIsLoadingCities(false);
            });

        return () => {
            active = false;
        };
    }, [provinceCode]);

    useEffect(() => {
        let active = true;
        if (!cityCode) {
            setBarangays([]);
            return;
        }

        setIsLoadingBarangays(true);
        setBarangays([]);

        fetchPsgcBarangaysByCity(cityCode)
            .then((data) => {
                if (active) setBarangays(data);
            })
            .finally(() => {
                if (active) setIsLoadingBarangays(false);
            });

        return () => {
            active = false;
        };
    }, [cityCode]);

    return {
        provinces,
        cities,
        barangays,
        isLoadingProvinces,
        isLoadingCities,
        isLoadingBarangays,
    };
}
