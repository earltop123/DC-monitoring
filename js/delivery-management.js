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
            if (newStock < 0) {
                showMessageModal('Error', `Insufficient stock for ${productData.name}. Required: ${product.quantity}, Available: ${productData.stock}`);
                return false; // Stop processing
            }
            const { error: stockError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', product.id);
            if (stockError) {
                console.error('Error updating stock for product', product.id, ':', stockError.message);
                showMessageModal('Error', `Failed to update stock for ${productData.name}: ${stockError.message}`);
                return false;
            }
        }
        if (product.chili_sauce && chiliSauceId) {
            const chiliData = products.find(p => p.id === chiliSauceId);
            if (chiliData) {
                const newChiliStock = chiliData.stock - product.quantity;
                if (newChiliStock < 0) {
                    showMessageModal('Error', `Insufficient stock for Chili Sauce. Required: ${product.quantity}, Available: ${chiliData.stock}`);
                    return false;
                }
                const { error: chiliError } = await supabase
                    .from('products')
                    .update({ stock: newChiliStock })
                    .eq('id', chiliSauceId);
                if (chiliError) {
                    console.error('Error updating chili stock:', chiliError.message);
                    showMessageModal('Error', `Failed to update Chili Sauce stock: ${chiliError.message}`);
                    return false;
                }
            }
        }
    }
    return true; // Success
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

function renderOrders(orders, updateSingleOrderId = null) {
    const orderList = document.getElementById('order-list');
    
    if (!updateSingleOrderId) {
        // Initial render or full refresh
        orderList.innerHTML = '';
        orders.forEach(order => renderSingleOrder(order, orderList));
    } else {
        // Update only the specific order
        const existingOrderBox = document.getElementById(`order-box-${updateSingleOrderId}`);
        const updatedOrder = orders.find(o => o.id === updateSingleOrderId);
        if (existingOrderBox && updatedOrder) {
            if (updatedOrder.status !== currentFilter) {
                // Remove if it no longer matches the filter
                existingOrderBox.remove();
            } else {
                // Replace the existing order box
                const newOrderBox = renderSingleOrder(updatedOrder);
                existingOrderBox.replaceWith(newOrderBox);
            }
        }
    }
}
function renderSingleOrder(order, orderList = null) {
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
    }).join('\n');

    const vendorName = order.vendors?.name || 'Vendor Deleted';
    const contactNumber = order.vendors?.contact_number || 'N/A';
    const contactLink = contactNumber !== 'N/A' 
        ? `<a href="tel:${contactNumber}" class="contact-link">${contactNumber}</a>` 
        : contactNumber;

    // Format timestamp in Manila timezone
    const orderDate = new Date(order.order_date);
    const timestamp = orderDate.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });

    const orderBox = document.createElement('div');
    orderBox.id = `order-box-${order.id}`;
    orderBox.className = 'order-box';
    orderBox.innerHTML = `
        <div class="order-header" onclick="toggleOrderDetails(${order.id})">
            <h3>Vendor: ${vendorName} || Number: ${contactLink}</h3>
            <span class="status ${order.status}">${order.status}</span>
            <span class="toggle-icon" id="toggle-icon-${order.id}">${expandedStates[order.id] ? '-' : '+'}</span>
        </div>
        <div class="order-details" id="order-details-${order.id}" style="display: ${expandedStates[order.id] ? 'block' : 'none'}">
            <br><br>
            <p><strong>Created:</strong> ${timestamp}</p>
            <p><strong>Items:</strong><br>${productsList}</p>
            <p><strong>Agent Name:</strong> ${order.sales_agents?.name || 'N/A'}</p>
            <p><strong>Distributor:</strong> ${order.distributors?.name || 'N/A'}</p>
            <p><strong>Total:</strong> ₱${order.total_amount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong></p>
            <select id="payment-method-${order.id}" onchange="handlePaymentMethod(${order.id}, this.value)" ${order.status !== 'pending' ? 'disabled' : ''}>
                <option value="">Select Payment Method</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Collectibles">Collectibles</option>
                <option value="Partial">Partial</option>
            </select>
            <div class="actions">
                <button class="cancel-btn" onclick="showCancelConfirmation(${order.id})" ${order.status !== 'pending' ? 'disabled' : ''}>Cancel</button>
            </div>
        </div>
    `;
    
    if (orderList) orderList.appendChild(orderBox);
    return orderBox;
}
function showCancelConfirmation(orderId) {
    const modal = document.getElementById('partial-payment-modal'); // Reuse existing modal
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Confirm Cancellation</h2>
            <p>Are you sure you want to cancel this order?</p>
            <div class="review-buttons">
                <button onclick="updateOrderStatus(${orderId}, 'cancelled')">Yes</button>
                <button onclick="closeModal()">No</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}
