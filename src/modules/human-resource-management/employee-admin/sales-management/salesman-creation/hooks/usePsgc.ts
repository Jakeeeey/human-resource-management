import provinceData from "@/modules/human-resource-management/employee-admin/employee-masterlist/area_masterlist/provinceData.json";
import cityData from "@/modules/human-resource-management/employee-admin/employee-masterlist/area_masterlist/cityData.json";
import barangayData from "@/modules/human-resource-management/employee-admin/employee-masterlist/area_masterlist/barangayData.json";
import { useMemo } from "react";

export function usePsgc() {
    const provinces = useMemo(() => {
        return Object.entries(provinceData as Record<string, string>)
            .map(([code, name]) => {
                let displayName = name.toUpperCase();
                if (displayName.startsWith("NCR,")) {
                    displayName = "METRO MANILA (" + displayName.replace("NCR,", "").trim() + ")";
                }
                return {
                    code,
                    name: displayName,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, []);

    const getCities = (provinceCode: string | null) => {
        if (!provinceCode) return [];
        return Object.entries(cityData as Record<string, string>)
            .filter(([code]) => code.startsWith(provinceCode))
            .map(([code, name]) => ({
                code,
                name: name.toUpperCase(),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const getBarangays = (cityCode: string | null) => {
        if (!cityCode) return [];
        return Object.entries(barangayData as Record<string, string>)
            .filter(([code]) => code.startsWith(cityCode))
            .map(([code, name]) => ({
                code,
                name: name.toUpperCase(),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const findProvinceCode = (name: string | null) => {
        if (!name) return null;
        const target = name.toUpperCase().trim();
        const entry = Object.entries(provinceData as Record<string, string>).find(
            ([, n]) => {
                let displayName = n.toUpperCase();
                if (displayName.startsWith("NCR,")) {
                    displayName = "METRO MANILA (" + displayName.replace("NCR,", "").trim() + ")";
                }
                return displayName.toUpperCase().trim() === target;
            }
        );
        return entry ? entry[0] : null;
    };

    const findCityCode = (provinceCode: string | null, cityName: string | null) => {
        if (!provinceCode || !cityName) return null;
        const target = cityName.toUpperCase().trim();
        const entry = Object.entries(cityData as Record<string, string>).find(
            ([code, name]) => code.startsWith(provinceCode) && name.toUpperCase().trim() === target
        );
        return entry ? entry[0] : null;
    };

    const findBarangayCode = (cityCode: string | null, barangayName: string | null) => {
        if (!cityCode || !barangayName) return null;
        const target = barangayName.toUpperCase().trim();
        const entry = Object.entries(barangayData as Record<string, string>).find(
            ([code, name]) => code.startsWith(cityCode) && name.toUpperCase().trim() === target
        );
        return entry ? entry[0] : null;
    };

    return {
        provinces,
        getCities,
        getBarangays,
        findProvinceCode,
        findCityCode,
        findBarangayCode,
    };
}

