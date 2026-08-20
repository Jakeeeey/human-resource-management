import { useContext, useState, useCallback, useRef } from "react";
import { MemoReleasingContext } from "../providers/MemoReleasingProvider";
import { MemoReleasingService } from "../services/MemoReleasingService";
import { Memo } from "../types";
import { SyncItem } from "../components/MemoSyncProgressDialog";
import { toast } from "sonner";

export function useMemoReleasing() {
    const context = useContext(MemoReleasingContext);
    if (context === undefined) {
        throw new Error("useMemoReleasing must be used within a MemoReleasingProvider");
    }

    const { memos, companies, isLoading, refreshMemos } = context;

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Sync Checklist states
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [activeMemoNo, setActiveMemoNo] = useState("");
    const [localReleaseStatus, setLocalReleaseStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
    const [syncItems, setSyncItems] = useState<SyncItem[]>([]);

    const syncItemsRef = useRef<SyncItem[]>([]);
    const updateSyncItemStatus = useCallback((companyId: number, status: SyncItem["status"], error?: string) => {
        const updated = syncItemsRef.current.map((item) => {
            if (item.companyId === companyId) {
                return { ...item, status, error };
            }
            return item;
        });
        syncItemsRef.current = updated;
        setSyncItems(updated);
    }, []);

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
        refreshMemos(query);
    }, [refreshMemos]);

    const handleViewDetails = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsDetailsOpen(true);
    }, []);

    const runSyncFlow = useCallback(async (memoNo: string) => {
        setActiveMemoNo(memoNo);
        setIsSyncModalOpen(true);
        setLocalReleaseStatus("running");
        setSyncItems([]);
        syncItemsRef.current = [];

        const currentMemo = memos.find((m) => m.memo_no === memoNo);
        const isPartiallyReleased = currentMemo?.status === "Partially Released";

        let targetIds: number[] = [];
        if (isPartiallyReleased) {
            setLocalReleaseStatus("success");
            targetIds = currentMemo?.company_ids || [];
        } else {
            // 1. Release locally first
            const localRes = await MemoReleasingService.releaseLocal(memoNo);
            if (!localRes.success) {
                setLocalReleaseStatus("failed");
                toast.error(localRes.message || "Failed to update local status to Released");
                return;
            }
            setLocalReleaseStatus("success");
            toast.success("Memo status updated to Released locally");
            targetIds = localRes.company_ids || [];
        }

        // 2. Resolve mapped target company IDs
        const initialItems: SyncItem[] = targetIds.map((cId) => {
            const found = companies.find((c) => Number(c.company_id) === Number(cId));
            return {
                companyId: cId,
                companyName: found ? found.company_name : `Company ID ${cId}`,
                companyCode: found ? found.company_code : `ID ${cId}`,
                status: "pending" as const
            };
        });

        syncItemsRef.current = initialItems;
        setSyncItems(initialItems);

        // 3. Sync each target company remote database sequentially
        let successCount = 0;
        for (const item of initialItems) {
            updateSyncItemStatus(item.companyId, "syncing");
            const syncRes = await MemoReleasingService.syncCompany(memoNo, item.companyId);
            if (syncRes.success) {
                updateSyncItemStatus(item.companyId, "success");
                successCount++;
            } else {
                updateSyncItemStatus(item.companyId, "failed", syncRes.message || "Sync failed");
            }
        }

        const finalStatus = successCount === targetIds.length ? "Released" : "Partially Released";
        await MemoReleasingService.updateSyncStatus(memoNo, successCount, finalStatus);
        refreshMemos(searchQuery);
    }, [memos, companies, searchQuery, refreshMemos, updateSyncItemStatus]);

    const handleRelease = useCallback((memoNo: string) => {
        const currentMemo = memos.find((m) => m.memo_no === memoNo);
        const isPartiallyReleased = currentMemo?.status === "Partially Released";
        
        triggerAlert({
            title: isPartiallyReleased ? "Retry Syncing Memo" : "Release Memo",
            description: isPartiallyReleased 
                ? `Are you sure you want to retry syncing memo ${memoNo} to target companies remote databases?`
                : `Are you sure you want to release memo ${memoNo}? Releasing will distribute and synchronize this memo to all target companies remote databases.`,
            variant: "default",
            onConfirm: async () => {
                await runSyncFlow(memoNo);
            }
        });
    }, [triggerAlert, memos, runSyncFlow]);

    const retrySyncCompany = async (companyId: number) => {
        updateSyncItemStatus(companyId, "syncing");
        const syncRes = await MemoReleasingService.syncCompany(activeMemoNo, companyId);
        if (syncRes.success) {
            updateSyncItemStatus(companyId, "success");
            toast.success("Remote synchronization succeeded on retry");
        } else {
            updateSyncItemStatus(companyId, "failed", syncRes.message || "Sync failed");
            toast.error(syncRes.message || "Retry sync failed");
        }

        // Update DB status after retry
        const currentItems = syncItemsRef.current;
        const successCount = currentItems.filter((item) => item.status === "success").length;
        const totalCount = currentItems.length;
        const finalStatus = successCount === totalCount ? "Released" : "Partially Released";

        await MemoReleasingService.updateSyncStatus(activeMemoNo, successCount, finalStatus);
        refreshMemos(searchQuery);
    };

    const handleSyncModalClose = (open: boolean) => {
        setIsSyncModalOpen(open);
        // Refresh memos when checklist closes
        refreshMemos(searchQuery);
    };

    return {
        memos,
        companies,
        isLoading,
        searchQuery,
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        alertDialogConfig,
        setAlertDialogConfig,
        handleSearch,
        handleViewDetails,
        handleRelease,

        // Progress Dialog exports
        isSyncModalOpen,
        activeMemoNo,
        localReleaseStatus,
        syncItems,
        retrySyncCompany,
        handleSyncModalClose
    };
}
