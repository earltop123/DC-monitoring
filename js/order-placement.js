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
        `Our siomai comes with chili sauce, but you added ${extraChiliSauceCount} extra pack${extraChiliSauceCount === 1 ? '' : 's'}. Do you want to keep the extra sauce?`;
    modal.style.display = 'flex';
}

function confirmChiliSauce(confirm) {
    const modal = document.getElementById('chili-sauce-modal');
    if (modal) modal.style.display = 'none';
    
    if (!confirm && pendingOrderData) {
        removeExtraChiliSauce();
        pendingOrderData.products = pendingOrderData.products.filter(p => p.id != chiliSauceId);
        pendingOrderData.totalAmount = updateTotalAmount();
    }
    
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
    updateTotalAmount();
}

// Vendor suggestions
document.getElementById('vendor-name').addEventListener('input', async (e) => {
    const query = e.target.value;
    const suggestions = document.getElementById('vendor-suggestions');
    if (query.length < 2) {
        suggestions.innerHTML = '';
        document.getElementById('vendor-id').value = '';
        document.getElementById('agent-name').value = '';
        document.getElementById('agent-id').value = '';
        return;
    }

    const { data: vendors, error } = await supabase
        .from('vendors')
        .select('id, name, agent_id')
        .ilike('name', `%${query}%`);
    if (error) return console.error('Error fetching vendors:', error.message);

    const agentIds = vendors.map(v => v.agent_id).filter(id => id);
    let agents = [];
    if (agentIds.length > 0) {
        const { data: agentData, error: agentError } = await supabase
            .from('sales_agents')
            .select('id, name')
            .in('id', agentIds);
        if (agentError) console.error('Error fetching agents:', agentError.message);
        else agents = agentData || [];
    }

    const vendorData = vendors.map(vendor => {
        const agent = agents.find(a => a.id === vendor.agent_id);
        return {
            id: vendor.id,
            name: vendor.name,
            agent_name: agent?.name || 'No Agent Assigned',
            agent_id: vendor.agent_id
        };
    });

    suggestions.innerHTML = vendorData.map(vendor => `
        <div class="suggestion-item" onclick="selectVendor('${vendor.id}', '${vendor.name}', '${vendor.agent_name}', '${vendor.agent_id}')">${vendor.name}</div>
    `).join('');
});

function selectVendor(id, name, agentName, agentId) {
    document.getElementById('vendor-name').value = name;
    document.getElementById('vendor-id').value = id;
    document.getElementById('agent-name').value = agentName;
    document.getElementById('agent-id').value = agentId || '';
    document.getElementById('vendor-suggestions').innerHTML = '';
}

// Products
async function populateProducts() {
    const { data, error } = await supabase.from('products').select('id, name, selling_price');
    if (error) return console.error('Error fetching products:', error.message);
    products = data;
    chiliSauceId = products.find(p => p.name === 'Chili Sauce (100grams)')?.id || null;
    if (!chiliSauceId) console.warn('Chili Sauce (100grams) not found.');
    updateAllProductSelects();
    updateTotalAmount();
}

function updateAllProductSelects() {
    document.querySelectorAll('.product-row').forEach(row => {
        const select = row.querySelector('.product-select');
        const currentValue = select.value;
        const chiliSauceChecked = row.querySelector('.chili-sauce')?.checked || false;
        const chiliSauceProduct = products.find(p => p.id == chiliSauceId);

        select.innerHTML = '<option value="">Select Product</option>' + 
            products.map(p => {
                const baseName = p.id == chiliSauceId ? 'Extra Chili Sauce (100 Grams)' : p.name;
                let displayName = baseName;
                let displayPrice = p.selling_price;
                if (p.id != chiliSauceId && chiliSauceChecked && chiliSauceId && chiliSauceProduct) {
                    displayName = `${baseName} with Chili Sauce`;
                    displayPrice += chiliSauceProduct.selling_price;
                }
                return `<option value="${p.id}">${displayName} (₱ ${displayPrice.toFixed(2)})</option>`;
            }).join('');
        
        select.value = currentValue || '';
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

async function populateCities() {
    const { data, error } = await supabase.from('cities').select('id, name');
    if (error) {
        console.error('Error fetching cities:', error.message);
        return;
    }
    const sortedCities = data.sort((a, b) => a.name.localeCompare(b.name));
    const citySelect = document.getElementById('city-select');
    citySelect.innerHTML = '<option value="">Select City</option>' + 
        sortedCities.map(city => `<option value="${city.id}">${city.name}</option>`).join('');
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
    updateTotalAmount();
}

function updateTotalAmount() {
    let total = 0;
    document.querySelectorAll('.product-row').forEach(row => {
        const productId = row.querySelector('.product-select').value;
        if (!productId) return;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauce = row.querySelector('.chili-sauce')?.checked || false;
        const product = products.find(p => p.id == productId);
        if (product) {
            let rowTotal = product.selling_price * quantity;
            if (chiliSauce && product.id != chiliSauceId && chiliSauceId) {
                const chili = products.find(p => p.id == chiliSauceId);
                if (chili) rowTotal += chili.selling_price * quantity;
            }
            total += rowTotal;
            row.querySelector('.price').textContent = `₱ ${rowTotal.toFixed(2)}`;
        }
    });
    document.getElementById('total-amount').textContent = `₱ ${total.toFixed(2)}`;
    updateAllProductSelects();
    return total;
}

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
    } else if (e.target.classList.contains('chili-sauce')) {
        updateAllProductSelects();
        updateTotalAmount();
    }
});

