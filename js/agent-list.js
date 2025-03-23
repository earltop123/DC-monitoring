async function fetchAgents(month, year) {
    const { data: agents, error } = await supabase.rpc('get_all_sales_agents');
    if (error) {
        console.error('Error fetching agents:', error.message);
        return;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const agentTableBody = document.querySelector('#agent-table tbody');
    agentTableBody.innerHTML = '';
    for (const agent of agents) {
        console.log(`Agent ${agent.name} contact_number:`, agent.contact_number);
        console.log(`Agent ${agent.name} join date (created_at):`, agent.created_at);

        const { data: vendors, error: vendorError } = await supabase
            .from('vendors')
            .select('*', { count: 'exact' })
            .eq('agent_id', agent.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());
        if (vendorError) {
            console.error('Error fetching vendors:', vendorError.message);
            continue;
        }

        const vendorIds = vendors.map(v => v.id);
        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('products')
            .in('vendor_id', vendorIds)
            .gte('order_date', startDate.toISOString())
            .lte('order_date', endDate.toISOString());
        if (orderError) {
            console.error('Error fetching orders:', orderError.message);
            continue;
        }

        const totalPacks = orders.reduce((sum, order) => {
            return sum + (order.products ? order.products.reduce((packSum, p) => packSum + (p.quantity || 0), 0) : 0);
        }, 0);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${agent.name}</td>
            <td>${agent.contact_number || 'N/A'}</td>
            <td>${vendors.length}</td>
            <td>${totalPacks}</td>
            <td>${agent.created_at ? new Date(agent.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A'}</td>
            <td>
                <button class="edit-btn" onclick="openEditModal(${agent.id}, '${agent.name}', '${agent.contact_number || ''}')">Edit</button>
                <button class="delete-btn" onclick="openDeleteModal(${agent.id})">Delete</button>
            </td>
        `;
        agentTableBody.appendChild(row);
    }
    return agents;
}

function openEditModal(id, name, contact) {
    document.getElementById('edit-agent-id').value = id;
    document.getElementById('edit-agent-name').value = name;
    document.getElementById('edit-agent-contact').value = contact;
    document.getElementById('edit-modal').style.display = 'flex';
}

function openDeleteModal(id) {
    document.getElementById('delete-modal').dataset.agentId = id;
    document.getElementById('delete-modal').style.display = 'flex';
}

async function confirmDelete() {
    const agentId = document.getElementById('delete-modal').dataset.agentId;
    document.getElementById('delete-modal').style.display = 'none';
    document.getElementById('loading-modal').style.display = 'flex';

    const { error } = await supabase
        .from('sales_agents')
        .delete()
        .eq('id', agentId);

    if (error) {
        console.error('Error deleting agent:', error.message);
        document.getElementById('loading-modal').style.display = 'none';
        showToast('Error deleting agent');
        return;
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Agent deleted successfully!');
    fetchAgents(
        document.getElementById('month-filter').value,
        document.getElementById('year-filter').value
    );
}

document.getElementById('edit-agent-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-agent-id').value;
    const name = document.getElementById('edit-agent-name').value;
    const contact = document.getElementById('edit-agent-contact').value;

    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('loading-modal').style.display = 'flex';

    const { error } = await supabase
        .from('sales_agents')
        .update({ name, contact_number: contact })
        .eq('id', id);

    if (error) {
        console.error('Error updating agent:', error.message);
        document.getElementById('loading-modal').style.display = 'none';
        showToast('Error updating agent');
        return;
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Agent updated successfully!');
    fetchAgents(
        document.getElementById('month-filter').value,
        document.getElementById('year-filter').value
    );
});

document.getElementById('month-filter').addEventListener('change', () => {
    fetchAgents(
        document.getElementById('month-filter').value,
        document.getElementById('year-filter').value
    );
});

document.getElementById('year-filter').addEventListener('change', () => {
    fetchAgents(
        document.getElementById('month-filter').value,
        document.getElementById('year-filter').value
    );
});

document.getElementById('download-csv').addEventListener('click', async () => {
    const agents = await fetchAgents(
        document.getElementById('month-filter').value,
        document.getElementById('year-filter').value
    );
    const csvContent = [
        ['Agent Name', 'Contact Number', 'Total Vendors', 'Total Packs'],
        ...agents.map(agent => [
            agent.name,
            agent.contact_number || 'N/A',
            document.querySelector(`#agent-table tbody tr:nth-child(${agents.indexOf(agent) + 1}) td:nth-child(3)`).textContent,
            document.querySelector(`#agent-table tbody tr:nth-child(${agents.indexOf(agent) + 1}) td:nth-child(4)`).textContent
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent_list.csv';
    a.click();
    window.URL.revokeObjectURL(url);
});

checkAuth().then(isAuthenticated => {
    if (isAuthenticated) {
        renderMenu('management-dashboard'); // Limited menu
        const now = new Date();
        document.getElementById('month-filter').value = now.getMonth() + 1;
        document.getElementById('year-filter').value = now.getFullYear();
        fetchAgents(now.getMonth() + 1, now.getFullYear());
    }
});