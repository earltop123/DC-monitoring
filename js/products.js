const supabaseUrl = 'https://vefirimqfcqcirgrhrpy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlyaW1xZmNxY2lyZ3JocnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NDg4MDIsImV4cCI6MjA1ODIyNDgwMn0.hLFVAUrrD1PtsfBbFuivh3b83z6YtMyKJrx8Idz2T_E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Pagination state
let currentPage = 1;
const rowsPerPage = 50;
let totalRows = 0;
let filteredLogs = [];

// Placeholder function for navigation (to be implemented later)
function navigateTo(page) {
    console.log(`Navigating to ${page} page`);
    // Placeholder: Add navigation logic here once other pages are built
    // For now, we'll just log the page
    if (page === 'products') {
        // Already on this page
    } else if (page === 'vendors') {
        // Navigate to Vendor Activity page (to be implemented)
    } else if (page === 'sales') {
        // Navigate to Sales Dashboard page (to be implemented)
    }
}

// Function to fetch and display products
async function fetchProducts() {
    console.log('Fetching products from Supabase');
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching products:', error.message);
        return;
    }
    console.log('Fetched products:', data);

    const tbody = document.querySelector('#product-table tbody');
    tbody.innerHTML = '';

    data.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.selling_price.toFixed(2)}</td>
            <td>${product.supplier_price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>
                <button class="edit-btn" onclick="openEditProductModal(${product.id}, '${product.name}', ${product.selling_price}, ${product.supplier_price})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Populate the stock product dropdown
    const stockProductSelect = document.getElementById('stock-product-id');
    stockProductSelect.innerHTML = '<option value="">Select Product</option>';
    data.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        stockProductSelect.appendChild(option);
    });
    console.log('Product table and dropdown populated');
}

// Function to open Edit Product modal
function openEditProductModal(id, name, sellingPrice, supplierPrice) {
    console.log('Opening Edit Product modal for product ID:', id);
    document.getElementById('edit-product-id').value = id;
    document.getElementById('edit-product-name').value = name;
    document.getElementById('edit-selling-price').value = sellingPrice;
    document.getElementById('edit-supplier-price').value = supplierPrice;
    document.getElementById('edit-product-modal').style.display = 'flex';
}

// Function to close Edit Product modal
function closeEditProductModal() {
    console.log('Closing Edit Product modal');
    document.getElementById('edit-product-modal').style.display = 'none';
    document.getElementById('edit-product-form').reset();
}

// Function to handle Edit Product form submission
document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Edit product form submitted');

    const id = parseInt(document.getElementById('edit-product-id').value);
    const name = document.getElementById('edit-product-name').value;
    const sellingPrice = parseFloat(document.getElementById('edit-selling-price').value);
    const supplierPrice = parseFloat(document.getElementById('edit-supplier-price').value);

    if (!name || isNaN(sellingPrice) || sellingPrice < 0 || isNaN(supplierPrice) || supplierPrice < 0) {
        alert('Please enter valid values for all fields');
        return;
    }

    // Show loading modal
    console.log('Showing loading modal');
    document.getElementById('loading-modal').style.display = 'flex';

    console.log('Updating product:', { id, name, sellingPrice, supplierPrice });
    const { error } = await supabase
        .from('products')
        .update({
            name,
            selling_price: sellingPrice,
            supplier_price: supplierPrice
        })
        .eq('id', id);

    // Hide loading modal
    console.log('Hiding loading modal');
    document.getElementById('loading-modal').style.display = 'none';

    if (error) {
        console.error('Error updating product:', error.message);
        alert('Error updating product: ' + error.message);
        return;
    }

    alert('Product updated successfully!');
    closeEditProductModal();
    fetchProducts();
});

// Function to add a product (no logging for initial stock)
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Add product form submitted');

    const name = document.getElementById('product-name').value;
    const sellingPrice = parseFloat(document.getElementById('selling-price').value);
    const supplierPrice = parseFloat(document.getElementById('supplier-price').value);
    const initialStock = parseInt(document.getElementById('initial-stock').value);
    console.log('Adding product:', { name, sellingPrice, supplierPrice, initialStock });

    const { data, error } = await supabase
        .from('products')
        .insert({
            name,
            selling_price: sellingPrice,
            supplier_price: supplierPrice,
            stock: initialStock
        })
        .select();

    if (error) {
        console.error('Error adding product:', error.message);
        alert('Error adding product: ' + error.message);
        return;
    }
    console.log('Product added:', data);

    alert('Product added successfully!');
    e.target.reset();
    fetchProducts();
});

