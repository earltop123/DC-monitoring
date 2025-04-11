let expensesChart, trendsChart;

function setTextContent(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    } else {
        console.warn(`Element with id "${id}" not found`);
    }
}

async function fetchDashboardData() {
    const monthFilter = document.getElementById('month-filter')?.value || '';
    const yearFilter = document.getElementById('year-filter')?.value || '';
    const currentYear = new Date().getFullYear();

    // Fetch all delivered orders (broad query like delivery-management.js)
    const { data: deliveredOrders, error: salesError } = await supabase
        .from('orders')
        .select('total_amount, amount_paid, amount_due, order_date, products, payment_method, vendor_id')
        .eq('status', 'delivered');
    if (salesError) {
        console.error('Error fetching sales:', salesError.message);
        return;
    }
    console.log('Delivered Orders:', deliveredOrders);

    // Apply filters in JS for flexibility
    const filteredOrders = deliveredOrders.filter(order => {
        const orderDate = new Date(order.order_date);
        const orderMonth = orderDate.getMonth() + 1;
        const orderYear = orderDate.getFullYear();
        return (!monthFilter || orderMonth === parseInt(monthFilter)) &&
               (!yearFilter || orderYear === parseInt(yearFilter));
    });

    // Cash Received
    const cashReceived = filteredOrders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
    setTextContent('cash-received', `₱ ${cashReceived.toFixed(2)}`);

    // Total Revenue
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
    setTextContent('total-revenue', `₱ ${totalRevenue.toFixed(2)}`);

    // Year to Date Sales
    const ytdOrders = deliveredOrders.filter(order => {
        const orderYear = new Date(order.order_date).getFullYear();
        return orderYear === (yearFilter ? parseInt(yearFilter) : currentYear);
    });
    const ytdSales = ytdOrders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
    setTextContent('ytd-sales', `₱ ${ytdSales.toFixed(2)}`);

    // Total Sales This Month
    const monthSales = filteredOrders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
    setTextContent('month-sales', `₱ ${monthSales.toFixed(2)}`);

    // Fetch expenses
    const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, category, expense_date');
    if (expensesError) {
        console.error('Error fetching expenses:', expensesError.message);
        return;
    }
    const filteredExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        const expenseMonth = expenseDate.getMonth() + 1;
        const expenseYear = expenseDate.getFullYear();
        return (!monthFilter || expenseMonth === parseInt(monthFilter)) &&
               (!yearFilter || expenseYear === parseInt(yearFilter));
    });
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    setTextContent('total-expenses', `₱ ${totalExpenses.toFixed(2)}`);
    console.log('Total Expenses:', totalExpenses);

    // Distributors and Investors Share
    const totalPacks = filteredOrders.reduce((sum, order) => {
        return sum + order.products
            .filter(p => p.name !== 'Chili Sauce (100grams)')
            .reduce((qty, p) => qty + p.quantity, 0);
    }, 0);
    const distributorsShare = totalPacks * 15;
    const investorsShare = totalPacks * 13.5;
    setTextContent('distributors-share', `₱ ${distributorsShare.toFixed(2)}`);
    setTextContent('investors-share', `₱ ${investorsShare.toFixed(2)}`);
    console.log('Total Packs:', totalPacks, 'Distributors Share:', distributorsShare);

    // Remaining Supplier Credit
    const supplierCreditBase = totalPacks * 121.5;
    const { data: stockPayments, error: paymentsError } = await supabase
        .from('stock_payments')
        .select('amount, paid_at');
    if (paymentsError) {
        console.error('Error fetching stock payments:', paymentsError.message);
        return;
    }
    const filteredPayments = stockPayments.filter(payment => {
        const paymentDate = new Date(payment.paid_at);
        const paymentMonth = paymentDate.getMonth() + 1;
        const paymentYear = paymentDate.getFullYear();
        return (!monthFilter || paymentMonth === parseInt(monthFilter)) &&
               (!yearFilter || paymentYear === parseInt(yearFilter));
    });
    const totalPayments = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingSupplierCredit = supplierCreditBase - totalPayments;
    setTextContent('supplier-credit', `₱ ${remainingSupplierCredit.toFixed(2)}`);

    // Net Profit
    const netProfit = distributorsShare - totalExpenses;
    setTextContent('net-profit', `₱ ${netProfit.toFixed(2)}`);
    console.log('Net Profit:', netProfit);

    // Pending Payments (match delivery-management.js)
    const pendingPayments = deliveredOrders
        .filter(order => order.amount_due > 0)
        .reduce((sum, order) => {
            const orderDate = new Date(order.order_date);
            const orderMonth = orderDate.getMonth() + 1;
            const orderYear = orderDate.getFullYear();
            return (!monthFilter || orderMonth === parseInt(monthFilter)) &&
                   (!yearFilter || orderYear === parseInt(yearFilter))
                ? sum + order.amount_due
                : sum;
        }, 0);
    setTextContent('pending-payments', `₱ ${pendingPayments.toFixed(2)}`);
    console.log('Pending Payments:', pendingPayments);

    // Total Amount of Collectibles
    const collectiblesTotal = filteredOrders
        .filter(order => order.payment_method === 'Collectibles')
        .reduce((sum, order) => sum + (order.amount_due || 0), 0);
    setTextContent('collectibles-total', `₱ ${collectiblesTotal.toFixed(2)}`);

    // Active Vendors
    const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select('id');
    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }
    const vendorIds = vendors.map(v => v.id);
    const activeVendorIds = [...new Set(filteredOrders.map(o => o.vendor_id).filter(id => vendorIds.includes(id)))];
    setTextContent('active-vendors', activeVendorIds.length);
    console.log('Vendors:', vendors, 'Active Vendors:', activeVendorIds.length);

    // Expenses by Category Pie Chart
    const categoryTotals = filteredExpenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + expense.amount;
        return acc;
    }, {});
    const expensesCtx = document.getElementById('expenses-chart')?.getContext('2d');
    if (expensesCtx) {
        if (expensesChart) expensesChart.destroy();
        expensesChart = new Chart(expensesCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryTotals),
                datasets: [{
                    data: Object.values(categoryTotals),
                    backgroundColor: ['#D32F2F', '#B71C1C', '#F5F5DC', '#D2B48C', '#FF9999'],
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14 } } },
                    title: { display: false }
                }
            }
        });
    }

    // Monthly Trends Line Chart
    const year = yearFilter || currentYear;
    const monthlyData = Array(12).fill(0).map(() => ({ cash: 0, revenue: 0, paid: 0 }));
    deliveredOrders.forEach(order => {
        const orderYear = new Date(order.order_date).getFullYear();
        if (!yearFilter || orderYear === parseInt(yearFilter)) {
            const month = new Date(order.order_date).getMonth();
            monthlyData[month].cash += order.amount_paid || 0;
            monthlyData[month].revenue += order.total_amount;
        }
    });
    stockPayments.forEach(payment => {
        const paymentYear = new Date(payment.paid_at).getFullYear();
        if (!yearFilter || paymentYear === parseInt(yearFilter)) {
            const month = new Date(payment.paid_at).getMonth();
            monthlyData[month].paid += payment.amount;
        }
    });

    const trendsCtx = document.getElementById('trends-chart')?.getContext('2d');
    if (trendsCtx) {
        if (trendsChart) trendsChart.destroy();
        trendsChart = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [
                    {
                        label: 'Cash Received',
                        data: monthlyData.map(d => d.cash),
                        borderColor: '#D32F2F',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Total Revenue',
                        data: monthlyData.map(d => d.revenue),
                        borderColor: '#B71C1C',
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Stock Paid',
                        data: monthlyData.map(d => d.paid),
                        borderColor: '#D2B48C',
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Amount (₱)' } },
                    x: { title: { display: true, text: 'Month' } }
                },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 14 } } },
                    title: { display: false }
                }
            }
        });
    }
}

function populateYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    if (yearFilter) {
        const currentYear = new Date().getFullYear();
        yearFilter.innerHTML = '<option value="">All Years</option>' +
            Array.from({ length: 5 }, (_, i) => `<option value="${currentYear - i}" ${currentYear - i === currentYear ? 'selected' : ''}>${currentYear - i}</option>`).join('');
    }
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    if (monthFilter) {
        const currentMonth = new Date().getMonth() + 1;
        monthFilter.value = currentMonth;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    populateYearFilter();
    populateMonthFilter();

    checkAuth('admin').then(isAuthenticated => {
        if (isAuthenticated) {
            renderMenu(['product', 'total-vendor-list', 'sales-monitoring', 'delivery-management', 'expenses']);
            fetchDashboardData();

            supabase
                .channel('orders-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
                .subscribe();

            supabase
                .channel('expenses-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchDashboardData())
                .subscribe();

            supabase
                .channel('stock-payments-channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_payments' }, () => fetchDashboardData())
                .subscribe();
        }
    });
});
