// Assume common.js is loaded before register.js, providing supabase and showToast

// Show/hide agent fields based on role selection
document.getElementById('role').addEventListener('change', (e) => {
    document.getElementById('agent-fields').style.display = e.target.value === 'agent' ? 'block' : 'none';
});

// Function to show message modal (for errors)
function showMessageModal(title, message) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    document.getElementById('message-modal').style.display = 'flex';
}

// Function to close message modal
function closeMessageModal() {
    document.getElementById('message-modal').style.display = 'none';
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!email || !password || !role) {
        showMessageModal('Error', 'Please fill in all required fields');
        return;
    }

    document.getElementById('loading-modal').style.display = 'flex';

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error registering user: ' + error.message);
        return;
    }

    const user = data.user;
    if (!user) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'User registration failed: No user returned');
        return;
    }

    if (data.session) {
        await supabase.auth.setSession(data.session.access_token);
        console.log('Session token set:', data.session.access_token);
    } else {
        console.error('No session token returned after sign-up');
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Sign-up failed: No session token returned');
        return;
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: user.id, role });

    if (profileError) {
        document.getElementById('loading-modal').style.display = 'none';
        showMessageModal('Error', 'Error saving user metadata: ' + profileError.message);
        showMessageModal('Cleanup Required', 'Please delete the user manually in the Supabase dashboard.');
        return;
    }

    if (role === 'agent') {
        const name = document.getElementById('name').value;
        const address = document.getElementById('address').value;
        const contact = document.getElementById('contact').value;

        if (!name || !address || !contact) {
            document.getElementById('loading-modal').style.display = 'none';
            showMessageModal('Error', 'Please fill in all agent fields');
            await supabase.from('profiles').delete().eq('id', user.id);
            showMessageModal('Cleanup Required', 'Please delete the user manually in the Supabase dashboard.');
            return;
        }

        const { data: existingAgents, error: existingAgentError } = await supabase
            .from('sales_agents')
            .select('user_id')
            .eq('user_id', user.id);

        if (existingAgentError) {
            document.getElementById('loading-modal').style.display = 'none';
            showMessageModal('Error', 'Error checking existing sales agent: ' + existingAgentError.message);
            await supabase.from('profiles').delete().eq('id', user.id);
            showMessageModal('Cleanup Required', 'Please delete the user manually in the Supabase dashboard.');
            return;
        }

        if (existingAgents?.length > 0) {
            document.getElementById('loading-modal').style.display = 'none';
            showMessageModal('Error', 'A sales agent record already exists for this user.');
            await supabase.from('profiles').delete().eq('id', user.id);
            showMessageModal('Cleanup Required', 'Please delete the user manually in the Supabase dashboard.');
            return;
        }

        const { error: agentError } = await supabase
            .from('sales_agents')
            .insert({ user_id: user.id, name, address, contact_number: contact });

        if (agentError) {
            document.getElementById('loading-modal').style.display = 'none';
            showMessageModal('Error', 'Error registering agent details: ' + agentError.message);
            await supabase.from('profiles').delete().eq('id', user.id);
            showMessageModal('Cleanup Required', 'Please delete the user manually in the Supabase dashboard.');
            return;
        }
    }

    document.getElementById('loading-modal').style.display = 'none';
    showToast('Registration successful! Redirecting to login...', () => {
        window.location.href = 'login.html';
    });
});