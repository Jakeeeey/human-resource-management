"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { 
    EmployeeFileRecordType,
    EmployeeFileRecordTypeFormData 
} from "../types";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";


interface FormData {
    name: string;
    description: string;
}

interface EmployeeFileRecordTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record?: EmployeeFileRecordType | null;
    onSubmit: (data: EmployeeFileRecordTypeFormData) => Promise<void>;
}

export function EmployeeFileRecordTypeDialog({
    open,
    onOpenChange,
    record,
    onSubmit,
}: EmployeeFileRecordTypeDialogProps) {
    const isEdit = !!record;
    const form = useForm<FormData>({
        defaultValues: { name: "", description: "" },
    });

    useEffect(() => {
        if (open && record) {
            form.reset({
                name: record.name,
                description: record.description || "",
            });
        } else if (!open) {
            form.reset({ name: "", description: "" });
        }
    }, [open, record, form]);

    const handleSubmit = async (data: FormData) => {
        try {
            await onSubmit(data);
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
                            ? "Edit Employee File Record Type"
                            : "Create Employee File Record Type"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the record type information below."
                            : "Fill in the information to create a new record type."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: "Name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g. Government IDs"
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
                                {isEdit ? "Update" : "Create"} Record Type
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
