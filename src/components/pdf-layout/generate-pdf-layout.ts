import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfLayoutOptions } from './types';

/**
 * Utility to load an image from a URL or Base64 string.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
};

/**
 * Generates a standard PDF layout with a company header.
 */
export const generatePdfLayout = async ({
    company: initialCompany,
    tableOptions,
    renderBody,
    filename = 'document.pdf',
    orientation = 'p',
}: PdfLayoutOptions) => {
    let company = initialCompany;

    // Fetch company data if not provided
    if (!company) {
        try {
            // NOTE: In a real Next.js app, this assumes the function is mapped in a client component 
            // where window is defined, OR we use an absolute URL if called server-side.
            // Using a relative string since PDF generation usually happens on client.
            const res = await fetch('/api/pdf-layout/company');
            if (!res.ok) throw new Error('Network response was not ok');
            const responseData = await res.json();
            // Directus array wrapping mapping
            company = responseData?.data?.[0] || responseData;

            if (!company) {
                console.warn('Fetched company but data is empty');
            }
        } catch (err) {
            console.error('Error auto-fetching company data for PDF Layout', err);
            // Fallback object to prevent crashing
            company = {
                company_id: 0,
                company_name: 'Unknown Company',
                company_address: '',
                company_code: 'ERR',
            } as any;
        }
    }

    if (!company) {
        console.error('Company data is still undefined after attempting to fetch. PDF generation aborted.');
        return;
    }

    const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let startY = 15; // Initial Y offset for content

    let finalLogoHeight = 0;

    // 1. Draw Header
    // Logo
    if (company.company_logo) {
        try {
            const img = await loadImage(company.company_logo);
            // Enforce a strict square size of 30x30 as requested
            const logoWidth = 45;
            const logoHeight = 25;

            finalLogoHeight = logoHeight;

            // Position logo on the left
            const logoX = 15;
            doc.addImage(img, 'PNG', logoX, startY, logoWidth, logoHeight);

            // Update startY based on logo height, ensuring it doesn't overlap text
            // if logo is very tall, though usually text is taller setup.
        } catch (e) {
            console.warn('Could not load company logo', e);
        }
    }

    // Determine max width for centered text so it doesn't overlap the logo. 
    // Logo (45mm) + Margin (15mm) = 60mm. Center of A4 is 105mm. 
    // (105 - 60) * 2 = 90mm max width to keep it centered and clear of the logo.
    const maxTextWidth = 90;

    // Company Information (Centered)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const companyName = company.company_name || 'Company Name';

    // text() returns an array of lines or just draws it. We want to measure it to adjust Y if it wraps.
    const splitCompanyName = doc.splitTextToSize(companyName, maxTextWidth);
    doc.text(splitCompanyName, pageWidth / 2, startY + 5, { align: 'center', maxWidth: maxTextWidth });

    // Advance Y based on how many lines the company name took
    let currentY = startY + 5 + (splitCompanyName.length * 4); // 4mm spacing for size 9

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // Format Address: address, brgy, city. province - zip
    const addressParts = [
        company.company_address,
        company.company_brgy,
        company.company_city,
    ].filter(Boolean).join(', ');

    const provZip = [
        company.company_province,
        company.company_zipCode,
    ].filter(Boolean).join(' - ');

    if (addressParts) {
        const splitAddr = doc.splitTextToSize(addressParts, maxTextWidth);
        doc.text(splitAddr, pageWidth / 2, currentY, { align: 'center', maxWidth: maxTextWidth });
        currentY += (splitAddr.length * 4);
    }

    if (provZip) {
        const splitProv = doc.splitTextToSize(provZip, maxTextWidth);
        doc.text(splitProv, pageWidth / 2, currentY, { align: 'center', maxWidth: maxTextWidth });
        currentY += (splitProv.length * 4);
    }

    // Contact Info
    if (company.company_contact) {
        doc.text(company.company_contact, pageWidth / 2, currentY, { align: 'center', maxWidth: maxTextWidth });
        currentY += 4;
    }

    if (company.company_email) {
        doc.text(company.company_email, pageWidth / 2, currentY, { align: 'center', maxWidth: maxTextWidth });
        currentY += 4;
    }

    // Draw Divider Line
    currentY += 5; // space after text
    // Ensure we clear the logo height if it's taller than the text block
    const maxHeaderHeight = Math.max(currentY, startY + finalLogoHeight + 5);
    const lineY = maxHeaderHeight;

    doc.setLineWidth(0.5);
    doc.line(15, lineY, pageWidth - 15, lineY);

    // Body content starts below the line
    const bodyStartY = lineY + 10;

    // 2. Render Body
    if (tableOptions) {
        autoTable(doc, {
            startY: bodyStartY,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            ...tableOptions,
        });
    } else if (renderBody) {
        renderBody(doc, bodyStartY);
    }

    // 3. Save PDF
    doc.save(filename);
};
