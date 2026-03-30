---
description: PDF Layout V3 - Reusable Template System
---
# PDF Layout V3 Workflow

This workflow documents the setup, database schema, and integration steps for the reusable PDF Template System.

## 1. Database Schema (DDL)
Run this in your database (MySQL) to support template persistence.

```sql
CREATE TABLE pdf_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'header', 'footer', 'payroll'
    config JSON NOT NULL,           -- Stores coordinates, fonts, and styles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 2. Project Architecture
The system is separated into a **Designer** (Admin UI) and a **Portable Engine** (Generation Logic).

### Global Engine (Reused by any module/project)
- **Path**: `src/components/pdf-engine-v3/`
- **Files**:
    - `PdfEngine.ts`: The main API for developers (`generateWithFrame`).
    - `PdfGenerator.ts`: Core rendering engine using jsPDF.
    - `services/pdf-template.ts`: CRUD operations for templates.
    - `types.ts` & `constants.ts`: Shared definitions.

### Designer Module (For creating templates)
- **Path**: `src/modules/human-resource-management/pdf-layout-v3/`
- **Page**: `src/app/(human-resource-management)/hrm/pdf-layout-v3/page.tsx`

### API Proxy (Secure Directus Connection)
- **Path**: `src/app/api/pdf-templates/`
- **Purpose**: Bypasses CORS and secures the `DIRECTUS_STATIC_TOKEN`.

## 3. How to Use in Other Modules (e.g., SCM or Payroll)

### Step 1: Copy Core Folders
If starting a new project, copy these from the HRM project:
1. `src/components/pdf-engine-v3/`
2. `src/app/api/pdf-templates/`

### Step 2: Sync Environment Variables
Ensure `.env.local` has:
```env
NEXT_PUBLIC_API_BASE_URL=...
DIRECTUS_STATIC_TOKEN=...
```

### Step 3: Implement Printing
Use the `PdfEngine` in your module logic.

```typescript
import { PdfEngine } from "@/components/pdf-engine-v3/PdfEngine";

/**
 * Example function to print an invoice using a designed header.
 */
const handlePrintInvoice = async (invoiceData) => {
    // 1. Specify the template name saved in the Designer
    const templateName = "Official Header"; 
    
    // 2. Data for Header/Footer (supports {{variable}} mapping)
    const data = { 
        ...invoiceData, 
        company_name: "Vertex Systems" 
    };

    // 3. Generate the PDF!
    const doc = await PdfEngine.generateWithFrame(templateName, data, (doc, startY) => {
        // startY is the offset after the header. Safe to draw here.
        doc.text("INVOICE #12345", 10, startY + 10);
        
        // Use jspdf-autotable or custom doc.text for your body content
        // doc.autoTable({ startY: startY + 15, ... });
    });

    doc.save("Document.pdf");
};
```

## 4. Key Logic Summary
- **Smart Mapping**: In the Designer, a text field with `{{fullname}}` will automatically be replaced by `data.fullname` during generation.
- **Auto-Offset**: `PdfEngine` detects the bottom-most element of the template and returns it as `startY`, so your body content never overlaps with the branding.
- **CORS Bypass**: Always call the template service via the local `/api/pdf-templates` proxy to avoid browser security blocks.
