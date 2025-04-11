let expensesChart, trendsChart;

async function fetchDashboardData() {
    const monthFilter = document.getElementById('month-filter').value;
    const yearFilter = document.getElementById('year-filter').value;
    const now = new Date();
    const currentYear = now.getFullYear();

    // Fetch sales data
    let salesQuery = supabase
        .from('orders')
        .select('total_amount, amount_paid, order_date, products, payment_method')
        .eq('status', 'delivered');
    if (monthFilter || yearFilter) {
        const year = yearFilter || currentYear;
        if (monthFilter) {
            const start = new Date(year, monthFilter - 1, 1).toISOString();
            const end = new Date(year, monthFilter, 0).toISOString();
            salesQuery = salesQuery.gte('order_date', start).lte('order_date', end);
        } else {
            const start = new Date(year, 0, 1).toISOString();
            const end = new Date(year, 11, 31).toISOString();
            salesQuery = salesQuery.gte('order_date', start).lte('order_date', end);
        }
    }
    const { data: deliveredOrders, error: salesError } = await salesQuery;
    if (salesError) {
        console.error('Error fetching sales:', salesError.message);
        return;
    }

    // Cash Received
    const cashReceived = deliveredOrders.reduce((sum, order) => sum + (order.amount_paid || order.total_amount), 0);
    document.getElementById('cash-received').textContent = `₱ ${cashReceived.toFixed(2)}`;

    // Total Revenue
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total_amount, 0);
    document.getElementById('total-revenue').textContent = `₱ ${totalRevenue.toFixed(2)}`;

    // Year to Date Sales (ignores month filter)
    const { data: ytdOrders, error: ytdError } = await supabase
        .from('orders')
        .select('total_amount, amount_paid, order_date')
        .eq('status', 'delivered')
        .gte('order_date', `${yearFilter || currentYear}-01-01`)
        .lte('order_date', `${yearFilter || currentYear}-12-31`);
    if (ytdError) {
        console.error('Error fetching YTD sales:', ytdError.message);
        return;
    }
    const ytdSales = ytdOrders.reduce((sum, order) => sum + (order.amount_paid || order.total_amount), 0);
    document.getElementById('ytd-sales').textContent = `₱ ${ytdSales.toFixed(2)}`;

    // Total Sales This Month
    const monthSales = deliveredOrders
        .filter(order => !monthFilter || new Date(order.order_date).getMonth() + 1 === parseInt(monthFilter))
        .reduce((sum, order) => sum + (order.amount_paid || order.total_amount), 0);
    document.getElementById('month-sales').textContent = `₱ ${monthSales.toFixed(2)}`;

    // Fetch expenses
    let expensesQuery = supabase
        .from('expenses')
        .select('amount, category, expense_date');
    if (monthFilter || yearFilter) {
        const year = yearFilter || currentYear;
        if (monthFilter) {
            const start = new Date(year, monthFilter - 1, 1).toISOString();
            const end = new Date(year, monthFilter, 0).toISOString();
            expensesQuery = expensesQuery.gte('expense_date', start).lte('expense_date', end);
        } else {
            const start = new Date(year, 0, 1).toISOString();
            const end = new Date(year, 11, 31).toISOString();
            expensesQuery = expensesQuery.gte('expense_date', start).lte('expense_date', end);
        }
    }
    const { data: expenses, error: expensesError } = await expensesQuery;
    if (expensesError) {
        console.error('Error fetching expenses:', expensesError.message);
        return;
    }
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('total-expenses').textContent = `₱ ${totalExpenses.toFixed(2)}`;

    // Distributors and Investors Share
    const totalPacks = deliveredOrders.reduce((sum, order) => {
        return sum + order.products
            .filter(p => p.name !== 'Chili Sauce (100grams)')
            .reduce((qty, p) => qty + p.quantity, 0);
    }, 0);
    const distributorsShare = totalPacks * 15; // ₱15 per pack
    const investorsShare = totalPacks * 13.5; // ₱13.5 per pack
    document.getElementById('distributors-share').textContent = `₱ ${distributorsShare.toFixed(2)}`;
    document.getElementById('investors-share').textContent = `₱ ${investorsShare.toFixed(2)}`;

    // Remaining Supplier Credit
    const supplierCreditBase = totalPacks * 121.5; // ₱121.5 per pack
    let paymentsQuery = supabase
        .from('stock_payments')
        .select('amount, paid_at'); // Changed to paid_at
    if (monthFilter || yearFilter) {
        const year = yearFilter || currentYear;
        if (monthFilter) {
            const start = new Date(year, monthFilter - 1, 1).toISOString();
            const end = new Date(year, monthFilter, 0).toISOString();
            paymentsQuery = paymentsQuery.gte('paid_at', start).lte('paid_at', end);
        } else {
            const start = new Date(year, 0, 1).toISOString();
            const end = new Date(year, 11, 31).toISOString();
            paymentsQuery = paymentsQuery.gte('paid_at', start).lte('paid_at', end);
        }
    }
    const { data: stockPayments, error: paymentsError } = await paymentsQuery;
    if (paymentsError) {
        console.error('Error fetching stock payments:', paymentsError.message);
        return;
    }
    const totalPayments = stockPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingSupplierCredit = supplierCreditBase - totalPayments;
    document.getElementById('supplier-credit').textContent = `₱ ${remainingSupplierCredit.toFixed(2)}`;

    // Net Profit
    const netProfit = distributorsShare - totalExpenses;
    document.getElementById('net-profit').textContent = `₱ ${netProfit.toFixed(2)}`;

    // Pending Payments
    const { data: pendingPaymentOrders, error: pendingError } = await supabase
        .from('orders')
        .select('amount_due, order_date')
        .eq('status', 'delivered')
        .gt('amount_due', 0)
        .gte('order_date', monthFilter || yearFilter ? `${yearFilter || currentYear}-${monthFilter ? String(monthFilter).padStart(2, '0') : '01'}-01` : '1900-01-01')
        .lte('order_date', monthFilter || yearFilter ? `${yearFilter || currentYear}-${monthFilter ? String(monthFilter).padStart(2, '0') : '12'}-${monthFilter ? new Date(yearFilter || currentYear, monthFilter, 0).getDate() : '31'}` : '9999-12-31');
    if (pendingError) {
        console.error('Error fetching pending payments:', pendingError.message);
        return;
    }
    const pendingPayments = pendingPaymentOrders.reduce((sum, order) => sum + order.amount_due, 0);
    document.getElementById('pending-payments').textContent = `₱ ${pendingPayments.toFixed(2)}`;

    // Total Amount of Collectibles
    const collectiblesTotal = deliveredOrders
        .filter(order => order.payment_method === 'Collectibles')
        .reduce((sum, order) => sum + (order.amount_due || 0), 0);
    document.getElementById('collectibles-total').textContent = `₱ ${collectiblesTotal.toFixed(2)}`;

    // Active Vendors
    const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select('id');
    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }
    const vendorIds = vendors.map(v => v.id);
    let activeQuery = supabase
        .from('orders')
        .select('vendor_id')
        .eq('status', 'delivered')
        .in('vendor_id', vendorIds);
    if (monthFilter || yearFilter) {
        const year = yearFilter || currentYear;
        if (monthFilter) {
            const start = new Date(year, monthFilter - 1, 1).toISOString();
            const end = new Date(year, monthFilter, 0).toISOString();
            activeQuery = activeQuery.gte('order_date', start).lte('order_date', end);
        } else {
            const start = new Date(year, 0, 1).toISOString();
            const end = new Date(year, 11, 31).toISOString();
            activeQuery = activeQuery.gte('order_date', start).lte('order_date', end);
        }
    }
    const { data: activeOrders, error: activeError } = await activeQuery;
    if (activeError) {
        console.error('Error fetching active vendors:', activeError.message);
        return;
    }
    const activeVendorIds = [...new Set(activeOrders.map(o => o.vendor_id))];
    document.getElementById('active-vendors').textContent = activeVendorIds.length;

    // Expenses by Category Pie Chart
    const categoryTotals = expenses.reduce((acc, expense) => {
        const category = expense.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + expense.amount;
        return acc;
    }, {});
    const expensesCtx = document.getElementById('expenses-chart').getContext('2d');
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

    // Monthly Trends Line Chart
    const year = yearFilter || currentYear;
    const monthlyData = Array(12).fill(0).map(() => ({ cash: 0, revenue: 0, paid: 0 }));
    deliveredOrders.forEach(order => {
        const month = new Date(order.order_date).getMonth();
        monthlyData[month].cash += order.amount_paid || order.total_amount;
        monthlyData[month].revenue += order.total_amount;
    });
    stockPayments.forEach(payment => {
        const month = new Date(payment.paid_at).getMonth();
        monthlyData[month].paid += payment.amount;
    });

    const trendsCtx = document.getElementById('trends-chart').getContext('2d');
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

function populateYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    yearFilter.innerHTML = '<option value="">All Years</option>' + 
        Array.from({ length: 5 }, (_, i) => `<option value="${currentYear - i}" ${currentYear - i === currentYear ? 'selected' : ''}>${currentYear - i}</option>`).join('');
    yearFilter.value = currentYear;
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    const currentMonth = new Date().getMonth() + 1;
    monthFilter.value = currentMonth;
}

// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        renderMenu(['product', 'total-vendor-list', 'sales-monitoring', 'delivery-management', 'expenses']);
        populateYearFilter();
        populateMonthFilter();
        fetchDashboardData();

        supabase
            .channel('orders-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        supabase
            .channel('expenses-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
                fetchDashboardData();
            })
            .subscribe();

        supabase
            .channel('stock-payments-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_payments' }, () => {
                fetchDashboardData();
            })
            .subscribe();
    }
});
