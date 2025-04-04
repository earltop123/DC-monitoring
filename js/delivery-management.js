// Maintain a map of expanded states
let expandedStates = {};
let products = [];
let chiliSauceId = 10;
let currentFilter, cityFilter, sortOrder;

async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('id, name, stock');
    if (error) console.error('Error fetching products:', error.message);
    else products = data || []; // Simplified error handling
}

async function deductStock(order) {
    for (const product of order.products) {
        const productData = products.find(p => p.id === product.id);
        if (productData) {
            const newStock = productData.stock - product.quantity;
            const { error: stockError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', product.id);
            if (stockError) console.error('Error updating stock for product', product.id, ':', stockError.message);
        }
        if (product.chili_sauce && chiliSauceId) {
            const chiliData = products.find(p => p.id === chiliSauceId);
            if (chiliData) {
                const newChiliStock = chiliData.stock - product.quantity;
                const { error: chiliError } = await supabase
                    .from('products')
                    .update({ stock: newChiliStock })
                    .eq('id', chiliSauceId);
                if (chiliError) console.error('Error updating chili stock:', chiliError.message);
            }
        }
    }
}

async function fetchOrders(statusFilter = 'pending', distributorFilter = '', sortOrder = 'desc') {
    let query = supabase
        .from('orders')
        .select('*, vendors(name, contact_number), sales_agents(name), distributors(name)')
        .eq('status', statusFilter)
        .order('order_date', { ascending: sortOrder === 'asc' });

    if (distributorFilter) {
        query = query.eq('distributor_id', distributorFilter);
    }

    const { data: orders, error } = await query;
    if (error) {
        showMessageModal('Error', 'Error fetching orders: ' + error.message);
        return;
    }

    renderOrders(orders);
}

async function populateDistributorFilter() {
    const { data, error } = await supabase.from('distributors').select('id, name');
    if (error) {
        console.error('Error fetching distributors:', error.message);
        return;
    }
    const sortedDistributors = data.sort((a, b) => a.name.localeCompare(b.name));
    const distributorFilter = document.getElementById('distributor-filter');
    distributorFilter.innerHTML = '<option value="">All Distributors</option>' + 
        sortedDistributors.map(dist => `<option value="${dist.id}">${dist.name}</option>`).join('');
}

function renderOrders(orders) {
    const orderList = document.getElementById('order-list');
    orderList.innerHTML = '';
    orders.forEach(order => {
        const productsList = order.products.map(p => {
            const baseName = p.name === 'Chili Sauce (100grams)' ? 'Extra Chili Sauce (100 Grams)' : p.name;
            const displayName = p.chili_sauce ? `${baseName} with Chili Sauce` : baseName;
            const chiliSaucePrice = order.products.some(prod => prod.name === 'Chili Sauce (100grams)') 
                ? order.products.find(prod => prod.name === 'Chili Sauce (100grams)').price 
                : 0;
            const unitPrice = p.chili_sauce && p.name !== 'Chili Sauce (100grams)' 
                ? p.price + chiliSaucePrice 
                : p.price;
            const totalPrice = unitPrice * p.quantity;
            const unit = p.quantity === 1 ? 'pack' : 'packs';
            return `- ${displayName} (₱ ${unitPrice.toFixed(2)} x ${p.quantity} ${unit}) = ₱ ${totalPrice.toFixed(2)}`;
        }).join('\n'); // Newline for bulleted list

        const lastUpdated = order.payment_updated_at ? new Date(order.payment_updated_at) : new Date(order.order_date);
        const lastUpdatedStr = lastUpdated.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });

        const vendorName = order.vendors?.name || 'Vendor Deleted';
        const contactNumber = order.vendors?.contact_number || 'N/A';
        const contactLink = contactNumber !== 'N/A' 
            ? `<a href="tel:${contactNumber}" class="contact-link">${contactNumber}</a>` 
            : contactNumber;

        const orderBox = document.createElement('div');
        orderBox.className = 'order-box';
        orderBox.innerHTML = `
            <div class="order-header" onclick="toggleOrderDetails(${order.id})">
                <h3>Vendor: ${vendorName} || Number: ${contactLink}</h3>
                <span class="status ${order.status}">${order.status}</span>
                <span class="toggle-icon" id="toggle-icon-${order.id}">${expandedStates[order.id] ? '-' : '+'}</span>
            </div>
            <div class="order-details" id="order-details-${order.id}" style="display: ${expandedStates[order.id] ? 'block' : 'none'}">
                <br><br>
                <p><strong>Items:</strong><br>${productsList}</p>
                <p><strong>Agent Name:</strong> ${order.sales_agents?.name || 'N/A'}</p>
                <p><strong>Distributor:</strong> ${order.distributors?.name || 'N/A'}</p>
                <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
                <!-- ... rest of the HTML ... -->
            </div>
        `;
        orderList.appendChild(orderBox);
    });
}
function toggleOrderDetails(orderId) {
    const details = document.getElementById(`order-details-${orderId}`);
    const toggleIcon = document.getElementById(`toggle-icon-${orderId}`);
    if (details.style.display === 'block') {
        details.style.display = 'none';
        toggleIcon.textContent = '+';
        expandedStates[orderId] = false;
    } else {
        details.style.display = 'block';
        toggleIcon.textContent = '-';
        expandedStates[orderId] = true;
    }
}