// Function to add stock (with logging)
document.getElementById('add-stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Add stock form submitted');

    const productId = parseInt(document.getElementById('stock-product-id').value);
    const quantity = parseInt(document.getElementById('stock-quantity').value);

    if (isNaN(productId) || quantity <= 0) {
        alert('Please select a product and enter a valid quantity');
        return;
    }

    // Fetch the product to get supplier price and name
    console.log('Fetching product for stock addition:', productId);
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, supplier_price, stock')
        .eq('id', productId)
        .single();

    if (productError) {
        console.error('Error fetching product:', productError.message);
        alert('Error fetching product: ' + productError.message);
        return;
    }
    console.log('Fetched product for stock:', product);

    const totalPrice = quantity * product.supplier_price;
    const addedAt = new Date().toISOString();
    console.log('Adding stock:', { productId, quantity, totalPrice });

    // Update stock in products table
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: product.stock + quantity })
        .eq('id', productId);

    if (updateError) {
        console.error('Error updating stock:', updateError.message);
        alert('Error updating stock: ' + updateError.message);
        return;
    }

    // Log the stock addition
    console.log('Logging stock addition');
    const { data: logData, error: logError } = await supabase
        .from('stock_logs')
        .insert({
            product_id: productId,
            product_name: product.name,
            quantity,
            total_price: totalPrice,
            added_at: addedAt
        })
        .select();

    if (logError) {
        console.error('Error logging stock addition:', logError.message);
        alert('Error logging stock addition: ' + logError.message);
        return;
    }

    alert('Stock added successfully!');
    e.target.reset();
    fetchProducts();
    fetchStockLogs();
});

// Function to populate month filter
function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    const currentYear = new Date().getFullYear();
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Add options for the last 12 months
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentYear, new Date().getMonth() - i, 1);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // e.g., "2024-10"
        const option = document.createElement('option');
        option.value = yearMonth;
        option.textContent = `${months[date.getMonth()]} ${date.getFullYear()}`;
        monthFilter.appendChild(option);
    }
}

