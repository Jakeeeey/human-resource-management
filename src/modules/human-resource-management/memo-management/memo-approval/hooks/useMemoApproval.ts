import { useContext, useState, useCallback, useMemo } from "react";
import { MemoApprovalContext } from "../providers/MemoApprovalProvider";
import { MemoApprovalService } from "../services/MemoApprovalService";
import { Memo } from "../types";
import { toast } from "sonner";

export function useMemoApproval() {
    const context = useContext(MemoApprovalContext);
    if (context === undefined) {
        throw new Error("useMemoApproval must be used within a MemoApprovalProvider");
    }

    const { memos, companies, isLoading, refreshMemos } = context;

    const [selectedMemoNos, setSelectedMemoNos] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [issuedByFilter, setIssuedByFilter] = useState<string>("all");
    const [targetCompanyFilter, setTargetCompanyFilter] = useState<string>("all");
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Confirmation Alert Config
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

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const filteredMemos = useMemo(() => {
        return memos.filter((memo) => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchNo = memo.memo_no.toLowerCase().includes(q);
                const matchSubject = memo.subject?.toLowerCase().includes(q);
                if (!matchNo && !matchSubject) return false;
            }
            if (issuedByFilter && issuedByFilter !== "all") {
                if (String(memo.from) !== issuedByFilter) return false;
            }
            if (targetCompanyFilter && targetCompanyFilter !== "all") {
                if (!memo.company_ids?.includes(Number(targetCompanyFilter))) return false;
            }
            return true;
        });
    }, [memos, searchQuery, issuedByFilter, targetCompanyFilter]);

    const handleSelectRow = useCallback((memoNo: string) => {
        setSelectedMemoNos((prev) =>
            prev.includes(memoNo) ? prev.filter((no) => no !== memoNo) : [...prev, memoNo]
        );
    }, []);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedMemoNos(memos.map((m) => m.memo_no));
        } else {
            setSelectedMemoNos([]);
        }
    }, [memos]);

    const handleViewDetails = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsDetailsOpen(true);
    }, []);

    const handleApprove = useCallback((memoNos: string[]) => {
        const isBulk = memoNos.length > 1;
        triggerAlert({
            title: isBulk ? "Bulk Approve Memos" : "Approve Memo",
            description: `Are you sure you want to approve ${isBulk ? `${memoNos.length} selected memos` : `memo ${memoNos[0]}`}? Approved memos will be released and propagated to target companies.`,
            variant: "default",
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const res = await MemoApprovalService.approveMemos(memoNos);
                    if (res.success) {
                        if (res.failedCompanies && res.failedCompanies.length > 0) {
                            toast.warning(`Approved successfully, but failed to sync remote databases for: ${res.failedCompanies.join(", ")}`, { duration: 6000 });
                        } else {
                            toast.success(isBulk ? "Selected memos approved successfully" : "Memo approved successfully");
                        }
                        setSelectedMemoNos([]);
                        refreshMemos();
                    } else {
                        toast.error(res.message || "Failed to approve memo(s)");
                    }
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    }, [triggerAlert, refreshMemos]);

    const handleReject = useCallback((memoNos: string[]) => {
        const isBulk = memoNos.length > 1;
        triggerAlert({
            title: isBulk ? "Bulk Reject Memos" : "Reject Memo",
            description: `Are you sure you want to reject ${isBulk ? `${memoNos.length} selected memos` : `memo ${memoNos[0]}`}? Rejected memos will be returned to Draft status.`,
            variant: "destructive",
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const res = await MemoApprovalService.rejectMemos(memoNos);
                    if (res.success) {
                        toast.success(isBulk ? "Selected memos rejected successfully" : "Memo rejected successfully");
                        setSelectedMemoNos([]);
                        refreshMemos();
                    } else {
                        toast.error(res.message || "Failed to reject memo(s)");
                    }
                } finally {
                    setIsSubmitting(false);
                }
            }
        });
    }, [triggerAlert, refreshMemos]);

    return {
        memos: filteredMemos,
        companies,
        isLoading,
        selectedMemoNos,
        searchQuery,
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        issuedByFilter,
        setIssuedByFilter,
        targetCompanyFilter,
        setTargetCompanyFilter,
        isSubmitting,
        alertDialogConfig,
        setAlertDialogConfig,
        handleSearch,
        handleSelectRow,
        handleSelectAll,
        handleViewDetails,
        handleApprove,
        handleReject
    };
}