async function showPaymentModal(orderId) {
    const paymentMethod = document.getElementById(`payment-method-${orderId}`).value;
    if (!paymentMethod) return;

    const { data: order, error } = await supabase
        .from('orders')
        .select('*, vendors(name), sales_agents(name)')
        .eq('id', orderId)
        .single();

    if (error) {
        showMessageModal('Error', 'Error fetching order: ' + error.message);
        return;
    }

    const productsList = order.products.map(p => {
        const baseName = p.name === 'Chili Sauce (100grams)' ? 'Extra Chili Sauce (100 Grams)' : p.name;
        const displayName = p.chili_sauce ? `${baseName} with Chili Sauce` : baseName;
        return `${displayName} (₱${p.price.toFixed(2)} x ${p.quantity})`;
    }).join(', ');

    const modal = document.getElementById('partial-payment-modal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.add('payment-review');

    if (paymentMethod === 'Partial') {
        modalContent.innerHTML = `
            <h2>Partial Payment Details</h2>
            <form id="partial-payment-form">
                <p><strong>Vendor:</strong> ${order.vendors?.name || 'N/A'}</p>
                <p><strong>Items:</strong> ${productsList}</p>
                <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
                <input type="hidden" id="partial-order-id" value="${orderId}">
                <label for="partial-amount-paid">Amount Paid:</label>
                <input type="number" id="partial-amount-paid" min="0" step="0.01" data-total-amount="${order.total_amount}" required>
                <label for="partial-payment-method">Payment Method:</label>
                <select id="partial-payment-method" required>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                </select>
                <div class="review-buttons">
                    <button type="button" onclick="submitPartialPayment(${orderId})">Delivered</button>
                    <button type="button" onclick="closePaymentModal()">Close</button>
                </div>
            </form>
        `;
    } else {
        modalContent.innerHTML = `
            <h2>Order Review</h2>
            <p><strong>Vendor:</strong> ${order.vendors?.name || 'N/A'}</p>
            <p><strong>Items:</strong> ${productsList}</p>
            <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            <input type="hidden" id="partial-order-id" value="${orderId}">
            <div class="review-buttons">
                <button type="button" onclick="updateOrderStatus(${order.id}, 'delivered')">Delivered</button>
                <button type="button" onclick="closePaymentModal()">Close</button>
            </div>
        `;
    }
    modal.style.display = 'flex';
}

async function updateOrderStatus(orderId, newStatus) {
    const paymentMethod = document.getElementById(`payment-method-${orderId}`).value;
    if (!paymentMethod && newStatus === 'delivered') {
        showMessageModal('Error', 'Please select a payment method before marking as delivered.');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (fetchError) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error fetching order: ' + fetchError.message);
        return;
    }

    let amountPaid = 0;
    let amountDue = 0;
    let finalPaymentMethod = paymentMethod || oldData.payment_method;

    if (newStatus === 'delivered' || newStatus === 'cancelled') {
        if (paymentMethod === 'Cash' || paymentMethod === 'Online') {
            amountPaid = oldData.total_amount;
            amountDue = 0;
        } else if (paymentMethod === 'Collectibles') {
            amountPaid = 0;
            amountDue = oldData.total_amount;
        } else if (paymentMethod === 'Partial') {
            amountPaid = oldData.amount_paid || 0;
            amountDue = oldData.amount_due || oldData.total_amount;
        }
    }

    const { error } = await supabase
        .from('orders')
        .update({
            status: newStatus,
            payment_method: finalPaymentMethod,
            amount_paid: amountPaid,
            amount_due: amountDue,
            payment_updated_at: (newStatus === 'delivered' || newStatus === 'cancelled') ? new Date().toISOString() : null
        })
        .eq('id', orderId);

    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error updating order: ' + error.message);
        return;
    }

    if (newStatus === 'delivered') await deductStock(oldData);

    const { error: historyError } = await supabase
        .from('history')
        .insert({
            entity_type: 'order',
            entity_id: orderId,
            change_type: 'edit',
            details: { old: oldData, new: { status: newStatus, payment_method: finalPaymentMethod, amount_paid: amountPaid, amount_due: amountDue } }
        });
    if (historyError) console.error('Error inserting history in updateOrderStatus:', historyError.message);

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order updated successfully!');
    closePaymentModal();
    updateFilters();
    fetchOrders(currentFilter, cityFilter, sortOrder);
}

