const supabaseUrl = 'https://vefirimqfcqcirgrhrpy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlyaW1xZmNxY2lyZ3JocnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NDg4MDIsImV4cCI6MjA1ODIyNDgwMn0.hLFVAUrrD1PtsfBbFuivh3b83z6YtMyKJrx8Idz2T_E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let products = [];
let chiliSauceId = null;
let productRows = 1;
let pendingOrderData = null;

// Show message modal (for errors)
function showMessageModal(title, message) {
    const modal = document.getElementById('message-modal');
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    if (modal) modal.style.display = 'flex';
}

// Close message modal
function closeMessageModal() {
    const modal = document.getElementById('message-modal');
    if (modal) modal.style.display = 'none';
}

// Show toast notification (for success)
function showToast(message, callback) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    if (toastContainer) toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
        if (callback) callback();
    }, 2000);
}

// Show chili sauce confirmation modal
function showChiliSauceModal(bundledChiliSauceCount, extraChiliSauceCount) {
    let modal = document.getElementById('chili-sauce-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chili-sauce-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p id="chili-sauce-message"></p>
                <button onclick="confirmChiliSauce(true)">Yes</button>
                <button onclick="confirmChiliSauce(false)">No</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    const messageElement = modal.querySelector('#chili-sauce-message');
    messageElement.textContent = `You have included chili sauce with your products (${bundledChiliSauceCount} packs) and added extra chili sauce (${extraChiliSauceCount} packs). Do you want to proceed with the extra chili sauce?`;
    modal.style.display = 'flex';
}

// Handle chili sauce confirmation
function confirmChiliSauce(confirm) {
    const modal = document.getElementById('chili-sauce-modal');
    if (modal) modal.style.display = 'none';
    if (!confirm) {
        const rows = document.querySelectorAll('.product-row');
        const filteredRows = Array.from(rows).filter(row => {
            const productId = row.querySelector('.product-select').value;
            if (productId == chiliSauceId) {
                row.remove();
                return false;
            }
            return true;
        });
        if (filteredRows.length === 0) addProductRow();
    }
    showReviewModal(pendingOrderData);
    pendingOrderData = null;
}

// Get vendor_id from URL
const urlParams = new URLSearchParams(window.location.search);
const vendorIdFromUrl = urlParams.get('vendor_id');

// Populate vendor suggestions
document.getElementById('vendor-name').addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length < 2) {
        document.getElementById('vendor-suggestions').innerHTML = '';
        document.getElementById('vendor-id').value = '';
        document.getElementById('agent-name').value = '';
        return;
    }
    const { data, error } = await supabase
        .from('vendors')
        .select('id, name, agent_id, sales_agents(name)')
        .ilike('name', `%${query}%`);
    if (error) {
        console.error('Error fetching vendors:', error.message);
        return;
    }
    const suggestions = document.getElementById('vendor-suggestions');
    suggestions.innerHTML = '';
    data.forEach(vendor => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = vendor.name;
        div.onclick = () => {
            document.getElementById('vendor-name').value = vendor.name;
            document.getElementById('vendor-id').value = vendor.id;
            document.getElementById('agent-name').value = vendor.sales_agents.name;
            suggestions.innerHTML = '';
        };
        suggestions.appendChild(div);
    });
});

// Populate products dropdown
async function populateProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*');
    if (error) {
        console.error('Error fetching products:', error.message);
        return;
    }
    products = data;
    chiliSauceId = products.find(p => p.name === 'Chili Sauce (100grams)')?.id;
    if (!chiliSauceId) console.warn('Chili Sauce (100grams) not found.');
    const productSelects = document.querySelectorAll('.product-select');
    productSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Product</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
        const row = select.closest('.product-row');
        const chiliSauceLabel = row.querySelector('.chili-sauce-label');
        const chiliSauceCheckbox = row.querySelector('.chili-sauce');
        if (select.value == chiliSauceId) {
            if (chiliSauceLabel) chiliSauceLabel.style.display = 'none';
            if (chiliSauceCheckbox) {
                chiliSauceCheckbox.style.display = 'none';
                chiliSauceCheckbox.checked = false;
            }
        } else {
            if (chiliSauceLabel) chiliSauceLabel.style.display = 'inline-block';
            if (chiliSauceCheckbox) chiliSauceCheckbox.style.display = 'inline-block';
        }
    });
    updateTotalAmount();
}

