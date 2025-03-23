// order-placement.js
let products = [];
let chiliSauceId = null;
let productRows = 1;
let pendingOrderData = null;

function showChiliSauceModal(bundledChiliSauceCount, extraChiliSauceCount) {
    const modal = document.getElementById('chili-sauce-modal') || createModal('chili-sauce-modal', `
        <p id="chili-sauce-message"></p>
        <button onclick="confirmChiliSauce(true)">Yes</button>
        <button onclick="confirmChiliSauce(false)">No</button>
    `);
    modal.querySelector('#chili-sauce-message').textContent = 
        `You have included chili sauce with your products (${bundledChiliSauceCount} packs) and added extra chili sauce (${extraChiliSauceCount} packs). Do you want to proceed with the extra chili sauce?`;
    modal.style.display = 'flex';
}

function confirmChiliSauce(confirm) {
    const modal = document.getElementById('chili-sauce-modal');
    if (modal) modal.style.display = 'none';
    if (!confirm) removeExtraChiliSauce();
    showReviewModal(pendingOrderData);
    pendingOrderData = null;
}

function removeExtraChiliSauce() {
    const rows = document.querySelectorAll('.product-row');
    const filteredRows = Array.from(rows).filter(row => {
        const productId = row.querySelector('.product-select').value;
        if (productId == chiliSauceId) {
            row.remove();
            return false;
        }
        return true;
    });
    if (!filteredRows.length) addProductRow();
}

// Vendor suggestions
// Vendor suggestions
document.getElementById('vendor-name').addEventListener('input', async (e) => {
    const query = e.target.value;
    const suggestions = document.getElementById('vendor-suggestions');
    if (query.length < 2) {
        suggestions.innerHTML = '';
        document.getElementById('vendor-id').value = '';
        document.getElementById('agent-name').value = '';
        return;
    }

    // Fetch vendors
    const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select('id, name, agent_id')
        .ilike('name', `%${query}%`);
    if (vendorError) {
        console.error('Error fetching vendors:', vendorError.message);
        return;
    }
    console.log('Vendors fetched:', vendors); // Debug: Check vendor data

    // Fetch agents
    const agentIds = vendors.map(v => v.agent_id).filter(id => id);
    console.log('Agent IDs:', agentIds); // Debug: Verify agent IDs
    let agents = [];
    if (agentIds.length > 0) {
        const { data: agentData, error: agentError } = await supabase
            .from('sales_agents')
            .select('id, name')
            .in('id', agentIds);
        if (agentError) {
            console.error('Error fetching agents:', agentError.message);
        } else {
            agents = agentData || [];
            console.log('Agents fetched:', agents); // Debug: Check agent data
        }
    }

    // Map vendor and agent data
    const vendorData = vendors.map(vendor => {
        const agent = agents.find(a => a.id === vendor.agent_id);
        console.log(`Matching agent for vendor ${vendor.name}:`, { vendorAgentId: vendor.agent_id, agent }); // Debug: Verify match
        return {
            id: vendor.id,
            name: vendor.name,
            agent_name: agent?.name || 'No Agent Assigned'
        };
    });
    console.log('Vendor data mapped:', vendorData); // Debug: Final mapped data

    // Render suggestions
    suggestions.innerHTML = vendorData.map(vendor => `
        <div class="suggestion-item" onclick="selectVendor('${vendor.id}', '${vendor.name}', '${vendor.agent_name}')">${vendor.name}</div>
    `).join('');
});

function selectVendor(id, name, agentName) {
    document.getElementById('vendor-name').value = name;
    document.getElementById('vendor-id').value = id;
    document.getElementById('agent-name').value = agentName;
    document.getElementById('vendor-suggestions').innerHTML = '';
    console.log('Selected:', { id, name, agentName }); // Debug: Final selected values
}

// Products
async function populateProducts() {
    const { data, error } = await supabase.from('products').select('id, name, selling_price, stock');
    if (error) return console.error('Error fetching products:', error.message);
    products = data.map(p => ({ ...p, currentStock: p.stock }));
    chiliSauceId = products.find(p => p.name === 'Chili Sauce (100grams)')?.id || null;
    if (!chiliSauceId) console.warn('Chili Sauce (100grams) not found.');
    updateAllProductSelects();
    updateTotalAmount();
}

