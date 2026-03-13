---
description: Create a PDF document with a standardized company header layout
---

# Reusable PDF Layout Workflow

This workflow describes how to create a PDF document with a pre-configured header containing the company's logo, name, address, and contact details, followed by dynamic table or body content. It uses the `generatePdfLayout` function provided in `src/components/pdf-layout`.

## 1. Prerequisites (Database & API)

Ensure the `company` data is available. The database table schema (`company`) is defined as follows:

```sql
CREATE TABLE `company` (
	`company_id` INT NOT NULL AUTO_INCREMENT,
	`company_name` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_type` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_code` VARCHAR(255) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_address` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_brgy` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_city` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_province` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_zipCode` VARCHAR(20) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_registrationNumber` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_tin` VARCHAR(20) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_dateAdmitted` DATE NULL DEFAULT NULL,
	`company_contact` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_email` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_outlook` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_gmail` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_department` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`company_logo` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_facebook` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_website` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_unicode_ci',
	`company_tags` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	PRIMARY KEY (`company_id`) USING BTREE
)
COLLATE='utf8mb4_unicode_ci'
ENGINE=InnoDB
AUTO_INCREMENT=11;
```

You must fetch the company details from the following API endpoint:

**Endpoint:** `/api/pdf-layout/company` (Fetching from Directus `items/company`)

## 2. Generate PDF using AutoTable

Use the `generatePdfLayout` function and pass the fetched company data alongside your `jspdf-autotable` options. 

```tsx
import { useState } from 'react';
import { generatePdfLayout } from '@/components/pdf-layout';

export function ExamplePdfButton() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      // 1. Define Table Options (jspdf-autotable format)
      const tableOptions = {
        head: [['Name', 'Position', 'Department']],
        body: [
          ['John Doe', 'Software Engineer', 'IT'],
          ['Jane Smith', 'HR Manager', 'Human Resources'],
        ],
      };

      // 2. Generate and Download
      // The `company` header is automatically fetched from the Directus API internally!
      await generatePdfLayout({
        tableOptions,
        filename: 'employee-list.pdf',
        orientation: 'p',
      });

    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={loading}>
      {loading ? 'Generating...' : 'Download PDF Report'}
    </button>
  );
}
```

## 3. Generate PDF with Custom Body Content

If you want to render custom text/content instead of an auto-generated table, use the `renderBody` parameter.

```tsx
await generatePdfLayout({
  company: company as Company,
  filename: 'custom-report.pdf',
  renderBody: (doc, startY) => {
    // startY gives you the Y coordinate directly below the header divider line
    doc.setFontSize(12);
    doc.text('This is some generic report content.', 15, startY);
    
    doc.text('We can continue adding more text or custom rectangles.', 15, startY + 10);
    
    // return the final Y position if needed by other logic (optional)
    return startY + 20; 
  }
});
```