// Add product row
function addProductRow() {
    const container = document.getElementById('products-container');
    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
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
    `;
    container.appendChild(row);
    productRows++;
    populateProducts();
}

// Remove product row
function removeProductRow(btn) {
    btn.parentElement.remove();
    updateTotalAmount();
}

// Update total amount
function updateTotalAmount() {
    let total = 0;
    const rows = document.querySelectorAll('.product-row');
    rows.forEach(row => {
        const productId = row.querySelector('.product-select').value;
        if (!productId) return;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauceCheckbox = row.querySelector('.chili-sauce');
        const chiliSauce = chiliSauceCheckbox ? chiliSauceCheckbox.checked : false;
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
    return total;
}

// Event listener for product selection, quantity, and chili sauce
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('product-select')) {
        const row = e.target.closest('.product-row');
        const chiliSauceLabel = row.querySelector('.chili-sauce-label');
        const chiliSauceCheckbox = row.querySelector('.chili-sauce');
        if (e.target.value == chiliSauceId) {
            if (chiliSauceLabel) chiliSauceLabel.style.display = 'none';
            if (chiliSauceCheckbox) {
                chiliSauceCheckbox.style.display = 'none';
                chiliSauceCheckbox.checked = false;
            }
        } else {
            if (chiliSauceLabel) chiliSauceLabel.style.display = 'inline-block';
            if (chiliSauceCheckbox) chiliSauceCheckbox.style.display = 'inline-block';
        }
        updateTotalAmount();
    } else if (e.target.classList.contains('quantity') || e.target.classList.contains('chili-sauce')) {
        updateTotalAmount();
    }
});

// Show review modal
function showReviewModal(orderData) {
    const { vendorId, products: orderProducts, totalAmount } = orderData;
    const reviewDetails = document.getElementById('review-details');
    reviewDetails.innerHTML = `
        <p><strong>Vendor:</strong> ${document.getElementById('vendor-name').value}</p>
        <p><strong>Agent:</strong> ${document.getElementById('agent-name').value}</p>
        <h3>Products:</h3>
        <ul>
            ${orderProducts.map(p => `<li>${p.name} (₱ ${p.price.toFixed(2)} x ${p.quantity}) ${p.chili_sauce ? ' + Chili Sauce' : ''}</li>`).join('')}
        </ul>
        <p><strong>Total Amount:</strong> ₱ ${totalAmount.toFixed(2)}</p>
    `;
    document.getElementById('review-modal').style.display = 'flex';
    localStorage.setItem('order-data', JSON.stringify({ vendorId, products: orderProducts, totalAmount }));
}

// Handle form submission
document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorId = document.getElementById('vendor-id').value;
    if (!vendorId) {
        showMessageModal('Error', 'Please select a vendor');
        return;
    }
    const rows = document.querySelectorAll('.product-row');
    const orderProducts = [];
    let totalAmount = 0;
    let bundledChiliSauceCount = 0;
    let extraChiliSauceCount = 0;
    for (const row of rows) {
        const productId = row.querySelector('.product-select').value;
        const quantity = parseInt(row.querySelector('.quantity').value) || 1;
        const chiliSauceCheckbox = row.querySelector('.chili-sauce');
        const chiliSauce = chiliSauceCheckbox ? chiliSauceCheckbox.checked : false;
        const product = products.find(p => p.id == productId);
        if (!product) {
            showMessageModal('Error', 'Please select a product in all rows');
            return;
        }
        orderProducts.push({
            id: product.id,
            name: product.name,
            price: product.selling_price,
            quantity: quantity,
            chili_sauce: chiliSauce && product.id != chiliSauceId
        });
        totalAmount += product.selling_price * quantity;
        if (chiliSauce && product.id != chiliSauceId) {
            const chili = products.find(p => p.id == chiliSauceId);
            if (chili) {
                totalAmount += chili.selling_price * quantity;
                bundledChiliSauceCount += quantity;
            }
        }
        if (product.id == chiliSauceId) extraChiliSauceCount += quantity;
    }
    const orderData = { vendorId, products: orderProducts, totalAmount };
    pendingOrderData = orderData;
    const hasBundledChiliSauce = orderProducts.some(p => p.chili_sauce);
    const hasExtraChiliSauce = orderProducts.some(p => p.id == chiliSauceId);
    if (hasBundledChiliSauce && hasExtraChiliSauce) {
        showChiliSauceModal(bundledChiliSauceCount, extraChiliSauceCount);
    } else {
        showReviewModal(orderData);
    }
});

// Edit Order
function editOrder() {
    document.getElementById('review-modal').style.display = 'none';
    localStorage.removeItem('order-data');
}

// Confirm Order
async function confirmOrder() {
    const orderData = JSON.parse(localStorage.getItem('order-data'));
    if (!orderData) return;
    const { vendorId, products: orderProducts, totalAmount } = orderData;
    document.getElementById('review-modal').style.display = 'none';
    document.getElementById('loading-modal').style.display = 'flex';

    // Check stock levels
    for (const product of orderProducts) {
        const { data: productData, error } = await supabase
            .from('products')
            .select('stock')
            .eq('id', product.id)
            .single();
        if (error || productData.stock < product.quantity) {
            document.getElementById('loading-modal').style.display = 'none';
            showMessageModal('Error', `Insufficient stock for ${product.name}`);
            return;
        }
        if (product.chili_sauce) {
            const { data: chiliData, error: chiliError } = await supabase
                .from('products')
                .select('stock')
                .eq('id', chiliSauceId)
                .single();
            if (chiliError || chiliData.stock < product.quantity) {
                document.getElementById('loading-modal').style.display = 'none';
                showMessageModal('Error', 'Insufficient stock for Chili Sauce');
                return;
            }
        }
    }

    // Calculate total chili sauce quantity
    let totalChiliSauceQuantity = 0;
    for (const product of orderProducts) {
        if (product.chili_sauce) totalChiliSauceQuantity += product.quantity;
        if (product.id == chiliSauceId) totalChiliSauceQuantity += product.quantity;
    }

    // Check stock for total chili sauce
    const { data: chiliData, error: chiliError } = await supabase
        .from('products')
        .select('stock')
        .eq('id', chiliSauceId)
        .single();
    if (chiliError || chiliData.stock < totalChiliSauceQuantity) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Insufficient stock for Chili Sauce');
        return;
    }

    // Update stock levels
    for (const product of orderProducts) {
        const { data: currentStock } = await supabase
            .from('products')
            .select('stock')
            .eq('id', product.id)
            .single();
        await supabase
            .from('products')
            .update({ stock: currentStock.stock - product.quantity })
            .eq('id', product.id);
        if (product.chili_sauce) {
            const { data: chiliStock } = await supabase
                .from('products')
                .select('stock')
                .eq('id', chiliSauceId)
                .single();
            await supabase
                .from('products')
                .update({ stock: chiliStock.stock - product.quantity })
                .eq('id', chiliSauceId);
        }
    }

    // Update stock for extra chili sauce
    const extraChiliSauce = orderProducts.filter(p => p.id == chiliSauceId);
    for (const extra of extraChiliSauce) {
        const { data: chiliStock } = await supabase
            .from('products')
            .select('stock')
            .eq('id', chiliSauceId)
            .single();
        await supabase
            .from('products')
            .update({ stock: chiliStock.stock - extra.quantity })
            .eq('id', chiliSauceId);
    }

    // Insert order
    const { error } = await supabase
        .from('orders')
        .insert({
            vendor_id: vendorId,
            order_date: new Date().toISOString(),
            total_amount: totalAmount,
            status: 'pending',
            placed_by: 'vendor',
            products: orderProducts
        });
    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error placing order: ' + error.message);
        return;
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Order placed successfully!', () => {
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
                <button type="button" class="remove-btn" onclick="removeProductRow(this)" style="display: none;">Remove</button>
            </div>
        `;
        productRows = 1;
        populateProducts();
    });
}

// Pre-fill vendor if vendor_id is in URL
async function prefillVendor() {
    if (vendorIdFromUrl) {
        const { data, error } = await supabase
            .from('vendors')
            .select('id, name, agent_id, sales_agents(name)')
            .eq('id', vendorIdFromUrl)
            .single();
        if (error) {
            console.error('Error fetching vendor:', error.message);
            return;
        }
        document.getElementById('vendor-name').value = data.name;
        document.getElementById('vendor-id').value = data.id;
        document.getElementById('agent-name').value = data.sales_agents.name;
        document.getElementById('vendor-name').setAttribute('readonly', true);
    }
}

// Initialize
populateProducts();
prefillVendor();