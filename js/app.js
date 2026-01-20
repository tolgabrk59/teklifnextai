/**
 * Ana Uygulama Modülü
 */

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize database
        await db.init();

        // Initialize managers
        customerManager = new CustomerManager(db);
        productManager = new ProductManager(db);
        quoteManager = new QuoteManager(db);

        // Load initial data
        await updateDashboardStats();
        await CustomerUI.renderList();
        await ProductUI.renderList();
        await QuoteUI.renderList();

        // Setup autocomplete
        setupAutocomplete();

        console.log('Uygulama başlatıldı');
    } catch (error) {
        console.error('Uygulama başlatılamadı:', error);
        showToast('Uygulama başlatılırken hata oluştu', 'error');
    }
});

// Tab Navigation
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
}

// Modal Management
const Modal = {
    show(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    hide(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';
    }
};

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Autocomplete Setup
function setupAutocomplete() {
    // Customer autocomplete in quote form
    const customerSearch = document.getElementById('quote-customer-search');
    if (customerSearch) {
        customerSearch.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const container = document.getElementById('customer-autocomplete');

            if (query.length < 2) {
                container.innerHTML = '';
                return;
            }

            const results = await customerManager.getAutocompleteResults(query);
            renderAutocomplete(container, results, (item) => {
                QuoteUI.selectCustomer(item);
            });
        }, 300));
    }

    // Product autocomplete in quote form
    const productSearch = document.getElementById('product-search-input');
    if (productSearch) {
        productSearch.addEventListener('input', debounce(async (e) => {
            const query = e.target.value.trim();
            const container = document.getElementById('product-autocomplete');

            if (query.length < 2) {
                container.innerHTML = '';
                return;
            }

            const results = await productManager.getAutocompleteResults(query);
            renderAutocomplete(container, results, (item) => {
                QuoteUI.addProduct(item);
            });
        }, 300));
    }
}

function renderAutocomplete(container, results, onSelect) {
    if (results.length === 0) {
        container.innerHTML = '<div class="autocomplete-empty">Sonuç bulunamadı</div>';
        return;
    }

    container.innerHTML = results.map((item, index) => `
        <div class="autocomplete-item" data-index="${index}">
            ${escapeHtml(item.displayText)}
        </div>
    `).join('');

    container.querySelectorAll('.autocomplete-item').forEach((el, index) => {
        el.addEventListener('click', () => {
            onSelect(results[index]);
        });
    });
}

// Dashboard Stats
async function updateDashboardStats() {
    try {
        const customers = await customerManager.getAll();
        const products = await productManager.getAll();
        const quotes = await quoteManager.getAll();

        document.getElementById('stat-customers').textContent = customers.length;
        document.getElementById('stat-products').textContent = products.length;
        document.getElementById('stat-quotes').textContent = quotes.length;

        // Calculate total revenue from accepted quotes
        const totalRevenue = quotes
            .filter(q => q.status === 'accepted')
            .reduce((sum, q) => sum + q.total, 0);
        document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue, 'USD');

        // Render recent quotes in dashboard
        await renderDashboardQuotes(quotes.slice(0, 5), customers);
    } catch (error) {
        console.error('Dashboard güncellenemedi:', error);
    }
}

// Render recent quotes in dashboard
async function renderDashboardQuotes(quotes, customers) {
    const tbody = document.getElementById('dashboard-quotes-body');
    if (!tbody) return;

    const customerMap = {};
    customers.forEach(c => customerMap[c.id] = c);

    if (quotes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-file-invoice"></i>
                    <p>Henüz teklif yok</p>
                </td>
            </tr>
        `;
        return;
    }

    const statusTexts = { draft: 'Taslak', sent: 'Gönderildi', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };
    const statusClasses = { draft: 'status-draft', sent: 'status-sent', accepted: 'status-accepted', rejected: 'status-rejected' };

    tbody.innerHTML = quotes.map(q => {
        const customer = customerMap[q.customerId];
        const customerName = customer ? customer.name : 'Bilinmeyen';
        return `
            <tr>
                <td data-label="Teklif No"><code>${escapeHtml(q.quoteNumber)}</code></td>
                <td data-label="Müşteri">${escapeHtml(customerName)}</td>
                <td data-label="Tutar" class="text-right">${formatCurrency(q.total, q.currency)}</td>
                <td data-label="Durum"><span class="status-badge ${statusClasses[q.status] || 'status-draft'}">${statusTexts[q.status] || 'Taslak'}</span></td>
                <td data-label="Tarih">${formatDate(q.createdAt)}</td>
            </tr>
        `;
    }).join('');
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount, currency = 'USD') {
    const symbols = {
        USD: '$',
        EUR: '€',
        TRY: '₺',
        GBP: '£'
    };
    const symbol = symbols[currency] || currency + ' ';
    const val = parseFloat(amount);
    if (isNaN(val)) return `${symbol}0.00`;
    return `${symbol}${val.toFixed(2)}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
