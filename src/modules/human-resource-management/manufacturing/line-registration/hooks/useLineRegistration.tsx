"use client";

import { useState } from "react";
import { useLineRegistrationFetchContext } from "../providers/fetchProvider";
import type { ManufacturingLine, LinePosition, LineFormValues, PositionFormValues } from "../types";
import { LineRegistrationService } from "../services/LineRegistrationService";
import { toast } from "sonner";

export function useLineRegistration() {
    const { lines, isLoading, addLine, updateLine, removeLine, refetch } =
        useLineRegistrationFetchContext();

    // ── Line dialog state ────────────────────────────────────────
    const [isLineDialogOpen, setIsLineDialogOpen] = useState(false);
    const [selectedLine, setSelectedLine] = useState<ManufacturingLine | null>(null);

    // ── Position management dialog state ─────────────────────────
    const [isPositionMgmtOpen, setIsPositionMgmtOpen] = useState(false);
    const [managedLine, setManagedLine] = useState<ManufacturingLine | null>(null);
    const [positions, setPositions] = useState<LinePosition[]>([]);
    const [isPositionsLoading, setIsPositionsLoading] = useState(false);

    // ── Position add/edit dialog state ───────────────────────────
    const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<LinePosition | null>(null);

    // ── Delete confirmation state ────────────────────────────────
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: "line" | "position"; item: ManufacturingLine | LinePosition } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Line Actions ─────────────────────────────────────────────

    const handleAddLine = () => {
        setSelectedLine(null);
        setIsLineDialogOpen(true);
    };

    const handleEditLine = (line: ManufacturingLine) => {
        setSelectedLine(line);
        setIsLineDialogOpen(true);
    };

    const handleRequestDeleteLine = (line: ManufacturingLine) => {
        setDeleteTarget({ type: "line", item: line });
        setIsDeleteOpen(true);
    };

    const handleSubmitLine = async (data: LineFormValues): Promise<boolean> => {
        if (selectedLine) {
            const success = await updateLine(selectedLine.id, data);
            if (success) {
                toast.success(`Updated "${data.line_name}"`);
                return true;
            } else {
                toast.error(`Failed to update "${data.line_name}"`);
                return false;
            }
        } else {
            const success = await addLine(data);
            if (success) {
                toast.success(`Registered "${data.line_name}"`);
                return true;
            } else {
                toast.error(`Failed to register "${data.line_name}"`);
                return false;
            }
        }
    };

    // ── Position Management ──────────────────────────────────────

    const handleManagePositions = async (line: ManufacturingLine) => {
        setManagedLine(line);
        setIsPositionMgmtOpen(true);
        setIsPositionsLoading(true);
        try {
            const data = await LineRegistrationService.getPositions(line.id);
            setPositions(data);
        } catch {
            toast.error("Failed to load positions");
        } finally {
            setIsPositionsLoading(false);
        }
    };

    const refreshPositions = async () => {
        if (!managedLine) return;
        setIsPositionsLoading(true);
        try {
            const data = await LineRegistrationService.getPositions(managedLine.id);
            setPositions(data);
        } catch {
            toast.error("Failed to refresh positions");
        } finally {
            setIsPositionsLoading(false);
        }
    };

    const handleAddPosition = () => {
        setSelectedPosition(null);
        setIsPositionDialogOpen(true);
    };

    const handleEditPosition = (position: LinePosition) => {
        setSelectedPosition(position);
        setIsPositionDialogOpen(true);
    };

    const handleRequestDeletePosition = (position: LinePosition) => {
        setDeleteTarget({ type: "position", item: position });
        setIsDeleteOpen(true);
    };

    const handleSubmitPosition = async (data: PositionFormValues): Promise<boolean> => {
        if (!managedLine) return false;

        if (selectedPosition) {
            const success = await LineRegistrationService.updatePosition(selectedPosition.id, data);
            if (success) {
                toast.success(`Updated position "${data.position_name}"`);
                await refreshPositions();
                return true;
            } else {
                toast.error(`Failed to update position "${data.position_name}"`);
                return false;
            }
        } else {
            const created = await LineRegistrationService.createPosition({
                ...data,
                line_id: managedLine.id,
            });
            if (created) {
                toast.success(`Added position "${data.position_name}"`);
                await refreshPositions();
                return true;
            } else {
                toast.error(`Failed to add position "${data.position_name}"`);
                return false;
            }
        }
    };

    // ── Unified Delete Confirmation ──────────────────────────────

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);

        try {
            if (deleteTarget.type === "line") {
                const line = deleteTarget.item as ManufacturingLine;
                const success = await removeLine(line.id);
                if (success) {
                    toast.success(`Deleted line "${line.line_name}"`);
                } else {
                    toast.error(`Failed to delete line "${line.line_name}"`);
                }
            } else {
                const position = deleteTarget.item as LinePosition;
                const success = await LineRegistrationService.deletePosition(position.id);
                if (success) {
                    toast.success(`Deleted position "${position.position_name}"`);
                    await refreshPositions();
                } else {
                    toast.error(`Failed to delete position "${position.position_name}"`);
                }
            }
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
            setDeleteTarget(null);
        }
    };

    return {
        // Lines
        lines,
        isLoading,
        refetch,
        isLineDialogOpen,
        setIsLineDialogOpen,
        selectedLine,
        handleAddLine,
        handleEditLine,
        handleRequestDeleteLine,
        handleSubmitLine,

        // Position management
        isPositionMgmtOpen,
        setIsPositionMgmtOpen,
        managedLine,
        positions,
        isPositionsLoading,
        handleManagePositions,
        refreshPositions,

        // Position dialog
        isPositionDialogOpen,
        setIsPositionDialogOpen,
        selectedPosition,
        handleAddPosition,
        handleEditPosition,
        handleRequestDeletePosition,
        handleSubmitPosition,

        // Delete confirmation
        isDeleteOpen,
        setIsDeleteOpen,
        deleteTarget,
        isDeleting,
        handleConfirmDelete,
    };
}
