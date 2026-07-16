import { API_URL } from './api.js';

// --- Module State & Config ---
let currentPagination = { currentPage: 1, limit: 10 };
let allCompaniesForInvoice = []; // Cache for the company list
let currentSort = { column: 'created_at', order: 'desc' };
let currentStatusFilter = 'new'; // 'new' or 'paid'

// --- DOM Elements ---
let billingTableBody, searchInvoiceInput, viewInvoiceModal, closeInvoiceModalBtn, invoiceContentContainer, printInvoiceBtn, addInvoiceModal, closeAddInvoiceModalBtn, addInvoiceForm, addInvoiceBtn, markAsPaidModal, closeMarkAsPaidModalBtn, markAsPaidForm;

// --- Dependencies ---
let fetchData;
let SAAS_API;

// --- Data Loading & Rendering ---
export async function loadInvoices(page = 1, limit = 10) {
    try {
        billingTableBody.innerHTML = '<tr><td colspan="7" class="loading">Loading invoices...</td></tr>';
        const searchTerm = searchInvoiceInput.value || '';
        const endpoint = `${SAAS_API.invoices}?page=${page}&limit=${limit}&search=${encodeURIComponent(searchTerm)}&sortBy=${currentSort.column}&sortOrder=${currentSort.order}&status=${currentStatusFilter}`;

        const response = await fetchData(endpoint);
        const invoices = response?.data;

        if (invoices) {
            renderInvoicesTable(invoices);
            if (response.pagination) {
                renderInvoicesPagination(response.pagination);
                currentPagination = response.pagination;
            } else {
                document.getElementById('billing-pagination-controls').innerHTML = '';
            }
        } else {
            billingTableBody.innerHTML = '<tr><td colspan="7" class="error">Failed to load invoices.</td></tr>';
            document.getElementById('billing-pagination-controls').innerHTML = '';
        }
    } catch (error) {
        billingTableBody.innerHTML = `<tr><td colspan="7" class="error">An error occurred: ${error.message}</td></tr>`;
        document.getElementById('billing-pagination-controls').innerHTML = '';
    }
}

function renderInvoicesTable(invoices) {
    billingTableBody.innerHTML = '';
    if (invoices.length === 0) {
        billingTableBody.innerHTML = `<tr><td colspan="7">No invoices found.</td></tr>`;
        return;
    }

    invoices.forEach(invoice => {
        const row = document.createElement('tr');

        const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(invoice.amount || 0);
        const dateFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('id-ID', dateFormatOptions) : 'N/A';
        const createdAtDate = new Date(invoice.createdAt).toLocaleDateString('id-ID', dateFormatOptions);

        let statusBadge;
        switch (invoice.status) {
            case 'paid':
                statusBadge = `<span class="status-badge status-paid">Paid</span>`;
                break;
            case 'due':
                statusBadge = `<span class="status-badge status-due">Due</span>`;
                break;
            case 'overdue':
                statusBadge = `<span class="status-badge status-overdue">Overdue</span>`;
                break;
            default:
                statusBadge = `<span class="status-badge status-draft">Draft</span>`;
        }

        row.innerHTML = `
            <td>${invoice.id}</td>
            <td>${invoice.companyName}</td>
            <td>${formattedAmount}</td>
            <td>${dueDate}</td>
            <td>${statusBadge}</td>
            <td>${createdAtDate}</td>
            <td class="actions">
                ${currentStatusFilter === 'paid' ? `
                    <button class="btn-action btn-view" data-id="${invoice.invoicePk}" title="View Invoice"><i class="fas fa-eye"></i></button>
                    <button class="btn-action btn-reopen-invoice" data-id="${invoice.invoicePk}" title="Re-open Invoice"><i class="fas fa-undo"></i></button>
                ` : `
                    <button class="btn-action btn-view" data-id="${invoice.invoicePk}" title="View Invoice"><i class="fas fa-eye"></i></button>
                    <button class="btn-action btn-edit-invoice" data-id="${invoice.invoicePk}" title="Edit Invoice"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-mark-paid" data-id="${invoice.invoicePk}" title="Mark as Paid" ${invoice.status === 'paid' ? 'disabled' : ''}>
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn-action btn-delete-invoice" data-id="${invoice.invoicePk}" title="Delete Invoice">
                        <i class="fas fa-trash"></i>
                    </button>
                `}
            </td>
        `;
        billingTableBody.appendChild(row);
    });
}

