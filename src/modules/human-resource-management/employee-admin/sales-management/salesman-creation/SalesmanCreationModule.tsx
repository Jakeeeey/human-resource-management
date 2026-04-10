"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { SalesmanFilterProvider, useSalesmanFilterContext } from "./Provider/SalesmanFilterProvider";
import { useSalesmen } from "./hooks/useSalesmen";
import { SalesmanTable } from "./components/SalesmanTable";
import { SalesmanDialog } from "./components/SalesmanDialog";
import { CustomerManagementDialog } from "./components/CustomerManagementDialog";
import { SalesmanDetailsDialog } from "./components/SalesmanDetailsDialog";
import type { SalesmanWithRelations } from "./types";

function SalesmanCreationContent() {
    const { filters, updateSearch, updatePriceType, updateIsActive, resetFilters } = useSalesmanFilterContext();
    const {
        salesmen,
        allSalesmen,
        users,
        divisions,
        branches,
        badBranches,
        operations,
        priceTypes,
        isLoading,
        isError,
        error,
        refetch,
        createSalesman,
        updateSalesman,
    } = useSalesmen();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedSalesman, setSelectedSalesman] = useState<SalesmanWithRelations | null>(null);
    const [detailsSalesman, setDetailsSalesman] = useState<SalesmanWithRelations | null>(null);

    const handleAdd = () => {
        setSelectedSalesman(null);
        setDialogOpen(true);
    };

    const handleEdit = (salesman: SalesmanWithRelations) => {
        setSelectedSalesman(salesman);
        setDialogOpen(true);
    };

    const handleManageCustomers = (salesman: SalesmanWithRelations) => {
        setSelectedSalesman(salesman);
        setCustomerDialogOpen(true);
    };

    const handleViewDetails = (salesman: SalesmanWithRelations) => {
        setDetailsSalesman(salesman);
        setDetailsDialogOpen(true);
    };

    const handleSubmit = async (data: Record<string, unknown>) => {
        if (selectedSalesman) {
            await updateSalesman(selectedSalesman.id, data);
        } else {
            await createSalesman(data);
        }
    };

    if (isError) {
        return (
            <div className="p-8">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-destructive">
                            <p className="font-semibold">Error loading salesmen</p>
                            <p className="text-sm mt-2">{error?.message}</p>
                            <Button onClick={() => refetch()} className="mt-4">
                                Retry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Salesmen</CardTitle>
                            <CardDescription>
                                Manage salesman registration and customer assignments
                            </CardDescription>
                        </div>
                        <Button onClick={handleAdd}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Salesman
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, code, or plate..."
                                value={filters.search}
                                onChange={(e) => updateSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <SearchableSelect
                            className="w-[200px]"
                            placeholder="All Price Types"
                            value={filters.priceType}
                            onValueChange={updatePriceType}
                            options={[
                                { value: "All", label: "All Price Types" },
                                ...priceTypes.map((pt) => ({
                                    value: pt.price_type_name,
                                    label: pt.price_type_name,
                                })),
                            ]}
                        />

                        <Select
                            value={
                                filters.isActive === null
                                    ? "all"
                                    : filters.isActive
                                      ? "active"
                                      : "inactive"
                            }
                            onValueChange={(value) =>
                                updateIsActive(
                                    value === "all" ? null : value === "active"
                                )
                            }
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>

                        {(filters.search || filters.priceType || filters.isActive !== null) && (
                            <Button variant="outline" onClick={resetFilters}>
                                Clear Filters
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <span className="text-muted-foreground">Loading salesmen...</span>
                        </div>
                    ) : (
                        <SalesmanTable
                            salesmen={salesmen}
                            onViewDetails={handleViewDetails}
                            onEdit={handleEdit}
                            onManageCustomers={handleManageCustomers}
                        />
                    )}
                </CardContent>
            </Card>

            <SalesmanDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                salesman={selectedSalesman}
                registeredSalesmen={allSalesmen}
                users={users}
                divisions={divisions}
                branches={branches}
                badBranches={badBranches}
                operations={operations}
                priceTypes={priceTypes}
                onSubmit={handleSubmit}
            />

            <CustomerManagementDialog
                open={customerDialogOpen}
                onOpenChange={setCustomerDialogOpen}
                salesman={selectedSalesman}
            />

            <SalesmanDetailsDialog
                open={detailsDialogOpen}
                onOpenChange={setDetailsDialogOpen}
                salesman={detailsSalesman}
            />
        </div>
    );
}

export function SalesmanCreationModule() {
    return (
        <SalesmanFilterProvider>
            <SalesmanCreationContent />
        </SalesmanFilterProvider>
    );
}
