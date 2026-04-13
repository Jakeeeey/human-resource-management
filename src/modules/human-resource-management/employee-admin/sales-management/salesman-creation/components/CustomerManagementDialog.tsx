"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Printer, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { Customer, SalesmanWithRelations } from "../types";
import { exportSalesmanCustomersPDF } from "../utils/exportSalesmanCustomersPDF";

interface CustomerManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    salesman: SalesmanWithRelations | null;
}

export function CustomerManagementDialog({
    open,
    onOpenChange,
    salesman,
}: CustomerManagementDialogProps) {
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [assignedCustomerIds, setAssignedCustomerIds] = useState<number[]>([]);
    const [lastAssignedCustomerId, setLastAssignedCustomerId] = useState<number | null>(null);
    const [assignedSearchQuery, setAssignedSearchQuery] = useState("");
    const [availableSearchQuery, setAvailableSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const customersApiUrl =
        "/api/hrm/employee-admin/structure/sales-management/salesman-creation/customers";

    const fetchData = useCallback(
        async (salesmanId: number) => {
            setIsLoading(true);
            try {
                const res = await fetch(
                    `${customersApiUrl}?salesmanId=${encodeURIComponent(String(salesmanId))}`,
                    { headers: { "Content-Type": "application/json" } }
                );

                if (!res.ok) {
                    const text = await res.text();
                    console.warn("Customer fetch failed:", res.status, text);
                    return;
                }

                const result = await res.json();
                setAllCustomers(result.customers || []);
                setAssignedCustomerIds(result.assignedCustomerIds || []);
                setLastAssignedCustomerId(null);
            } catch (error) {
                console.error("Error fetching customers:", error);
            } finally {
                setIsLoading(false);
            }
        },
        [customersApiUrl]
    );

    useEffect(() => {
        if (open && salesman) {
            fetchData(salesman.id);
        }
    }, [open, salesman, fetchData]);

    useEffect(() => {
        if (open) {
            setAssignedSearchQuery("");
            setAvailableSearchQuery("");
            setLastAssignedCustomerId(null);
        }
    }, [open]);

    const customerMatchesQuery = useCallback(
        (customer: Customer, query: string) => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            return (
                customer.customer_name.toLowerCase().includes(q) ||
                customer.customer_code.toLowerCase().includes(q) ||
                customer.store_name.toLowerCase().includes(q)
            );
        },
        []
    );

    const assignedCustomers = useMemo(() => {
        if (assignedCustomerIds.length === 0) return [];
        const assignedSet = new Set(assignedCustomerIds);
        return allCustomers.filter((c) => assignedSet.has(c.id));
    }, [allCustomers, assignedCustomerIds]);

    const availableCustomers = useMemo(() => {
        if (assignedCustomerIds.length === 0) return allCustomers;
        const assignedSet = new Set(assignedCustomerIds);
        return allCustomers.filter((c) => !assignedSet.has(c.id));
    }, [allCustomers, assignedCustomerIds]);

    const filteredAssignedCustomers = useMemo(() => {
        const base = assignedSearchQuery
            ? assignedCustomers.filter((c) => customerMatchesQuery(c, assignedSearchQuery))
            : assignedCustomers;

        if (!lastAssignedCustomerId) return base;

        const idx = base.findIndex((c) => c.id === lastAssignedCustomerId);
        if (idx === -1) return base;

        return [base[idx], ...base.slice(0, idx), ...base.slice(idx + 1)];
    }, [assignedCustomers, assignedSearchQuery, customerMatchesQuery, lastAssignedCustomerId]);

    const filteredAvailableCustomers = useMemo(() => {
        if (!availableSearchQuery) return availableCustomers;
        return availableCustomers.filter((c) => customerMatchesQuery(c, availableSearchQuery));
    }, [availableCustomers, availableSearchQuery, customerMatchesQuery]);

    const handlePrint = useCallback(async () => {
        if (!salesman) return;

        setIsPrinting(true);
        const toastId = toast.loading("Generating printable PDF...");
        try {
            await exportSalesmanCustomersPDF({
                salesman,
                customers: assignedCustomers,
            });
            toast.success("Printable PDF generated", { id: toastId });
        } catch (error) {
            console.error("Error generating Salesman Customer PDF:", error);
            toast.error("Failed to generate printable PDF", {
                id: toastId,
                description: error instanceof Error ? error.message : "Unexpected error occurred",
            });
        } finally {
            setIsPrinting(false);
        }
    }, [assignedCustomers, salesman]);

    const handleToggleCustomer = (customerId: number) => {
        setAssignedCustomerIds((prev) => {
            const wasAssigned = prev.includes(customerId);
            const next = wasAssigned
                ? prev.filter((id) => id !== customerId)
                : [...prev, customerId];

            // If it was available and is now assigned, move it to the top of the Assigned list.
            if (!wasAssigned) {
                setLastAssignedCustomerId(customerId);
            }

            return next;
        });
    };

    const handleSave = async () => {
        if (!salesman) return;

        setIsSaving(true);
        const toastId = toast.loading("Saving customer assignments...");
        try {
            const res = await fetch(customersApiUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    salesmanId: salesman.id,
                    customerIds: assignedCustomerIds,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                console.warn("Save customer assignments failed:", res.status, text);
                toast.error("Failed to save changes", {
                    id: toastId,
                    description: text || `Request failed (${res.status})`,
                });
                return;
            }

            toast.success("Customer assignments saved", { id: toastId });
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving customer assignments:", error);
            toast.error("Failed to save changes", {
                id: toastId,
                description:
                    error instanceof Error ? error.message : "Unexpected error occurred",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[950px] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Customers for {salesman?.salesman_name}</DialogTitle>
                    <DialogDescription>
                        Select customers to assign to this salesman.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {assignedCustomerIds.length} customer(s) selected
                        </span>
                        <div className="flex items-center gap-2">
                            {assignedCustomerIds.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setAssignedCustomerIds([]);
                                        setLastAssignedCustomerId(null);
                                    }}
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="text-sm text-muted-foreground">
                                Loading customers...
                            </span>
                        </div>
                    ) : allCustomers.length === 0 ? (
                        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed">
                            <span className="text-sm text-muted-foreground">
                                No customers found
                            </span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                            <div className="flex flex-col rounded-lg border bg-muted/10 overflow-hidden min-h-0">
                                <div className="border-b bg-muted/20 px-4 py-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">Assigned Customers</div>
                                        <Badge variant="secondary" className="text-xs">
                                            {filteredAssignedCustomers.length}
                                        </Badge>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search assigned..."
                                            value={assignedSearchQuery}
                                            onChange={(e) =>
                                                setAssignedSearchQuery(e.target.value)
                                            }
                                            className="pl-9"
                                        />
                                        {assignedSearchQuery && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                                onClick={() =>
                                                    setAssignedSearchQuery("")
                                                }
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 min-h-0 p-3">
                                    {filteredAssignedCustomers.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-md m-2">
                                            No customers assigned yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredAssignedCustomers.map((customer) => {
                                                const isAssigned = assignedCustomerIds.includes(
                                                    customer.id
                                                );
                                                return (
                                                    <div
                                                        key={customer.id}
                                                        className="group flex items-start space-x-3 rounded-lg border bg-background p-3 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                                                        onClick={() =>
                                                            handleToggleCustomer(customer.id)
                                                        }
                                                    >
                                                        <Checkbox
                                                            checked={isAssigned}
                                                            onCheckedChange={() =>
                                                                handleToggleCustomer(customer.id)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">
                                                                    {customer.customer_name}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {customer.customer_code}
                                                                </Badge>
                                                                {customer.isActive === 1 && (
                                                                    <Badge
                                                                        variant="default"
                                                                        className="text-xs bg-green-500"
                                                                    >
                                                                        Active
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {customer.store_name}
                                                            </div>
                                                            {(customer.city ||
                                                                customer.province) && (
                                                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                                    <span className="truncate">
                                                                        {customer.city}
                                                                        {customer.city &&
                                                                            customer.province &&
                                                                            ", "}
                                                                        {customer.province}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>

                            <div className="flex flex-col rounded-lg border bg-muted/10 overflow-hidden min-h-0">
                                <div className="border-b bg-muted/20 px-4 py-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">Available Customers</div>
                                        <Badge variant="secondary" className="text-xs">
                                            {filteredAvailableCustomers.length}
                                        </Badge>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search available..."
                                            value={availableSearchQuery}
                                            onChange={(e) =>
                                                setAvailableSearchQuery(e.target.value)
                                            }
                                            className="pl-9"
                                        />
                                        {availableSearchQuery && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                                onClick={() =>
                                                    setAvailableSearchQuery("")
                                                }
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <ScrollArea className="flex-1 min-h-0 p-3">
                                    {filteredAvailableCustomers.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-4 text-center border-2 border-dashed rounded-md m-2">
                                            {availableSearchQuery
                                                ? "No customers found matching your search"
                                                : "No additional customers available."}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredAvailableCustomers.map((customer) => {
                                                const isAssigned = assignedCustomerIds.includes(
                                                    customer.id
                                                );
                                                return (
                                                    <div
                                                        key={customer.id}
                                                        className="group flex items-start space-x-3 rounded-lg border bg-background p-3 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                                                        onClick={() =>
                                                            handleToggleCustomer(customer.id)
                                                        }
                                                    >
                                                        <Checkbox
                                                            checked={isAssigned}
                                                            onCheckedChange={() =>
                                                                handleToggleCustomer(customer.id)
                                                            }
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">
                                                                    {customer.customer_name}
                                                                </span>
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {customer.customer_code}
                                                                </Badge>
                                                                {customer.isActive === 1 && (
                                                                    <Badge
                                                                        variant="default"
                                                                        className="text-xs bg-green-500"
                                                                    >
                                                                        Active
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {customer.store_name}
                                                            </div>
                                                            {(customer.city ||
                                                                customer.province) && (
                                                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                                    <span className="truncate">
                                                                        {customer.city}
                                                                        {customer.city &&
                                                                            customer.province &&
                                                                            ", "}
                                                                        {customer.province}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        disabled={isLoading || isPrinting || !salesman}
                        aria-busy={isPrinting}
                        className="gap-2"
                    >
                        {isPrinting ? (
                            <>
                                <Spinner className="h-4 w-4" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <Printer className="h-4 w-4" />
                                <span>Print</span>
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="w-full sm:w-auto"
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