function renderInvoicesPagination(pagination) {
    const paginationContainer = document.getElementById('billing-pagination-controls');
    if (!paginationContainer || !pagination || pagination.totalPages <= 1) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const { currentPage, totalPages, totalItems, limit } = pagination;
    const startItem = (currentPage - 1) * limit + 1;
    const endItem = Math.min(startItem + limit - 1, totalItems);

    let pageNumbersHTML = '';
    const pages = [];
    const maxVisiblePages = 5;
    const sidePages = 1;

    if (totalPages <= maxVisiblePages + 2) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > sidePages + 2) pages.push('...');
        let start = Math.max(2, currentPage - sidePages);
        let end = Math.min(totalPages - 1, currentPage + sidePages);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - sidePages - 1) pages.push('...');
        pages.push(totalPages);
    }

    pages.forEach(page => {
        if (page === '...') {
            pageNumbersHTML += `<span>...</span>`;
        } else {
            const isActive = page === currentPage;
            pageNumbersHTML += `<button data-page="${page}" class="${isActive ? 'active' : ''}">${page}</button>`;
        }
    });

    const paginationHTML = `
        <p>Showing ${startItem} to ${endItem} of ${totalItems} results</p>
        <nav>
            <button data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Previous</button>
            ${pageNumbersHTML}
            <button data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next &raquo;</button>
        </nav>
    `;
    paginationContainer.innerHTML = paginationHTML;

    paginationContainer.querySelectorAll('button[data-page]').forEach(button => {
        button.addEventListener('click', (e) => {
            const page = parseInt(e.currentTarget.dataset.page, 10);
            loadInvoices(page, limit);
        });
    });
}

function handleInvoiceSearch() {
    loadInvoices(1, currentPagination.limit);
}

