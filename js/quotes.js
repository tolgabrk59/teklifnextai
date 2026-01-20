/**
 * Teklif Yönetimi Modülü
 */

class QuoteManager {
    constructor(database) {
        this.db = database;
    }

    async add(quote) {
        // Save quote
        const quoteId = await this.db.add('quotes', quote);



        return quoteId;
    }

    async update(quote) {
        return await this.db.update('quotes', quote);
    }

    async delete(id) {
        return await this.db.delete('quotes', id);
    }

    async get(id) {
        return await this.db.get('quotes', id);
    }

    async getAll() {
        const quotes = await this.db.getAll('quotes');
        // Sort by date descending
        return quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async generateQuoteNumber() {
        return await this.db.generateQuoteNumber();
    }

    async getPriceInfo(productId, customerId) {
        const lastPrice = await this.db.getLastPriceForCustomer(productId, customerId);
        const avgPrice = await this.db.getAveragePriceForProduct(productId, customerId);

        return {
            lastPriceForCustomer: lastPrice,
            averageForOthers: avgPrice
        };
    }
}

// Quote creation state
let currentQuote = {
    customerId: null,
    customerName: '',
    items: [],
    currency: 'USD',
    validDays: 30,
    notes: ''
};

// UI Functions for Quote Management
const QuoteUI = {
    async renderList() {
        const quotes = await quoteManager.getAll();
        const tbody = document.getElementById('quotes-table-body');

        if (!tbody) return;

        if (quotes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-file-invoice"></i>
                        <p>Henüz teklif oluşturulmamış</p>
                    </td>
                </tr>
            `;
            return;
        }

        const customers = await customerManager.getAll();
        const customerMap = {};
        customers.forEach(c => customerMap[c.id] = c);

        tbody.innerHTML = quotes.map(q => {
            const customer = customerMap[q.customerId];
            const customerName = customer ? customer.name : 'Bilinmeyen';
            const statusClass = this.getStatusClass(q.status);
            const statusText = this.getStatusText(q.status);

            return `
                <tr>
                    <td><code>${escapeHtml(q.quoteNumber)}</code></td>
                    <td>${escapeHtml(customerName)}</td>
                    <td class="text-right">${formatCurrency(q.total, q.currency)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${formatDate(q.createdAt)}</td>
                    <td class="actions">
                        <button onclick="QuoteUI.view(${q.id})" class="btn-icon" title="Görüntüle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="QuoteUI.generatePDF(${q.id})" class="btn-icon" title="PDF İndir">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button onclick="QuoteUI.sendWhatsApp(${q.id})" class="btn-icon btn-success" title="WhatsApp ile Gönder">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button onclick="QuoteUI.sendEmail(${q.id})" class="btn-icon" title="E-posta ile Gönder">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button onclick="QuoteUI.delete(${q.id})" class="btn-icon btn-danger" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusClass(status) {
        const classes = {
            draft: 'status-draft',
            sent: 'status-sent',
            accepted: 'status-accepted',
            rejected: 'status-rejected'
        };
        return classes[status] || 'status-draft';
    },

    getStatusText(status) {
        const texts = {
            draft: 'Taslak',
            sent: 'Gönderildi',
            accepted: 'Kabul Edildi',
            rejected: 'Reddedildi'
        };
        return texts[status] || 'Taslak';
    },

    // Search/Filter quotes
    async filterList(query) {
        const searchTerm = query.toLowerCase().trim();
        const quotes = await quoteManager.getAll();
        const customers = await customerManager.getAll();
        const customerMap = {};
        customers.forEach(c => customerMap[c.id] = c);

        const tbody = document.getElementById('quotes-table-body');
        if (!tbody) return;

        // Filter quotes
        const filtered = searchTerm ? quotes.filter(q => {
            const customer = customerMap[q.customerId];
            const customerName = customer ? customer.name.toLowerCase() : '';
            return q.quoteNumber.toLowerCase().includes(searchTerm) ||
                customerName.includes(searchTerm) ||
                (q.notes && q.notes.toLowerCase().includes(searchTerm));
        }) : quotes;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>${searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz teklif oluşturulmamış'}</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(q => {
            const customer = customerMap[q.customerId];
            const customerName = customer ? customer.name : 'Bilinmeyen';
            const statusClass = this.getStatusClass(q.status);
            const statusText = this.getStatusText(q.status);

            return `
                <tr>
                    <td><code>${escapeHtml(q.quoteNumber)}</code></td>
                    <td>${escapeHtml(customerName)}</td>
                    <td class="text-right">${formatCurrency(q.total, q.currency)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${formatDate(q.createdAt)}</td>
                    <td class="actions">
                        <button onclick="QuoteUI.view(${q.id})" class="btn-icon" title="Görüntüle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="QuoteUI.generatePDF(${q.id})" class="btn-icon" title="PDF İndir">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button onclick="QuoteUI.sendWhatsApp(${q.id})" class="btn-icon btn-success" title="WhatsApp ile Gönder">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button onclick="QuoteUI.sendEmail(${q.id})" class="btn-icon" title="E-posta ile Gönder">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button onclick="QuoteUI.delete(${q.id})" class="btn-icon btn-danger" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async showCreateModal() {
        // Reset current quote
        currentQuote = {
            customerId: null,
            customerName: '',
            items: [],
            currency: 'USD',
            validDays: 30,
            notes: ''
        };

        // Generate quote number
        const quoteNumber = await quoteManager.generateQuoteNumber();
        document.getElementById('quote-number').value = quoteNumber;

        // Reset form
        document.getElementById('quote-customer-search').value = '';
        document.getElementById('quote-currency').value = 'USD';
        document.getElementById('quote-valid-days').value = '30';
        document.getElementById('quote-notes').value = '';

        // Clear items
        this.renderItems();
        this.updateTotal();

        Modal.show('quote-modal');
    },

    renderItems() {
        const container = document.getElementById('quote-items-container');

        if (currentQuote.items.length === 0) {
            container.innerHTML = `
                <div class="empty-items">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Henüz ürün eklenmedi</p>
                </div>
            `;
            return;
        }

        container.innerHTML = currentQuote.items.map((item, index) => `
            <div class="quote-item" data-index="${index}">
                <div class="item-info">
                    <span class="item-code">${escapeHtml(item.productCode)}</span>
                    <span class="item-name">${escapeHtml(item.productName)}</span>
                </div>
                <div class="item-details">
                    <div class="item-field">
                        <label>Miktar</label>
                        <input type="number" value="${item.quantity}" min="1" 
                               onchange="QuoteUI.updateItemQuantity(${index}, this.value)">
                        <span class="unit">${escapeHtml(item.unit)}</span>
                    </div>
                    <div class="item-field">
                        <label>Birim Fiyat</label>
                        <input type="number" value="${item.unitPrice}" min="0" step="0.01"
                               onchange="QuoteUI.updateItemPrice(${index}, this.value)">
                        <span class="currency">${currentQuote.currency}</span>
                    </div>
                    <div class="item-total">
                        ${formatCurrency(item.quantity * item.unitPrice, currentQuote.currency)}
                    </div>
                    <button onclick="QuoteUI.removeItem(${index})" class="btn-icon btn-danger">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                ${item.priceInfo ? this.renderPriceInfo(item.priceInfo) : ''}
            </div>
        `).join('');
    },

    renderPriceInfo(priceInfo) {
        let html = '<div class="price-history-info">';

        if (priceInfo.lastPriceForCustomer) {
            html += `<span class="price-hint customer-price">
                <i class="fas fa-user"></i> Bu müşteriye daha önce: 
                <strong>${formatCurrency(priceInfo.lastPriceForCustomer.price, priceInfo.lastPriceForCustomer.currency)}</strong>
            </span>`;
        }

        if (priceInfo.averageForOthers) {
            html += `<span class="price-hint average-price">
                <i class="fas fa-users"></i> Diğer müşterilere ortalama: 
                <strong>${formatCurrency(priceInfo.averageForOthers.average, currentQuote.currency)}</strong>
                (${priceInfo.averageForOthers.count} teklif)
            </span>`;
        }

        html += '</div>';
        return html;
    },

    async addProduct(product) {
        // Get price info
        let priceInfo = null;
        if (currentQuote.customerId) {
            priceInfo = await quoteManager.getPriceInfo(product.id, currentQuote.customerId);
        }

        // Determine initial price
        let initialPrice = product.defaultPrice;
        if (priceInfo && priceInfo.lastPriceForCustomer) {
            initialPrice = priceInfo.lastPriceForCustomer.price;
        }

        currentQuote.items.push({
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            quantity: 1,
            unitPrice: initialPrice,
            unit: product.unit || 'Adet',
            priceInfo: priceInfo
        });

        this.renderItems();
        this.updateTotal();

        // Clear search
        document.getElementById('product-search-input').value = '';
        document.getElementById('product-autocomplete').innerHTML = '';
    },

    updateItemQuantity(index, quantity) {
        currentQuote.items[index].quantity = parseInt(quantity) || 1;
        this.renderItems();
        this.updateTotal();
    },

    updateItemPrice(index, price) {
        currentQuote.items[index].unitPrice = parseFloat(price) || 0;
        this.renderItems();
        this.updateTotal();
    },

    removeItem(index) {
        currentQuote.items.splice(index, 1);
        this.renderItems();
        this.updateTotal();
    },

    updateTotal() {
        const total = currentQuote.items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice);
        }, 0);

        document.getElementById('quote-total').textContent =
            formatCurrency(total, currentQuote.currency);
    },

    selectCustomer(customer) {
        currentQuote.customerId = customer.id;
        currentQuote.customerName = customer.displayText;
        document.getElementById('quote-customer-search').value = customer.displayText;
        document.getElementById('customer-autocomplete').innerHTML = '';

        // Refresh price info for existing items
        this.refreshPriceInfo();
    },

    async refreshPriceInfo() {
        if (!currentQuote.customerId) return;

        for (let i = 0; i < currentQuote.items.length; i++) {
            const item = currentQuote.items[i];
            item.priceInfo = await quoteManager.getPriceInfo(item.productId, currentQuote.customerId);
        }
        this.renderItems();
    },

    async save() {
        if (!currentQuote.customerId) {
            showToast('Lütfen bir müşteri seçin', 'error');
            return;
        }

        if (currentQuote.items.length === 0) {
            showToast('Lütfen en az bir ürün ekleyin', 'error');
            return;
        }

        const quote = {
            quoteNumber: document.getElementById('quote-number').value,
            customerId: currentQuote.customerId,
            items: currentQuote.items.map(item => ({
                productId: item.productId,
                productCode: item.productCode,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unit: item.unit
            })),
            total: currentQuote.items.reduce((sum, item) =>
                sum + (item.quantity * item.unitPrice), 0),
            currency: document.getElementById('quote-currency').value,
            validDays: parseInt(document.getElementById('quote-valid-days').value) || 30,
            notes: document.getElementById('quote-notes').value.trim(),
            status: 'draft'
        };

        try {
            await quoteManager.add(quote);
            showToast('Teklif oluşturuldu', 'success');
            Modal.hide('quote-modal');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            showToast('Hata: ' + error.message, 'error');
        }
    },

    async view(id) {
        const quote = await quoteManager.get(id);
        if (!quote) return;

        const customer = await customerManager.get(quote.customerId);

        let html = `
            <div class="quote-view">
                <div class="quote-header">
                    <h3>Teklif No: ${quote.quoteNumber}</h3>
                    <span class="status-badge ${this.getStatusClass(quote.status)}">${this.getStatusText(quote.status)}</span>
                </div>
                <div class="quote-info">
                    <p><strong>Müşteri:</strong> ${customer ? customer.name : 'Bilinmeyen'}</p>
                    <p><strong>Şirket:</strong> ${customer && customer.company ? customer.company : '-'}</p>
                    <p><strong>Tarih:</strong> ${formatDate(quote.createdAt)}</p>
                    <p><strong>Geçerlilik:</strong> ${formatDate(quote.validUntil)}</p>
                </div>
                <table class="quote-items-table">
                    <thead>
                        <tr>
                            <th>Ürün</th>
                            <th>Miktar</th>
                            <th>Birim Fiyat</th>
                            <th>Toplam</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quote.items.map(item => `
                            <tr>
                                <td>${item.productCode} - ${item.productName}</td>
                                <td>${item.quantity} ${item.unit}</td>
                                <td>${formatCurrency(item.unitPrice, quote.currency)}</td>
                                <td>${formatCurrency(item.quantity * item.unitPrice, quote.currency)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3"><strong>Genel Toplam</strong></td>
                            <td><strong>${formatCurrency(quote.total, quote.currency)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                ${quote.notes ? `<div class="quote-notes"><strong>Notlar:</strong> ${quote.notes}</div>` : ''}
            </div>
        `;

        document.getElementById('view-quote-content').innerHTML = html;
        document.getElementById('view-quote-id').value = id;
        Modal.show('view-quote-modal');
    },

    async generatePDF(id) {
        const quote = await quoteManager.get(id);
        if (!quote) return;

        const customer = await customerManager.get(quote.customerId);
        await PDFGenerator.generate(quote, customer);

        // Update status to sent
        quote.status = 'sent';
        await quoteManager.update(quote);
        await this.renderList();
    },

    async sendWhatsApp(id) {
        const quote = await quoteManager.get(id);
        if (!quote) return;

        const customer = await customerManager.get(quote.customerId);
        if (!customer || !customer.phone) {
            showToast('Müşterinin telefon numarası yok', 'error');
            return;
        }

        // Clean phone number
        let phone = customer.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
            phone = '90' + phone.substring(1); // Turkish prefix
        }

        const message = encodeURIComponent(
            `Sayın ${customer.name},\n\n` +
            `${quote.quoteNumber} numaralı teklifimizi ilginize sunarız.\n\n` +
            `Toplam: ${formatCurrency(quote.total, quote.currency)}\n\n` +
            `Detaylar için PDF dosyasını inceleyiniz.`
        );

        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');

        // Update status
        quote.status = 'sent';
        await quoteManager.update(quote);
        await this.renderList();
    },

    async sendEmail(id) {
        const quote = await quoteManager.get(id);
        if (!quote) return;

        const customer = await customerManager.get(quote.customerId);
        if (!customer || !customer.email) {
            showToast('Müşterinin e-posta adresi yok', 'error');
            return;
        }

        const subject = encodeURIComponent(`Teklif - ${quote.quoteNumber}`);
        const body = encodeURIComponent(
            `Sayın ${customer.name},\n\n` +
            `${quote.quoteNumber} numaralı teklifimizi ilginize sunarız.\n\n` +
            `Toplam: ${formatCurrency(quote.total, quote.currency)}\n\n` +
            `Geçerlilik Tarihi: ${formatDate(quote.validUntil)}\n\n` +
            `Saygılarımızla`
        );

        window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, '_blank');

        // Update status
        quote.status = 'sent';
        await quoteManager.update(quote);
        await this.renderList();
    },

    async delete(id) {
        if (!confirm('Bu teklifi silmek istediğinizden emin misiniz?')) return;

        try {
            await quoteManager.delete(id);
            showToast('Teklif silindi', 'success');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            showToast('Hata: ' + error.message, 'error');
        }
    },

    async updateStatus(id, status) {
        const quote = await quoteManager.get(id);
        if (!quote) return;

        quote.status = status;
        await quoteManager.update(quote);
        await this.renderList();
        Modal.hide('view-quote-modal');
        showToast('Teklif durumu güncellendi', 'success');
    }
};

let quoteManager;
