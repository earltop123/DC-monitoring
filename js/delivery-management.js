// Maintain a map of expanded states
let expandedStates = {};

// Fetch and display orders
async function fetchOrders(statusFilter = 'pending') {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, vendors(name), sales_agents(name)')
        .eq('status', statusFilter)
        .order('order_date', { ascending: false });

    if (error) {
        showMessageModal('Error', 'Error fetching orders: ' + error.message);
        return;
    }

    renderOrders(orders);
}

// Render orders with preserved expand/collapse state
function renderOrders(orders) {
    const orderList = document.getElementById('order-list');
    orderList.innerHTML = '';
    orders.forEach(order => {
        const productsList = order.products.map(p => `${p.name}: ${p.quantity}`).join(', ');
        const lastUpdated = order.payment_updated_at ? new Date(order.payment_updated_at) : new Date(order.order_date);
        const lastUpdatedStr = lastUpdated.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });

        const orderBox = document.createElement('div');
        orderBox.className = 'order-box';
        orderBox.innerHTML = `
            <div class="order-header" onclick="toggleOrderDetails(${order.id})">
                <h3>Vendor: ${order.vendors.name}</h3>
                <span class="status ${order.status}">${order.status}</span>
                <span class="toggle-icon" id="toggle-icon-${order.id}">${expandedStates[order.id] ? '-' : '+'}</span>
            </div>
            <div class="order-details" id="order-details-${order.id}" style="display: ${expandedStates[order.id] ? 'block' : 'none'}">
                <p><strong>Items:</strong> ${productsList}</p>
                <p><strong>Agent Name:</strong> ${order.sales_agents?.name || 'N/A'}</p>
                <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
                <select id="payment-method-${order.id}" onchange="updateDeliveredButton(${order.id})" ${order.status !== 'pending' ? 'disabled' : ''}>
                    <option value="">Select Payment Method</option>
                    <option value="Cash" ${order.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                    <option value="Online" ${order.payment_method === 'Online' ? 'selected' : ''}>Online</option>
                    <option value="Collectibles" ${order.payment_method === 'Collectibles' ? 'selected' : ''}>Collectibles</option>
                    <option value="Partial" ${order.payment_method === 'Partial' ? 'selected' : ''}>Partial Payment</option>
                </select>
                <div class="actions" ${order.status !== 'pending' ? 'style="display: none;"' : ''}>
                    <button class="delivered-btn" id="delivered-btn-${order.id}" onclick="updateOrderStatus(${order.id}, 'delivered')" disabled>Delivered</button>
                    <button class="cancel-btn" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel</button>
                </div>
                <p><strong>Last Updated:</strong> ${lastUpdatedStr}</p>
            </div>
        `;
        orderList.appendChild(orderBox);

        updateDeliveredButton(order.id);
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

// Update delivered button state and show partial payment modal if needed
async function updateDeliveredButton(orderId) {
    const paymentMethod = document.getElementById(`payment-method-${orderId}`).value;
    const deliveredBtn = document.getElementById(`delivered-btn-${orderId}`);
    const orderStatus = deliveredBtn.closest('.order-box').querySelector('.status').textContent;

    deliveredBtn.disabled = !paymentMethod;

    // Only show partial payment modal for "pending" orders
    if (paymentMethod === 'Partial' && orderStatus === 'pending') {
        const partialModal = document.getElementById('partial-payment-modal');
        if (!partialModal) {
            console.error('Partial payment modal not found in DOM');
            showMessageModal('Error', 'Partial payment modal not found.');
            return;
        }

        const { data: orderData, error: fetchError } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('id', orderId)
            .single();

        if (fetchError) {
            showMessageModal('Error', 'Error fetching order: ' + fetchError.message);
            return;
        }

        const partialOrderIdInput = document.getElementById('partial-order-id');
        const partialAmountPaidInput = document.getElementById('partial-amount-paid');
        if (!partialOrderIdInput || !partialAmountPaidInput) {
            console.error('Partial payment form inputs not found in DOM');
            showMessageModal('Error', 'Partial payment form inputs not found.');
            return;
        }

        partialOrderIdInput.value = orderId;
        partialAmountPaidInput.dataset.totalAmount = orderData.total_amount;
        partialModal.style.display = 'flex';
        console.log('Partial payment modal should be visible now');
    }
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
    let finalPaymentMethod = paymentMethod;

    if (newStatus === 'delivered' || newStatus === 'cancelled') {
        if (paymentMethod === 'Cash' || paymentMethod === 'Online') {
            amountPaid = oldData.total_amount;
            amountDue = 0;
        } else if (paymentMethod === 'Collectibles') {
            amountPaid = 0;
            amountDue = oldData.total_amount;
        } else if (paymentMethod === 'Partial') {
            // For partial payment, the amount_paid and amount_due should already be updated by the modal submission
            amountPaid = oldData.amount_paid || 0;
            amountDue = oldData.amount_due || oldData.total_amount;
            if (amountPaid === 0 && amountDue === 0) {
                document.getElementById('loading-modal').style.display = 'none';
                showMessageModal('Error', 'Please complete the partial payment before marking as delivered.');
                return;
            }
        }
    }

    const { error } = await supabase
        .from('orders')
        .update({
            status: newStatus,
            payment_method: (newStatus === 'delivered' || newStatus === 'cancelled') ? finalPaymentMethod : null,
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
}

// Close partial payment modal
function closePartialPaymentModal() {
    document.getElementById('partial-payment-modal').style.display = 'none';
}

// Event listener for status filter
document.getElementById('status-filter').addEventListener('change', (e) => {
    fetchOrders(e.target.value);
});

// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        fetchOrders();

        const channel = supabase
            .channel('orders-channel')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                const currentFilter = document.getElementById('status-filter').value;
                fetchOrders(currentFilter);
            })
            .subscribe();

        // Add event listener for partial payment form submission
        const partialPaymentForm = document.getElementById('partial-payment-form');
        if (partialPaymentForm) {
            console.log('Partial payment form found, adding event listener');
            partialPaymentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Partial payment form submitted');
                const orderId = document.getElementById('partial-order-id').value;
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
                        details: { old: oldData, new: { payment_method: 'Partial', amount_paid: amountPaid, amount_due: amountDue } }
                    });

                document.getElementById('loading-modal').style.display = 'none';
                showToast('Partial payment recorded successfully!', () => {
                    closePartialPaymentModal();
                });
            });
        } else {
            console.error('Partial payment form not found in DOM during initialization');
        }
    }
});