function switchBillingTab(status) {
    currentStatusFilter = status;
    const tabs = document.querySelectorAll('#billing-tabs .tab-item');
    tabs.forEach(tab => {
        if (tab.dataset.status === status) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Sembunyikan tombol "Add New Invoice" jika tab 'paid' aktif
    if (addInvoiceBtn) {
        addInvoiceBtn.style.display = status === 'paid' ? 'none' : '';
    }

    loadInvoices(); // Reload invoices with the new filter
}

// --- Add/Edit Invoice Modal Functions ---

async function showInvoiceFormModal(invoiceId = null) {
    const isEdit = !!invoiceId;
    const modalTitle = document.getElementById('invoice-modal-title');
    const submitBtn = document.getElementById('invoice-form-submit-btn');

    // Reset and configure modal for add/edit
    addInvoiceForm.reset();
    document.getElementById('invoice-id-input').value = isEdit ? invoiceId : '';
    modalTitle.textContent = isEdit ? 'Edit Invoice' : 'Add New Invoice';
    submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Invoice';

    addInvoiceModal.style.display = 'flex';
    
    const companySearchInput = document.getElementById('invoice-company-search');
    const companyResultsContainer = document.getElementById('invoice-company-results');
    const companyIdInput = document.getElementById('invoice-company-id');
    const quantityInput = document.getElementById('invoice-quantity');
    const unitPriceInput = document.getElementById('invoice-unit-price');
    const amountInput = document.getElementById('invoice-amount'); // This is now the hidden input for subtotal
    const subtotalDisplay = document.getElementById('invoice-form-subtotal-amount');
    
    // --- Tax Calculation Setup ---
    const saasSettings = await fetchData(SAAS_API.saasSettings).catch(() => ({}));
    const ppnRate = parseFloat(saasSettings.saas_tax_ppn_rate) || 0;
    const pph23Rate = parseFloat(saasSettings.saas_tax_pph23_rate) || 0;

    document.getElementById('invoice-form-ppn-rate').textContent = ppnRate;
    document.getElementById('invoice-form-pph23-rate').textContent = pph23Rate;

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

    const calculateTotals = () => {
        const quantity = parseFloat(quantityInput.value) || 0;
        const unitPrice = parseFloat(unitPriceInput.value) || 0;
        const subtotal = quantity * unitPrice;
        
        amountInput.value = subtotal; // Update hidden input
        subtotalDisplay.textContent = formatCurrency(subtotal);
        const ppnAmount = (subtotal * ppnRate) / 100;
        const pph23Amount = (subtotal * pph23Rate) / 100;
        const totalAmount = subtotal + ppnAmount;

        document.getElementById('invoice-form-ppn-amount').textContent = formatCurrency(ppnAmount);
        document.getElementById('invoice-form-total-amount').textContent = formatCurrency(totalAmount);
        document.getElementById('invoice-form-pph23-amount').textContent = `(${formatCurrency(pph23Amount)})`;
    };

    // Add event listener for real-time calculation
    quantityInput.removeEventListener('input', calculateTotals);
    unitPriceInput.removeEventListener('input', calculateTotals);
    quantityInput.addEventListener('input', calculateTotals);
    unitPriceInput.addEventListener('input', calculateTotals);

    // Initial calculation
    calculateTotals();
    // --- End Tax Calculation Setup ---

    // Populate company list if not already populated
    if (allCompaniesForInvoice.length === 0) {
        try {
            companySearchInput.placeholder = 'Loading companies...';
            companySearchInput.disabled = true;
            const response = await fetchData(`${SAAS_API.companies}?limit=1000`);
            allCompaniesForInvoice = response?.data || [];
            companySearchInput.placeholder = 'Type to search for a company...';
            companySearchInput.disabled = false;
        } catch (error) {
            companySearchInput.placeholder = 'Error loading companies';
            console.error("Error fetching companies for invoice modal:", error);
        }
    }

    if (isEdit) {
        // Fetch invoice data to populate the form
        const invoiceData = await fetchData(`${SAAS_API.invoices}/${invoiceId}`);
        if (invoiceData) {
            // Assuming the backend now returns an `items` array.
            // For this form, we'll work with the first item.
            const firstItem = invoiceData.items && invoiceData.items[0] ? invoiceData.items[0] : {};

            companyIdInput.value = invoiceData.companyId;
            companySearchInput.value = invoiceData.companyName;
            document.getElementById('invoice-description').value = firstItem.description || invoiceData.description || ''; // Fallback for old data
            quantityInput.value = firstItem.quantity || 1;
            unitPriceInput.value = firstItem.unit_price || invoiceData.amount || 0; // Fallback for old data
            document.getElementById('invoice-due-date').value = new Date(invoiceData.dueDate).toISOString().split('T')[0];
            document.getElementById('invoice-status').value = invoiceData.status;
            calculateTotals(); // Recalculate all totals with the populated data
        } else {
            alert('Failed to load invoice data for editing.');
            hideInvoiceFormModal();
        }
    } else {
        // Clear fields for add mode
        companyIdInput.value = '';
        companySearchInput.value = '';
        quantityInput.value = 1;
        unitPriceInput.value = '';
        companyResultsContainer.innerHTML = '';
        companyResultsContainer.style.display = 'none';
        // Set a default description for new invoices
        const monthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        document.getElementById('invoice-description').value = `SaaS Subscription for ${monthYear}`;
    }
}

function hideInvoiceFormModal() {
    addInvoiceModal.style.display = 'none';
}

async function handleInvoiceFormSubmit(e) {
    e.preventDefault();

    const invoiceId = document.getElementById('invoice-id-input').value;
    const isEdit = !!invoiceId;

    const companyId = document.getElementById('invoice-company-id').value;
    if (!companyId) {
        alert('Please select a valid company from the list.');
        document.getElementById('invoice-company-search').focus();
        return;
    }

    if (!addInvoiceForm.checkValidity()) {
        addInvoiceForm.reportValidity();
        return;
    }

    const invoiceData = {
        company_id: companyId,
        // The backend will calculate the final amount from items
        items: [{
            description: document.getElementById('invoice-description').value,
            quantity: parseFloat(document.getElementById('invoice-quantity').value) || 1,
            unit_price: parseFloat(document.getElementById('invoice-unit-price').value) || 0,
        }],
        due_date: document.getElementById('invoice-due-date').value,
        status: document.getElementById('invoice-status').value,
    };

    const method = isEdit ? 'PUT' : 'POST';
    const endpoint = isEdit ? `${SAAS_API.invoices}/${invoiceId}` : SAAS_API.invoices;

    try {
        await fetchData(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invoiceData) });
        alert(`Invoice ${isEdit ? 'updated' : 'created'} successfully!`);
        hideInvoiceFormModal();
        loadInvoices(); // Reload the table
    } catch (error) {
        alert(`Error ${isEdit ? 'updating' : 'creating'} invoice: ${error.message}`);
    }
}

