function populateYearFilter() {
    const yearFilter = document.getElementById('year-filter');
    const currentYear = new Date().getFullYear();
    yearFilter.innerHTML = '<option value="">All Years</option>' + 
        Array.from({ length: 5 }, (_, i) => `<option value="${currentYear - i}" ${currentYear - i === currentYear ? 'selected' : ''}>${currentYear - i}</option>`).join('');
    yearFilter.value = currentYear; // Default to current year
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    const currentMonth = new Date().getMonth() + 1; // 1-12
    monthFilter.value = currentMonth; // Default to current month
}

function updateDateField() {
    const monthFilter = document.getElementById('month-filter').value;
    const yearFilter = document.getElementById('year-filter').value;
    const dateInput = document.getElementById('expense-date');
    const now = new Date();
    const year = yearFilter || now.getFullYear();
    const month = monthFilter ? String(monthFilter).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`; // Default to current date within filtered month/year
}

// Form submission
// Form submission
document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const description = document.getElementById('expense-description').value;
    const expenseDate = document.getElementById('expense-date').value;
    const category = document.getElementById('expense-category').value;

    if (!amount || !expenseDate) {
        showToast('Please fill in all required fields!', null, 'error');
        return;
    }

    const { error } = await supabase
        .from('expenses')
        .insert({
            amount,
            description: description || null,
            expense_date: new Date(expenseDate).toISOString(),
            category: category || null
        });

    if (error) {
        showToast('Error adding expense: ' + error.message, null, 'error');
        return;
    }

    showToast('Expense added successfully!');
    document.getElementById('add-expense-form').reset();
    updateDateField();
});

// Initialize
checkAuth('admin').then(isAuthenticated => {
    if (isAuthenticated) {
        renderMenu(['product', 'vendors', 'sales-monitoring', 'delivery-management', 'expenses']);
        populateYearFilter();
        populateMonthFilter();
        updateDateField(); // Set initial date
    }
});
