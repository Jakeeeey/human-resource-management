/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import { 
  Laptop, 
  Plus, 
  Search, 
  Loader2,
  AlertCircle,
  MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { User, AssetAndEquipment, AssetAssignment, Department, Company } from "../types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  getEmployeeAssetsDirectus,
  getAvailableAssetsDirectus,
  assignAssetToEmployeeDirectus,
  getItemsDirectus,
  getEmployeeAssetAssignmentsDirectus,
  getAllAssetAssignmentsDirectus,
  returnAssetDirectus,
  getCompanyDataDirectus
} from "../providers/directusProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmployeeAssetsTabProps {
  user: User;
  departments?: Department[];
}

export function EmployeeAssetsTab({ user, departments = [] }: EmployeeAssetsTabProps) {
  const [assignedAssets, setAssignedAssets] = useState<AssetAndEquipment[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AssetAndEquipment[]>([]);
  const [userAssignments, setUserAssignments] = useState<AssetAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<AssetAssignment[]>([]);
  const [itemsList, setItemsList] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<AssetAndEquipment | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [receiptPdfUrl, setReceiptPdfUrl] = useState<string | null>(null);
  const [isMultiReceiptModalOpen, setIsMultiReceiptModalOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  
  // Return form state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedAssetForReturn, setSelectedAssetForReturn] = useState<AssetAndEquipment | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [returnFormData, setReturnFormData] = useState({
    status: "Returned",
    condition: "Good",
    notes: ""
  });

  // Form state for new assignment
  const [newAssignment, setNewAssignment] = useState({
    assetId: "",
    expectedReturnDate: "",
    notes: ""
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function loadData() {
    setIsLoading(true);
    try {
      const userAssignments = await getEmployeeAssetAssignmentsDirectus(user.id);
      const historyIds = Array.from(new Set(userAssignments.map(a => a.asset_id)));
    
      const [assigned, available, allItems, companies, totalAssignments] = await Promise.all([
        getEmployeeAssetsDirectus(user.id, historyIds),
        getAvailableAssetsDirectus(),
        getItemsDirectus(),
        getCompanyDataDirectus(),
        getAllAssetAssignmentsDirectus()
      ]);
      setAssignedAssets(assigned);
      setAvailableAssets(available);
      setItemsList(allItems);
      setUserAssignments(userAssignments);
      setAllAssignments(totalAssignments);
      if (companies && companies.length > 0) {
        setCompanyData(companies[0]);
      }
    } catch (error) {
      console.error("Failed to load assets data:", error);
      toast.error("Failed to load assets");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssign() {
    if (!newAssignment.assetId) {
        toast.error("Please select an asset to assign");
        return;
    }

    const selectedAsset = availableAssets.find(a => a.id.toString() === newAssignment.assetId);
    if (!selectedAsset) return;

    setIsAssigning(true);
    try {
      await assignAssetToEmployeeDirectus({
        asset_id: selectedAsset.id,
        user_id: user.id,
        expected_return_date: newAssignment.expectedReturnDate || null,
        condition_on_assignment: selectedAsset.condition,
        notes: newAssignment.notes
      });

      toast.success("Asset assigned successfully");
      setIsAssignModalOpen(false);
      setNewAssignment({
        assetId: "",
        expectedReturnDate: "",
        notes: ""
      });
      loadData();
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign asset");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleReturn() {
    if (!selectedAssetForReturn) return;

    const assetAssignments = userAssignments
      .filter(a => a.asset_id === selectedAssetForReturn.id)
      .sort((a, b) => new Date(b.assigned_date || 0).getTime() - new Date(a.assigned_date || 0).getTime());
    
    const latestAssignment = assetAssignments[0];
    if (!latestAssignment || !latestAssignment.assignment_id) {
      toast.error("No active assignment found to return");
      return;
    }

    setIsReturning(true);
    try {
      await returnAssetDirectus({
        assignment_id: latestAssignment.assignment_id,
        asset_id: selectedAssetForReturn.id,
        assignment_status: returnFormData.status,
        condition_on_return: returnFormData.condition,
        actual_return_date: new Date().toISOString(),
        notes: returnFormData.notes
      });

      toast.success("Asset returned successfully");
      setIsReturnModalOpen(false);
      loadData();
    } catch (error) {
      console.error("Return error:", error);
      toast.error("Failed to return asset");
    } finally {
      setIsReturning(false);
    }
  }

  const getItemName = (itemId: number | undefined): string => {
    if (!itemId) return "Unknown Item";
    const found = itemsList.find(i => i.id === itemId);
    return (found?.item_name as string) || "Unknown Item";
  };

  const generateReceiptPdf = async (assets: AssetAndEquipment[]) => {
    const doc = new jsPDF();
    const baseUrl = "/api/hrm/employee-admin/employee-master-list";
    
    try {
      // Use company logo from Directus if available, otherwise fallback
      const logoId = companyData?.company_logo;
      const logoUrl = logoId 
        ? `${baseUrl}/assets/${logoId}`
        : '/vertex_logo_receipt.png';
        
      const response = await fetch(logoUrl);
      if (!response.ok) throw new Error("Logo fetch failed");
      const blob = await response.blob();
      const base64data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Modern Header Design
      // Logo on the left
      doc.addImage(base64data, 'PNG', 14, 6, 45, 20); // Maintain a professional size
      
      // Company Info on the right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(33, 37, 41);
      doc.text((companyData?.company_name || "VERTEX TECHNOLOGIES CORPORATION").toUpperCase(), 65, 16);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      
      // Build address parts
      const addrParts = [
        companyData?.company_address,
        companyData?.company_brgy,
        companyData?.company_city,
        companyData?.company_province,
        companyData?.company_zipCode
      ].filter(Boolean);
      
      const fullAddress = addrParts.length > 0 ? addrParts.join(", ") : "Digital Hub, Quezon City, Philippines";
      doc.text(fullAddress, 65, 21);
      
      const contactParts = [];
      if (companyData?.company_contact) contactParts.push(`Tel: ${companyData.company_contact}`);
      if (companyData?.company_email) contactParts.push(`Email: ${companyData.company_email}`);
      if (companyData?.company_website) contactParts.push(`Web: ${companyData.company_website}`);
      
      doc.text(contactParts.join(" | "), 65, 25);

      // Horizontal line separator
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(14, 30, 196, 30);

    } catch(err) {
      console.error("Could not add logo", err);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text((companyData?.company_name || "VERTEX TECHNOLOGIES CORPORATION").toUpperCase(), 105, 18, { align: "center" });
    }

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("ACKNOWLEDGEMENT RECEIPT", 105, 42, { align: "center" });

    // Body
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const fullName = `${user.firstName} ${user.lastName}`;
    const dateStr = new Date().toLocaleDateString();
    const deptNameStr = departments?.find(d => d.department_id === user.department)?.department_name || "               ";
    
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    let currentX = 14;
    const line1Y = 52; // Adjusted for new header
    
    const fullFirstLineWidth = doc.getTextWidth(`This is to acknowledge that  `) + doc.getTextWidth(fullName) + 4 + doc.getTextWidth(`  of`);
    
    if (14 + fullFirstLineWidth > 195) {
      doc.text("This is to acknowledge that ", currentX, line1Y);
      currentX += doc.getTextWidth("This is to acknowledge that ");
      
      const nameWidth = doc.getTextWidth(fullName) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(fullName, currentX + 2, line1Y);
      doc.setFont("helvetica", "normal");
      currentX += nameWidth + 2;

      let line2X = 14;
      const line2YOffset = 60;
      
      doc.text("of ", line2X, line2YOffset);
      line2X += doc.getTextWidth("of ");
      
      const deptWidth = doc.getTextWidth(deptNameStr) + 4; 
      doc.setFont("helvetica", "bold");
      doc.text(deptNameStr, line2X + 2, line2YOffset);
      doc.setFont("helvetica", "normal");
      line2X += deptWidth + 2;
      
      doc.text(" department has received the following items(s)", line2X, line2YOffset);

      let currentX3 = 14;
      const line3Y = 68;
      doc.text("from Vertex Technologies Corporation on this day, ", currentX3, line3Y);
      currentX3 += doc.getTextWidth("from Vertex Technologies Corporation on this day, ");
      
      const dateWidth = doc.getTextWidth(dateStr) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(dateStr, currentX3 + 2, line3Y);
      doc.setFont("helvetica", "normal");
      currentX3 += dateWidth + 2;
      
      doc.text(" at ", currentX3, line3Y);
      currentX3 += doc.getTextWidth(" at ");
      
      const timeWidth = doc.getTextWidth(timeStr) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(timeStr, currentX3 + 2, line3Y);
      doc.setFont("helvetica", "normal");
      currentX3 += timeWidth + 2;
      
      doc.text(" o'clock", currentX3, line3Y);
      
      const line4Y = 76;
      doc.text(`AM [${ampm === 'AM' ? 'X' : ' '}] PM [${ampm === 'PM' ? 'X' : ' '}]`, 14, line4Y);

      autoTable(doc, {
        startY: 84,
        head: [['Name of Item', 'Barcode', 'Serial No.', 'Quantity', 'Condition']],
        body: assets.map(asset => [
          getItemName(asset.item_id), 
          asset.barcode || "N/A", 
          asset.serial || "N/A",
          asset.quantity?.toString() || "1", 
          asset.condition || 'Good'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50] },
        styles: { minCellHeight: 12 }
      });

    } else {
      doc.text("This is to acknowledge that ", currentX, line1Y);
      currentX += doc.getTextWidth("This is to acknowledge that ");
      
      const nameWidth = doc.getTextWidth(fullName) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(fullName, currentX + 2, line1Y);
      doc.setFont("helvetica", "normal");
      currentX += nameWidth + 2;
      
      doc.text(" of ", currentX, line1Y);
      currentX += doc.getTextWidth(" of ");
      
      const deptWidth = doc.getTextWidth(deptNameStr) + 4; 
      doc.setFont("helvetica", "bold");
      doc.text(deptNameStr, currentX + 2, line1Y);
      doc.setFont("helvetica", "normal");
      currentX += deptWidth + 2;
      
      doc.text(" department has received the following items(s)", currentX, line1Y);
      
      let currentX2 = 14;
      const line2Y = 60;
      doc.text("from Vertex Technologies Corporation on this day, ", currentX2, line2Y);
      currentX2 += doc.getTextWidth("from Vertex Technologies Corporation on this day, ");
      
      const dateWidth = doc.getTextWidth(dateStr) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(dateStr, currentX2 + 2, line2Y);
      doc.setFont("helvetica", "normal");
      currentX2 += dateWidth + 2;
      
      doc.text(" at ", currentX2, line2Y);
      currentX2 += doc.getTextWidth(" at ");
      
      const timeWidth = doc.getTextWidth(timeStr) + 4;
      doc.setFont("helvetica", "bold");
      doc.text(timeStr, currentX2 + 2, line2Y);
      doc.setFont("helvetica", "normal");
      currentX2 += timeWidth + 2;
      
      doc.text(" o'clock", currentX2, line2Y);
      
      const line3Y = 68;
      doc.text(`AM [${ampm === 'AM' ? 'X' : ' '}] PM [${ampm === 'PM' ? 'X' : ' '}]`, 14, line3Y);

      autoTable(doc, {
        startY: 76,
        head: [['Name of Item', 'Barcode', 'Serial No.', 'Quantity', 'Condition']],
        body: assets.map(asset => [
          getItemName(asset.item_id), 
          asset.barcode || "N/A", 
          asset.serial || "N/A",
          asset.quantity?.toString() || "1", 
          asset.condition || 'Good'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50] },
        styles: { minCellHeight: 12 }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY + 20;

    doc.text("Received by:", 14, finalY);
    doc.text("Issued by:", 120, finalY);

    doc.text("________________________________", 14, finalY + 12);
    doc.text("________________________________", 120, finalY + 12);

    doc.text("Signature over printed name", 14, finalY + 17);
    doc.text("Signature over printed name", 120, finalY + 17);

    doc.text("Date:", 14, finalY + 23);
    doc.text("Date:", 120, finalY + 23);

    // Create a Blob URL for preview
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    setReceiptPdfUrl(pdfUrl);
    setIsReceiptModalOpen(true);
  };

  const filteredAssets = assignedAssets.filter(a => {
    const itemName = getItemName(a.item_id);
    return itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (a.serial && a.serial.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search assigned assets..." 
            className="pl-9 h-10 rounded-xl bg-muted/30 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsMultiReceiptModalOpen(true);
              setSelectedAssetIds([]);
            }}
            className="h-10 rounded-xl gap-2"
          >
            Print Receipt
          </Button>
          <Button 
            onClick={() => setIsAssignModalOpen(true)}
            className="h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2"
          >
            <Plus className="h-4 w-4" />
            Assign Asset
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading assets...</p>
          </div>
        ) : filteredAssets.length > 0 ? (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[30%] font-bold text-foreground">Asset / Item</TableHead>
                <TableHead className="font-bold text-foreground">Barcode</TableHead>
                <TableHead className="font-bold text-foreground">Serial No.</TableHead>
                <TableHead className="font-bold text-foreground">Condition</TableHead>
                <TableHead className="font-bold text-foreground">Status</TableHead>
                <TableHead className="text-right font-bold text-foreground">Date Acquired</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const assetAssignments = allAssignments.filter(a => a.asset_id === asset.id).sort((a, b) => new Date(b.assigned_date || 0).getTime() - new Date(a.assigned_date || 0).getTime());
                const assignmentStatus = assetAssignments.length > 0 ? assetAssignments[0].assignment_status : "Assigned";
                return (
                <TableRow key={asset.id} className="hover:bg-muted/20 transition-colors border-border/50">
                  <TableCell className="font-medium py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
                        {asset.item_image ? (
                          <img 
                            src={`/api/hrm/employee-admin/employee-master-list/assets/${asset.item_image}`} 
                            alt={getItemName(asset.item_id) || "Asset"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Laptop className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="truncate font-semibold">{getItemName(asset.item_id)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground font-medium bg-muted/40 px-2 py-1 rounded-md border border-border/50 shadow-sm">{asset.barcode || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{asset.serial || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                        "rounded-md px-2 py-0.5",
                        asset.condition === "Good" ? "border-green-500/20 text-green-600 bg-green-500/10" :
                        asset.condition === "Bad" ? "border-red-500/20 text-red-600 bg-red-500/10" :
                        "border-yellow-500/20 text-yellow-600 bg-yellow-500/10"
                    )}>
                      {asset.condition || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                        "rounded-md px-2 py-0.5",
                        assignmentStatus === "Assigned" ? "border-blue-500/20 text-blue-600 bg-blue-500/10" :
                        assignmentStatus === "Returned" ? "border-green-500/20 text-green-600 bg-green-500/10" :
                        assignmentStatus === "Lost" ? "border-red-500/20 text-red-600 bg-red-500/10" :
                        assignmentStatus === "Damaged" ? "border-yellow-500/20 text-yellow-600 bg-yellow-500/10" :
                        "border-gray-500/20 text-gray-600 bg-gray-500/10"
                    )}>
                      {assignmentStatus || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {asset.date_acquired ? new Date(asset.date_acquired).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px] rounded-xl">
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAssetForDetails(asset);
                            setIsDetailsModalOpen(true);
                          }} 
                          className="cursor-pointer rounded-lg"
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => generateReceiptPdf([asset])} 

                          className="cursor-pointer rounded-lg"
                        >
                          Print Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          disabled={assignmentStatus !== "Assigned"}
                          onClick={() => {
                          setSelectedAssetForReturn(asset);
                          setReturnFormData({
                            status: "Returned",
                            condition: asset.condition || "Good",
                            notes: ""
                          });
                          setIsReturnModalOpen(true);
                        }} className="cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-500/10">
                          Return Asset
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        ) : (
          <div className="p-20 flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 rounded-full bg-muted/30">
              <Laptop className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">No assigned assets</h4>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                {searchTerm 
                  ? `No matching assets for "${searchTerm}"`
                  : "Assign company laptops, phones, or other equipment to this employee."
                }
              </p>
            </div>
            {!searchTerm && (
              <Button 
                variant="outline" 
                onClick={() => setIsAssignModalOpen(true)}
                className="mt-2 rounded-xl border-dashed px-6"
              >
                Assign Equipment
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Assign Asset</DialogTitle>
            <DialogDescription>
              Assign a company asset to {user.firstName}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Select Asset <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={newAssignment.assetId}
                onValueChange={(v) => setNewAssignment({...newAssignment, assetId: v})}
              >
                <SelectTrigger className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl">
                  <SelectValue placeholder="Select available asset" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-[300px]">
                  {availableAssets.map(a => {
                    const itemName = getItemName(a.item_id);
                    const assetAssignments = allAssignments
                      .filter(assign => assign.asset_id === a.id)
                      .sort((v1, v2) => new Date(v2.assigned_date || 0).getTime() - new Date(v1.assigned_date || 0).getTime());
                    
                    const actualStatus = assetAssignments.length > 0 ? assetAssignments[0].assignment_status : "Unassigned";
                    const displayStatus = actualStatus === "Returned" ? "Available" : actualStatus;

                    return (
                      <SelectItem 
                        key={a.id} 
                        value={a.id.toString()}
                        disabled={actualStatus !== "Returned" && actualStatus !== "Unassigned"}
                        className="[&>span:last-child]:w-full pr-8"
                      >
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="truncate">{itemName} {a.serial ? `(${a.serial})` : ''}</span>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] shrink-0 ml-auto",
                              displayStatus === "Assigned" ? "text-blue-600 bg-blue-500/10 border-blue-500/20" :
                              (displayStatus === "Available" || displayStatus === "Unassigned") ? "text-green-600 bg-green-500/10 border-green-500/20" :
                              displayStatus === "Lost" ? "text-red-600 bg-red-500/10 border-red-500/20" :
                              displayStatus === "Damaged" ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/20" :
                              "text-muted-foreground bg-muted border-border"
                            )}
                          >
                            {displayStatus}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Expected Return Date (Optional)
              </Label>
              <Input 
                type="date"
                className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl"
                value={newAssignment.expectedReturnDate}
                onChange={(e) => setNewAssignment({...newAssignment, expectedReturnDate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Notes (Optional)
              </Label>
              <Input 
                placeholder="Any special remarks or conditions" 
                className="h-11 bg-muted/40 border-transparent focus-visible:bg-background rounded-xl"
                value={newAssignment.notes}
                onChange={(e) => setNewAssignment({...newAssignment, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsAssignModalOpen(false)}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              disabled={isAssigning || !newAssignment.assetId}
              onClick={handleAssign}
              className="rounded-xl h-11 px-8 bg-primary hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20 min-w-[140px]"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign Asset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          {selectedAssetForDetails && (
            <>
              <DialogHeader className="p-6 pb-0">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
                    {selectedAssetForDetails.item_image ? (
                      <img 
                        src={`/api/hrm/employee-admin/employee-master-list/assets/${selectedAssetForDetails.item_image}`} 
                        alt={getItemName(selectedAssetForDetails.item_id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Laptop className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      {getItemName(selectedAssetForDetails.item_id)}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex gap-2">
                      <Badge variant="outline" className="bg-muted">Serial: {selectedAssetForDetails.serial || "N/A"}</Badge>
                      <Badge variant="outline" className="bg-muted">Barcode: {selectedAssetForDetails.barcode || "N/A"}</Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 grid grid-cols-2 gap-6">
                <div className="space-y-4">
                   <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Condition</Label>
                    <p className="mt-1 font-medium">{selectedAssetForDetails.condition || "Unknown"}</p>
                   </div>
                   <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Date Acquired</Label>
                    <p className="mt-1 font-medium">{selectedAssetForDetails.date_acquired ? new Date(selectedAssetForDetails.date_acquired).toLocaleDateString() : "N/A"}</p>
                   </div>
                   <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Lifespan</Label>
                    <p className="mt-1 font-medium">{selectedAssetForDetails.life_span ? `${selectedAssetForDetails.life_span} months` : "N/A"}</p>
                   </div>
                   <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Cost</Label>
                    <p className="mt-1 font-medium">{selectedAssetForDetails.cost_per_item ? `₱${selectedAssetForDetails.cost_per_item.toLocaleString()}` : "N/A"}</p>
                   </div>
                </div>

                <div className="space-y-4 rounded-xl border p-4 bg-muted/10">
                  <h4 className="font-bold text-sm">Assignment Info</h4>
                  {(() => {
                    const currentAssignments = allAssignments.filter(a => a.asset_id === selectedAssetForDetails.id).sort((a, b) => new Date(b.assigned_date || 0).getTime() - new Date(a.assigned_date || 0).getTime());
                    const latestAssignment = currentAssignments[0];

                    if (!latestAssignment) {
                      return <p className="text-sm text-muted-foreground">No active assignment details found.</p>;
                    }

                    return (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <p className="font-medium text-sm">{latestAssignment.assignment_status || "Assigned"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Assigned Date</Label>
                          <p className="font-medium text-sm">{latestAssignment.assigned_date ? new Date(latestAssignment.assigned_date).toLocaleDateString() : "N/A"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Expected Return</Label>
                          <p className="font-medium text-sm">{latestAssignment.expected_return_date ? new Date(latestAssignment.expected_return_date).toLocaleDateString() : "N/A"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Condition on Assignment</Label>
                          <p className="font-medium text-sm">{latestAssignment.condition_on_assignment || "N/A"}</p>
                        </div>
                        {latestAssignment.notes && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Notes</Label>
                            <p className="font-medium text-sm italic">{latestAssignment.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <DialogFooter className="p-4 bg-muted/30 border-t">
                <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={(open) => {
        setIsReceiptModalOpen(open);
        if (!open && receiptPdfUrl) URL.revokeObjectURL(receiptPdfUrl);
      }}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden shadow-2xl rounded-2xl border-none">
          <DialogHeader className="p-4 bg-muted/40 border-b">
            <DialogTitle>Acknowledgement Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="bg-background h-[600px] w-full p-0 m-0">
            {receiptPdfUrl ? (
              <iframe 
                src={`${receiptPdfUrl}#toolbar=1&navpanes=0&scrollbar=0`} 
                className="w-full h-full border-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Multi Receipt Modal */}
      <Dialog open={isMultiReceiptModalOpen} onOpenChange={setIsMultiReceiptModalOpen}>
        <DialogContent className="sm:max-w-[500px] shadow-2xl rounded-2xl border-none p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Select Assets for Receipt</DialogTitle>
            <DialogDescription>Choose which assigned assets to include in the acknowledgement receipt.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-2 space-y-2 max-h-[400px] overflow-y-auto">
            {assignedAssets.filter(a => {
               const assetAssignments = allAssignments.filter(as => as.asset_id === a.id).sort((as1, as2) => new Date(as2.assigned_date || 0).getTime() - new Date(as1.assigned_date || 0).getTime());
               const assignmentStatus = assetAssignments.length > 0 ? assetAssignments[0].assignment_status : "Assigned";
               return assignmentStatus === "Assigned";
            }).map((asset) => (
              <div key={asset.id} className="flex items-center space-x-3 p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-muted/30 transition-colors">
                <Checkbox 
                  id={`asset-${asset.id}`} 
                  checked={selectedAssetIds.includes(asset.id)}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedAssetIds(prev => [...prev, asset.id]);
                    else setSelectedAssetIds(prev => prev.filter(id => id !== asset.id));
                  }}
                />
                <label 
                  htmlFor={`asset-${asset.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed cursor-pointer flex-1"
                >
                  {getItemName(asset.item_id)} <span className="text-muted-foreground ml-1 font-normal">{asset.serial ? `(${asset.serial})` : ''}</span>
                </label>
              </div>
            ))}
            {assignedAssets.filter(a => {
               const assetAssignments = allAssignments.filter(as => as.asset_id === a.id).sort((as1, as2) => new Date(as2.assigned_date || 0).getTime() - new Date(as1.assigned_date || 0).getTime());
               const assignmentStatus = assetAssignments.length > 0 ? assetAssignments[0].assignment_status : "Assigned";
               return assignmentStatus === "Assigned";
            }).length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No active assignments available to print.</div>
            )}
          </div>
          <DialogFooter className="p-6 bg-muted/20 border-t gap-2">
            <Button variant="ghost" onClick={() => setIsMultiReceiptModalOpen(false)}>Cancel</Button>
            <Button 
              className="bg-primary hover:bg-primary/90 rounded-xl"
              disabled={selectedAssetIds.length === 0}
              onClick={() => {
                const assetsToPrint = assignedAssets.filter(a => selectedAssetIds.includes(a.id));
                setIsMultiReceiptModalOpen(false);
                generateReceiptPdf(assetsToPrint);
              }}
            >
              Generate Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Return Asset Modal */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden shadow-2xl rounded-2xl border-none">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Return Asset
            </DialogTitle>
            <DialogDescription>
              Process the return of {selectedAssetForReturn && getItemName(selectedAssetForReturn.item_id)}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Return Status <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={returnFormData.status}
                onValueChange={(v) => setReturnFormData({...returnFormData, status: v})}
              >
                <SelectTrigger className="h-11 bg-muted/40 border-transparent rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Returned">Returned</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Disposed">Disposed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Condition on Return <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={returnFormData.condition}
                onValueChange={(v) => setReturnFormData({...returnFormData, condition: v})}
              >
                <SelectTrigger className="h-11 bg-muted/40 border-transparent rounded-xl">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Bad">Bad</SelectItem>
                  <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                  <SelectItem value="Discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                Notes
              </Label>
              <Input 
                placeholder="Optional remarks on item condition" 
                className="h-11 bg-muted/40 border-transparent rounded-xl"
                value={returnFormData.notes}
                onChange={(e) => setReturnFormData({...returnFormData, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t gap-2">
            <Button variant="ghost" className="h-11 rounded-xl" onClick={() => setIsReturnModalOpen(false)}>Cancel</Button>
            <Button 
              className="h-11 rounded-xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 px-8"
              onClick={handleReturn}
              disabled={isReturning}
            >
              {isReturning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