async function handleDeleteInvoice(invoiceId) {
    if (confirm('Are you sure you want to permanently delete this invoice? This action cannot be undone.')) {
        try {
            await fetchData(`${SAAS_API.invoices}/${invoiceId}`, { method: 'DELETE' });
            alert('Invoice deleted successfully.');
            loadInvoices();
        } catch (error) {
            alert(`Error deleting invoice: ${error.message}`);
        }
    }
}

async function handleReopenInvoice(invoiceId) {
    if (confirm('Are you sure you want to re-open this invoice? This will move it back to "New Billing" and mark it as "due".')) {
        try {
            await fetchData(`${SAAS_API.invoices}/${invoiceId}/reopen`, { method: 'PUT' });
            alert('Invoice re-opened successfully.');
            // Reload the current tab. The invoice will disappear from the 'paid' list.
            loadInvoices();
        } catch (error) {
            alert(`Error re-opening invoice: ${error.message}`);
        }
    }
}

// --- Mark as Paid Modal Functions ---

function showMarkAsPaidModal(invoiceId) {
    markAsPaidForm.reset();
    document.getElementById('mark-as-paid-invoice-id').value = invoiceId;
    // Set default payment date to today
    document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
    markAsPaidModal.style.display = 'flex';
}

function hideMarkAsPaidModal() {
    markAsPaidModal.style.display = 'none';
}

async function handleMarkAsPaidSubmit(e) {
    e.preventDefault();
    if (!markAsPaidForm.checkValidity()) {
        markAsPaidForm.reportValidity();
        return;
    }

    const invoiceId = document.getElementById('mark-as-paid-invoice-id').value;
    const paymentData = {
        paymentDate: document.getElementById('payment-date').value,
        paymentNotes: document.getElementById('payment-notes').value,
    };

    const endpoint = `${SAAS_API.invoices}/${invoiceId}/mark-as-paid`;

    try {
        await fetchData(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });
        alert('Invoice marked as paid successfully!');
        hideMarkAsPaidModal();
        loadInvoices(); // Reload the table to reflect the change
    } catch (error) {
        alert(`Error updating invoice: ${error.message}`);
    }
}

// --- Invoice Modal Functions ---

function showInvoiceModal() {
    if (viewInvoiceModal) viewInvoiceModal.style.display = 'flex';
}

function hideInvoiceModal() {
    if (viewInvoiceModal) viewInvoiceModal.style.display = 'none';
}