function updateAllProductSelects() {
    document.querySelectorAll('.product-select').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Product</option>' + 
            products.map(p => `<option value="${p.id}">${p.name} (Php ${p.selling_price.toFixed(2)} Stock: ${p.currentStock})</option>`).join('');
        select.value = currentValue || '';
        const row = select.closest('.product-row');
        toggleChiliSauceVisibility(row, select.value == chiliSauceId);
    });
}

function toggleChiliSauceVisibility(row, hide) {
    const label = row.querySelector('.chili-sauce-label');
    const checkbox = row.querySelector('.chili-sauce');
    if (label) label.style.display = hide ? 'none' : 'inline-block';
    if (checkbox) {
        checkbox.style.display = hide ? 'none' : 'inline-block';
        if (hide) checkbox.checked = false;
    }
}

function addProductRow() {
    const container = document.getElementById('products-container');
    container.insertAdjacentHTML('beforeend', `
        <div class="product-row">
            <label for="product-${productRows}">Product:</label>
            <select class="product-select" id="product-${productRows}" required></select>
            <div class="quantity-container">
                <label for="quantity-${productRows}">Quantity:</label>
                <input type="number" class="quantity" id="quantity-${productRows}" min="1" value="1" required>
                <label for="chili-sauce-${productRows}" class="chili-sauce-label">Include Chili Sauce:</label>
                <input type="checkbox" class="chili-sauce" id="chili-sauce-${productRows}" checked>
            </div>
            <span class="price" id="price-${productRows}"></span>
            <button type="button" class="remove-btn" onclick="removeProductRow(this)">Remove</button>
        </div>
    `);
    productRows++;
    updateAllProductSelects();
}

function removeProductRow(btn) {
    btn.parentElement.remove();
    resetStock();
    updateTotalAmount();
}

function resetStock() {
    products.forEach(p => p.currentStock = p.stock);
    updateAllProductSelects();
}

// Update this function to return the total
function updateTotalAmount() {
    let total = 0;
    resetStock();
    document.querySelectorAll('.product-row').forEach(row => {
        const productId = row.querySelector('.product-select').value;
        if (!productId) return;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauce = row.querySelector('.chili-sauce')?.checked || false;
        const product = products.find(p => p.id == productId);
        if (product) {
            let rowTotal = product.selling_price * quantity;
            product.currentStock -= quantity;
            if (chiliSauce && product.id != chiliSauceId && chiliSauceId) {
                const chili = products.find(p => p.id == chiliSauceId);
                if (chili) {
                    rowTotal += chili.selling_price * quantity;
                    chili.currentStock -= quantity;
                }
            }
            total += rowTotal;
            row.querySelector('.price').textContent = `₱ ${rowTotal.toFixed(2)}`;
        }
    });
    document.getElementById('total-amount').textContent = `₱ ${total.toFixed(2)}`;
    updateAllProductSelects();
    return total; // Return the total value
}

// Real-time event listeners
document.addEventListener('input', (e) => {
    const row = e.target.closest('.product-row');
    if (!row) return;
    if (e.target.classList.contains('quantity') || e.target.classList.contains('chili-sauce')) {
        updateTotalAmount();
    }
});

document.addEventListener('change', (e) => {
    const row = e.target.closest('.product-row');
    if (!row) return;
    if (e.target.classList.contains('product-select')) {
        toggleChiliSauceVisibility(row, e.target.value == chiliSauceId);
        updateTotalAmount();
    }
});

function showReviewModal(orderData) {
    const { vendorId, products: orderProducts, totalAmount } = orderData;
    document.getElementById('review-details').innerHTML = `
        <p><strong>Vendor:</strong> ${document.getElementById('vendor-name').value}</p>
        <p><strong>Agent:</strong> ${document.getElementById('agent-name').value}</p>
        <h3>Products:</h3>
        <ul>${orderProducts.map(p => `<li>${p.name} (₱ ${p.price.toFixed(2)} x ${p.quantity})${p.chili_sauce ? ' + Chili Sauce' : ''}</li>`).join('')}</ul>
        <p><strong>Total Amount:</strong> ₱ ${totalAmount.toFixed(2)}</p>
    `;
    document.getElementById('review-modal').style.display = 'flex';
    localStorage.setItem('order-data', JSON.stringify(orderData));
}