async function submitPartialPayment(orderId) {
    const amountPaid = parseFloat(document.getElementById('partial-amount-paid').value) || 0;
    const totalAmount = parseFloat(document.getElementById('partial-amount-paid').dataset.totalAmount) || 0;
    const paymentMethod = document.getElementById('partial-payment-method').value;

    if (amountPaid >= totalAmount) {
        showMessageModal('Error', 'Amount paid cannot be greater than or equal to total amount for partial payment');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (fetchError) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error fetching order: ' + fetchError.message);
        return;
    }

    const amountDue = totalAmount - amountPaid;

    const { error } = await supabase
        .from('orders')
        .update({
            status: 'delivered',
            payment_method: 'Partial',
            amount_paid: amountPaid,
            amount_due: amountDue,
            payment_updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error updating order: ' + error.message);
        return;
    }

    await deductStock(oldData);

    const { error: historyError } = await supabase
        .from('history')
        .insert({
            entity_type: 'order',
            entity_id: orderId,
            change_type: 'edit',
            details: { 
                old: oldData, 
                new: { 
                    status: 'delivered', 
                    payment_method: 'Partial', 
                    amount_paid: amountPaid, 
                    amount_due: amountDue 
                },
                payment_amount: amountPaid,
                payment_method: paymentMethod
            }
        });
    if (historyError) console.error('Error inserting history in submitPartialPayment:', historyError.message);

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order marked as delivered with partial payment!');
    closePaymentModal();
    updateFilters();
    fetchOrders(currentFilter, cityFilter, sortOrder);
}

function closePaymentModal() {
    const modal = document.getElementById('partial-payment-modal');
    modal.style.display = 'none';
    modal.querySelector('.modal-content').classList.remove('payment-review');
}

function updateFilters() {
    currentFilter = document.getElementById('status-filter').value;
    distributorFilter = document.getElementById('distributor-filter').value;
    sortOrder = document.getElementById('sort-order')?.value || 'desc';
}
// Initialize
// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        updateFilters();
        fetchOrders('pending', distributorFilter, sortOrder); // Changed cityFilter to distributorFilter
        populateDistributorFilter();
        fetchProducts();

        const channel = supabase
            .channel('orders-channel')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                updateFilters();
                fetchOrders(currentFilter, distributorFilter, sortOrder); // Changed cityFilter to distributorFilter
            })
            .subscribe();
    }
});
