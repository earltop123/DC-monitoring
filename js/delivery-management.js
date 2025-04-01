// Maintain a map of expanded states
let expandedStates = {};

// Fetch and display orders
async function fetchOrders(statusFilter = 'pending', cityFilter = '', sortOrder = 'desc') {
    let query = supabase
        .from('orders')
        .select('*, vendors(name, contact_number), sales_agents(name), cities(name)')
        .eq('status', statusFilter)
        .order('order_date', { ascending: sortOrder === 'asc' });

    if (cityFilter) {
        query = query.eq('city_id', cityFilter);
    }

    const { data: orders, error } = await query;

    if (error) {
        showMessageModal('Error', 'Error fetching orders: ' + error.message);
        return;
    }

    renderOrders(orders);
}

// Populate city filter dropdown
async function populateCityFilter() {
    const { data, error } = await supabase.from('cities').select('id, name');
    if (error) {
        console.error('Error fetching cities:', error.message);
        return;
    }
    // Sort cities alphabetically by name
    const sortedCities = data.sort((a, b) => a.name.localeCompare(b.name));
    const cityFilter = document.getElementById('city-filter');
    cityFilter.innerHTML = '<option value="">All Cities</option>' + 
        sortedCities.map(city => `<option value="${city.id}">${city.name}</option>`).join('');
}

// Render orders with preserved expand/collapse state
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
            return `${displayName} (₱ ${unitPrice.toFixed(2)} x ${p.quantity} ${unit}) = ₱ ${totalPrice.toFixed(2)}`;
        }).join(', ');

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
                <p><strong>Items:</strong> ${productsList}</p>
                <p><strong>Agent Name:</strong> ${order.sales_agents?.name || 'N/A'}</p>
                <p><strong>City:</strong> ${order.cities?.name || 'N/A'}</p>
                <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
                <select id="payment-method-${order.id}" onchange="showPaymentModal(${order.id})" ${order.status !== 'pending' ? 'disabled' : ''}>
                    <option value="">Select Payment Method</option>
                    <option value="Cash" ${order.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                    <option value="Online" ${order.payment_method === 'Online' ? 'selected' : ''}>Online</option>
                    <option value="Collectibles" ${order.payment_method === 'Collectibles' ? 'selected' : ''}>Collectibles</option>
                    <option value="Partial" ${order.payment_method === 'Partial' ? 'selected' : ''}>Partial Payment</option>
                </select>
                <div class="actions" ${order.status !== 'pending' ? 'style="display: none;"' : ''}>
                    <button class="cancel-btn" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel</button>
                </div>
                <p><strong>Last Updated:</strong> ${lastUpdatedStr}</p>
            </div>
        `;
        orderList.appendChild(orderBox);
    });
}

// Toggle order details visibility
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

// Show payment modal
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

// Update order status
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

    await supabase
        .from('history')
        .insert({
            entity_type: 'order',
            entity_id: orderId,
            change_type: 'update',
            details: { old: oldData, new: { status: newStatus, payment_method: finalPaymentMethod, amount_paid: amountPaid, amount_due: amountDue } }
        });

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order updated successfully!');
    closePaymentModal();
    const currentFilter = document.getElementById('status-filter').value;
    const cityFilter = document.getElementById('city-filter').value;
    const sortOrder = document.getElementById('sort-order')?.value || 'desc';
    fetchOrders(currentFilter, cityFilter, sortOrder);
}

// Submit partial payment
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

    await supabase
        .from('history')
        .insert({
            entity_type: 'order',
            entity_id: orderId,
            change_type: 'update',
            details: { old: oldData, new: { status: 'delivered', payment_method: 'Partial', amount_paid: amountPaid, amount_due: amountDue } }
        });

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order marked as delivered with partial payment!');
    closePaymentModal();
    const currentFilter = document.getElementById('status-filter').value;
    const cityFilter = document.getElementById('city-filter').value;
    const sortOrder = document.getElementById('sort-order')?.value || 'desc';
    fetchOrders(currentFilter, cityFilter, sortOrder);
}

// Close payment modal
function closePaymentModal() {
    const modal = document.getElementById('partial-payment-modal');
    modal.style.display = 'none';
    modal.querySelector('.modal-content').classList.remove('payment-review');
}

// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        const initialSortOrder = document.getElementById('sort-order')?.value || 'desc';
        const initialCityFilter = document.getElementById('city-filter')?.value || '';
        fetchOrders('pending', initialCityFilter, initialSortOrder);
        populateCityFilter();

        const channel = supabase
            .channel('orders-channel')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                const currentFilter = document.getElementById('status-filter').value;
                const cityFilter = document.getElementById('city-filter').value;
                const sortOrder = document.getElementById('sort-order')?.value || 'desc';
                fetchOrders(currentFilter, cityFilter, sortOrder);
            })
            .subscribe();
    }
});
