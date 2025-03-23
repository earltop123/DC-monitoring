// Pagination state for vendor log
let currentPage = 1;
const rowsPerPage = 20;
let totalRows = 0;
let filteredLogs = [];

async function populateAgentFilter() {
    const { data, error } = await supabase
        .from('sales_agents')
        .select('id, name')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching agents:', error.message);
        return;
    }

    const agentFilter = document.getElementById('agent-filter');
    agentFilter.innerHTML = '<option value="">All Agents</option>';
    data.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        agentFilter.appendChild(option);
    });

    const vendorAgent = document.getElementById('vendor-agent');
    const editVendorAgent = document.getElementById('edit-vendor-agent');
    vendorAgent.innerHTML = editVendorAgent.innerHTML = '';
    data.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        vendorAgent.appendChild(option.cloneNode(true));
        editVendorAgent.appendChild(option);
    });
}

async function fetchDashboardData() {
    const selectedAgentId = document.getElementById('agent-filter').value;

    let vendorQuery = supabase.from('vendors').select('*');
    if (selectedAgentId) vendorQuery = vendorQuery.eq('agent_id', selectedAgentId);
    const { data: vendors, error: vendorError } = await vendorQuery;

    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }

    document.getElementById('total-vendors').textContent = vendors.length;

    const vendorTableBody = document.querySelector('#vendor-table tbody');
    vendorTableBody.innerHTML = '';
    vendors.forEach(vendor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vendor.name}</td>
            <td>${vendor.address}</td>
            <td>${vendor.contact_number}</td>
            <td>
                <button class="edit-btn" onclick="openEditVendorModal(${vendor.id}, '${vendor.name}', '${vendor.address}', '${vendor.contact_number}', '${vendor.landmark || ''}', '${vendor.deployed_steamer}', '${vendor.deployed_food_cart}', '${vendor.notes || ''}', ${vendor.agent_id})">Edit</button>
                <button class="delete-btn" onclick="deleteVendor(${vendor.id})">Delete</button>
                <button class="history-btn" onclick="showHistory('vendor', ${vendor.id})">History</button>
            </td>
        `;
        vendorTableBody.appendChild(row);
    });

    let orderQuery = supabase.from('orders').select('*, vendors(name)');
    if (selectedAgentId) orderQuery = orderQuery.in('vendor_id', vendors.map(v => v.id));
    const { data: orders, error: orderError } = await orderQuery;

    if (orderError) {
        console.error('Error fetching orders:', orderError.message);
        return;
    }

    document.getElementById('total-orders').textContent = orders.length;

    const orderTableBody = document.querySelector('#order-table tbody');
    orderTableBody.innerHTML = '';
    orders.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.vendors.name}</td>
            <td>${new Date(order.order_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</td>
            <td>₱ ${order.total_amount.toFixed(2)}</td>
            <td>${order.status}</td>
            <td>
                <button class="edit-btn" onclick="openEditOrderModal(${order.id}, ${order.vendor_id}, '${order.order_date}', ${order.total_amount}, '${order.status}')">Edit</button>
                <button class="delete-btn" onclick="deleteOrder(${order.id})">Delete</button>
                <button class="history-btn" onclick="showHistory('order', ${order.id})">History</button>
            </td>
        `;
        orderTableBody.appendChild(row);
    });

    let logQuery = supabase.from('vendors').select('*');
    if (selectedAgentId) logQuery = logQuery.eq('agent_id', selectedAgentId);
    const { data: logVendors, error: logError } = await logQuery;

    if (logError) {
        console.error('Error fetching vendor log:', logError.message);
        return;
    }

    const vendorIds = logVendors.map(v => v.id);
    const { data: vendorOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('vendor_id', vendorIds);

    if (ordersError) {
        console.error('Error fetching vendor orders:', ordersError.message);
        return;
    }

    filteredLogs = logVendors.map(vendor => {
        const vendorOrdersList = vendorOrders.filter(o => o.vendor_id === vendor.id);
        const deliveredOrders = vendorOrdersList.filter(o => o.status === 'delivered').length;
        const lastOrder = vendorOrdersList.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0];
        const daysSinceLastOrder = lastOrder ? Math.floor((new Date() - new Date(lastOrder.order_date)) / (1000 * 60 * 60 * 24)) : 'No orders';
        return { ...vendor, deliveredOrders, daysSinceLastOrder };
    });

    totalRows = filteredLogs.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    currentPage = Math.min(currentPage, Math.max(1, totalPages));
    updatePagination(totalPages);

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedLogs = filteredLogs.slice(start, end);

    const logTableBody = document.querySelector('#vendor-log-table tbody');
    logTableBody.innerHTML = '';
    paginatedLogs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.name}</td>
            <td>${log.address}</td>
            <td>${log.contact_number}</td>
            <td>${log.deliveredOrders}</td>
            <td>${log.daysSinceLastOrder === 'No orders' ? 'No orders' : log.daysSinceLastOrder}</td>
            <td>
                <button class="edit-btn" onclick="openEditVendorModal(${log.id}, '${log.name}', '${log.address}', '${log.contact_number}', '${log.landmark || ''}', '${log.deployed_steamer}', '${log.deployed_food_cart}', '${log.notes || ''}', ${log.agent_id})">Edit</button>
                <button class="delete-btn" onclick="deleteVendor(${log.id})">Delete</button>
                <button class="history-btn" onclick="showHistory('vendor', ${log.id})">History</button>
            </td>
        `;
        logTableBody.appendChild(row);
    });
}

function updatePagination(totalPages) {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || totalPages === 0;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchDashboardData();
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        fetchDashboardData();
    }
});

document.getElementById('agent-filter').addEventListener('change', () => {
    currentPage = 1;
    fetchDashboardData();
});

function openAddVendorModal() {
    document.getElementById('add-vendor-form').reset();
    document.getElementById('add-vendor-modal').style.display = 'flex';
}

function closeAddVendorModal() {
    document.getElementById('add-vendor-modal').style.display = 'none';
}

document.getElementById('add-vendor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const agentId = document.getElementById('vendor-agent').value;
    const name = document.getElementById('vendor-name').value;
    const address = document.getElementById('vendor-address').value;
    const contact = document.getElementById('vendor-contact').value;
    const landmark = document.getElementById('vendor-landmark').value;
    const steamer = document.getElementById('vendor-steamer').value;
    const cart = document.getElementById('vendor-cart').value;
    const notes = document.getElementById('vendor-notes').value;

    if (!agentId || !name || !address || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error } = await supabase
        .from('vendors')
        .insert({ agent_id: agentId, name, address, contact_number: contact, landmark, deployed_steamer: steamer, deployed_food_cart: cart, notes })
        .select();

    if (error) {
        alert('Error adding vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase.from('history').insert({ entity_type: 'vendor', entity_id: data[0].id, change_type: 'create', details: { message: `Vendor ${name} created` } });

    showToast('Vendor added successfully!', fetchDashboardData);
    document.getElementById('loading-modal').style.display = 'none';
    closeAddVendorModal();
});

function openEditVendorModal(id, name, address, contact, landmark, steamer, cart, notes, agentId) {
    document.getElementById('edit-vendor-id').value = id;
    document.getElementById('edit-vendor-agent').value = agentId;
    document.getElementById('edit-vendor-name').value = name;
    document.getElementById('edit-vendor-address').value = address;
    document.getElementById('edit-vendor-contact').value = contact;
    document.getElementById('edit-vendor-landmark').value = landmark;
    document.getElementById('edit-vendor-steamer').value = steamer;
    document.getElementById('edit-vendor-cart').value = cart;
    document.getElementById('edit-vendor-notes').value = notes;
    document.getElementById('edit-vendor-modal').style.display = 'flex';
}

function closeEditVendorModal() {
    document.getElementById('edit-vendor-modal').style.display = 'none';
}

document.getElementById('edit-vendor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-vendor-id').value;
    const agentId = document.getElementById('edit-vendor-agent').value;
    const name = document.getElementById('edit-vendor-name').value;
    const address = document.getElementById('edit-vendor-address').value;
    const contact = document.getElementById('edit-vendor-contact').value;
    const landmark = document.getElementById('edit-vendor-landmark').value;
    const steamer = document.getElementById('edit-vendor-steamer').value;
    const cart = document.getElementById('edit-vendor-cart').value;
    const notes = document.getElementById('edit-vendor-notes').value;

    if (!agentId || !name || !address || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error: fetchError } = await supabase.from('vendors').select('*').eq('id', id).single();

    if (fetchError) {
        alert('Error fetching vendor: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const { error } = await supabase
        .from('vendors')
        .update({ agent_id: agentId, name, address, contact_number: contact, landmark, deployed_steamer: steamer, deployed_food_cart: cart, notes })
        .eq('id', id);

    if (error) {
        alert('Error updating vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase.from('history').insert({
        entity_type: 'vendor',
        entity_id: id,
        change_type: 'edit',
        details: { old: oldData, new: { agent_id: agentId, name, address, contact_number: contact, landmark, deployed_steamer: steamer, deployed_food_cart: cart, notes } }
    });

    showToast('Vendor updated successfully!', fetchDashboardData);
    document.getElementById('loading-modal').style.display = 'none';
    closeEditVendorModal();
});

async function deleteVendor(id) {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error: fetchError } = await supabase.from('vendors').select('*').eq('id', id).single();

    if (fetchError) {
        alert('Error fetching vendor: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const { error } = await supabase.from('vendors').delete().eq('id', id);

    if (error) {
        alert('Error deleting vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase.from('history').insert({ entity_type: 'vendor', entity_id: id, change_type: 'delete', details: { deleted: data } });

    showToast('Vendor deleted successfully!', fetchDashboardData);
    document.getElementById('loading-modal').style.display = 'none';
}

function openEditOrderModal(id, vendorId, orderDate, totalAmount, status) {
    document.getElementById('edit-order-id').value = id;
    document.getElementById('edit-order-vendor').value = vendorId;
    document.getElementById('edit-order-date').value = orderDate.slice(0, 16);
    document.getElementById('edit-order-amount').value = totalAmount;
    document.getElementById('edit-order-status').value = status;
    document.getElementById('edit-order-modal').style.display = 'flex';
}

function closeEditOrderModal() {
    document.getElementById('edit-order-modal').style.display = 'none';
}

document.getElementById('edit-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-order-id').value;
    const vendorId = document.getElementById('edit-order-vendor').value;
    const orderDate = document.getElementById('edit-order-date').value;
    const totalAmount = parseFloat(document.getElementById('edit-order-amount').value);
    const status = document.getElementById('edit-order-status').value;

    if (!vendorId || !orderDate || isNaN(totalAmount)) {
        alert('Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error: fetchError } = await supabase.from('orders').select('*').eq('id', id).single();

    if (fetchError) {
        alert('Error fetching order: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const { error } = await supabase
        .from('orders')
        .update({ vendor_id: vendorId, order_date: orderDate, total_amount: totalAmount, status })
        .eq('id', id);

    if (error) {
        alert('Error updating order: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase.from('history').insert({
        entity_type: 'order',
        entity_id: id,
        change_type: 'edit',
        details: { old: oldData, new: { vendor_id: vendorId, order_date: orderDate, total_amount: totalAmount, status } }
    });

    showToast('Order updated successfully!', fetchDashboardData);
    document.getElementById('loading-modal').style.display = 'none';
    closeEditOrderModal();
});

async function deleteOrder(id) {
    if (!confirm('Are you sure you want to delete this order?')) return;

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error: fetchError } = await supabase.from('orders').select('*').eq('id', id).single();

    if (fetchError) {
        alert('Error fetching order: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) {
        alert('Error deleting order: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase.from('history').insert({ entity_type: 'order', entity_id: id, change_type: 'delete', details: { deleted: data } });

    showToast('Order deleted successfully!', fetchDashboardData);
    document.getElementById('loading-modal').style.display = 'none';
}

async function showHistory(entityType, entityId) {
    const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('changed_at', { ascending: false });

    if (error) {
        alert('Error fetching history: ' + error.message);
        return;
    }

    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = data.length === 0 ? '<tr><td colspan="3">No history found</td></tr>' : '';
    data.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.change_type}</td>
            <td>${JSON.stringify(entry.details)}</td>
            <td>${new Date(entry.changed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('history-modal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        renderMenu(['product', 'vendors', 'sales', 'delivery-management']); // Admin-specific pages
        populateAgentFilter();
        fetchDashboardData();
    }
});