const supabaseUrl = 'https://vefirimqfcqcirgrhrpy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlyaW1xZmNxY2lyZ3JocnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NDg8MDIsImV4cCI6MjA1ODIyNDgwMn0.hLFVAUrrD1PtsfBbFuivh3b83z6YtMyKJrx8Idz2T_E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Check if user is logged in and has admin role
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        showMessageModal('Error', 'Please log in to access this page.');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return false;
    }

    // Fetch user role from profiles table
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile || profile.role !== 'admin') {
        showMessageModal('Error', 'Access denied. Admins only.');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return false;
    }

    return true;
}

// Logout function
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showMessageModal('Error', 'Error logging out: ' + error.message);
        return;
    }
    showToast('Logged out successfully!', () => {
        window.location.href = 'login.html';
    });
}

// Placeholder navigation function
function navigateTo(page) {
    console.log(`Navigating to ${page} page`);
}

// Function to show message modal (for errors)
function showMessageModal(title, message) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    document.getElementById('message-modal').style.display = 'flex';
}

// Function to close message modal
function closeMessageModal() {
    document.getElementById('message-modal').style.display = 'none';
}

// Function to show toast notification (for success)
function showToast(message, callback) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
        if (callback) callback();
    }, 2000);
}

// Maintain a map of expanded states
let expandedStates = {};

// Fetch and display orders
async function fetchOrders(statusFilter = 'pending') {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, vendors(name)')
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

        // Set initial state of delivered button
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

// Update delivered button state
function updateDeliveredButton(orderId) {
    const paymentMethod = document.getElementById(`payment-method-${orderId}`).value;
    const deliveredBtn = document.getElementById(`delivered-btn-${orderId}`);
    deliveredBtn.disabled = !paymentMethod;
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    const paymentMethod = document.getElementById(`payment-method-${orderId}`).value;
    if (!paymentMethod && newStatus === 'delivered') {
        showMessageModal('Error', 'Please select a payment method before marking as delivered.');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    // Fetch current order data
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
            // Show partial payment modal
            document.getElementById('partial-order-id').value = orderId;
            document.getElementById('partial-amount-paid').dataset.totalAmount = oldData.total_amount;
            document.getElementById('partial-payment-modal').style.display = 'flex';
            document.getElementById('loading-modal').style.display = 'none';
            return;
        }
    }

    // Update order
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

    // Log to history
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

// Handle partial payment form submission
document.getElementById('partial-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('partial-order-id').value;
    const amountPaid = parseFloat(document.getElementById('partial-amount-paid').value) || 0;
    const totalAmount = parseFloat(document.getElementById('partial-amount-paid').dataset.totalAmount) || 0;
    const paymentMethod = document.getElementById('partial-payment-method').value;

    if (amountPaid >= totalAmount) {
        showMessageModal('Error', 'Amount paid cannot be greater than or equal to total amount for partial payment');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    // Fetch current order data
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

    // Update order
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

    // Log to history
    await supabase
        .from('history')
        .insert({
            entity_type: 'order',
            entity_id: orderId,
            change_type: 'update',
            details: { old: oldData, new: { status: 'delivered', payment_method: 'Partial', amount_paid: amountPaid, amount_due: amountDue } }
        });

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order updated successfully!', () => {
        closePartialPaymentModal();
    });
});

// Close partial payment modal
function closePartialPaymentModal() {
    document.getElementById('partial-payment-modal').style.display = 'none';
}

// Event listener for status filter
document.getElementById('status-filter').addEventListener('change', (e) => {
    fetchOrders(e.target.value);
});

// Real-time subscription for orders table
const channel = supabase
    .channel('orders-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        console.log('Order updated:', payload);
        // Re-fetch orders with the current filter to update the UI
        fetchOrders(document.getElementById('status-filter').value);
    })
    .subscribe();

// Initialize
checkAuth().then(isAuthenticated => {
    if (isAuthenticated) {
        fetchOrders();
    }
});