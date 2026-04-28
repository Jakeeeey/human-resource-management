"use client";

import React from "react";
import { UserConfigurationFetchProvider } from "./providers/fetchProvider";
import { useUserConfiguration } from "./hooks/useUserConfiguration";
import { UserConfigurationTable } from "./components/UserConfigurationTable";
import { PermissionsDialog } from "./components/PermissionsDialog";

const UserConfigurationContent = () => {
    const {
        users,
        subsystems,
        isLoading,
        currentPage,
        totalCount,
        pageSize,
        isPermissionsOpen,
        setIsPermissionsOpen,
        activeUser,
        activeSubsystem,
        searchTerm,
        fetchPage,
        handleToggleAccess,
        handleConfigure,
        handleUpdatePermissions,
    } = useUserConfiguration();

    return (
        <div className="flex-1 space-y-6 p-6 pt-8 bg-gradient-to-br from-background via-background to-primary/[0.02] h-full overflow-auto">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter">User Configuration</h2>
                    <p className="text-muted-foreground">
                        Manage subsystem access permissions for each user.
                    </p>
                </div>
            </div>

            <UserConfigurationTable
                data={users}
                subsystems={subsystems}
                onToggleAccess={handleToggleAccess}
                onConfigure={handleConfigure}
                isLoading={isLoading}
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                searchTerm={searchTerm}
                onPageChange={(page, quiet, search) => fetchPage(page, quiet, search)}
            />

            <PermissionsDialog
                open={isPermissionsOpen}
                onOpenChange={setIsPermissionsOpen}
                user={activeUser}
                subsystem={activeSubsystem}
                authorizedSubsystemIds={activeUser?.authorized_subsystem_ids || []}
                authorizedModuleIds={activeUser?.authorized_module_ids || []}
                onUpdate={handleUpdatePermissions}
            />
        </div>
    );
};

export const UserConfigurationModule = () => {
    return (
        <UserConfigurationFetchProvider>
            <UserConfigurationContent />
        </UserConfigurationFetchProvider>
    );
};
