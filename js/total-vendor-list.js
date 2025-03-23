let agentId = null;

async function fetchAgentId() {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Fetching sales agent record for user ID:', session.user.id);
    const { data, error } = await supabase
        .from('sales_agents')
        .select('id, user_id, name')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Error fetching agent ID:', error.message);
        showToast('Error: Unable to fetch agent profile.', () => window.location.href = 'login.html');
        return false;
    }

    console.log('Sales agents query result:', data);

    if (!data || data.length === 0) {
        console.error('No sales agent record found for user:', session.user.id);
        showToast('Error: Sales agent profile not found. Please contact an admin.', () => window.location.href = 'login.html');
        return false;
    }

    agentId = data[0].id;
    console.log('Fetched agentId:', agentId);
    return true;
}

async function fetchVendors() {
    const monthFilter = document.getElementById('month-filter').value;
    const yearFilter = document.getElementById('year-filter').value;

    let startDate, endDate;

    if (yearFilter !== 'all') {
        const year = parseInt(yearFilter);
        if (monthFilter !== 'all') {
            const month = parseInt(monthFilter) - 1;
            startDate = new Date(year, month, 1).toISOString();
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
        } else {
            startDate = new Date(year, 0, 1).toISOString();
            endDate = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();
        }
    }

    let vendorQuery = supabase
        .from('vendors')
        .select('id, name, address, contact_number, landmark, deployed_steamer, deployed_food_cart, notes, created_at, agent_id')
        .eq('agent_id', agentId);

    if (yearFilter !== 'all') {
        vendorQuery = vendorQuery
            .gte('created_at', startDate)
            .lte('created_at', endDate);
    }

    const { data: vendors, error: vendorError } = await vendorQuery;

    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        showToast('Error fetching vendors: ' + vendorError.message);
        return;
    }

    const vendorTableBody = document.querySelector('#vendor-table tbody');
    vendorTableBody.innerHTML = '';
    if (vendors.length === 0) {
        vendorTableBody.innerHTML = '<tr><td colspan="9">No vendors found for the selected period.</td></tr>';
    } else {
        vendors.forEach(vendor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vendor.name}</td>
                <td>${vendor.address}</td>
                <td>${vendor.contact_number}</td>
                <td>${vendor.landmark || 'N/A'}</td>
                <td>${vendor.deployed_steamer}</td>
                <td>${vendor.deployed_food_cart}</td>
                <td>${vendor.notes || 'N/A'}</td>
                <td>${new Date(vendor.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}</td>
                <td>
                    <button class="edit-btn" onclick="openEditVendorModal(${vendor.id}, '${vendor.name}', '${vendor.address}', '${vendor.contact_number}', '${vendor.landmark || ''}', '${vendor.deployed_steamer}', '${vendor.deployed_food_cart}', '${vendor.notes || ''}', ${vendor.agent_id})">Edit</button>
                    <button class="delete-btn" onclick="deleteVendor(${vendor.id})">Delete</button>
                </td>
            `;
            vendorTableBody.appendChild(row);
        });
    }
}

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

    console.log('Editing vendor with ID:', id);
    console.log('Agent ID:', agentId);
    console.log('Updated values:', { name, address, contact_number: contact, landmark, deployed_steamer: steamer, deployed_food_cart: cart, notes });

    if (!agentId || !name || !address || !contact) {
        showToast('Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data: oldData, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) {
        console.error('Error fetching vendor:', fetchError.message);
        showToast('Error fetching vendor: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    console.log('Old vendor data:', oldData);

    const { data, error } = await supabase
        .from('vendors')
        .update({
            agent_id: parseInt(agentId),
            name,
            address,
            contact_number: contact,
            landmark,
            deployed_steamer: steamer,
            deployed_food_cart: cart,
            notes
        })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating vendor:', error.message);
        showToast('Error updating vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    console.log('Updated vendor data:', data);

    const { error: historyError } = await supabase
        .from('history')
        .insert({
            entity_type: 'vendor',
            entity_id: id,
            change_type: 'edit',
            details: { old: oldData, new: { agent_id: parseInt(agentId), name, address, contact_number: contact, landmark, deployed_steamer: steamer, deployed_food_cart: cart, notes } }
        });

    if (historyError) {
        console.error('Error logging history:', historyError.message);
        showToast('Vendor updated, but failed to log history: ' + historyError.message);
    } else {
        showToast('Vendor updated successfully!');
    }

    document.getElementById('loading-modal').style.display = 'none';
closeEditVendorModal();
    fetchVendors();
});


async function deleteVendor(id) {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) {
        showToast('Error fetching vendor: ' + fetchError.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);

    if (error) {
        showToast('Error deleting vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase
        .from('history')
        .insert({
            entity_type: 'vendor',
            entity_id: id,
            change_type: 'delete',
            details: { deleted: data }
        });

    showToast('Vendor deleted successfully!');
    document.getElementById('loading-modal').style.display = 'none';
    fetchVendors();
}

function setDefaultFilters() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    document.getElementById('month-filter').value = currentMonth.toString();
    document.getElementById('year-filter').value = currentYear.toString();
}

document.getElementById('month-filter').addEventListener('change', () => {
    fetchVendors();
});

document.getElementById('year-filter').addEventListener('change', () => {
    fetchVendors();
});

checkAuth('agent').then(isAuthenticated => {
    if (isAuthenticated) {
        fetchAgentId().then(success => {
            if (success) {
                renderMenu(['order-placement','agent-dashboard']); // Limited menu for agents
                setDefaultFilters();
                fetchVendors();
            }
        });
    }
});