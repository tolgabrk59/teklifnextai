/**
 * Satış Teklif Sistemi - Veritabanı Modülü (API Client Version)
 * Python/Flask backend API ile iletişim kurar.
 */

class Database {
    constructor() {
        this.baseUrl = '/api';
    }

    async init() {
        // API health check could go here, but for now we'll assume it's up.
        console.log('API Client Initialized');
        return Promise.resolve(true);
    }

    // Generic CRUD operations
    async add(storeName, data) {
        try {
            const response = await fetch(`${this.baseUrl}/${storeName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error adding data:', error);
            throw error;
        }
    }

    async update(storeName, data) {
        if (!data.id) throw new Error('Update requires an ID');
        try {
            const response = await fetch(`${this.baseUrl}/${storeName}/${data.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error updating data:', error);
            throw error;
        }
    }

    async delete(storeName, id) {
        try {
            const response = await fetch(`${this.baseUrl}/${storeName}/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return true;
        } catch (error) {
            console.error('Error deleting data:', error);
            throw error;
        }
    }

    async get(storeName, id) {
        try {
            const response = await fetch(`${this.baseUrl}/${storeName}/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    async getAll(storeName) {
        try {
            const response = await fetch(`${this.baseUrl}/${storeName}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            // Handle paginated response format for customers
            if (storeName === 'customers' && data.customers) {
                return data.customers;
            }
            return data;
        } catch (error) {
            console.error('Error fetching all data:', error);
            throw error;
        }
    }

    async search(storeName, indexName, query) {
        // Implement client-side filtering since dataset is likely small
        // or backend doesn't support field-specific search yet.
        const allItems = await this.getAll(storeName);
        if (!query) return allItems;

        const lowerQuery = query.toLowerCase();
        return allItems.filter(item => {
            const value = item[indexName];
            return value && String(value).toLowerCase().includes(lowerQuery);
        });
    }

    async searchAll(storeName, query) {
        const allItems = await this.getAll(storeName);
        if (!query) return allItems;

        const lowerQuery = query.toLowerCase();
        return allItems.filter(item => {
            return Object.values(item).some(val =>
                val && String(val).toLowerCase().includes(lowerQuery)
            );
        });
    }

    // Price History specific methods
    async getPriceHistoryForProduct(productId) {
        try {
            const response = await fetch(`${this.baseUrl}/price-history?productId=${productId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching price history:', error);
            throw error;
        }
    }

    async getPriceHistoryForProductAndCustomer(productId, customerId) {
        const allHistory = await this.getPriceHistoryForProduct(productId);
        // Customer filtering done client-side as backend returns all history for product
        // (Optimizable if backend supports customerId filter)
        return allHistory.filter(h => h.customerId == customerId); // == for type coercion just in case
    }

    async getAveragePriceForProduct(productId, excludeCustomerId = null) {
        const history = await this.getPriceHistoryForProduct(productId);
        const filtered = excludeCustomerId
            ? history.filter(h => h.customerId != excludeCustomerId)
            : history;

        if (filtered.length === 0) return null;

        const sum = filtered.reduce((acc, h) => acc + h.price, 0);
        return {
            average: sum / filtered.length,
            count: filtered.length
        };
    }

    async getLastPriceForCustomer(productId, customerId) {
        const history = await this.getPriceHistoryForProductAndCustomer(productId, customerId);
        if (history.length === 0) return null;

        // Sort by date descending and get the most recent
        // Backend returns ISO strings so string comparison works, or Date object
        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return history[0];
    }

    // Quote number generation
    async generateQuoteNumber() {
        try {
            const response = await fetch(`${this.baseUrl}/quote-number`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.quoteNumber;
        } catch (error) {
            console.error('Error generating quote number:', error);
            // Fallback logic if offline? 
            // For now, return a timestamp based fallback to prevent blocking
            const year = new Date().getFullYear();
            return `TKL-${year}-${Date.now().toString().slice(-4)}`;
        }
    }
}

// Global database instance
const db = new Database();
