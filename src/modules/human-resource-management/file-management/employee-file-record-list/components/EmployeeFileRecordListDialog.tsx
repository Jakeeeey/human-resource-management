"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { 
    EmployeeFileRecordListWithRelations,
    EmployeeFileRecordListFormData 
} from "../types";
import type { EmployeeFileRecordType } from "../../employee-file-record-type/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface FormData {
    record_type_id: string;
    name: string;
    description: string;
}

interface EmployeeFileRecordListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record?: EmployeeFileRecordListWithRelations | null;
    recordTypes: EmployeeFileRecordType[];
    onSubmit: (data: EmployeeFileRecordListFormData) => Promise<void>;
}

export function EmployeeFileRecordListDialog({
    open,
    onOpenChange,
    record,
    recordTypes,
    onSubmit,
}: EmployeeFileRecordListDialogProps) {
    const isEdit = !!record;

    const form = useForm<FormData>({
        defaultValues: { record_type_id: "", name: "", description: "" },
    });

    useEffect(() => {
        if (open && record) {
            form.reset({
                record_type_id: record.record_type_id?.toString() || "",
                name: record.name,
                description: record.description || "",
            });
        } else if (!open) {
            form.reset({ record_type_id: "", name: "", description: "" });
        }
    }, [open, record, form]);

    const handleSubmit = async (data: FormData) => {
        try {
            await onSubmit({
                record_type_id: parseInt(data.record_type_id, 10),
                name: data.name,
                description: data.description,
            });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            console.error("Error submitting record:", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit
                            ? "Edit Employee File Record"
                            : "Create Employee File Record"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the record information below."
                            : "Fill in the information to create a new record."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="record_type_id"
                            rules={{ required: "Record type is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Record Type</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a record type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {recordTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.id.toString()}
                                                >
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: "Name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g. Passport"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter description"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                {isEdit ? "Update" : "Create"} Record
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
