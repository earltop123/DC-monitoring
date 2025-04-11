const supabaseUrl = 'https://vefirimqfcqcirgrhrpy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZmlyaW1xZmNxY2lyZ3JocnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NDg4MDIsImV4cCI6MjA1ODIyNDgwMn0.hLFVAUrrD1PtsfBbFuivh3b83z6YtMyKJrx8Idz2T_E';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function checkAuth(requiredRole = 'management') {
    let { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        showToast('Please log in to access this page.', () => window.location.href = 'login.html');
        return false;
    }
    // Refresh session if expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
            showToast('Session expired. Please log in again.', () => window.location.href = 'login.html');
            return false;
        }
        session = refreshedSession.session;
    }
    supabase.realtime.setAuth(session.access_token);
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
    
    console.log('Fetched profile:', profiles);
    console.log('Profile error:', profileError);
    console.log('Required role:', requiredRole, 'User role:', profiles?.role);

    if (profileError || !profiles || profiles.role !== requiredRole) {
        showToast(`Access denied. ${requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)} only.`, () => window.location.href = 'login.html');
        return false;
    }
    return true;
}

async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) return showToast('Error logging out: ' + error.message);
    showToast('Logged out successfully!', () => window.location.href = 'login.html');
}

function navigateTo(page) {
    window.open(page, '_blank');
}

function showToast(message, callback, duration = 2000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
        if (callback) callback();
    }, duration);
}

// In common.js
function showMessageModal(title, message) {
    const modal = document.getElementById('message-modal') || createModal('message-modal', `
        <h3 id="message-title"></h3>
        <p id="message-text"></p>
        <button id="message-modal-close">Close</button>
    `);
    modal.querySelector('#message-title').textContent = title;
    modal.querySelector('#message-text').textContent = message;
    modal.style.display = 'flex';

    // Add event listener for the close button
    const closeButton = modal.querySelector('#message-modal-close');
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

function createModal(id, content) {
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${content}</div>`;
    document.body.appendChild(modal);
    return modal;
}

function renderMenu(allowedPages = ['products', 'vendors', 'sales', 'management-dashboard', 'agent-list', 'expenses', 'sales sonitoring']) {
    const menuContainer = document.querySelector('.menu-container');
    if (!menuContainer) {
        console.warn('Menu container not found in DOM');
        return;
    }
    const menuItems = [
        { page: 'product', label: 'Product Management' },
        { page: 'delivery-management', label: 'Delivery' },
        { page: 'sales', label: 'Sales Dashboard' },
        { page: 'agent-list', label: 'Agent List' },
        { page: 'management-dashboard', label: 'Management Dashboard' },
        { page: 'agent-dashboard', label: 'Agent Summary' },
        { page: 'order-placement', label: 'Order Placement' },
        { page: 'total-vendor-list', label: 'Vendor List' },
        { page: 'expenses', label: 'Add Expenses' },
        { page: 'sales-monitoring', label: 'Sales Monitoring'},
    ].filter(item => allowedPages.includes(item.page));

    menuContainer.innerHTML = `
        <button class="menu-btn">Menu</button>
        <div class="menu-content">
            ${menuItems.map(item => `<button onclick="navigateTo('${item.page}.html')">${item.label}</button>`).join('')}
        </div>
    `;

    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) logoutButton.onclick = logout;
}
