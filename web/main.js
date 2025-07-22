class TransactionTracker {
    constructor() {
        this.baseUrl = '/transactions';
        this.transactions = [];
        this.offset = 0;
        this.limit = 10;
        this.hasMore = true;
        this.totalCount = 0;
        this.currentBalance = 0;
        this.currentEditingTransaction = null;
        this.filters = {
            type: '',
            dateFrom: '',
            dateTo: ''
        };
        this.balanceChart = null;
        this.chartVisible = true;
        this.init();
    }

    init() {
        this.loadBalance();
        this.loadTransactions();
        this.bindEvents();
        this.initModalFallbacks();
    }

    bindEvents() {
        document.getElementById('loadFromApiBtn').addEventListener('click', () => this.loadFromAPI());
        document.getElementById('addTransactionBtn').addEventListener('click', () => this.openAddTransactionModal());
    }

    initModalFallbacks() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'modal-backdrop-fallback') {
                this.hideModal('transactionModal');
            }

            if (e.target.classList.contains('btn-close') ||
                e.target.getAttribute('data-bs-dismiss') === 'modal') {
                this.hideModal('transactionModal');
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal.show');
                if (modal) {
                    this.hideModal(modal.id);
                }
            }
        });
    }

    async makeRequest(url, options = {}) {
        this.showLoading(true);
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle 204 No Content responses (DELETE)
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            this.showAlert(`Error: ${error.message}`, 'danger');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    async loadBalance() {
        try {
            const data = await this.makeRequest(`${this.baseUrl}/balance/`);
            this.currentBalance = data.balance;
            document.getElementById('balanceDisplay').innerHTML = `Balance: $${data.balance.toFixed(2)}`;
        } catch (error) {
            document.getElementById('balanceDisplay').innerHTML = 'Balance: Error loading';
            this.currentBalance = 0;
        }
    }

    buildFilterParams() {
        const params = new URLSearchParams();
        params.append('limit', this.limit);
        params.append('offset', this.offset);

        if (this.filters.type) {
            params.append('type', this.filters.type);
        }
        if (this.filters.dateFrom) {
            params.append('from_date', this.filters.dateFrom);
        }
        if (this.filters.dateTo) {
            params.append('to_date', this.filters.dateTo);
        }

        return params.toString();
    }

    async loadTransactions(reset = false) {
        if (reset) {
            this.offset = 0;
            this.transactions = [];
            this.hasMore = true;
        }

        if (!this.hasMore) {
            return;
        }

        try {
            const params = this.buildFilterParams();
            const url = `${this.baseUrl}/?${params}`;
            const data = await this.makeRequest(url);

            const newTransactions = data.results || data;

            if (reset) {
                this.transactions = newTransactions;
            } else {
                this.transactions = [...this.transactions, ...newTransactions];
            }

            // Update total count from paginated response
            if (data.count !== undefined) {
                this.totalCount = data.count;
            } else {
                // no count when loading all transactions without pagination
                this.totalCount = this.transactions.length;
            }

            // Check if there are more transactions
            this.hasMore = newTransactions.length === this.limit;
            this.offset += newTransactions.length;

            this.updateTransactionCount();
            this.renderTransactions();
            this.updateBalanceChart();
        } catch (error) {
            this.updateTransactionCount();
            this.renderTransactions();
            this.updateBalanceChart();
        }
    }

    updateTransactionCount() {
        document.getElementById('transactionCount').innerHTML = `Total transactions: ${this.totalCount}`;
    }

    async loadMore() {
        await this.loadTransactions(false);
    }

    applyFilters() {
        this.filters.type = document.getElementById('filterType').value;
        this.filters.dateFrom = document.getElementById('filterDateFrom').value;
        this.filters.dateTo = document.getElementById('filterDateTo').value;

        this.loadTransactions(true);
    }

    clearFilters() {
        this.filters = {
            type: '',
            dateFrom: '',
            dateTo: ''
        };

        document.getElementById('filterType').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';

        this.loadTransactions(true);
    }

    calculateBalanceHistory() {
        if (!this.transactions || this.transactions.length === 0) {
            return { dates: [], balances: [] };
        }

        // Sort transactions by date
        const sortedTransactions = [...this.transactions].sort((a, b) =>
            new Date(a.createdAt) - new Date(b.createdAt)
        );

        const balanceHistory = [];
        let runningBalance = 0;

        let totalChange = 0;
        sortedTransactions.forEach(tx => {
            if (tx.type === 'deposit') {
                totalChange += tx.amount;
            } else {
                totalChange -= tx.amount;
            }
        });

        const initialBalance = this.currentBalance - totalChange;
        runningBalance = initialBalance;

        if (sortedTransactions.length > 0) {
            const firstDate = new Date(sortedTransactions[0].createdAt);
            const dayBefore = new Date(firstDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            balanceHistory.push({
                date: dayBefore.toISOString().split('T')[0],
                balance: runningBalance
            });
        }

        const dailyBalances = new Map();

        sortedTransactions.forEach(tx => {
            if (tx.type === 'deposit') {
                runningBalance += tx.amount;
            } else {
                runningBalance -= tx.amount;
            }

            const date = new Date(tx.createdAt).toISOString().split('T')[0];
            dailyBalances.set(date, runningBalance);
        });

        const dates = Array.from(dailyBalances.keys()).sort();
        const balances = dates.map(date => dailyBalances.get(date));

        return { dates, balances };
    }

    updateBalanceChart() {
        const { dates, balances } = this.calculateBalanceHistory();
        const chartCard = document.getElementById('balanceChart').closest('.card');

        if (dates.length === 0) {
            if (chartCard) {
                chartCard.style.display = 'none';
            }
            return;
        }

        if (chartCard) {
            chartCard.style.display = 'block';
        }

        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            chartContainer.style.display = this.chartVisible ? 'block' : 'none';
        }

        const toggleBtn = document.getElementById('chartToggleBtn');
        if (toggleBtn) {
            toggleBtn.textContent = this.chartVisible ? 'Hide Chart' : 'Show Chart';
        }

        if (!this.chartVisible) {
            return;
        }

        const ctx = document.getElementById('balanceChart').getContext('2d');

        if (this.balanceChart) {
            this.balanceChart.destroy();
        }

        this.balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString()),
                datasets: [{
                    label: 'Balance',
                    data: balances,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#28a745',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Balance ($)'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            callback: function (value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                return 'Balance: $' + context.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    toggleChart() {
        const { dates } = this.calculateBalanceHistory();

        if (dates.length === 0) {
            return;
        }

        const chartContainer = document.getElementById('chartContainer');
        const toggleBtn = document.getElementById('chartToggleBtn');

        if (this.chartVisible) {
            chartContainer.style.display = 'none';
            toggleBtn.textContent = 'Show Chart';
            this.chartVisible = false;
        } else {
            chartContainer.style.display = 'block';
            toggleBtn.textContent = 'Hide Chart';
            this.chartVisible = true;
            setTimeout(() => this.updateBalanceChart(), 100);
        }
    }

    showModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            console.error(`Modal element ${modalId} not found`);
            return;
        }

        try {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } catch (error) {
            console.error('Error showing modal:', error);
            this.showAlert('Error opening modal. Please try again.', 'danger');
        }
    }

    hideModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) {
            return;
        }

        try {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            } else {
                const newModal = new bootstrap.Modal(modalElement);
                newModal.hide();
            }
        } catch (error) {
            console.error('Error hiding modal:', error);
        }
    }

    async loadFromAPI() {
        try {
            this.showAlert('Loading transactions from external API...', 'info');
            const data = await this.makeRequest(`${this.baseUrl}/load-from-api/`);
            this.showAlert(`Successfully loaded ${data.length} new transactions!`, 'success');
            await this.refresh();
        } catch (error) {
            this.showAlert('Failed to load transactions from API', 'danger');
        }
    }

    openAddTransactionModal() {
        this.currentEditingTransaction = null;
        this.clearModalAlerts();
        document.getElementById('transactionModalTitle').textContent = 'Add Transaction';
        document.getElementById('transactionAmount').value = '';
        document.getElementById('transactionType').value = '';

        document.getElementById('transactionModalFooter').innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" onclick="app.createTransaction()">Create</button>
        `;

        this.showModal('transactionModal');
    }

    openEditTransactionModal(transaction) {
        this.currentEditingTransaction = transaction;
        this.clearModalAlerts();
        document.getElementById('transactionModalTitle').textContent = 'Edit Transaction';
        document.getElementById('transactionAmount').value = transaction.amount;
        document.getElementById('transactionType').value = transaction.type;

        document.getElementById('transactionModalFooter').innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="app.discardChanges()">Discard</button>
            <button type="button" class="btn btn-primary" onclick="app.saveTransaction()">Save</button>
        `;

        this.showModal('transactionModal');
    }

    async createTransaction() {
        this.clearModalAlerts();
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const type = document.getElementById('transactionType').value;

        if (!amount || !type) {
            this.showModalAlert('Please fill in all fields', 'warning');
            return;
        }

        if (type === 'expense' && amount > this.currentBalance) {
            this.showModalAlert(`Insufficient balance. Current balance: $${this.currentBalance.toFixed(2)}`, 'danger');
            return;
        }

        try {
            await this.makeRequest(`${this.baseUrl}/`, {
                method: 'POST',
                body: JSON.stringify({ amount, type })
            });

            this.showAlert('Transaction created successfully!', 'success');
            this.hideModal('transactionModal');

            await this.refresh();
        } catch (error) {
            this.showModalAlert('Failed to create transaction', 'danger');
        }
    }

    async saveTransaction() {
        this.clearModalAlerts();
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const type = document.getElementById('transactionType').value;

        if (!amount || !type) {
            this.showModalAlert('Please fill in all fields', 'warning');
            return;
        }

        if (type === 'expense') {
            let adjustedBalance = this.currentBalance;

            if (this.currentEditingTransaction.type === 'deposit') {
                adjustedBalance -= this.currentEditingTransaction.amount;
            } else if (this.currentEditingTransaction.type === 'expense') {
                adjustedBalance += this.currentEditingTransaction.amount;
            }

            if (amount > adjustedBalance) {
                this.showModalAlert(`Insufficient balance for this expense. Available: $${adjustedBalance.toFixed(2)}`, 'danger');
                return;
            }
        }

        try {
            await this.makeRequest(`${this.baseUrl}/${this.currentEditingTransaction.id}/`, {
                method: 'PUT',
                body: JSON.stringify({ amount, type })
            });

            this.showAlert('Transaction updated successfully!', 'success');
            this.hideModal('transactionModal');
            await this.refresh();
        } catch (error) {
            this.showModalAlert('Failed to update transaction', 'danger');
        }
    }

    discardChanges() {
        this.hideModal('transactionModal');
    }

    async deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            await this.makeRequest(`${this.baseUrl}/${id}/`, { method: 'DELETE' });
            this.showAlert('Transaction deleted successfully!', 'success');
            await this.refresh();
        } catch (error) {
            this.showAlert('Failed to delete transaction', 'danger');
        }
    }

    renderTransactions() {
        const tableContainer = document.querySelector('.table-responsive');
        const parentSection = tableContainer.parentElement;

        const existingLoadMoreBtn = document.getElementById('loadMoreBtn');
        if (existingLoadMoreBtn) {
            existingLoadMoreBtn.remove();
        }

        if (!this.transactions || this.transactions.length === 0) {
            // when no transactions are found
            tableContainer.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-4">
                        <svg width="64" height="64" fill="currentColor" class="bi bi-receipt text-muted" viewBox="0 0 16 16">
                            <path d="M1.92.506a.5.5 0 0 1 .434.14L3 1.293l.646-.647a.5.5 0 0 1 .708 0L5 1.293l.646-.647a.5.5 0 0 1 .708 0L7 1.293l.646-.647a.5.5 0 0 1 .708 0L9 1.293l.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .801.13l.5 1A.5.5 0 0 1 15 2v12a.5.5 0 0 1-.053.224l-.5 1a.5.5 0 0 1-.8.13L13 14.707l-.646.647a.5.5 0 0 1-.708 0L11 14.707l-.646.647a.5.5 0 0 1-.708 0L9 14.707l-.646.647a.5.5 0 0 1-.708 0L7 14.707l-.646.647a.5.5 0 0 1-.708 0L5 14.707l-.646.647a.5.5 0 0 1-.708 0L3 14.707l-.646.647a.5.5 0 0 1-.801-.13l-.5-1A.5.5 0 0 1 1 14V2a.5.5 0 0 1 .053-.224l.5-1a.5.5 0 0 1 .367-.27zm.217 1.338L2 2.118v11.764l.137.274.51-.51a.5.5 0 0 1 .707 0l.646.647.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.646.646.646-.646a.5.5 0 0 1 .708 0l.509.509.137-.274V2.118l-.137-.274-.51.51a.5.5 0 0 1-.707 0L12 1.707l-.646.647a.5.5 0 0 1-.708 0L10 1.707l-.646.647a.5.5 0 0 1-.708 0L8 1.707l-.646.647a.5.5 0 0 1-.708 0L6 1.707l-.646.647a.5.5 0 0 1-.708 0L4 1.707l-.646.647a.5.5 0 0 1-.708 0L2 1.707l-.646.647a.5.5 0 0 1-.137-.274z"/>
                            <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 1 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z"/>
                        </svg>
                    </div>
                    <h3 class="text-muted">No Transactions Found</h3>
                    <p class="text-muted">Get started by adding a transaction or loading from the API.</p>
                    <div class="d-flex gap-2 justify-content-center">
                        <button class="btn btn-primary" onclick="app.openAddTransactionModal()">Add Transaction</button>
                        <button class="btn btn-outline-primary" onclick="app.loadFromAPI()">Load from API</button>
                    </div>
                </div>
            `;
            return;
        }

        tableContainer.innerHTML = `
            <table class="table table-success table-striped mt-4">
                <thead>
                    <tr>
                        <th class="text-nowrap">ID</th>
                        <th class="text-nowrap">Amount</th>
                        <th class="text-nowrap">Type</th>
                        <th class="text-nowrap">Date</th>
                        <th class="text-nowrap">Actions</th>
                    </tr>
                </thead>
                <tbody id="transactionsTableBody">
                    ${this.transactions.map(tx => `
                        <tr>
                            <td class="text-nowrap">${tx.id}</td>
                            <td class="text-nowrap">
                                <span class="fw-bold ${tx.type === 'deposit' ? 'text-success' : 'text-danger'}">
                                    ${tx.type === 'expense' ? '-' : '+'}$${tx.amount.toFixed(2)}
                                </span>
                            </td>
                            <td class="text-nowrap">
                                <span class="badge ${tx.type === 'deposit' ? 'bg-success' : 'bg-danger'}">
                                    ${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                                </span>
                            </td>
                            <td class="text-nowrap">${new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td class="text-nowrap">
                                ${tx.editable ? `
                                    <div class="btn-group btn-group-sm" role="group">
                                        <button class="btn btn-sm btn-outline-primary" onclick="app.openEditTransactionModal(${JSON.stringify(tx).replace(/"/g, '&quot;')})">
                                            Edit
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="app.deleteTransaction(${tx.id})">
                                            Delete
                                        </button>
                                    </div>
                                ` : `
                                    <span class="text-muted small">API Transaction</span>
                                `}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        if (this.hasMore) {
            const loadMoreBtn = document.createElement('div');
            loadMoreBtn.id = 'loadMoreBtn';
            loadMoreBtn.className = 'text-center mt-3';
            loadMoreBtn.innerHTML = `
                <button class="btn btn-outline-primary" onclick="app.loadMore()">
                    Load More Transactions
                </button>
            `;
            parentSection.appendChild(loadMoreBtn);
        }
    }

    showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        alertContainer.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    showModalAlert(message, type = 'info') {
        const modalAlertContainer = document.getElementById('modalAlertContainer');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show mb-3`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        modalAlertContainer.appendChild(alert);

        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    clearModalAlerts() {
        const modalAlertContainer = document.getElementById('modalAlertContainer');
        modalAlertContainer.innerHTML = '';
    }

    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        if (show) {
            indicator.classList.remove('d-none');
        } else {
            indicator.classList.add('d-none');
        }
    }

    async refresh() {
        await this.loadBalance();
        await this.loadAllTransactions();
    }

    async loadAllTransactions() {
        try {
            const url = `${this.baseUrl}/`;
            const data = await this.makeRequest(url);

            this.transactions = data.results || data;
            this.totalCount = this.transactions.length;

            this.updateTransactionCount();
            this.renderTransactions();
            this.updateBalanceChart();
        } catch (error) {
            console.error('Error loading all transactions:', error);
            this.showAlert('Failed to load transactions', 'danger');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new TransactionTracker();
});