async function handleViewInvoice(invoicePk) {
    showInvoiceModal();
    invoiceContentContainer.innerHTML = '<div class="text-center py-10">Loading invoice...</div>';
 
    try {
        // Fetch the rendered HTML directly from the backend
        const invoiceHtml = await fetchData(`${SAAS_API.invoices}/${invoicePk}/preview`, {
            responseType: 'text'
        });

        if (invoiceHtml) {
            invoiceContentContainer.innerHTML = invoiceHtml;
        } else {
            invoiceContentContainer.innerHTML = '<div class="text-center py-10 text-red-500">Failed to load invoice details.</div>';
        }
    } catch (error) {
        invoiceContentContainer.innerHTML = `<div class="text-center py-10 text-red-500">Error: ${error.message}</div>`;
    }

    // --- Client-side PDF Generation ---
    const printButton = document.getElementById('btn-print-invoice');
    printButton.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF';

    // Assign/re-assign onclick handler to generate PDF. This captures the current invoicePk.
    printButton.onclick = () => {
        console.log(`Generating PDF for invoice ${invoicePk}...`);
        
        const element = document.getElementById('invoice-content');
        
        const options = {
            margin:       [0.5, 0.5, 0.5, 0.5], // [top, left, bottom, right] in inches
            filename:     `invoice-${invoicePk}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true }, // scale: 2 for better resolution
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        // Use html2pdf to create and save the file
        html2pdf().set(options).from(element).save();
    };
}

export function initBillingModule(config) {
    fetchData = config.fetchData;
    SAAS_API = config.SAAS_API;

    billingTableBody = config.dom.billingTableBody;
    searchInvoiceInput = config.dom.searchInvoiceInput;
    viewInvoiceModal = document.getElementById('view-invoice-modal');
    closeInvoiceModalBtn = document.getElementById('close-invoice-modal-btn');
    invoiceContentContainer = document.getElementById('invoice-content');
    const printInvoiceBtn = document.getElementById('btn-print-invoice');
    addInvoiceModal = document.getElementById('add-invoice-modal');
    closeAddInvoiceModalBtn = document.getElementById('close-add-invoice-modal-btn');
    addInvoiceForm = document.getElementById('add-invoice-form');
    addInvoiceBtn = document.getElementById('add-invoice-btn');
    markAsPaidModal = document.getElementById('mark-as-paid-modal');
    closeMarkAsPaidModalBtn = document.getElementById('close-mark-as-paid-modal-btn');
    markAsPaidForm = document.getElementById('mark-as-paid-form');

    const billingTabs = document.getElementById('billing-tabs');
    if (billingTabs) {
        billingTabs.addEventListener('click', (e) => {
            if (e.target.matches('.tab-item')) {
                switchBillingTab(e.target.dataset.status);
            }
        });
    }

    const companySearchInput = document.getElementById('invoice-company-search');
    const companyResultsContainer = document.getElementById('invoice-company-results');
    const companyIdInput = document.getElementById('invoice-company-id');

    if (companySearchInput) {
        companySearchInput.addEventListener('input', () => {
            const searchTerm = companySearchInput.value.toLowerCase();
            if (searchTerm === '') {
                companyIdInput.value = ''; // Clear hidden ID if input is cleared
            }

            const filteredCompanies = allCompaniesForInvoice.filter(company => 
                company.name.toLowerCase().includes(searchTerm)
            );
            
            companyResultsContainer.innerHTML = '';
            if (filteredCompanies.length > 0) {
                filteredCompanies.forEach(company => {
                    const item = document.createElement('div');
                    item.className = 'result-item';
                    item.textContent = `${company.name}`;
                    item.dataset.id = company.id;
                    item.dataset.name = company.name;
                    companyResultsContainer.appendChild(item);
                });
            } else {
                companyResultsContainer.innerHTML = '<div class="no-results">No companies found</div>';
            }
            companyResultsContainer.style.display = 'block';
        });

        companyResultsContainer.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('result-item')) {
                companySearchInput.value = e.target.dataset.name;
                companyIdInput.value = e.target.dataset.id;
                companyResultsContainer.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select-container')) {
                companyResultsContainer.style.display = 'none';
            }
        });
    }

    searchInvoiceInput.addEventListener('input', () => {
        clearTimeout(searchInvoiceInput.debounce);
        searchInvoiceInput.debounce = setTimeout(() => {
            handleInvoiceSearch();
        }, 300);
    });

    if (addInvoiceBtn) addInvoiceBtn.addEventListener('click', () => showInvoiceFormModal());
    if (closeAddInvoiceModalBtn) closeAddInvoiceModalBtn.addEventListener('click', hideInvoiceFormModal);
    if (addInvoiceForm) addInvoiceForm.addEventListener('submit', handleInvoiceFormSubmit);
    if (closeMarkAsPaidModalBtn) closeMarkAsPaidModalBtn.addEventListener('click', hideMarkAsPaidModal);
    if (markAsPaidForm) markAsPaidForm.addEventListener('submit', handleMarkAsPaidSubmit);

    closeInvoiceModalBtn.addEventListener('click', hideInvoiceModal);
    // The print button's onclick is now set dynamically in handleViewInvoice

    billingTableBody.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.btn-view');
        if (viewBtn) {
            const invoicePk = viewBtn.dataset.id;
            handleViewInvoice(invoicePk);
        }

        const editBtn = e.target.closest('.btn-edit-invoice');
        if (editBtn) {
            showInvoiceFormModal(editBtn.dataset.id);
        }

        const markPaidBtn = e.target.closest('.btn-mark-paid');
        if (markPaidBtn) {
            const invoiceId = markPaidBtn.dataset.id;
            showMarkAsPaidModal(invoiceId);
        }

        const deleteBtn = e.target.closest('.btn-delete-invoice');
        if (deleteBtn) {
            handleDeleteInvoice(deleteBtn.dataset.id);
        }

        const reopenBtn = e.target.closest('.btn-reopen-invoice');
        if (reopenBtn) {
            handleReopenInvoice(reopenBtn.dataset.id);
        }
    });
}