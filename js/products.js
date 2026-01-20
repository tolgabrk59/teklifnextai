/**
 * Ürün Yönetimi Modülü
 */

class ProductManager {
    constructor(database) {
        this.db = database;
    }

    async add(product) {
        return await this.db.add('products', product);
    }

    async update(product) {
        return await this.db.update('products', product);
    }

    async delete(id) {
        return await this.db.delete('products', id);
    }

    async get(id) {
        return await this.db.get('products', id);
    }

    async getAll() {
        return await this.db.getAll('products');
    }

    async search(query) {
        return await this.db.searchAll('products', query);
    }

    async getAutocompleteResults(query, limit = 10) {
        const results = await this.search(query);
        return results.slice(0, limit).map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            defaultPrice: p.price,
            currency: p.currency,
            unit: p.unit,
            displayText: `${p.code} - ${p.name}`
        }));
    }
}

// UI Functions for Product Management
const ProductUI = {
    async renderList() {
        const products = await productManager.getAll();
        const tbody = document.getElementById('products-table-body');

        if (!tbody) return;

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-box"></i>
                        <p>Henüz ürün eklenmemiş</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const imgHtml = p.imageUrl
                ? `<img src="/api/proxy-image?url=${encodeURIComponent(p.imageUrl)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">`
                : `<i class="fas fa-image" style="color: #ccc; font-size: 20px;"></i>`;
            return `
            <tr>
                <td style="text-align: center;">${imgHtml}</td>
                <td><code>${escapeHtml(p.code)}</code></td>
                <td>${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.description || '-')}</td>
                <td class="text-right">${formatCurrency(p.price, p.currency)}</td>
                <td>${escapeHtml(p.unit || 'Adet')}</td>
                <td class="actions">
                    <button onclick="ProductUI.edit(${p.id})" class="btn-icon" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="ProductUI.delete(${p.id})" class="btn-icon btn-danger" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    },

    showAddModal() {
        document.getElementById('product-modal-title').textContent = 'Yeni Ürün';
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-url').value = '';
        document.getElementById('product-image-url').value = '';
        this.resetImagePreview();
        Modal.show('product-modal');
    },

    async edit(id) {
        const product = await productManager.get(id);
        if (!product) return;

        document.getElementById('product-modal-title').textContent = 'Ürün Düzenle';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-code').value = product.code || '';
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-price').value = product.price || '';
        document.getElementById('product-currency').value = product.currency || 'USD';
        document.getElementById('product-unit').value = product.unit || 'Adet';
        document.getElementById('product-url').value = '';

        // Handle image
        if (product.imageUrl) {
            document.getElementById('product-image-url').value = product.imageUrl;
            this.showImagePreview(product.imageUrl);
        } else {
            document.getElementById('product-image-url').value = '';
            this.resetImagePreview();
        }

        Modal.show('product-modal');
    },

    async save() {
        const id = document.getElementById('product-id').value;
        const product = {
            code: document.getElementById('product-code').value.trim(),
            name: document.getElementById('product-name').value.trim(),
            description: document.getElementById('product-description').value.trim(),
            price: parseFloat(document.getElementById('product-price').value) || 0,
            currency: document.getElementById('product-currency').value,
            unit: document.getElementById('product-unit').value.trim() || 'Adet',
            imageUrl: document.getElementById('product-image-url').value || null
        };

        if (!product.code || !product.name) {
            showToast('Ürün kodu ve adı zorunludur', 'error');
            return;
        }

        try {
            if (id) {
                product.id = parseInt(id);
                await productManager.update(product);
                showToast('Ürün güncellendi', 'success');
            } else {
                await productManager.add(product);
                showToast('Ürün eklendi', 'success');
            }
            Modal.hide('product-modal');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            if (error.message.includes('unique')) {
                showToast('Bu ürün kodu zaten kullanılıyor', 'error');
            } else {
                showToast('Hata: ' + error.message, 'error');
            }
        }
    },

    async delete(id) {
        if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

        try {
            await productManager.delete(id);
            showToast('Ürün silindi', 'success');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            showToast('Hata: ' + error.message, 'error');
        }
    },

    // URL Scraping
    async scrapeUrl() {
        const url = document.getElementById('product-url').value.trim();
        if (!url) {
            showToast('Lütfen bir URL girin', 'error');
            return;
        }

        const statusEl = document.getElementById('scrape-status');
        const btn = document.getElementById('scrape-btn');

        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bilgi çekiliyor...';
        statusEl.style.color = '#666';
        btn.disabled = true;

        try {
            const response = await fetch('/api/scrape-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Bilgi çekilemedi');
            }

            const data = result.data;

            // Auto-fill form
            if (data.title) {
                document.getElementById('product-name').value = data.title;
            }
            if (data.description) {
                document.getElementById('product-description').value = data.description;
            }
            if (data.imageUrl) {
                document.getElementById('product-image-url').value = data.imageUrl;
                this.showImagePreview(data.imageUrl);
            }

            statusEl.innerHTML = '<i class="fas fa-check" style="color: green;"></i> Bilgiler çekildi!';
            showToast('Ürün bilgileri alındı', 'success');

        } catch (error) {
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: red;"></i> ' + error.message;
            showToast('Hata: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
        }
    },

    showImagePreview(imageUrl) {
        const previewContainer = document.getElementById('product-image-preview');
        const previewImg = document.getElementById('preview-img');

        // Use proxy to avoid CORS
        previewImg.src = '/api/proxy-image?url=' + encodeURIComponent(imageUrl);
        previewContainer.style.display = 'block';
    },

    resetImagePreview() {
        const previewContainer = document.getElementById('product-image-preview');
        const previewImg = document.getElementById('preview-img');

        previewImg.src = '';
        previewContainer.style.display = 'none';
    },

    clearImage() {
        document.getElementById('product-image-url').value = '';
        this.resetImagePreview();
        showToast('Görsel kaldırıldı', 'info');
    }
};

let productManager;
