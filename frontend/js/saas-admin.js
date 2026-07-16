import { initCompanyModule, loadCompanies } from './saas-admin-companies.js';
import { initSaaSUsersModule, loadSaaSUsers } from './saas-admin-users.js';
import { initBillingModule, loadInvoices } from './saas-admin-billing.js';
import { initCorporateModule, loadCorporates } from './saas-admin-corporates.js';
import { fetchData, logout, getUser, getToken, API_URL } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    
    const user = getUser();
    const token = getToken();

    if (!user || !token) {
        console.error("User data or token not found.");
        alert('Sesi login tidak valid. Silakan login ulang.');
        logout();
        return;
    }

    // Pastikan hanya superadmin yang bisa mengakses halaman ini
    if (user.role !== 'superadmin') {
        console.error(`Access Denied: User role is '${user.role}', but 'superadmin' is required.`);
        alert('Akses ditolak. Halaman ini hanya untuk Super Admin.');
        logout();
        return;
    }

    let companyGrowthChartInstance  = null;
    let revenueTrendChartInstance   = null;

    // --- DOM Elements ---
    const dom = {
        pageTitle: document.getElementById('page-title'),
        menuItems: document.querySelectorAll('.menu-item'),
        pageContents: document.querySelectorAll('.page-content'),
        logoutBtn: document.getElementById('logout-btn'),

        // Dashboard elements
        revenueTrendChart:  document.getElementById('revenue-trend-chart'),
        totalCompaniesCard: document.getElementById('total-companies'),
        totalEmployeesCard: document.getElementById('total-employees'),
        totalRevenueCard: document.getElementById('total-revenue'),
        totalUnpaidCard: document.getElementById('total-unpaid'),
        companyGrowthChart: document.getElementById('company-growth-chart'),
        recentCompaniesList: document.getElementById('recent-companies-list'),

        // Company page elements
        companiesTableBody: document.querySelector('#companies-table tbody'),
        addCompanyBtn: document.getElementById('add-company-btn'),
        searchCompanyInput: document.getElementById('search-company-input'),

        // Add Company Modal elements
        addCompanyModal: document.getElementById('add-company-modal'),
        closeAddModalBtn: document.getElementById('close-add-modal-btn'),
        addCompanyForm: document.getElementById('add-company-form'),

        // Edit Company Modal elements
        editCompanyModal: document.getElementById('edit-company-modal'),
        closeEditModalBtn: document.getElementById('close-edit-modal-btn'),
        editCompanyForm: document.getElementById('edit-company-form'),
        // Settings page elements
        settingsCards: document.querySelectorAll('#settings .card.clickable'),

        // Billing page elements
        billingTableBody: document.querySelector('#billing-table tbody'),
        searchInvoiceInput: document.getElementById('search-invoice-input'),

        // SaaS User Management elements
        saasUsersTableBody: document.querySelector('#saas-users-table tbody'),
        addSaaSUserBtn: document.getElementById('add-saas-user-btn'),
        searchSaaSUserInput: document.getElementById('search-saas-user-input'),
        saasUserModal: document.getElementById('saas-user-modal'),
        closeSaaSUserModalBtn: document.getElementById('close-saas-user-modal-btn'),
        saasUserForm: document.getElementById('saas-user-form'),

        // SaaS Profile Settings
        saasProfileForm: document.getElementById('saas-profile-form'),

        // Invoice Layout Settings
        invoiceLayoutForm: document.getElementById('invoice-layout-form'),

        // Tax Settings
        taxSettingsForm: document.getElementById('tax-settings-form'),
    };

    const SAAS_API = {
        dashboardStats:  '/saas/dashboard-stats',
        companies:       '/saas/companies',
        users:           '/saas/users',
        invoices:        '/saas/invoices',
        saasSettings:    '/saas/settings',
        companyGrowth:   '/saas/company-growth',
        recentCompanies: '/saas/recent-companies',
        monthlyRevenue:  '/saas/monthly-revenue',
    };

    // --- Data Loading & Rendering ---
    function formatCompactIDR(val) {
        const num = parseFloat(val) || 0;
        if (num >= 1_000_000_000_000) return 'Rp ' + (num / 1_000_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' T';
        if (num >= 1_000_000_000)     return 'Rp ' + (num / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' M';
        if (num >= 1_000_000)         return 'Rp ' + (num / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' Jt';
        if (num >= 1_000)             return 'Rp ' + (num / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' Rb';
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    async function loadDashboardData() {
        try {
            const stats = await fetchData(SAAS_API.dashboardStats);
            if (stats) {
                dom.totalCompaniesCard.textContent = stats.totalCompanies || 0;
                dom.totalEmployeesCard.textContent = stats.totalEmployees || 0;
                dom.totalRevenueCard.textContent = formatCompactIDR(stats.totalRevenue);
                dom.totalUnpaidCard.textContent = stats.totalUnpaidBilling || 0;
                loadCompanyGrowthChart();
                loadRecentCompanies();
                loadRevenueTrendChart();
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    async function loadRecentCompanies() {
        if (!dom.recentCompaniesList) return;

        dom.recentCompaniesList.innerHTML = '<li>Loading...</li>';
        const companies = await fetchData(SAAS_API.recentCompanies);

        if (companies && companies.length > 0) {
            dom.recentCompaniesList.innerHTML = '';
            companies.forEach(company => {
                const li = document.createElement('li');
                
                const now = new Date();
                const createdAt = new Date(company.createdAt);
                const diffSeconds = Math.round((now - createdAt) / 1000);
                let timeAgo = '';

                if (diffSeconds < 60) timeAgo = `${diffSeconds}s ago`;
                else if (diffSeconds < 3600) timeAgo = `${Math.floor(diffSeconds / 60)}m ago`;
                else if (diffSeconds < 86400) timeAgo = `${Math.floor(diffSeconds / 3600)}h ago`;
                else timeAgo = `${Math.floor(diffSeconds / 86400)}d ago`;

                 li.innerHTML = `
                    <div class="company-details">
                        <div class="name">
                            <a href="#" class="recent-company-link" data-company-name="${company.name}">${company.name}</a>
                        </div>
                        <div class="email">${company.adminEmail || 'No admin'}</div>
                    </div>
                    <div class="company-time">${timeAgo}</div>`;
                dom.recentCompaniesList.appendChild(li);
            });
        } else {
            dom.recentCompaniesList.innerHTML = '<li>No recent companies found.</li>';
        }
    }

    async function loadCompanyGrowthChart() {
        if (companyGrowthChartInstance) {
            companyGrowthChartInstance.destroy();
            companyGrowthChartInstance = null;
        }
        if (!dom.companyGrowthChart) return;

        let data;
        try {
            data = await fetchData(SAAS_API.companyGrowth);
        } catch (e) {
            console.error('Failed to load company growth:', e);
            return;
        }
        if (!data) return;

        const ctx = dom.companyGrowthChart.getContext('2d');
        companyGrowthChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: String(data.currentYear),
                        data: data.currentData,
                        backgroundColor: 'rgba(74, 105, 189, 0.75)',
                        borderColor: 'rgba(74, 105, 189, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                    {
                        label: String(data.previousYear),
                        data: data.previousData,
                        backgroundColor: 'rgba(148, 163, 184, 0.5)',
                        borderColor: 'rgba(148, 163, 184, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { boxWidth: 12, padding: 16, usePointStyle: true },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { stepSize: 1 },
                    },
                    x: { grid: { display: false } },
                },
            },
        });
    }

    async function loadRevenueTrendChart() {
        if (revenueTrendChartInstance) {
            revenueTrendChartInstance.destroy();
            revenueTrendChartInstance = null;
        }
        if (!dom.revenueTrendChart) return;

        let data;
        try {
            data = await fetchData(SAAS_API.monthlyRevenue);
        } catch (e) {
            console.error('Failed to load monthly revenue:', e);
            return;
        }
        if (!data) return;

        const canvas = dom.revenueTrendChart;
        const ctx    = canvas.getContext('2d');
        const h      = canvas.offsetHeight || 340;

        // Gradient arsir tahun ini (biru)
        const gradCurrent = ctx.createLinearGradient(0, 0, 0, h);
        gradCurrent.addColorStop(0, 'rgba(74, 105, 189, 0.35)');
        gradCurrent.addColorStop(1, 'rgba(74, 105, 189, 0.0)');

        // Gradient arsir tahun lalu (abu-abu)
        const gradPrevious = ctx.createLinearGradient(0, 0, 0, h);
        gradPrevious.addColorStop(0, 'rgba(148, 163, 184, 0.22)');
        gradPrevious.addColorStop(1, 'rgba(148, 163, 184, 0.0)');

        revenueTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: String(data.currentYear),
                        data: data.currentData,
                        borderColor: '#4a69bd',
                        backgroundColor: gradCurrent,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointBackgroundColor: '#4a69bd',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: String(data.previousYear),
                        data: data.previousData,
                        borderColor: '#94a3b8',
                        backgroundColor: gradPrevious,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointBackgroundColor: '#94a3b8',
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { boxWidth: 12, padding: 16, usePointStyle: true },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `  ${ctx.dataset.label}: ${formatCompactIDR(ctx.raw)}`,
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            maxTicksLimit: 6,
                            callback: (val) => formatCompactIDR(val),
                        },
                    },
                    x: { grid: { display: false } },
                },
            },
        });
    }

    function switchPage(target) {
        // Update active menu item
        dom.menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.target === target) {
                item.classList.add('active');
            }
        });

        // Show active page content
        dom.pageContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === target) {
                content.classList.add('active');
            }
        });

        // Update page title
        const activeMenuItem = document.querySelector(`.menu-item[data-target="${target}"]`);
        if (activeMenuItem && dom.pageTitle) {
            dom.pageTitle.textContent = activeMenuItem.textContent.trim();
        }

        // Load data for the new page
        if (target === 'dashboard') {
            loadDashboardData();
        } else if (target === 'companies') {
            loadCompanies(); // Load first page by default
        } else if (target === 'corporates') {
            loadCorporates();
        } else if (target === 'billing') {
            loadInvoices();
        } else if (target === 'settings') {
            // No data to load for the main settings page for now.
        }
    }

    async function loadSaaSProfile() {
        try {
            const settings = await fetchData(SAAS_API.saasSettings);
            if (settings) {
                document.getElementById('saas-company-name').value = settings.saas_company_name || '';
                document.getElementById('saas-company-address').value = settings.saas_company_address || '';
                document.getElementById('saas-support-whatsapp').value = settings.saas_support_whatsapp || '';
                document.getElementById('saas-npwp').value = settings.saas_npwp || '';
                document.getElementById('saas-bank-account').value = settings.saas_bank_account || '';

                // New: Load logo preview
                const logoPreview = document.getElementById('saas-company-logo-preview');
                if (settings.saas_company_logo) {
                    const baseUrl = API_URL.replace(/\/api$/, '');
                    logoPreview.src = `${baseUrl}${settings.saas_company_logo}?t=${new Date().getTime()}`; // Add timestamp to prevent caching
                } else {
                    logoPreview.src = 'https://placehold.co/100x100/e2e8f0/cbd5e1?text=Logo';
                }
            }
        } catch (error) {
            alert('Failed to load SaaS profile settings.');
        }
    }

    async function handleUpdateSaaSProfile(e) {
        e.preventDefault();

        // Use FormData to handle file upload
        const formData = new FormData();
        formData.append('saas_company_name', document.getElementById('saas-company-name').value);
        formData.append('saas_company_address', document.getElementById('saas-company-address').value);
        formData.append('saas_support_whatsapp', document.getElementById('saas-support-whatsapp').value);
        formData.append('saas_npwp', document.getElementById('saas-npwp').value);
        formData.append('saas_bank_account', document.getElementById('saas-bank-account').value);

        // Append the logo file if selected
        const logoUploadInput = document.getElementById('saas-company-logo-upload');
        if (logoUploadInput.files.length > 0) {
            formData.append('saas_company_logo', logoUploadInput.files[0]);
        }

        try {
            const result = await fetchData(SAAS_API.saasSettings, {
                method: 'PUT',
                body: formData
                // NOTE: Do NOT set 'Content-Type'. The browser will set it to 'multipart/form-data' automatically.
            });
            if (result) {
                alert('SaaS profile updated successfully!');
                loadSaaSProfile(); // Reload to see the new logo
            }
        } catch (error) {
            alert(`Error updating settings: ${error.message}`);
        }
    }

    async function loadInvoiceLayoutSettings() {
        try {
            const settings = await fetchData(SAAS_API.saasSettings);
            if (settings) {
                document.getElementById('saas-invoice-signature-text').value = settings.saas_invoice_signature_text || '';
                document.getElementById('saas-invoice-signature-name').value = settings.saas_invoice_signature_name || '';
                document.getElementById('saas-invoice-footer-text').value = settings.saas_invoice_footer_text || '';
            }
        } catch (error) {
            alert('Failed to load invoice layout settings.');
        }
    }

    async function handleUpdateInvoiceLayout(e) {
        e.preventDefault();
        const updatedSettings = {
            saas_invoice_signature_text: document.getElementById('saas-invoice-signature-text').value,
            saas_invoice_signature_name: document.getElementById('saas-invoice-signature-name').value,
            saas_invoice_footer_text: document.getElementById('saas-invoice-footer-text').value,
        };

        try {
            const result = await fetchData(SAAS_API.saasSettings, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings)
            });
            if (result) {
                alert('Invoice layout settings updated successfully!');
            }
        } catch (error) {
            alert(`Error updating settings: ${error.message}`);
        }
    }

    async function loadTaxSettings() {
        try {
            const settings = await fetchData(SAAS_API.saasSettings);
            if (settings) {
                document.getElementById('saas-tax-ppn-rate').value = settings.saas_tax_ppn_rate || '11';
                document.getElementById('saas-tax-pph23-rate').value = settings.saas_tax_pph23_rate || '2';
            }
        } catch (error) {
            alert('Failed to load tax settings.');
        }
    }

    async function handleUpdateTaxSettings(e) {
        e.preventDefault();
        const updatedSettings = {
            saas_tax_ppn_rate: document.getElementById('saas-tax-ppn-rate').value,
            saas_tax_pph23_rate: document.getElementById('saas-tax-pph23-rate').value,
        };

        try {
            const result = await fetchData(SAAS_API.saasSettings, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings)
            });
            if (result) {
                alert('Tax settings updated successfully!');
            }
        } catch (error) {
            alert(`Error updating settings: ${error.message}`);
        }
    }

    function setupLogoPreview() {
        const logoUploadInput = document.getElementById('saas-company-logo-upload');
        const logoPreview = document.getElementById('saas-company-logo-preview');
        if (logoUploadInput && logoPreview) {
            logoUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        logoPreview.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // --- WhatsApp Chat Companies List ---
    let allWhatsappCompanies = []; // To store all companies for filtering

    async function loadWhatsappCompaniesList() {
        if (!dom.whatsappCompaniesList) return;

        dom.whatsappCompaniesList.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-light);">Loading companies...</p>';
        try {
            const endpoint = `${SAAS_API.companies}?limit=9999`; // Fetch all companies
            const response = await fetchData(endpoint);
            allWhatsappCompanies = Array.isArray(response) ? response : response?.data || [];
            renderWhatsappCompanyItems(allWhatsappCompanies);
        } catch (error) {
            console.error('Error loading WhatsApp companies:', error);
            dom.whatsappCompaniesList.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--danger-color, #e74c3c);">Failed to load companies.</p>';
        }
    }

    function renderWhatsappCompanyItems(companies) {
        if (!dom.whatsappCompaniesList) return;

        dom.whatsappCompaniesList.innerHTML = ''; // Clear previous list

        if (companies.length === 0) {
            dom.whatsappCompaniesList.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-light);">No companies found.</p>';
            return;
        }

        companies.forEach(company => {
            const companyItem = document.createElement('div');
            companyItem.classList.add('whatsapp-company-item');
            companyItem.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 15px;
                border-bottom: 1px solid var(--border-color);
            `;

            const companyInfo = document.createElement('div');
            companyInfo.innerHTML = `
                <div style="font-weight: 600;">${company.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-light);">${company.whatsapp || 'No WhatsApp provided'}</div>
            `;
            companyItem.appendChild(companyInfo);

            if (company.whatsapp) {
                const whatsappLink = document.createElement('a');
                whatsappLink.href = `https://wa.me/${company.whatsapp.replace(/\D/g, '')}`; // Remove non-digits for link
                whatsappLink.target = '_blank';
                whatsappLink.classList.add('btn-primary');
                whatsappLink.style.cssText = `
                    padding: 8px 12px;
                    font-size: 0.85rem;
                    border-radius: 5px;
                    text-decoration: none;
                `;
                whatsappLink.textContent = 'Chat';
                companyItem.appendChild(whatsappLink);
            } else {
                const noWhatsappText = document.createElement('span');
                noWhatsappText.style.cssText = `
                    font-size: 0.85rem;
                    color: var(--text-light);
                `;
                noWhatsappText.textContent = 'N/A';
                companyItem.appendChild(noWhatsappText);
            }

            dom.whatsappCompaniesList.appendChild(companyItem);
        });
    }

    function filterWhatsappCompanies() {
        const searchTerm = dom.whatsappCompanySearchInput.value.toLowerCase();
        const filteredCompanies = allWhatsappCompanies.filter(company =>
            company.name.toLowerCase().includes(searchTerm) ||
            (company.whatsapp && company.whatsapp.includes(searchTerm))
        );
        renderWhatsappCompanyItems(filteredCompanies);
    }

    function init() {
        // Setup menu navigation
        dom.menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                switchPage(target);
            });
        });

        // Setup settings card navigation
        dom.settingsCards.forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                // This is not a main menu item, so we handle it slightly differently.
                // We want to show the target content, but keep the 'Settings' menu active.
                dom.pageContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === target) {
                        content.classList.add('active');
                    }
                });
                // Update page title
                if (dom.pageTitle) {
                    // Find the h3 inside the card for the title
                    const cardTitle = card.querySelector('h3');
                    if (cardTitle) {
                        dom.pageTitle.textContent = cardTitle.textContent.trim();
                    }
                }
                if (target === 'users') {
                    loadSaaSUsers();
                } else if (target === 'saas-profile') {
                    loadSaaSProfile();
                } else if (target === 'invoice-layout') {
                    loadInvoiceLayoutSettings();
                } else if (target === 'tax-settings') {
                    loadTaxSettings();
                }
            });
        });

        // Event listener for recently joined companies list
        dom.recentCompaniesList.addEventListener('click', (e) => {
            const link = e.target.closest('.recent-company-link');
            if (link) {
                e.preventDefault();
                const companyName = link.dataset.companyName;

                // Set the search input value before switching pages
                dom.searchCompanyInput.value = companyName;

                // Switch to the companies page, which will trigger loadCompanies()
                switchPage('companies');
            }
        });

        // Event listeners for WhatsApp floating button and modal
        if (dom.floatingChatButton) {
            dom.floatingChatButton.addEventListener('click', () => {
                dom.whatsappCompaniesModal.style.display = 'flex';
                loadWhatsappCompaniesList(); // Load companies when modal opens
            });
        }
        if (dom.closeWhatsappModalBtn) {
            dom.closeWhatsappModalBtn.addEventListener('click', () => {
                dom.whatsappCompaniesModal.style.display = 'none';
                dom.whatsappCompanySearchInput.value = ''; // Clear search on close
            });
        }
        if (dom.whatsappCompanySearchInput) {
            dom.whatsappCompanySearchInput.addEventListener('input', () => {
                clearTimeout(dom.whatsappCompanySearchInput.debounce);
                dom.whatsappCompanySearchInput.debounce = setTimeout(() => {
                    filterWhatsappCompanies();
                }, 300);
            });
        }

        // Setup other event listeners
        dom.logoutBtn.addEventListener('click', logout);
        if (dom.saasProfileForm) {
            dom.saasProfileForm.addEventListener('submit', handleUpdateSaaSProfile);
        }
        if (dom.invoiceLayoutForm) {
            dom.invoiceLayoutForm.addEventListener('submit', handleUpdateInvoiceLayout);
        }
        if (dom.taxSettingsForm) {
            dom.taxSettingsForm.addEventListener('submit', handleUpdateTaxSettings);
        }
        setupLogoPreview();

        // Initialize the company module and its event listeners
        initCompanyModule({
            fetchData: fetchData,
            SAAS_API: SAAS_API,
            dom: {
                companiesTableBody: dom.companiesTableBody,
                addCompanyBtn: dom.addCompanyBtn,
                searchCompanyInput: dom.searchCompanyInput,
                addCompanyModal: dom.addCompanyModal,
                closeAddModalBtn: dom.closeAddModalBtn,
                addCompanyForm: dom.addCompanyForm,
                editCompanyModal: dom.editCompanyModal,
                closeEditModalBtn: dom.closeEditModalBtn,
                editCompanyForm: dom.editCompanyForm
            }
        });

        // Initialize the billing module
        initBillingModule({
            fetchData: fetchData,
            SAAS_API: SAAS_API,
            dom: {
                billingTableBody: dom.billingTableBody,
                searchInvoiceInput: dom.searchInvoiceInput
            }
        });

        // Initialize the SaaS users module
        initSaaSUsersModule({
            fetchData: fetchData,
            SAAS_API: SAAS_API,
            dom: {
                saasUsersTableBody: dom.saasUsersTableBody,
                addSaaSUserBtn: dom.addSaaSUserBtn,
                searchUserInput: dom.searchSaaSUserInput,
                saasUserModal: dom.saasUserModal,
                closeSaaSUserModalBtn: dom.closeSaaSUserModalBtn,
                saasUserForm: dom.saasUserForm
            }
        });

        // Initialize corporate module
        initCorporateModule();

        // --- Mobile sidebar toggle ---
        const sidebarToggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const contentOverlay = document.querySelector('.content-overlay');

        function closeSidebar() {
            sidebar.classList.remove('open');
            contentOverlay.classList.remove('active');
        }

        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                contentOverlay.classList.toggle('active');
            });
        }

        if (contentOverlay) {
            contentOverlay.addEventListener('click', closeSidebar);
        }

        // Close sidebar when a menu item is clicked on mobile
        dom.menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 900) closeSidebar();
            });
        });

        // Initial page load
        switchPage('dashboard');
    }
    init();
});
