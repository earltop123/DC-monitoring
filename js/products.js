const supabaseUrl = 'https://vefirimqfcqcirgrhrpy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlyaW1xZmNxY2lyZ3JocnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NDg4MDIsImV4cCI6MjA1ODIyNDgwMn0.hLFVAUrrD1PtsfBbFuivh3b83z6YtMyKJrx8Idz2T_E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Function to fetch and display products
async function fetchProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching products:', error.message);
        return;
    }

    const tbody = document.querySelector('#product-table tbody');
    tbody.innerHTML = '';

    data.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.selling_price.toFixed(2)}</td>
            <td>${product.supplier_price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>
                <button class="edit-btn" onclick="editProduct(${product.id}, '${product.name}', ${product.selling_price}, ${product.supplier_price})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Populate the stock product dropdown
    const stockProductSelect = document.getElementById('stock-product-id');
    stockProductSelect.innerHTML = '<option value="">Select Product</option>';
    data.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        stockProductSelect.appendChild(option);
    });
}

// Function to add a product
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('product-name').value;
    const sellingPrice = parseFloat(document.getElementById('selling-price').value);
    const supplierPrice = parseFloat(document.getElementById('supplier-price').value);
    const initialStock = parseInt(document.getElementById('initial-stock').value);

    const { data, error } = await supabase
        .from('products')
        .insert({
            name,
            selling_price: sellingPrice,
            supplier_price: supplierPrice,
            stock: initialStock
        })
        .select();

    if (error) {
        console.error('Error adding product:', error.message);
        alert('Error adding product: ' + error.message);
        return;
    }

    // If initial stock > 0, log it as a stock addition
    if (initialStock > 0) {
        const totalPrice = initialStock * supplierPrice;
        const addedAt = new Date().toISOString(); // Will convert to Manila time in display
        await supabase
            .from('stock_logs')
            .insert({
                product_id: data[0].id,
                product_name: name,
                quantity: initialStock,
                total_price: totalPrice,
                added_at: addedAt
            });
    }

    alert('Product added successfully!');
    e.target.reset();
    fetchProducts();
    fetchStockLogs();
});

// Function to edit a product
async function editProduct(id, currentName, currentSellingPrice, currentSupplierPrice) {
    const name = prompt('Enter new product name:', currentName);
    if (!name) return;

    const sellingPrice = parseFloat(prompt('Enter new selling price:', currentSellingPrice));
    if (isNaN(sellingPrice) || sellingPrice < 0) {
        alert('Invalid selling price');
        return;
    }

    const supplierPrice = parseFloat(prompt('Enter new supplier price:', currentSupplierPrice));
    if (isNaN(supplierPrice) || supplierPrice < 0) {
        alert('Invalid supplier price');
        return;
    }

    const { error } = await supabase
        .from('products')
        .update({
            name,
            selling_price: sellingPrice,
            supplier_price: supplierPrice
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating product:', error.message);
        alert('Error updating product: ' + error.message);
        return;
    }

    alert('Product updated successfully!');
    fetchProducts();
}

// Function to add stock
document.getElementById('add-stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = parseInt(document.getElementById('stock-product-id').value);
    const quantity = parseInt(document.getElementById('stock-quantity').value);

    if (isNaN(productId) || quantity <= 0) {
        alert('Please select a product and enter a valid quantity');
        return;
    }

    // Fetch the product to get supplier price and name
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, supplier_price, stock')
        .eq('id', productId)
        .single();

    if (productError) {
        console.error('Error fetching product:', productError.message);
        alert('Error fetching product: ' + productError.message);
        return;
    }

    const totalPrice = quantity * product.supplier_price;
    const addedAt = new Date().toISOString(); // Will convert to Manila time in display

    // Update stock in products table
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: product.stock + quantity })
        .eq('id', productId);

    if (updateError) {
        console.error('Error updating stock:', updateError.message);
        alert('Error updating stock: ' + updateError.message);
        return;
    }

    // Log the stock addition
    const { error: logError } = await supabase
        .from('stock_logs')
        .insert({
            product_id: productId,
            product_name: product.name,
            quantity,
            total_price: totalPrice,
            added_at: addedAt
        });

    if (logError) {
        console.error('Error logging stock addition:', logError.message);
        alert('Error logging stock addition: ' + logError.message);
        return;
    }

    alert('Stock added successfully!');
    e.target.reset();
    fetchProducts();
    fetchStockLogs();
});

// Function to fetch and display stock logs
async function fetchStockLogs() {
    const { data, error } = await supabase
        .from('stock_logs')
        .select('*')
        .order('added_at', { ascending: false });

    if (error) {
        console.error('Error fetching stock logs:', error.message);
        return;
    }

    const tbody = document.querySelector('#stock-log-table tbody');
    tbody.innerHTML = '';

    data.forEach(log => {
        const row = document.createElement('tr');
        const manilaDate = new Date(log.added_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        row.innerHTML = `
            <td>${log.product_name}</td>
            <td>${log.quantity}</td>
            <td>₱ ${log.total_price.toFixed(2)}</td>
            <td>${manilaDate}</td>
        `;
        tbody.appendChild(row);
    });
}

// Initialize
fetchProducts();
fetchStockLogs();