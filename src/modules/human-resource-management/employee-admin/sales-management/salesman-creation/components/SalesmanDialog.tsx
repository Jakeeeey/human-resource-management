"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type {
    SalesmanWithRelations,
    User,
    Division,
    Branch,
    Operation,
    PriceType,
} from "../types";

interface SalesmanFormData {
    employee_id: string;
    salesman_code: string;
    salesman_name: string;
    truck_plate: string;
    user_email: string;
    user_contact: string;
    user_province: string;
    user_city: string;
    user_brgy: string;
    division_id: string;
    branch_code: string;
    bad_branch_code: string;
    operation: string;
    price_type_id: string;
    isActive: boolean;
    isInventory: boolean;
    canCollect: boolean;
    inventory_day: string;
}

const INVENTORY_DAYS = [
    { value: "2", label: "Monday" },
    { value: "3", label: "Tuesday" },
    { value: "4", label: "Wednesday" },
    { value: "5", label: "Thursday" },
    { value: "6", label: "Friday" },
    { value: "7", label: "Saturday" },
    { value: "1", label: "Sunday" },
] as const;

interface SalesmanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    salesman?: SalesmanWithRelations | null;
    registeredSalesmen?: SalesmanWithRelations[];
    users: User[];
    divisions: Division[];
    branches: Branch[];
    badBranches: Branch[];
    operations: Operation[];
    priceTypes: PriceType[];
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function SalesmanDialog({
    open,
    onOpenChange,
    salesman,
    registeredSalesmen = [],
    users,
    divisions,
    branches,
    badBranches,
    operations,
    priceTypes,
    onSubmit,
}: SalesmanDialogProps) {
    const isEdit = !!salesman;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<SalesmanFormData>({
        defaultValues: {
            employee_id: "",
            salesman_code: "",
            salesman_name: "",
            truck_plate: "",
            user_email: "",
            user_contact: "",
            user_province: "",
            user_city: "",
            user_brgy: "",
            division_id: "",
            branch_code: "",
            bad_branch_code: "",
            operation: "",
            price_type_id: "",
            isActive: true,
            isInventory: false,
            canCollect: false,
            inventory_day: "",
        },
    });

    const selectedEmployeeId = form.watch("employee_id");
    const hasInventory = form.watch("isInventory");
    const selectedEmployee = users.find((u) => u.user_id.toString() === selectedEmployeeId);

    const selectableUsers = useMemo(() => {
        if (!registeredSalesmen.length) return users;

        const usedEmployeeIds = new Set(
            registeredSalesmen
                .map((s) => s.employee_id)
                .filter((id): id is number => typeof id === "number")
        );

        // Allow the currently-linked employee when editing.
        const currentEmployeeId = salesman?.employee_id;
        if (typeof currentEmployeeId === "number") {
            usedEmployeeIds.delete(currentEmployeeId);
        }

        return users.filter((u) => !usedEmployeeIds.has(u.user_id));
    }, [registeredSalesmen, salesman?.employee_id, users]);

    useEffect(() => {
        if (selectedEmployee) {
            form.setValue(
                "salesman_name",
                `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
            );

            form.setValue("user_email", selectedEmployee.user_email || "");
            form.setValue("user_contact", selectedEmployee.user_contact || "");
            form.setValue("user_province", selectedEmployee.user_province || "");
            form.setValue("user_city", selectedEmployee.user_city || "");
            form.setValue("user_brgy", selectedEmployee.user_brgy || "");
        }
    }, [selectedEmployee, form]);

    useEffect(() => {
        if (open && salesman) {
            form.reset({
                employee_id: salesman.employee_id?.toString() || "",
                salesman_code: salesman.salesman_code || "",
                salesman_name: salesman.salesman_name || "",
                truck_plate: salesman.truck_plate || "",
                user_email: salesman.employee?.user_email || "",
                user_contact: salesman.employee?.user_contact || "",
                user_province: salesman.employee?.user_province || "",
                user_city: salesman.employee?.user_city || "",
                user_brgy: salesman.employee?.user_brgy || "",
                division_id: salesman.division_id?.toString() || "",
                branch_code: salesman.branch_code?.toString() || "",
                bad_branch_code: salesman.bad_branch_code?.toString() || "",
                operation: salesman.operation?.toString() || "",
                price_type_id: salesman.price_type_id?.toString() || "",
                isActive: salesman.isActive === 1,
                isInventory: salesman.isInventory === 1,
                canCollect: salesman.canCollect === 1,
                inventory_day: salesman.inventory_day?.toString() || "",
            });
        } else if (open) {
            form.reset({
                employee_id: "",
                salesman_code: "",
                salesman_name: "",
                truck_plate: "",
                user_email: "",
                user_contact: "",
                user_province: "",
                user_city: "",
                user_brgy: "",
                division_id: "",
                branch_code: "",
                bad_branch_code: "",
                operation: "",
                price_type_id: "",
                isActive: true,
                isInventory: false,
                canCollect: false,
                inventory_day: "",
            });
        }
    }, [open, salesman, form]);

    useEffect(() => {
        if (!hasInventory) {
            form.setValue("inventory_day", "");
        }
    }, [hasInventory, form]);

    const handleSubmit = async (data: SalesmanFormData) => {
        setIsSubmitting(true);
        const toastId = toast.loading(isEdit ? "Updating salesman..." : "Creating salesman...");
        try {
            const selectedPriceType = priceTypes.find(
                (pt) => pt.price_type_id.toString() === data.price_type_id
            );

            const payload = {
                employee_id: parseInt(data.employee_id, 10),
                salesman_code: data.salesman_code,
                salesman_name: data.salesman_name,
                truck_plate: data.truck_plate || null,
                user_email: data.user_email || null,
                user_contact: data.user_contact || null,
                user_province: data.user_province || null,
                user_city: data.user_city || null,
                user_brgy: data.user_brgy || null,
                division_id: data.division_id ? parseInt(data.division_id, 10) : null,
                branch_code: data.branch_code ? parseInt(data.branch_code, 10) : null,
                bad_branch_code: data.bad_branch_code ? parseInt(data.bad_branch_code, 10) : null,
                operation: data.operation ? parseInt(data.operation, 10) : null,
                price_type: selectedPriceType?.price_type_name || null,
                price_type_id: data.price_type_id ? parseInt(data.price_type_id, 10) : null,
                isActive: data.isActive ? 1 : 0,
                isInventory: data.isInventory ? 1 : 0,
                canCollect: data.canCollect ? 1 : 0,
                inventory_day:
                    data.isInventory && data.inventory_day
                        ? parseInt(data.inventory_day, 10)
                        : null,
                modified_date: new Date().toISOString(),
            };

            await onSubmit(payload);
            toast.success(isEdit ? "Salesman updated" : "Salesman created", { id: toastId });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting salesman:", error);
            toast.error("Failed to save salesman", {
                id: toastId,
                description:
                    error instanceof Error ? error.message : "An error occurred",
            });
            form.setError("root", {
                message: error instanceof Error ? error.message : "An error occurred",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? "Edit Salesman" : "Add New Salesman"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the salesman information below."
                            : "Fill in the information to create a new salesman."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="employee_id"
                                rules={{ required: "Employee is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Employee Link</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                placeholder="Select employee"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={selectableUsers.map((user) => ({
                                                    value: user.user_id.toString(),
                                                    label: `${user.user_fname} ${user.user_lname}`,
                                                }))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="salesman_name"
                                rules={{ required: "Salesman name is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Salesman Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Salesman name" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="salesman_code"
                                rules={{ required: "Salesman code is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Salesman Code</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g., SLS-001" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="truck_plate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Truck Plate</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="e.g., ABC-123" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {(selectedEmployeeId || isEdit) && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="user_email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Email address" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="user_contact"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact No.</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Contact number" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {(selectedEmployeeId || isEdit) && (
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="user_province"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Province</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Province" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="user_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="City" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="user_brgy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Barangay</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Barangay" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="division_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Division</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                placeholder="Select division"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={divisions.map((div) => ({
                                                    value: div.division_id.toString(),
                                                    label: div.division_name,
                                                }))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="operation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Operation</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                placeholder="Select operation"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={operations.map((op) => ({
                                                    value: op.id.toString(),
                                                    label: op.operation_name || `Operation ${op.id}`,
                                                }))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="inventory_day"
                                rules={{
                                    validate: (value) => {
                                        if (!form.getValues("isInventory")) return true;
                                        return (
                                            Boolean(value) ||
                                            "Inventory day is required when Has Inventory is enabled"
                                        );
                                    },
                                }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Inventory Day</FormLabel>
                                        <FormControl>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                disabled={!hasInventory}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={
                                                            hasInventory
                                                                ? "Select day of week"
                                                                : "Enable Has Inventory first"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {INVENTORY_DAYS.map((day) => (
                                                        <SelectItem key={day.value} value={day.value}>
                                                            {day.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="branch_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                placeholder="Select branch"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={branches.map((branch) => ({
                                                    value: branch.id.toString(),
                                                    label: branch.branch_name,
                                                }))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="bad_branch_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bad Branch</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                placeholder="Select bad branch"
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                options={badBranches.map((branch) => ({
                                                    value: branch.id.toString(),
                                                    label: branch.branch_name,
                                                }))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="price_type_id"
                            rules={{ required: "Price type is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Price Type</FormLabel>
                                    <FormControl>
                                        <SearchableSelect
                                            placeholder="Select price type"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={priceTypes.map((pt) => ({
                                                value: pt.price_type_id.toString(),
                                                label: pt.price_type_name,
                                            }))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex items-center gap-6">
                            <FormField
                                control={form.control}
                                name="isActive"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Active</FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isInventory"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Has Inventory</FormLabel>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="canCollect"
                                render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Can Collect</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {form.formState.errors.root && (
                            <div className="text-sm text-destructive">
                                {form.formState.errors.root.message}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : isEdit ? "Update" : "Confirm"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
