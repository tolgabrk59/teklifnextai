/**
 * PDF Oluşturma Modülü
 * jsPDF ve jspdf-autotable kullanarak Proforma Fatura şablonu oluşturur.
 */

const PDFGenerator = {
    async generate(quote, customer) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // --- CONFIGURATION ---
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const primaryColor = [27, 78, 164];
            const textColor = [50, 50, 50];

            // Helper Functions
            const formatMoney = (amount, currency) => {
                const symbols = { USD: '$', EUR: '€', TRY: '₺', GBP: '£' };
                const symbol = symbols[currency] || currency + ' ';
                const val = parseFloat(amount);
                if (isNaN(val)) return symbol + '0.00';
                return symbol + val.toFixed(2);
            };

            const formatDateStr = (dateStr) => {
                if (!dateStr) return '-';
                const date = new Date(dateStr);
                return date.toLocaleDateString('tr-TR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });
            };

            // Remove Turkish special characters for PDF compatibility
            const removeTurkishChars = (str) => {
                if (!str) return '';
                return str
                    .replace(/İ/g, 'I')
                    .replace(/ı/g, 'i')
                    .replace(/i/g, 'i')  // Keep regular 'i' as 'i'
                    .replace(/Ğ/g, 'G')
                    .replace(/ğ/g, 'g')
                    .replace(/Ü/g, 'U')
                    .replace(/ü/g, 'u')
                    .replace(/Ş/g, 'S')
                    .replace(/ş/g, 's')
                    .replace(/Ö/g, 'O')
                    .replace(/ö/g, 'o')
                    .replace(/Ç/g, 'C')
                    .replace(/ç/g, 'c');
            };

            // Truncate text to first N words
            const truncateToWords = (str, wordCount = 2) => {
                if (!str) return '-';
                const words = str.trim().split(/\s+/);
                if (words.length <= wordCount) return str;
                return words.slice(0, wordCount).join(' ');
            };

            // Load Logo
            const loadImage = (url) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
            };
            const logoImg = await loadImage('images/logo.png');

            // Use Helvetica (built-in, always works)
            doc.setFont('helvetica');

            // --- HEADER ---
            let y = 20;

            if (logoImg) {
                const logoWidth = 50;
                const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                doc.addImage(logoImg, 'PNG', pageWidth - margin - logoWidth, y - 5, logoWidth, logoHeight);
            } else {
                doc.setFontSize(18);
                doc.setTextColor(...primaryColor);
                doc.text('NEXT AI', pageWidth - margin, y, { align: 'right' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(40, 40, 40);
            doc.text('TEKLIF MEKTUBU', margin, y + 5);

            y += 20;
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, margin + 80, y);

            y += 7;
            doc.setFontSize(9);
            doc.setTextColor(...textColor);

            doc.setFont('helvetica', 'bold');
            doc.text('Teklif No:', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(quote.quoteNumber, margin + 40, y);

            y += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Tarih:', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDateStr(quote.createdAt), margin + 40, y);

            y += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Gecerlilik:', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(quote.validDays + ' gun', margin + 40, y);

            y += 10;

            // --- CUSTOMER INFO SECTION ---
            doc.setFillColor(...primaryColor);
            doc.rect(margin, y, pageWidth - (2 * margin), 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('MUSTERI BILGILERI', margin + 2, y + 5);

            y += 7;
            const infoBoxHeight = 35;
            doc.setDrawColor(...primaryColor);
            doc.rect(margin, y, pageWidth - (2 * margin), infoBoxHeight);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);

            let startY = y + 7;
            let leftColX = margin + 5;
            let rightColX = pageWidth / 2 + 5;

            doc.setFont('helvetica', 'bold');
            doc.text('Firma:', leftColX, startY);
            doc.setFont('helvetica', 'normal');
            doc.text(removeTurkishChars(truncateToWords(customer.company || customer.name || '-', 2)), leftColX + 25, startY);

            startY += 6;
            doc.setFont('helvetica', 'bold');
            doc.text('Adres:', leftColX, startY);
            doc.setFont('helvetica', 'normal');
            const addr = customer.address || '-';
            doc.text(addr.substring(0, 40), leftColX + 25, startY);

            startY += 6;
            doc.setFont('helvetica', 'bold');
            doc.text('Telefon:', leftColX, startY);
            doc.setFont('helvetica', 'normal');
            doc.text(customer.phone || '-', leftColX + 25, startY);

            startY += 6;
            doc.setFont('helvetica', 'bold');
            doc.text('Yetkili:', leftColX, startY);
            doc.setFont('helvetica', 'normal');
            doc.text(removeTurkishChars(truncateToWords(customer.name || '-', 2)), leftColX + 25, startY);

            startY = y + 7;
            doc.setFont('helvetica', 'bold');
            doc.text('E-posta:', rightColX, startY);
            doc.setFont('helvetica', 'normal');
            doc.text(customer.email || '-', rightColX + 15, startY);

            y += infoBoxHeight + 5;

            // --- TABLE ---
            const tableHeaders = [['ACIKLAMA', 'MIKTAR', 'BIRIM', 'BIRIM FIYAT', 'TUTAR']];
            const tableData = quote.items.map(item => [
                removeTurkishChars(item.productCode + ' - ' + item.productName),
                item.quantity,
                item.unit,
                formatMoney(item.unitPrice, quote.currency),
                formatMoney(item.quantity * item.unitPrice, quote.currency)
            ]);

            doc.autoTable({
                startY: y,
                head: tableHeaders,
                body: tableData,
                theme: 'striped',
                headStyles: {
                    fillColor: primaryColor,
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: [50, 50, 50],
                    minCellHeight: 6,
                    overflow: 'ellipsize'
                },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 90 },
                    1: { halign: 'center', cellWidth: 20 },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'right', cellWidth: 25 },
                    4: { halign: 'right', cellWidth: 25 }
                },
                alternateRowStyles: { fillColor: [245, 248, 255] },
                margin: { left: margin, right: margin }
            });

            y = doc.lastAutoTable.finalY + 5;

            // --- TOTALS ---
            const totalsWidth = 70;
            const rightStart = pageWidth - margin - totalsWidth;
            const rowHeight = 7;
            let currentTotalY = y;

            // Calculate KDV
            const subtotal = quote.total;
            const kdvRate = 0.20;
            const kdvAmount = subtotal * kdvRate;
            const grandTotal = subtotal + kdvAmount;

            // Ara Toplam (Subtotal)
            doc.setFont('helvetica', 'bold');
            doc.text('ARA TOPLAM:', rightStart + 2, currentTotalY + 5);
            doc.setFont('helvetica', 'normal');
            doc.text(formatMoney(subtotal, quote.currency), pageWidth - margin - 2, currentTotalY + 5, { align: 'right' });

            currentTotalY += rowHeight;
            doc.setDrawColor(200, 200, 200);
            doc.line(rightStart, currentTotalY, pageWidth - margin, currentTotalY);

            // KDV (%20)
            currentTotalY += 2;
            doc.setFont('helvetica', 'bold');
            doc.text('KDV (%20):', rightStart + 2, currentTotalY + 5);
            doc.setFont('helvetica', 'normal');
            doc.text(formatMoney(kdvAmount, quote.currency), pageWidth - margin - 2, currentTotalY + 5, { align: 'right' });

            currentTotalY += rowHeight;
            doc.setDrawColor(200, 200, 200);
            doc.line(rightStart, currentTotalY, pageWidth - margin, currentTotalY);
            currentTotalY += 2;

            // Genel Toplam (Grand Total with KDV)
            doc.setFillColor(...primaryColor);
            doc.rect(rightStart, currentTotalY, totalsWidth, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('GENEL TOPLAM:', rightStart + 5, currentTotalY + 7);
            doc.text(formatMoney(grandTotal, quote.currency), pageWidth - margin - 2, currentTotalY + 7, { align: 'right' });

            // --- NOTES ---
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            let leftY = y + 5;

            doc.setFont('helvetica', 'bold');
            doc.text('Teslimat:', margin, leftY);
            doc.setFont('helvetica', 'normal');
            doc.text('Stoktan Teslim', margin + 30, leftY);

            leftY += 6;
            doc.setFont('helvetica', 'bold');
            doc.text('Odeme:', margin, leftY);
            doc.setFont('helvetica', 'normal');
            doc.text('Pesin / Havale', margin + 30, leftY);

            if (quote.notes) {
                leftY += 6;
                doc.setFont('helvetica', 'bold');
                doc.text('Notlar:', margin, leftY);
                doc.setFont('helvetica', 'normal');
                const notesLines = doc.splitTextToSize(quote.notes, rightStart - margin - 10);
                doc.text(notesLines, margin + 30, leftY);
                leftY += (notesLines.length * 5);
            }

            y = Math.max(currentTotalY + 15, leftY + 10);

            // --- SIGNATURE ---
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Musteri Adi Soyadi - Kase ve Imza:', margin, y);
            doc.rect(margin, y + 2, 70, 20);

            // --- BANK INFO ---
            const footerY = pageHeight - 40;
            const colW = (pageWidth - (2 * margin)) / 2; // 2 columns now

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('TL HESAP BILGILERI', margin, footerY);
            doc.text('USD HESAP BILGILERI', margin + colW, footerY);

            doc.setDrawColor(0, 0, 0);
            doc.rect(margin, footerY + 2, pageWidth - (2 * margin), 25);
            doc.line(margin + colW, footerY + 2, margin + colW, footerY + 27);

            const bankStartY = footerY + 7;
            const addBankInfo = (x, iban) => {
                doc.setFont('helvetica', 'bold');
                doc.text('Banka:', x + 2, bankStartY);
                doc.setFont('helvetica', 'normal');
                doc.text('Garanti BBVA', x + 18, bankStartY);

                doc.setFont('helvetica', 'bold');
                doc.text('IBAN:', x + 2, bankStartY + 5);
                doc.setFont('helvetica', 'normal');
                doc.text(iban, x + 18, bankStartY + 5);

                doc.setFont('helvetica', 'bold');
                doc.text('Sube:', x + 2, bankStartY + 10);
                doc.setFont('helvetica', 'normal');
                doc.text('Corlu', x + 18, bankStartY + 10);
            };

            addBankInfo(margin, 'TR88 0006 2001 4650 0006 2961 33');
            addBankInfo(margin + colW, 'TR23 0006 2001 4650 0009 0820 76');

            // --- BOTTOM STRIP ---
            doc.setFillColor(...primaryColor);
            doc.rect(margin, pageHeight - 10, pageWidth - (2 * margin), 5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('Next AI Teknoloji Yazilim San. ve Tic.Ltd.Sti.', pageWidth / 2, pageHeight - 6.5, { align: 'center' });

            doc.save('Teklif_' + quote.quoteNumber + '.pdf');
            showToast('PDF indirildi', 'success');

        } catch (error) {
            console.error('PDF Olusturma Hatasi:', error);
            alert('PDF olusturulurken bir hata olustu: ' + error.message);
        }
    }
};
