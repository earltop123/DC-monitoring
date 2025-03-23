// Assume common.js is loaded before login.js in the HTML
// Remove redundant Supabase initialization and toast function since they're in common.js

function showMessageModal(title, message) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    document.getElementById('message-modal').style.display = 'flex';
}

function closeMessageModal() {
    document.getElementById('message-modal').style.display = 'none';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    console.log('Attempting login with email:', email);
    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Login error:', error.message);
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Invalid email or password: ' + error.message);
        return;
    }

    console.log('Login successful, user:', data.user);

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

    if (profileError || !profiles) {
        console.error('Profile fetch error:', profileError?.message || 'No profile found');
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error fetching user profile: ' + (profileError?.message || 'No profile found'));
        await supabase.auth.signOut();
        return;
    }

    console.log('User role:', profiles.role);
    document.getElementById('loading-modal').style.display = 'none';
    showToast('Login successful! Redirecting...', () => {
        if (profiles.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else if (profiles.role === 'management') {
            window.location.href = 'management-dashboard.html';
        } else if (profiles.role === 'agent') {
            window.location.href = 'agent-dashboard.html';
        }
    });
});