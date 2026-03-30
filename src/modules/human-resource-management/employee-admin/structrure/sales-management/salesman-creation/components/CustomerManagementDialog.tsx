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
import { Search, X } from "lucide-react";
import type { Customer, SalesmanWithRelations } from "../types";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    const filteredCustomers = useMemo(() => {
        if (!searchQuery) return allCustomers;
        const query = searchQuery.toLowerCase();
        return allCustomers.filter(
            (c) =>
                c.customer_name.toLowerCase().includes(query) ||
                c.customer_code.toLowerCase().includes(query) ||
                c.store_name.toLowerCase().includes(query)
        );
    }, [allCustomers, searchQuery]);

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
        const source = searchQuery ? filteredCustomers : assignedCustomers;
        const assignedSet = new Set(assignedCustomerIds);
        return source.filter((c) => assignedSet.has(c.id));
    }, [assignedCustomers, assignedCustomerIds, filteredCustomers, searchQuery]);

    const filteredAvailableCustomers = useMemo(() => {
        const source = searchQuery ? filteredCustomers : availableCustomers;
        const assignedSet = new Set(assignedCustomerIds);
        return source.filter((c) => !assignedSet.has(c.id));
    }, [assignedCustomerIds, availableCustomers, filteredCustomers, searchQuery]);

    const handleToggleCustomer = (customerId: number) => {
        setAssignedCustomerIds((prev) =>
            prev.includes(customerId)
                ? prev.filter((id) => id !== customerId)
                : [...prev, customerId]
        );
    };

    const handleSave = async () => {
        if (!salesman) return;

        setIsSaving(true);
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
                return;
            }

            onOpenChange(false);
        } catch (error) {
            console.error("Error saving customer assignments:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[950px] max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Manage Customers for {salesman?.salesman_name}</DialogTitle>
                    <DialogDescription>
                        Select customers to assign to this salesman.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            {assignedCustomerIds.length} customer(s) selected
                        </span>
                        {assignedCustomerIds.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAssignedCustomerIds([])}
                            >
                                Clear All
                            </Button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="text-sm text-muted-foreground">
                                Loading customers...
                            </span>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="text-sm text-muted-foreground">
                                No customers found
                            </span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border bg-muted/20">
                                <div className="flex items-center justify-between border-b px-3 py-2">
                                    <div className="text-sm font-medium">Assigned Customers</div>
                                    <div className="text-xs text-muted-foreground">
                                        {filteredAssignedCustomers.length}
                                    </div>
                                </div>
                                <ScrollArea className="h-[45vh] px-3 py-3">
                                    {filteredAssignedCustomers.length === 0 ? (
                                        <div className="text-sm text-muted-foreground p-1">
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
                                                        className="flex items-start space-x-3 rounded-lg border bg-background p-3 hover:bg-accent cursor-pointer"
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
                                                                <div className="text-xs text-muted-foreground">
                                                                    {customer.city}
                                                                    {customer.city &&
                                                                        customer.province &&
                                                                        ", "}
                                                                    {customer.province}
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

                            <div className="rounded-lg border bg-muted/20">
                                <div className="flex items-center justify-between border-b px-3 py-2">
                                    <div className="text-sm font-medium">Available Customers</div>
                                    <div className="text-xs text-muted-foreground">
                                        {filteredAvailableCustomers.length}
                                    </div>
                                </div>
                                <ScrollArea className="h-[45vh] px-3 py-3">
                                    {filteredAvailableCustomers.length === 0 ? (
                                        <div className="text-sm text-muted-foreground p-1">
                                            No additional customers available.
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
                                                        className="flex items-start space-x-3 rounded-lg border bg-background p-3 hover:bg-accent cursor-pointer"
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
                                                                <div className="text-xs text-muted-foreground">
                                                                    {customer.city}
                                                                    {customer.city &&
                                                                        customer.province &&
                                                                        ", "}
                                                                    {customer.province}
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
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
