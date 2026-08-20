import { useContext, useState, useCallback } from "react";
import { MemoFetchContext } from "../providers/fetchProvider";
import { MemoCreationService } from "../services/MemoCreationService";
import { Memo } from "../types";
import { toast } from "sonner";

export function useMemoCreation() {
    const context = useContext(MemoFetchContext);
    if (context === undefined) {
        throw new Error("useMemoCreation must be used within a MemoFetchProvider");
    }

    const { memos, companies, isLoading, refreshMemos } = context;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
        refreshMemos(query);
    }, [refreshMemos]);

    // Shadcn alert dialog state
    const [alertDialogConfig, setAlertDialogConfig] = useState<{
        open: boolean;
        title: string;
        description: string;
        onConfirm: () => void | Promise<void>;
        variant?: "default" | "destructive";
    }>({
        open: false,
        title: "",
        description: "",
        onConfirm: () => {},
    });

    const triggerAlert = useCallback((config: {
        title: string;
        description: string;
        onConfirm: () => void | Promise<void>;
        variant?: "default" | "destructive";
    }) => {
        setAlertDialogConfig({ ...config, open: true });
    }, []);
    const handleAdd = useCallback(() => {
        setSelectedMemo(null);
        setIsReadOnly(false);
        setIsDialogOpen(true);
    }, []);

    const handleEdit = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsReadOnly(false);
        setIsDialogOpen(true);
    }, []);

    const handleView = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsReadOnly(true);
        setIsDialogOpen(true);
    }, []);

    const handleDelete = useCallback((memo: Memo) => {
        triggerAlert({
            title: "Delete Memo",
            description: `Are you sure you want to delete memo ${memo.memo_no}? This action cannot be undone.`,
            variant: "destructive",
            onConfirm: async () => {
                const res = await MemoCreationService.deleteMemo(memo.memo_no);
                if (res.success) {
                    if (res.message) {
                        toast.warning(res.message, { duration: 6000 });
                    } else {
                        toast.success("Memo deleted successfully");
                    }
                    refreshMemos();
                } else {
                    toast.error(res.message || "Failed to delete memo");
                }
            }
        });
    }, [refreshMemos, triggerAlert]);

    const handleSubmitMemo = useCallback((memo: Memo) => {
        triggerAlert({
            title: "Submit Memo",
            description: `Are you sure you want to submit memo ${memo.memo_no}? Once submitted, you will no longer be able to edit or delete this memo.`,
            variant: "default", // Styled via className in AlertDialogAction
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const res = await MemoCreationService.submitMemo(memo.memo_no);
                    if (res.success) {
                        if (res.message) {
                            toast.warning(res.message, { duration: 6000 });
                        } else {
                            toast.success("Memo submitted successfully");
                        }
                        refreshMemos();
                    } else {
                        toast.error(res.message || "Failed to submit memo");
                    }
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    }, [refreshMemos, triggerAlert]);



    const handleSubmit = useCallback(async (
        data: Partial<Memo>,
        attachments: { id?: string | number; file_url: string; file_name: string }[]
    ) => {
        if (!data.from) {
            toast.error("Please select a sending company (From).");
            return;
        }
        if (!data.company_ids || data.company_ids.length === 0) {
            toast.error("Please select at least one company.");
            return;
        }
        if (!data.start_date || !data.end_date) {
            toast.error("Start date and End date are strictly required.");
            return;
        }
        
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        
        if (end < start) {
            toast.error("End date must be on or after the start date.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (selectedMemo) {
                const res = await MemoCreationService.updateMemo(selectedMemo.memo_no, data, attachments);
                if (!res.success) {
                    toast.error(res.message);
                } else {
                    if (res.message) {
                        toast.warning(res.message, { duration: 6000 });
                    } else {
                        toast.success("Memo updated successfully");
                    }
                    setIsDialogOpen(false);
                    refreshMemos();
                }
            } else {
                const res = await MemoCreationService.createMemo(data, attachments);
                if (!res.success) {
                    toast.error(res.message);
                } else {
                    if (res.message) {
                        toast.warning(res.message, { duration: 6000 });
                    } else {
                        toast.success("Memo created successfully");
                    }
                    setIsDialogOpen(false);
                    refreshMemos();
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedMemo, refreshMemos]);

    return {
        memos,
        companies,
        isLoading,
        isDialogOpen,
        setIsDialogOpen,
        selectedMemo,
        isSubmitting,
        isReadOnly,
        alertDialogConfig,
        setAlertDialogConfig,
        handleAdd,
        handleEdit,
        handleView,
        handleDelete,
        handleSubmitMemo,
        handleSubmit,
        searchQuery,
        handleSearch
    };
}