async function handlePaymentMethod(orderId, method) {
    if (!method) return;

    if (method === 'Cash' || method === 'Online' || method === 'Collectibles') {
        await updateOrderStatus(orderId, 'delivered', method);
    } else if (method === 'Partial') {
        showPartialPaymentModal(orderId);
    }
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

async function updateOrderStatus(orderId, newStatus, paymentMethod = null) {
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
    if (newStatus === 'delivered') {
        if (paymentMethod === 'Cash' || paymentMethod === 'Online') {
            amountPaid = oldData.total_amount;
            amountDue = 0;
        } else if (paymentMethod === 'Collectibles') {
            amountPaid = 0;
            amountDue = oldData.total_amount;
        }
        const stockSuccess = await deductStock(oldData);
        if (!stockSuccess) {
            document.getElementById('loading-modal').style.display = 'none';
            return;
        }
    }

    const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({
            status: newStatus,
            payment_method: paymentMethod || oldData.payment_method,
            amount_paid: amountPaid,
            amount_due: amountDue,
            payment_updated_at: newStatus === 'delivered' || newStatus === 'cancelled' ? new Date().toISOString() : null
        })
        .eq('id', orderId)
        .select('*, vendors(name, contact_number), sales_agents(name), distributors(name)')
        .single();

    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error updating order: ' + error.message);
        return;
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast(`Order ${newStatus === 'cancelled' ? 'cancelled' : 'delivered'} successfully!`);
    closeModal();

    // Update only the changed order
    renderOrders([updatedOrder], orderId);
}

async function showPartialPaymentModal(orderId) {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('status', 'pending') // Only pending
        .single();

    if (error || !order) return;

    const modal = document.getElementById('partial-payment-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Partial Payment</h2>
            <label for="partial-amount">Amount:</label>
            <input type="number" id="partial-amount" min="0" step="0.01" data-total="${order.total_amount}" required>
            <label for="partial-method">Method:</label>
            <select id="partial-method" required>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
            </select>
            <div class="review-buttons">
                <button onclick="submitPartialPayment(${orderId})">Confirm</button>
                <button onclick="closeModal()">Close</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}
async function submitPartialPayment(orderId) {
    const amountPaid = parseFloat(document.getElementById('partial-amount').value) || 0;
    const totalAmount = parseFloat(document.getElementById('partial-amount').dataset.total) || 0;
    const paymentMethod = document.getElementById('partial-method').value;

    if (amountPaid >= totalAmount) {
        showMessageModal('Error', 'Amount paid cannot be greater than or equal to total amount');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error fetching order: ' + error.message);
        return;
    }

    const stockSuccess = await deductStock(oldData);
    if (!stockSuccess) {
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const amountDue = totalAmount - amountPaid;

    const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({
            status: 'delivered',
            payment_method: 'Partial',
            amount_paid: amountPaid,
            amount_due: amountDue,
            payment_updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*, vendors(name, contact_number), sales_agents(name), distributors(name)')
        .single();

    if (updateError) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error updating order: ' + updateError.message);
        return;
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order delivered with partial payment!');
    closeModal();

    // Update only the changed order
    renderOrders([updatedOrder], orderId);
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
function closeModal() {
    const modal = document.getElementById('partial-payment-modal');
    modal.style.display = 'none';
}

// Prevent closing on outside click
document.getElementById('partial-payment-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.stopPropagation(); // Do nothing on outside click
});

// Initialize
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
    

/*checkAuth('admin').then(isAuthenticated => {
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
});*/
