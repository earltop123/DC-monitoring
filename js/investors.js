document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication (requires 'management' role)
    const isAuthenticated = await checkAuth('management');
    console.log('Is authenticated:', isAuthenticated);
    /*if (!isAuthenticated) return;*/
  
    // Fetch and display investors
    // Fetch and display investors
    async function fetchInvestors() {
        const { data: investors, error: investorError } = await supabase.from('investors').select('id, name, contact');
        if (investorError) {
          showToast('Error fetching investors: ' + investorError.message);
          return;
        }
      
        const tbody = document.querySelector('#investors-table tbody');
        tbody.innerHTML = '';
        for (const investor of investors) {
          const { data: vendors, error: vendorError } = await supabase
            .from('vendors')
            .select('id, name, packs_sold')
            .eq('investor_id', investor.id);
          if (vendorError) {
            showToast('Error fetching vendors: ' + vendorError.message);
            continue;
          }
      
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${investor.name}</td>
            <td>${investor.contact || ''}</td>
            <td>
              <button class="add-vendor-btn" data-investor-id="${investor.id}">Add Vendor</button>
              <select class="assign-vendor" data-investor-id="${investor.id}">
                <option value="">Assign Existing Vendor</option>
              </select>
              <table class="vendor-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Packs Sold</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${vendors.map(vendor => `
                    <tr>
                      <td>${vendor.name}</td>
                      <td><input type="number" value="${vendor.packs_sold}" data-vendor-id="${vendor.id}" min="0"></td>
                      <td><button class="save-packs" data-vendor-id="${vendor.id}">Save</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
            <td><button class="view-report-btn" data-investor-id="${investor.id}" data-investor-name="${investor.name}">View Report</button></td>
          `;
          tbody.appendChild(row);
      
          // Populate assign vendor dropdown
          const { data: unassignedVendors } = await supabase
            .from('vendors')
            .select('id, name')
            .is('investor_id', null);
          const select = row.querySelector('.assign-vendor');
          unassignedVendors.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor.id;
            option.textContent = vendor.name;
            select.appendChild(option);
          });
        }
      }
  
  // Add vendor modal handlers
  document.getElementById('investors-table').addEventListener('click', (e) => {
    if (e.target.classList.contains('add-vendor-btn')) {
      const investorId = e.target.dataset.investorId;
      document.getElementById('vendor-investor-id').value = investorId;
      document.getElementById('add-vendor-modal').style.display = 'flex';
    }
    if (e.target.classList.contains('save-packs')) {
      const vendorId = e.target.dataset.vendorId;
      const input = e.target.parentElement.previousElementSibling.querySelector('input');
      const packs = parseInt(input.value) || 0;
      updatePacksSold(vendorId, packs);
    }
  });
  
  // Report modal handlers
// Handle clicks and assignments
document.getElementById('investors-table').addEventListener('click', async (e) => {
    if (e.target.classList.contains('add-vendor-btn')) {
      const investorId = e.target.dataset.investorId;
      // Check vendor count
      const { count } = await supabase
        .from('vendors')
        .select('id', { count: 'exact' })
        .eq('investor_id', investorId);
      if (count >= 80) {
        showToast('Cannot add more than 80 vendors per investor');
        return;
      }
      document.getElementById('vendor-investor-id').value = investorId;
      document.getElementById('add-vendor-modal').style.display = 'flex';
    }
    if (e.target.classList.contains('save-packs')) {
      const vendorId = e.target.dataset.vendorId;
      const input = e.target.parentElement.previousElementSibling.querySelector('input');
      const packs = parseInt(input.value) || 0;
      updatePacksSold(vendorId, packs);
    }
    if (e.target.classList.contains('view-report-btn')) {
      const investorId = e.target.dataset.investorId;
      const investorName = e.target.dataset.investorName;
      const { data: vendors, error } = await supabase
        .from('vendors')
        .select('name, packs_sold')
        .eq('investor_id', investorId);
      if (error) {
        showToast('Error fetching report data: ' + error.message);
        return;
      }
  
      const totalPacks = vendors.reduce((sum, v) => sum + v.packs_sold, 0);
      const totalCut = (totalPacks * 13.50).toFixed(2);
  
      document.getElementById('report-title').textContent = `Investor Report: ${investorName}`;
      document.getElementById('report-date').textContent = `Date: ${new Date().toLocaleDateString()}`;
      const tbody = document.querySelector('#report-table tbody');
      tbody.innerHTML = vendors.map(v => `
        <tr>
          <td>${v.name}</td>
          <td>${v.packs_sold}</td>
        </tr>
      `).join('');
      document.getElementById('report-total-packs').textContent = `Total Packs Sold: ${totalPacks}`;
      document.getElementById('report-total-cut').textContent = `Total Cut: $${totalCut}`;
      document.getElementById('report-modal').style.display = 'flex';
    }
  });
  
  document.getElementById('investors-table').addEventListener('change', async (e) => {
    if (e.target.classList.contains('assign-vendor')) {
      const vendorId = e.target.value;
      const investorId = e.target.dataset.investorId;
      if (vendorId) {
        // Check vendor count
        const { count } = await supabase
          .from('vendors')
          .select('id', { count: 'exact' })
          .eq('investor_id', investorId);
        if (count >= 80) {
          showToast('Cannot assign more than 80 vendors per investor');
          e.target.value = '';
          return;
        }
        const { error } = await supabase
          .from('vendors')
          .update({ investor_id: investorId })
          .eq('id', vendorId);
        if (error) {
          showToast('Error assigning vendor: ' + error.message);
        } else {
          showToast('Vendor assigned successfully!');
          fetchInvestors(document.getElementById('investor-filter').value);
        }
      }
    }
  });
  
    // Show modal when clicking "Add Investor"
    document.getElementById('add-investor-btn').addEventListener('click', () => {
      console.log('Add Investor button clicked');
      const modal = document.getElementById('add-investor-modal');
      console.log('Modal element:', modal);
      modal.style.display = 'flex';
      console.log('Modal display after change:', modal.style.display);
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