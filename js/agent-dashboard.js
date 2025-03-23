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

async function fetchSummaryData() {
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
        .select('id', { count: 'exact' })
        .eq('agent_id', agentId);

    if (yearFilter !== 'all') {
        vendorQuery = vendorQuery
            .gte('created_at', startDate)
            .lte('created_at', endDate);
    }

    const { count: vendorCount, error: vendorError } = await vendorQuery;

    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }

    const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id')
        .eq('agent_id', agentId);

    if (vendorsError) {
        console.error('Error fetching vendors for orders:', vendorsError.message);
        return;
    }

    const vendorIds = vendors.map(v => v.id);

    let orderQuery = supabase
        .from('orders')
        .select('id, vendor_id, order_date, products', { count: 'exact' })
        .eq('placed_by', 'vendor')
        .in('vendor_id', vendorIds);

    if (yearFilter !== 'all') {
        orderQuery = orderQuery
            .gte('order_date', startDate)
            .lte('order_date', endDate);
    }

    const { data: orders, count: orderCount, error: orderError } = await orderQuery;

    if (orderError) {
        console.error('Error fetching orders:', orderError.message);
        return;
    }

    document.getElementById('total-vendors').textContent = vendorCount || 0;
    document.getElementById('total-orders').textContent = orderCount || 0;

    const vendorStats = vendors.map(vendor => {
        const vendorOrders = orders.filter(order => order.vendor_id === vendor.id);
        const totalStocksOrdered = vendorOrders.reduce((sum, order) => {
            return sum + order.products.reduce((acc, product) => acc + product.quantity, 0);
        }, 0);
        const lastOrder = vendorOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date))[0];
        return {
            vendor_id: vendor.id,
            totalStocksOrdered,
            lastOrderDate: lastOrder ? new Date(lastOrder.order_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'No orders'
        };
    });

    const { data: vendorDetails, error: vendorDetailsError } = await supabase
        .from('vendors')
        .select('id, name')
        .in('id', vendorIds);

    if (vendorDetailsError) {
        console.error('Error fetching vendor details:', vendorDetailsError.message);
        return;
    }

    const topVendors = vendorStats
        .map(stat => {
            const vendor = vendorDetails.find(v => v.id === stat.vendor_id);
            return {
                name: vendor ? vendor.name : 'Unknown Vendor',
                totalStocksOrdered: stat.totalStocksOrdered,
                lastOrderDate: stat.lastOrderDate
            };
        })
        .filter(v => v.totalStocksOrdered > 0)
        .sort((a, b) => b.totalStocksOrdered - a.totalStocksOrdered)
        .slice(0, 10);

    const topVendorsTableBody = document.querySelector('#top-vendors-table tbody');
    topVendorsTableBody.innerHTML = '';
    if (topVendors.length === 0) {
        topVendorsTableBody.innerHTML = '<tr><td colspan="3">No orders found for the selected period.</td></tr>';
    } else {
        topVendors.forEach(vendor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vendor.name}</td>
                <td>${vendor.totalStocksOrdered}</td>
                <td>${vendor.lastOrderDate}</td>
            `;
            topVendorsTableBody.appendChild(row);
        });
    }
}

function openAddVendorModal() {
    document.getElementById('add-vendor-form').reset();
    document.getElementById('vendor-agent').value = agentId;
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
        showToast('Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error } = await supabase
        .from('vendors')
        .insert({
            agent_id: parseInt(agentId),
            name,
            address,
            contact_number: contact,
            landmark,
            deployed_steamer: steamer,
            deployed_food_cart: cart,
            notes
        })
        .select();

    if (error) {
        showToast('Error adding vendor: ' + error.message);
        document.getElementById('loading-modal').style.display = 'none';
        return;
    }

    await supabase
        .from('history')
        .insert({
            entity_type: 'vendor',
            entity_id: data[0].id,
            change_type: 'create',
            details: { message: `Vendor ${name} created` }
        });

    showToast('Vendor added successfully!');
    document.getElementById('loading-modal').style.display = 'none';
    closeAddVendorModal();
    fetchSummaryData();
});

document.getElementById('month-filter').addEventListener('change', () => {
    fetchSummaryData();
});

document.getElementById('year-filter').addEventListener('change', () => {
    fetchSummaryData();
});

function setDefaultFilters() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    document.getElementById('month-filter').value = currentMonth.toString();
    document.getElementById('year-filter').value = currentYear.toString();
}

checkAuth('agent').then(isAuthenticated => {
    if (isAuthenticated) {
        fetchAgentId().then(success => {
            if (success) {
                renderMenu(['order-placement','total-vendor-list']); // Limited menu for agents
                setDefaultFilters();
                fetchSummaryData();
            }
        });
    }
});