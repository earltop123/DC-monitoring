<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Placement</title>
    <link rel="stylesheet" href="css/order-placement.css">
</head>
<body>
    <div class="toast-container" id="toast-container"></div>
    <div class="container">
        <h1>Place an Order</h1>
        <form id="order-form">
            <label for="vendor-name">Vendor Name:</label>
            <div class="vendor-input-container">
                <input type="text" id="vendor-name" autocomplete="off" required>
                <div id="vendor-suggestions" class="suggestions"></div>
            </div>
            <input type="hidden" id="vendor-id">
            <input type="hidden" id="agent-id">
            <label for="agent-name">Agent Name:</label>
            <input type="text" id="agent-name" readonly>
            <label for="city-select">City:</label>
            <select id="city-select" required>
                <option value="">Select City</option>
            </select>
            <div id="products-container">
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
            </div>
            <button type="button" onclick="addProductRow()">Add Another Product</button>
            <div class="total">
                <label>Total Amount:</label>
                <span id="total-amount">₱ 0.00</span>
            </div>
            <button type="submit">Place Order</button>
        </form>
    </div>
    <div id="review-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <h2>Review Your Order</h2>
            <div id="review-details"></div>
            <button onclick="confirmOrder()">Confirm</button>
            <button onclick="editOrder()">Edit Order</button>
        </div>
    </div>
    <div id="loading-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <h2>Loading...</h2>
            <p>Please wait while your order is being processed.</p>
        </div>
    </div>
    <div id="message-modal" class="modal" style="display: none;">
        <div class="modal-content">
            <h2 id="message-title"></h2>
            <p id="message-text"></p>
            <button onclick="document.getElementById('message-modal').style.display='none'">OK</button>
        </div>
    </div>
    <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script defer src="js/common.js"></script>
    <script defer src="js/order-placement.js"></script>
    <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'924f6139b99044f5',t:'MTc0Mjc0ODEyMy4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>
    <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'929a8847ea35da87',t:'MTc0MzUzNjE1NC4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script>
</body>
</html>
