let currentPage = 1;
const rowsPerPage = 40;

async function populateAgentFilter() {
    const { data: agents, error } = await supabase.rpc('get_all_sales_agents');
    if (error) {
        console.error('Error fetching agents via RPC:', error.message);
        return;
    }
    console.log('Fetched agents from RPC:', agents);
    const filterSelect = document.getElementById('agent-filter');
    filterSelect.innerHTML = '<option value="">All Agents</option>';
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        filterSelect.appendChild(option);
    });
}

async function fetchOverview(agentId = '') {
    let vendorQuery = supabase.from('vendors').select('*', { count: 'exact' });
    if (agentId) vendorQuery = vendorQuery.eq('agent_id', agentId);
    const { data: vendors, error: vendorError, count } = await vendorQuery;
    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }

    const vendorIds = vendors.map(v => v.id);
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('products')
        .in('vendor_id', vendorIds);
    if (orderError) {
        console.error('Error fetching orders:', orderError.message);
        return;
    }

    const totalPacks = orders.reduce((sum, order) => {
        return sum + order.products.reduce((packSum, product) => packSum + (product.quantity || 0), 0);
    }, 0);

    document.getElementById('total-vendors').textContent = count;
    document.getElementById('total-packs').textContent = totalPacks;
}

async function fetchVendors(agentId = '') {
    const { data: vendors, error } = await supabase.rpc('get_vendors_with_agents');
    if (error) {
        console.error('Error fetching vendors:', error.message);
        return;
    }
    console.log('Fetched vendors:', vendors);

    let filteredVendors = agentId ? vendors.filter(v => v.agent_id === parseInt(agentId)) : vendors;
    const totalRows = filteredVendors.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    currentPage = Math.min(currentPage, Math.max(1, totalPages));

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedVendors = filteredVendors.slice(start, end);

    const vendorTableBody = document.querySelector('#vendor-table tbody');
    vendorTableBody.innerHTML = '';
    paginatedVendors.forEach(vendor => {
        console.log('Vendor data:', vendor);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vendor.name}</td>
            <td>${vendor.address}</td>
            <td>${vendor.contact_number}</td>
            <td>${vendor.agent_name || 'Unassigned'}</td>
            <td><button class="history-btn" onclick="showHistory(${vendor.id}, 'vendor')">History</button></td>
        `;
        vendorTableBody.appendChild(row);
    });

    updatePagination(totalPages);
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
        fetchVendors(document.getElementById('agent-filter').value);
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    const agentId = document.getElementById('agent-filter').value;
    fetchVendors(agentId).then(() => {
        const totalRows = document.querySelectorAll('#vendor-table tbody tr').length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            fetchVendors(agentId);
        }
    });
});

async function showHistory(entityId, entityType) {
    const { data: history, error } = await supabase
        .from('history')
        .select('*, sales_agents!agent_id(name)')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .order('changed_at', { ascending: false });
    if (error) {
        console.error('Error fetching history:', error.message);
        return;
    }
    const modalContent = document.querySelector('#history-modal .modal-content');
    modalContent.innerHTML = `
        <h2>History</h2>
        <table>
            <thead>
                <tr>
                    <th>Change Type</th>
                    <th>Details</th>
                    <th>Added On</th>
                </tr>
            </thead>
            <tbody>
                ${history.map(entry => `
                    <tr>
                        <td>${entry.change_type}</td>
                        <td>${entry.change_type === 'create' && entry.sales_agents?.name ? `Added by ${entry.sales_agents.name}` : JSON.stringify(entry.details)}</td>
                        <td>${new Date(entry.changed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <button onclick="document.getElementById('history-modal').style.display = 'none'">Close</button>
    `;
    document.getElementById('history-modal').style.display = 'flex';
}

function updateData() {
    const agentId = document.getElementById('agent-filter').value;
    fetchOverview(agentId);
    fetchVendors(agentId);
}

checkAuth().then(isAuthenticated => {
    if (isAuthenticated) {
        renderMenu(['agent-list']); // Use full menu for management dashboard
        populateAgentFilter();
        fetchOverview();
        fetchVendors();
        document.getElementById('agent-filter').addEventListener('change', updateData);
    }
});