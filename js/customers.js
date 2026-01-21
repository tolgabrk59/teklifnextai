/**
 * Müşteri Yönetimi Modülü
 */

class CustomerManager {
    constructor(database) {
        this.db = database;
    }

    async add(customer) {
        return await this.db.add('customers', customer);
    }

    async update(customer) {
        return await this.db.update('customers', customer);
    }

    async delete(id) {
        return await this.db.delete('customers', id);
    }

    async get(id) {
        return await this.db.get('customers', id);
    }

    async getAll() {
        return await this.db.getAll('customers');
    }

    async search(query) {
        return await this.db.searchAll('customers', query);
    }

    async getAutocompleteResults(query, limit = 10) {
        const results = await this.search(query);
        return results.slice(0, limit).map(c => ({
            id: c.id,
            name: c.name,
            company: c.company,
            displayText: c.company ? `${c.name} (${c.company})` : c.name
        }));
    }
}

// UI Functions for Customer Management
const CustomerUI = {
    currentPage: 1,
    searchQuery: '',

    async renderList(page = 1, search = '') {
        this.currentPage = page;
        this.searchQuery = search;

        const response = await fetch(`/api/customers?page=${page}&limit=50&search=${encodeURIComponent(search)}`);
        const data = await response.json();

        const tbody = document.getElementById('customers-table-body');
        const paginationDiv = document.getElementById('customers-pagination');

        if (!tbody) return;

        // Update total count display
        const countSpan = document.getElementById('customers-count');
        if (countSpan) countSpan.textContent = `(${data.total} müşteri)`;

        if (data.customers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>${search ? 'Arama sonucu bulunamadı' : 'Henüz müşteri eklenmemiş'}</p>
                    </td>
                </tr>
            `;
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }

        tbody.innerHTML = data.customers.map(c => `
            <tr>
                <td data-label="Ad">${escapeHtml(c.name)}</td>
                <td data-label="Firma">${escapeHtml(c.company || '-')}</td>
                <td data-label="E-posta">${escapeHtml(c.email || '-')}</td>
                <td data-label="Telefon">${escapeHtml(c.phone || '-')}</td>
                <td class="actions">
                    <button onclick="CustomerUI.edit(${c.id})" class="btn-icon" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="CustomerUI.delete(${c.id})" class="btn-icon btn-danger" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Render pagination
        if (paginationDiv && data.pages > 1) {
            let paginationHtml = '<div class="pagination">';

            if (page > 1) {
                paginationHtml += `<button class="btn btn-primary" onclick="CustomerUI.renderList(${page - 1}, '${search}')"><i class="fas fa-chevron-left"></i></button>`;
            }

            paginationHtml += `<span class="page-info">Sayfa ${page} / ${data.pages}</span>`;

            if (page < data.pages) {
                paginationHtml += `<button class="btn btn-primary" onclick="CustomerUI.renderList(${page + 1}, '${search}')"><i class="fas fa-chevron-right"></i></button>`;
            }

            paginationHtml += '</div>';
            paginationDiv.innerHTML = paginationHtml;
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    },

    searchCustomers(query) {
        this.renderList(1, query);
    },

    showAddModal() {
        document.getElementById('customer-modal-title').textContent = 'Yeni Müşteri';
        document.getElementById('customer-form').reset();
        document.getElementById('customer-id').value = '';
        Modal.show('customer-modal');
    },

    async edit(id) {
        const customer = await customerManager.get(id);
        if (!customer) return;

        document.getElementById('customer-modal-title').textContent = 'Müşteri Düzenle';
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-name').value = customer.name || '';
        document.getElementById('customer-company').value = customer.company || '';
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-address').value = customer.address || '';

        Modal.show('customer-modal');
    },

    async save() {
        const id = document.getElementById('customer-id').value;
        const customer = {
            name: document.getElementById('customer-name').value.trim(),
            company: document.getElementById('customer-company').value.trim(),
            email: document.getElementById('customer-email').value.trim(),
            phone: document.getElementById('customer-phone').value.trim(),
            address: document.getElementById('customer-address').value.trim()
        };

        if (!customer.name) {
            showToast('Müşteri adı zorunludur', 'error');
            return;
        }

        try {
            if (id) {
                customer.id = parseInt(id);
                await customerManager.update(customer);
                showToast('Müşteri güncellendi', 'success');
            } else {
                await customerManager.add(customer);
                showToast('Müşteri eklendi', 'success');
            }
            Modal.hide('customer-modal');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            showToast('Hata: ' + error.message, 'error');
        }
    },

    async delete(id) {
        if (!confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) return;

        try {
            await customerManager.delete(id);
            showToast('Müşteri silindi', 'success');
            await this.renderList();
            updateDashboardStats();
        } catch (error) {
            showToast('Hata: ' + error.message, 'error');
        }
    }
};

let customerManager;