function showReviewModal(orderData) {
    const { vendorId, products: orderProducts, totalAmount } = orderData;
    document.getElementById('review-details').innerHTML = `
        <p><strong>Vendor:</strong> ${document.getElementById('vendor-name').value}</p>
        <p><strong>Agent:</strong> ${document.getElementById('agent-name').value}</p>
        <h3>Products:</h3>
        <ul>${orderProducts.map(p => {
            const chiliSauceProduct = products.find(prod => prod.id == chiliSauceId);
            const baseName = p.id == chiliSauceId ? 'Extra Chili Sauce (100 Grams)' : p.name;
            const displayName = (p.chili_sauce && p.id != chiliSauceId) ? `${baseName} with Chili Sauce` : baseName;
            const price = p.chili_sauce && p.id != chiliSauceId && chiliSauceProduct 
                ? p.price + chiliSauceProduct.selling_price 
                : p.price;
            const unit = p.quantity === 1 ? 'pack' : 'packs';
            return `<li>${displayName} (₱ ${price.toFixed(2)} x ${p.quantity} ${unit})</li>`;
        }).join('')}</ul>
        <p><strong>Total Amount:</strong> ₱ ${totalAmount.toFixed(2)}</p>
    `;
    document.getElementById('review-modal').style.display = 'flex';
    localStorage.setItem('order-data', JSON.stringify(orderData));
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorId = document.getElementById('vendor-id').value;
    const cityId = document.getElementById('city-select').value;
    if (!vendorId) return showMessageModal('Error', 'Please select a vendor');
    if (!cityId) return showMessageModal('Error', 'Please select a city');

    const orderProducts = Array.from(document.querySelectorAll('.product-row')).map(row => {
        const productId = row.querySelector('.product-select').value;
        const product = products.find(p => p.id == productId);
        if (!product) return null;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauce = row.querySelector('.chili-sauce')?.checked || false;
        let price = product.selling_price;
        if (chiliSauce && product.id != chiliSauceId && chiliSauceId) {
            const chili = products.find(p => p.id == chiliSauceId);
            if (chili) price += chili.selling_price;
        }
        return { id: product.id, name: product.name, price, quantity, chili_sauce: chiliSauce && product.id != chiliSauceId };
    }).filter(p => p);

    if (!orderProducts.length) return showMessageModal('Error', 'Please select a product in all rows');

    const totalAmount = updateTotalAmount();
    const orderData = { vendorId, cityId, products: orderProducts, totalAmount };
    pendingOrderData = orderData;

    const bundledChiliSauceCount = orderProducts.reduce((sum, p) => sum + (p.chili_sauce ? p.quantity : 0), 0);
    const extraChiliSauceCount = orderProducts.reduce((sum, p) => sum + (p.id == chiliSauceId ? p.quantity : 0), 0);
    (bundledChiliSauceCount && extraChiliSauceCount) ? showChiliSauceModal(bundledChiliSauceCount, extraChiliSauceCount) : showReviewModal(orderData);
});

function editOrder() {
    document.getElementById('review-modal').style.display = 'none';
    localStorage.removeItem('order-data');
    updateTotalAmount();
}

async function confirmOrder() {
    const orderData = JSON.parse(localStorage.getItem('order-data'));
    if (!orderData) return;
    const { vendorId, cityId, products: orderProducts, totalAmount } = orderData;
    const agentId = document.getElementById('agent-id').value;
    document.getElementById('review-modal').style.display = 'none';
    document.getElementById('loading-modal').style.display = 'flex';

    const { error } = await supabase.from('orders').insert({
        vendor_id: vendorId,
        order_date: new Date().toISOString(),
        total_amount: totalAmount,
        status: 'pending',
        placed_by: 'vendor',
        products: orderProducts,
        agent_id: agentId || null,
        city_id: cityId
    });
    if (error) return showMessageModal('Error', 'Error placing order: ' + error.message);

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order placed successfully!', resetForm);
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

async function init() {
    await populateProducts();
    await populateCities();
}

init();
