---
description: Create a PDF document with a standardized company header layout
---

# Reusable PDF Layout System (V2)

This workflow describes the Unified PDF Template System, which allows users to design professional headers/footers in a Visual Designer and reuse them across all system modules via the `PdfEngine`.

## 1. Database Schema (DDL)

The system uses two primary tables. `company` provides global metadata, and `pdf_templates` stores custom layout configurations.

### Company Metadata (Directus)
```sql
CREATE TABLE `company` (
	`company_id` INT NOT NULL AUTO_INCREMENT,
	`company_name` VARCHAR(255) NULL,
	`company_address` VARCHAR(255) NULL,
	`company_brgy` VARCHAR(255) NULL,
	`company_city` VARCHAR(255) NULL,
	`company_province` VARCHAR(255) NULL,
	`company_zipCode` VARCHAR(20) NULL,
	`company_contact` VARCHAR(255) NULL,
	`company_email` VARCHAR(255) NULL,
	`company_logo` TEXT NULL, -- Base64 or URL
	PRIMARY KEY (`company_id`)
);
```

### PDF Templates Table
```sql
CREATE TABLE `pdf_templates` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL, -- e.g., 'Official Receipt', 'Employment Contract'
    `category` VARCHAR(100) DEFAULT 'general',
    `config` JSON NOT NULL, -- Stores PdfConfig (dimensions, elements, styles)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);
```

## 2. System Flow

### Design Phase
1.  **Open Designer**: Navigate to `/hrm/pdf-layout`.
2.  **Configure Canvas**: Set Paper Size (Legal, A4, etc.), Orientation, and Margins.
3.  **Add Elements**: Insert Logo, Company Info (Dynamic), or Custom Text.
4.  **Edit Typography**: Set Font Size (pt), Text Height (mm), and Line Spacing (Ratio).
5.  **Save Layout**: Templates are stored as JSON strings in the `config` column.

### Implementation Phase (Developer)
Modules use the `PdfEngine` to generate documents based on these templates.

```tsx
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";

// Example: Generating a Report with a Saved Header
const handlePrint = async () => {
    const data = { ...fetchSomeData() };
    
    const doc = await PdfEngine.generateWithFrame(
        "Official Receipt", // Template Name
        data, 
        async (pdf, startY, config) => {
            // Your module-specific body logic starts at 'startY'
            pdf.setFontSize(12);
            pdf.text("Hello World", 10, startY + 10);
            
            // AutoTable integration
            (pdf as any).autoTable({
                startY: startY + 20,
                head: [['#', 'Description']],
                body: [['1', 'General Services']],
            });
        }
---
description: Create a PDF document with a standardized company header layout
---

# Reusable PDF Layout System (V2)

This workflow describes the Unified PDF Template System, which allows users to design professional headers/footers in a Visual Designer and reuse them across all system modules via the `PdfEngine`.

## 1. Database Schema (DDL)

The system uses two primary tables. `company` provides global metadata, and `pdf_templates` stores custom layout configurations.

### Company Metadata (Directus)
```sql
CREATE TABLE `company` (
	`company_id` INT NOT NULL AUTO_INCREMENT,
	`company_name` VARCHAR(255) NULL,
	`company_address` VARCHAR(255) NULL,
	`company_brgy` VARCHAR(255) NULL,
	`company_city` VARCHAR(255) NULL,
	`company_province` VARCHAR(255) NULL,
	`company_zipCode` VARCHAR(20) NULL,
	`company_contact` VARCHAR(255) NULL,
	`company_email` VARCHAR(255) NULL,
	`company_logo` TEXT NULL, -- Base64 or URL
	PRIMARY KEY (`company_id`)
);
```

### PDF Templates Table
```sql
CREATE TABLE `pdf_templates` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL, -- e.g., 'Official Receipt', 'Employment Contract'
    `category` VARCHAR(100) DEFAULT 'general',
    `config` JSON NOT NULL, -- Stores PdfConfig (dimensions, elements, styles)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);
```

## 2. System Flow

### Design Phase
1.  **Open Designer**: Navigate to `/hrm/pdf-layout`.
2.  **Configure Canvas**: Set Paper Size (Legal, A4, etc.), Orientation, and Margins.
3.  **Add Elements**: Insert Logo, Company Info (Dynamic), or Custom Text.
4.  **Edit Typography**: Set Font Size (pt), Text Height (mm), and Line Spacing (Ratio).
5.  **Save Layout**: Templates are stored as JSON strings in the `config` column.

### Implementation Phase (Developer)
Modules use the `PdfEngine` to generate documents based on these templates.

```tsx
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";

// Example: Generating a Report with a Saved Header
const handlePrint = async () => {
    const data = { ...fetchSomeData() };
    
    const doc = await PdfEngine.generateWithFrame(
        "Official Receipt", // Template Name
        data, 
        async (pdf, startY, config) => {
            // Your module-specific body logic starts at 'startY'
            pdf.setFontSize(12);
            pdf.text("Hello World", 10, startY + 10);
            
            // AutoTable integration
            (pdf as any).autoTable({
                startY: startY + 20,
                head: [['#', 'Description']],
                body: [['1', 'General Services']],
            });
        }
    );
    
    doc.save("document.pdf");
};
```

## 3. Core Logic & Standards

### Smart Variable Mapping
The engine automatically detects `{{variable_name}}` patterns in text elements and replaces them with corresponding values from the `data` object.
*   **Logic**: Uses a global regex `/\{\{(.*?)\}\}/g` to find and trim keys before mapping.
*   **Fallback**: If a key is missing from the data, it leaves the placeholder `{{key}}` visible for debugging.

### API Proxy (Secure Integration)
To avoid CORS issues and keep the Directus `STATIC_TOKEN` server-side, all frontend calls go through a local Next.js proxy:
*   **GET/POST**: `/api/pdf/templates`
*   **PATCH/DELETE**: `/api/pdf/templates/[id]`

### 100% WYSIWYG Baseline Alignment
To match the browser's `flex items-center` exactly, the `PdfGenerator` uses a **Hybrid Baseline** calculation instead of the standard `middle` baseline:
*   **Formula**: `textY = el.y + (el.height / 2) + (capHeightMm / 2)`
*   **CapHeight**: Calculated as `~70%` of the font size. This ensures text sits in the physical center of the box regardless of the font metrics.

### DPI Calibration
*   **Standard**: 96 DPI (`1mm = 3.7795px`).
*   **Scaling**: All Designer offsets in pixels are converted to `mm` using this scale before being sent to the PDF engine.

### Units Sync
*   **Font Size**: Settable in `pt` (standard) or `mm` (physical height), synced with the conversion `1pt = 0.3528mm`.

## 4. Key Components
| Component | Purpose |
| :--- | :--- |
| `PdfDesigner.tsx` | The Visual Editor (Draggable/Resizable elements). |
| `PdfSidebar.tsx` | UI Controls for styling and configuration. |
| `PdfEngine.ts` | The bridge for other modules to load/apply templates. |
| `PdfGenerator.ts` | The low-level `jsPDF` rendering engine. |
| `pdfTemplateService.ts`| Data fetching layer (CRUD). |
| `PdfEditor.tsx` | The wrapper that manages state and template loading. |
