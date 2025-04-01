async function fetchOrders() {
    const paymentFilter = document.getElementById('payment-filter').value;
    const monthFilter = document.getElementById('month-filter').value;
    const yearFilter = document.getElementById('year-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;

    let query = supabase
        .from('orders')
        .select('*, vendors(name), cities_2(name)')
        .in('status', ['delivered', 'cancelled'])
        .order('order_date', { ascending: sortFilter === 'asc' }); // Sort by order_date

    if (paymentFilter) {
        if (paymentFilter === 'Paid Partial') {
            query = query.in('payment_method', ['Partial', 'Collectibles']).eq('amount_due', 0);
        } else if (paymentFilter === 'Partial' || paymentFilter === 'Collectibles') {
            query = query.eq('payment_method', paymentFilter).neq('amount_due', 0);
        } else {
            query = query.eq('payment_method', paymentFilter);
        }
    }
    if (monthFilter || yearFilter) {
        const year = yearFilter || new Date().getFullYear();
        if (monthFilter) {
            const start = new Date(year, monthFilter - 1, 1).toISOString();
            const end = new Date(year, monthFilter, 0).toISOString();
            query = query.gte('order_date', start).lte('order_date', end);
        } else {
            const start = new Date(year, 0, 1).toISOString();
            const end = new Date(year, 11, 31).toISOString();
            query = query.gte('order_date', start).lte('order_date', end);
        }
    }

    const { data, error } = await query;
    if (error) return console.error('Error fetching orders:', error.message);
    renderOrders(data);
}

function renderOrders(orders) {
    const orderList = document.getElementById('order-list');
    orderList.innerHTML = orders.map(order => {
        const canUpdate = ['Partial', 'Collectibles'].includes(order.payment_method) && order.status !== 'cancelled' && order.amount_due > 0;
        const rowClass = order.status === 'cancelled' ? 'cancelled' : '';
        const dateStr = order.payment_updated_at 
            ? new Date(order.payment_updated_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
            : new Date(order.order_date).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
        return `
            <div class="order-row ${rowClass}">
                <div>Date: ${dateStr}</div>
                <div>Vendor: ${order.vendors?.name || 'N/A'}</div>
                <div>City: ${order.cities_2?.name || 'N/A'}</div>
                <div>Total: ₱${order.total_amount.toFixed(2)}</div>
                <div>Paid: ₱${(order.amount_paid || 0).toFixed(2)}</div>
                <div>Due: ₱${(order.amount_due || 0).toFixed(2)}</div>
                <div>Method: ${order.payment_method || 'N/A'}</div>
                <div>Status: ${order.status}</div>
                <div>${canUpdate ? `<button onclick="showPaymentModal(${order.id})">Add Payment</button><button onclick="showHistory(${order.id})">History</button>` : ''}</div>
            </div>
        `;
    }).join('');
}
async function showPaymentModal(orderId) {
    const { data: order, error } = await supabase
        .from('orders')
        .select('total_amount, amount_paid')
        .eq('id', orderId)
        .single();
    if (error) return console.error('Error fetching order:', error.message);

    document.getElementById('payment-order-id').value = orderId;
    document.getElementById('payment-amount').value = '';
    document.getElementById('remaining-balance').textContent = `Remaining Balance: ₱${(order.total_amount - (order.amount_paid || 0)).toFixed(2)}`;
    document.getElementById('payment-modal').style.display = 'block';
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

async function showHistory(orderId) {
    const { data, error } = await supabase
        .from('history')
        .select('details, created_at')
        .eq('entity_id', orderId)
        .eq('entity_type', 'order');
    if (error) return console.error('Error fetching history:', error.message);
    
    const historyTable = document.getElementById('history-table').querySelector('tbody');
    historyTable.innerHTML = data.map(entry => {
        const paymentAmount = entry.details.payment_amount || ((entry.details.new.amount_paid || 0) - (entry.details.old.amount_paid || 0));
        return `
            <tr>
                <td>${new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</td>
                <td>₱${paymentAmount.toFixed(2)}</td>
                <td>${entry.details.payment_method || 'Initial'}</td>
            </tr>
        `;
    }).join('');
    document.getElementById('history-modal').style.display = 'block';
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}

function populateYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    yearFilter.innerHTML = '<option value="">All Years</option>' + 
        Array.from({ length: 5 }, (_, i) => `<option value="${currentYear - i}" ${currentYear - i === currentYear ? 'selected' : ''}>${currentYear - i}</option>`).join('');
    yearFilter.value = currentYear; // Default to current year
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    const currentMonth = new Date().getMonth() + 1; // 1-12
    monthFilter.value = currentMonth; // Default to current month
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin').then(isAuthenticated => {
        if (isAuthenticated) {
            populateYearFilter();
            populateMonthFilter();
            fetchOrders();

            const channel = supabase
                .channel('orders-channel')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                    fetchOrders();
                })
                .subscribe();

            document.getElementById('payment-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const orderId = document.getElementById('payment-order-id').value;
                const amountPaid = parseFloat(document.getElementById('payment-amount').value);
                const paymentMethod = document.getElementById('payment-method').value;

                const { data: order, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', orderId)
                    .single();
                if (error) return console.error('Error fetching order:', error.message);

                const oldAmountPaid = order.amount_paid || 0;
                const newAmountPaid = oldAmountPaid + amountPaid;
                const newAmountDue = order.total_amount - newAmountPaid;
                if (newAmountPaid > order.total_amount) return alert('Payment exceeds total.');

                const { error: updateError } = await supabase
                    .from('orders')
                    .update({ amount_paid: newAmountPaid, amount_due: newAmountDue, payment_updated_at: new Date().toISOString() })
                    .eq('id', orderId);
                if (updateError) return console.error('Error updating order:', updateError.message);

                const { error: historyError } = await supabase
                    .from('history')
                    .insert({
                        entity_type: 'order',
                        entity_id: orderId,
                        change_type: 'edit',
                        details: { 
                            old: { amount_paid: oldAmountPaid, amount_due: order.amount_due },
                            new: { amount_paid: newAmountPaid, amount_due: newAmountDue },
                            payment_amount: amountPaid,
                            payment_method: paymentMethod
                        }
                    });
                if (historyError) console.error('Error inserting history:', historyError.message);

                closePaymentModal();
                fetchOrders();
            });
        }
    });
});