// Function to fetch and display stock logs with pagination, filtering, and sorting
async function fetchStockLogs() {
    console.log('Fetching stock logs');
    const { data: logs, error: logError } = await supabase
        .from('stock_logs')
        .select('*');

    if (logError) {
        console.error('Error fetching stock logs:', logError.message);
        return;
    }
    console.log('Fetched stock logs:', logs);

    // Fetch all payments for the stock logs
    const stockLogIds = logs.map(log => log.id);
    const { data: payments, error: paymentError } = await supabase
        .from('stock_payments')
        .select('stock_log_id, amount')
        .in('stock_log_id', stockLogIds);

    if (paymentError) {
        console.error('Error fetching payments:', paymentError.message);
        return;
    }
    console.log('Fetched payments:', payments);

    // Calculate total payments per stock log
    const totalPaymentsByLog = {};
    let totalRemainingBalance = 0;
    payments.forEach(payment => {
        if (!totalPaymentsByLog[payment.stock_log_id]) {
            totalPaymentsByLog[payment.stock_log_id] = 0;
        }
        totalPaymentsByLog[payment.stock_log_id] += payment.amount;
    });
    console.log('Total payments by stock log:', totalPaymentsByLog);

    // Apply month filter
    const monthFilter = document.getElementById('month-filter').value;
    filteredLogs = logs;
    if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        filteredLogs = logs.filter(log => {
            const logDate = new Date(log.added_at);
            const manilaDate = new Date(logDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            return manilaDate.getFullYear() === year && (manilaDate.getMonth() + 1) === month;
        });
    }
    console.log('Filtered logs by month:', filteredLogs);

    // Apply sorting
    const sortOrder = document.getElementById('sort-order').value;
    filteredLogs.sort((a, b) => {
        const dateA = new Date(a.added_at);
        const dateB = new Date(b.added_at);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    console.log('Sorted logs:', filteredLogs);

    // Calculate total remaining balance
    filteredLogs.forEach(log => {
        const totalPaid = totalPaymentsByLog[log.id] || 0;
        const remainingBalance = log.total_price - totalPaid;
        totalRemainingBalance += remainingBalance;
    });
    document.getElementById('total-remaining-balance').textContent = `₱ ${totalRemainingBalance.toFixed(2)}`;
    console.log('Total remaining balance:', totalRemainingBalance);

    // Update pagination
    totalRows = filteredLogs.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    currentPage = Math.min(currentPage, Math.max(1, totalPages));
    updatePagination(totalPages);

    // Display paginated logs
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedLogs = filteredLogs.slice(start, end);

    const tbody = document.querySelector('#stock-log-table tbody');
    tbody.innerHTML = '';

    paginatedLogs.forEach(log => {
        const totalPaid = totalPaymentsByLog[log.id] || 0;
        const remainingBalance = log.total_price - totalPaid;
        const manilaDate = new Date(log.added_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.product_name}</td>
            <td>${log.quantity}</td>
            <td>₱ ${log.total_price.toFixed(2)}</td>
            <td>₱ ${remainingBalance.toFixed(2)}</td>
            <td>${manilaDate}</td>
            <td>
                <button class="payment-btn" onclick="openAddPaymentModal(${log.id})">Add Payment</button>
                <a class="history-link" onclick="showPaymentHistory(${log.id})">Show Payment History</a>
            </td>
        `;
        tbody.appendChild(row);
    });
    console.log('Stock log table populated');
}

// Function to update pagination controls
function updatePagination(totalPages) {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

// Pagination event listeners
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchStockLogs();
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        fetchStockLogs();
    }
});

// Filter and sort event listeners
document.getElementById('month-filter').addEventListener('change', () => {
    currentPage = 1; // Reset to first page on filter change
    fetchStockLogs();
});

document.getElementById('sort-order').addEventListener('change', () => {
    currentPage = 1; // Reset to first page on sort change
    fetchStockLogs();
});

// Function to open Add Payment modal
function openAddPaymentModal(stockLogId) {
    console.log('Opening Add Payment modal for stock log ID:', stockLogId);
    document.getElementById('payment-stock-log-id').value = stockLogId;
    document.getElementById('add-payment-modal').style.display = 'flex';
}

// Function to close Add Payment modal
function closeAddPaymentModal() {
    console.log('Closing Add Payment modal');
    document.getElementById('add-payment-modal').style.display = 'none';
    document.getElementById('add-payment-form').reset();
}

// Function to handle Add Payment form submission
document.getElementById('add-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Add payment form submitted');

    const stockLogId = parseInt(document.getElementById('payment-stock-log-id').value);
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const paymentMethod = document.getElementById('payment-method').value;

    if (isNaN(amount) || amount <= 0 || !paymentMethod) {
        alert('Please enter a valid amount and select a payment method');
        return;
    }

    // Show loading modal
    console.log('Showing loading modal');
    document.getElementById('loading-modal').style.display = 'flex';

    const paidAt = new Date().toISOString();
    console.log('Adding payment:', { stockLogId, amount, paymentMethod, paidAt });

    const { error } = await supabase
        .from('stock_payments')
        .insert({
            stock_log_id: stockLogId,
            amount,
            payment_method: paymentMethod,
            paid_at: paidAt
        });

    // Hide loading modal
    console.log('Hiding loading modal');
    document.getElementById('loading-modal').style.display = 'none';

    if (error) {
        console.error('Error adding payment:', error.message);
        alert('Error adding payment: ' + error.message);
        return;
    }

    alert('Payment added successfully!');
    closeAddPaymentModal();
    fetchStockLogs();
});

// Function to show Payment History modal
async function showPaymentHistory(stockLogId) {
    console.log('Fetching payment history for stock log ID:', stockLogId);
    const { data, error } = await supabase
        .from('stock_payments')
        .select('*')
        .eq('stock_log_id', stockLogId)
        .order('paid_at', { ascending: false });

    if (error) {
        console.error('Error fetching payment history:', error.message);
        alert('Error fetching payment history: ' + error.message);
        return;
    }
    console.log('Fetched payment history:', data);

    const tbody = document.querySelector('#payment-history-table tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No payments found</td></tr>';
    } else {
        data.forEach(payment => {
            const row = document.createElement('tr');
            const manilaDate = new Date(payment.paid_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
            row.innerHTML = `
                <td>₱ ${payment.amount.toFixed(2)}</td>
                <td>${payment.payment_method}</td>
                <td>${manilaDate}</td>
            `;
            tbody.appendChild(row);
        });
    }

    document.getElementById('payment-history-modal').style.display = 'flex';
}

// Function to close Payment History modal
function closePaymentHistoryModal() {
    console.log('Closing Payment History modal');
    document.getElementById('payment-history-modal').style.display = 'none';
}

// Initialize
console.log('Page initialization started');
populateMonthFilter();
fetchProducts();
fetchStockLogs();