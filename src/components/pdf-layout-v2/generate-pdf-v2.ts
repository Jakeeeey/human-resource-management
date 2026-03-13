import jsPDF from 'jspdf';
import { PdfV2Layout } from './types';

// Helper to load image for jsPDF
const loadImageBase64 = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
};

export const generatePdfV2 = async (layout: PdfV2Layout, filename: string = 'layout-v2.pdf') => {
    const doc = new jsPDF({
        orientation: layout.pageSize.width > layout.pageSize.height ? 'l' : 'p',
        unit: 'mm',
        format: [layout.pageSize.width, layout.pageSize.height],
    });

    for (const el of layout.elements) {
        if (el.type === 'image' && el.content) {
            try {
                const img = await loadImageBase64(el.content);
                doc.addImage(img, 'PNG', el.x, el.y, el.width, el.height);
            } catch (e) {
                console.error('Could not add image to PDF', e);
            }
        } else if (el.type === 'text' && el.content) {
            doc.setFont('helvetica', el.fontWeight || 'normal');
            doc.setFontSize(el.fontSize || 10);

            // Centered text inside the defined box
            const centerX = el.x + (el.width / 2);
            const centerY = el.y + (el.height / 2) + (el.fontSize || 10) * 0.12; // 0.12 is approx factor for helvetica baseline

            doc.text(el.content, centerX, centerY, { align: 'center' });
        } else if (el.type === 'line') {
            const thicknessInMm = (el.thickness || 1) * 0.352778; // Convert pt to mm
            doc.setLineWidth(thicknessInMm);
            doc.setDrawColor(el.color || '#000000');
            // Vertical center of the defined line height area (usually minimal height)
            const lineY = el.y + (el.height / 2);
            doc.line(el.x, lineY, el.x + el.width, lineY);
        }
    }

    doc.save(filename);
};
