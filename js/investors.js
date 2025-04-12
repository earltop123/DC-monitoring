document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication (requires 'management' role)
    const isAuthenticated = await checkAuth('management');
    if (!isAuthenticated) return;
  
    // Fetch and display investors
    async function fetchInvestors() {
      const { data, error } = await supabase.from('investors').select('id, name, contact');
      if (error) {
        showToast('Error fetching investors: ' + error.message);
        return;
      }
      const tbody = document.querySelector('#investors-table tbody');
      tbody.innerHTML = '';
      data.forEach(investor => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${investor.name}</td>
          <td>${investor.contact || ''}</td>
        `;
        tbody.appendChild(row);
      });
    }
  
    // Show modal when clicking "Add Investor"
    document.getElementById('add-investor-btn').addEventListener('click', () => {
      document.getElementById('add-investor-modal').style.display = 'flex';
      document.getElementById('add-investor-btn').addEventListener('click', () => {
        console.log('Add Investor button clicked');
        document.getElementById('add-investor-modal').style.display = 'flex';
      });
    });
  
    // Handle form submission
    document.getElementById('add-investor-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('investor-name').value;
      const contact = document.getElementById('investor-contact').value || null;
      const { error } = await supabase.from('investors').insert({ name, contact });
      if (error) {
        showToast('Error adding investor: ' + error.message);
      } else {
        showToast('Investor added successfully!');
        document.getElementById('add-investor-form').reset();
        document.getElementById('add-investor-modal').style.display = 'none';
        fetchInvestors();
      }
    });
  
    // Close modal
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('add-investor-modal').style.display = 'none';
    });
  
    // Initial fetch
    fetchInvestors();
  });