// Form submission
document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorId = document.getElementById('vendor-id').value;
    if (!vendorId) return showMessageModal('Error', 'Please select a vendor');
    const orderProducts = Array.from(document.querySelectorAll('.product-row')).map(row => {
        const productId = row.querySelector('.product-select').value;
        const product = products.find(p => p.id == productId);
        if (!product) return null;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauce = row.querySelector('.chili-sauce')?.checked || false;
        return { id: product.id, name: product.name, price: product.selling_price, quantity, chili_sauce: chiliSauce && product.id != chiliSauceId };
    }).filter(p => p);
    if (!orderProducts.length) return showMessageModal('Error', 'Please select a product in all rows');
    const totalAmount = updateTotalAmount(); // Capture the returned total
    const orderData = { vendorId, products: orderProducts, totalAmount };
    pendingOrderData = orderData;
    const bundledChiliSauceCount = orderProducts.reduce((sum, p) => sum + (p.chili_sauce ? p.quantity : 0), 0);
    const extraChiliSauceCount = orderProducts.reduce((sum, p) => sum + (p.id == chiliSauceId ? p.quantity : 0), 0);
    (bundledChiliSauceCount && extraChiliSauceCount) ? showChiliSauceModal(bundledChiliSauceCount, extraChiliSauceCount) : showReviewModal(orderData);
});

function editOrder() {
    document.getElementById('review-modal').style.display = 'none';
    localStorage.removeItem('order-data');
    resetStock();
    updateTotalAmount();
}

async function confirmOrder() {
    const orderData = JSON.parse(localStorage.getItem('order-data'));
    if (!orderData) return;
    const { vendorId, products: orderProducts, totalAmount } = orderData;
    document.getElementById('review-modal').style.display = 'none';
    document.getElementById('loading-modal').style.display = 'flex';

    for (const product of orderProducts) {
        const { data, error } = await supabase.from('products').select('stock').eq('id', product.id).single();
        if (error || data.stock < product.quantity) return handleStockError(product.name);
        if (product.chili_sauce && chiliSauceId) {
            const { data: chiliData, error: chiliError } = await supabase.from('products').select('stock').eq('id', chiliSauceId).single();
            if (chiliError || chiliData.stock < product.quantity) return handleStockError('Chili Sauce');
        }
    }

    const totalChiliSauceQuantity = orderProducts.reduce((sum, p) => sum + (p.chili_sauce || p.id == chiliSauceId ? p.quantity : 0), 0);
    if (chiliSauceId) {
        const { data, error } = await supabase.from('products').select('stock').eq('id', chiliSauceId).single();
        if (error || data.stock < totalChiliSauceQuantity) return handleStockError('Chili Sauce');
    }

    for (const product of orderProducts) {
        await updateStock(product.id, product.quantity);
        if (product.chili_sauce && chiliSauceId) await updateStock(chiliSauceId, product.quantity);
    }

    const { error } = await supabase.from('orders').insert({
        vendor_id: vendorId,
        order_date: new Date().toISOString(),
        total_amount: totalAmount,
        status: 'pending',
        placed_by: 'vendor',
        products: orderProducts
    });
    if (error) return showMessageModal('Error', 'Error placing order: ' + error.message);

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order placed successfully!', resetForm);
}

function handleStockError(item) {
    document.getElementById('loading-modal').style.display = 'none';
    showMessageModal('Error', `Insufficient stock for ${item}`);
}

async function updateStock(productId, quantity) {
    const { data } = await supabase.from('products').select('stock').eq('id', productId).single();
    await supabase.from('products').update({ stock: data.stock - quantity }).eq('id', productId);
}

function resetForm() {
    document.getElementById('order-form').reset();
    document.getElementById('total-amount').textContent = '₱ 0.00';
    document.getElementById('products-container').innerHTML = `
        <div class="product-row">
            <label for="product-0">Product:</label>
            <select class="product-select" id="product-0" required></select>
            <div class="quantity-container">
                <label for="quantity-0">Quantity:</label>
                <input type="number" class="quantity" id="quantity-0" min="1" value="1" required>
                <label for="chili-sauce-0" class="chili-sauce-label">Include Chili Sauce:</label>
                <input type="checkbox" class="chili-sauce" id="chili-sauce-0" checked>
            </div>
            <span class="price" id="price-0"></span>
            <button type="button" class="remove-btn" onclick="removeProductRow(this)" style="display: none;"></button>
        </div>
    `;
    productRows = 1;
    populateProducts();
}

// Init
populateProducts();
