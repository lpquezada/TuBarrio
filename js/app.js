/*
 * DoorLoop clone – main application logic
 * This script manages loading data from localStorage, rendering the UI, and
 * handling CRUD operations for properties, units, tenants, leases, payments,
 * maintenance requests, accounting, CRM, communication, reports, files,
 * owner portal, and user management. It uses only vanilla JavaScript and
 * Bootstrap’s modal component for dialogs.
 */

(() => {
  // Utility functions for localStorage
  const storageKeys = {
    users: 'users',
    currentUserId: 'currentUserId',
    appData: 'appData'
  };

  function getUsers() {
    return JSON.parse(localStorage.getItem(storageKeys.users) || '[]');
  }
  function saveUsers(users) {
    localStorage.setItem(storageKeys.users, JSON.stringify(users));
  }
  function getCurrentUserId() {
    return parseInt(localStorage.getItem(storageKeys.currentUserId), 10);
  }
  function getAppData() {
    const defaultData = {
      properties: [],
      units: [],
      tenants: [],
      leases: [],
      payments: [],
      maintenanceRequests: [],
      expenses: [],
      leads: [],
      messages: [],
      files: []
    };
    try {
      const stored = localStorage.getItem(storageKeys.appData);
      if (stored) {
        return Object.assign(defaultData, JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to parse app data', err);
    }
    return defaultData;
  }
  function saveAppData(data) {
    localStorage.setItem(storageKeys.appData, JSON.stringify(data));
  }

  // Format a date string as YYYY-MM-DD for input fields
  function formatDate(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // Format currency
  function formatCurrency(num) {
    return '$' + Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Global variables for charts to update later
  let occupancyChartInstance;
  let revenueChartInstance;

  // Main initialization
  document.addEventListener('DOMContentLoaded', () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      // Not logged in; redirect to login page
      window.location.href = 'index.html';
      return;
    }
    const users = getUsers();
    const currentUser = users.find(u => u.id === currentUserId);
    if (!currentUser) {
      // Invalid session; redirect
      window.location.href = 'index.html';
      return;
    }
    // Load or initialize app data
    let appData = getAppData();

    // Show greeting
    const userWelcome = document.getElementById('userWelcome');
    if (userWelcome) {
      userWelcome.textContent = `Hello, ${currentUser.name}`;
    }
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem(storageKeys.currentUserId);
        window.location.href = 'index.html';
      });
    }

    // Role-based navigation adjustments
    function updateNavForRole() {
      const navLinks = document.querySelectorAll('#navLinks a');
      navLinks.forEach(link => {
        const requiredRole = link.getAttribute('data-role');
        // Hide link if user role doesn't match and not admin
        if (requiredRole && currentUser.role !== requiredRole && currentUser.role !== 'admin') {
          link.parentElement.style.display = 'none';
        }
        // Additional restrictions for specific roles
        if (currentUser.role === 'tenant') {
          // Tenants: Only dashboard, leases, payments, maintenance, communication, files
          const allowed = ['sectionDashboard','sectionLeases','sectionPayments','sectionMaintenance','sectionCommunication','sectionFiles'];
          if (!allowed.includes(link.getAttribute('data-section'))) {
            link.parentElement.style.display = 'none';
          }
        }
        if (currentUser.role === 'vendor') {
          // Vendors: Only dashboard and maintenance
          const allowed = ['sectionDashboard','sectionMaintenance'];
          if (!allowed.includes(link.getAttribute('data-section'))) {
            link.parentElement.style.display = 'none';
          }
        }
        if (currentUser.role === 'owner') {
          // Owners: Hide user management and CRM; but show owner portal automatically; hide adding other
          const disallowedSections = ['sectionUsers','sectionCRM'];
          if (disallowedSections.includes(link.getAttribute('data-section'))) {
            link.parentElement.style.display = 'none';
          }
        }
      });
    }
    updateNavForRole();

    // Section navigation
    const sections = document.querySelectorAll('.app-section');
    const navLinks = document.querySelectorAll('#navLinks a');
    function showSection(sectionId) {
      sections.forEach(sec => {
        if (sec.id === sectionId) {
          sec.classList.remove('d-none');
        } else {
          sec.classList.add('d-none');
        }
      });
      navLinks.forEach(link => {
        if (link.getAttribute('data-section') === sectionId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
    navLinks.forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const sectionId = link.getAttribute('data-section');
        if (!sectionId) return;
        showSection(sectionId);
        // On section change, update dynamic lists (if needed)
        if (sectionId === 'sectionProperties') renderProperties();
        if (sectionId === 'sectionUnits') renderUnits();
        if (sectionId === 'sectionTenants') renderTenants();
        if (sectionId === 'sectionLeases') renderLeases();
        if (sectionId === 'sectionPayments') renderPayments();
        if (sectionId === 'sectionMaintenance') renderMaintenance();
        if (sectionId === 'sectionAccounting') renderAccounting();
        if (sectionId === 'sectionCRM') renderCRM();
        if (sectionId === 'sectionCommunication') renderMessages();
        if (sectionId === 'sectionReports') {
          // clear previous report contents
          document.getElementById('reportContainer').innerHTML = '';
        }
        if (sectionId === 'sectionFiles') renderFiles();
        if (sectionId === 'sectionOwner') renderOwnerPortal();
        if (sectionId === 'sectionUsers') renderUsers();
      });
    });
    // Show default section on load
    showSection('sectionDashboard');

    // Chart initialization on dashboard
    function updateDashboardMetrics() {
      // Count properties, units, tenants
      document.getElementById('countProperties').textContent = appData.properties.length;
      document.getElementById('countUnits').textContent = appData.units.length;
      document.getElementById('countTenants').textContent = appData.tenants.length;
      // Sum revenue (paid payments)
      const totalRevenue = appData.payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + Number(p.amount), 0);
      document.getElementById('sumRevenue').textContent = formatCurrency(totalRevenue);
      // Occupancy chart data
      const totalUnits = appData.units.length;
      const occupiedUnits = appData.units.filter(unit => unit.occupied).length;
      const vacantUnits = totalUnits - occupiedUnits;
      const occupancyCtx = document.getElementById('occupancyChart').getContext('2d');
      const occupancyData = {
        labels: ['Occupied','Vacant'],
        datasets: [{
          label: 'Units',
          data: [occupiedUnits, vacantUnits],
          backgroundColor: ['#0d6efd','#6c757d']
        }]
      };
      if (occupancyChartInstance) occupancyChartInstance.destroy();
      occupancyChartInstance = new Chart(occupancyCtx, { type:'doughnut', data: occupancyData, options:{ responsive:true, plugins:{ legend:{position:'bottom'} } } });
      // Revenue chart: monthly revenue of current year
      const now = new Date();
      const currentYear = now.getFullYear();
      const monthlyRevenue = Array(12).fill(0);
      appData.payments.forEach(p => {
        if (p.status === 'Paid') {
          const dt = new Date(p.paidDate || p.date);
          if (dt.getFullYear() === currentYear) {
            monthlyRevenue[dt.getMonth()] += Number(p.amount);
          }
        }
      });
      const revenueCtx = document.getElementById('revenueChart').getContext('2d');
      const revenueData = {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        datasets: [{
          label: 'Revenue',
          data: monthlyRevenue,
          borderColor: '#198754',
          backgroundColor: 'rgba(25, 135, 84, 0.2)',
          fill: true
        }]
      };
      if (revenueChartInstance) revenueChartInstance.destroy();
      revenueChartInstance = new Chart(revenueCtx, { type:'line', data: revenueData, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
    }
    updateDashboardMetrics();

    /**
     * Render Properties Table
     */
    function renderProperties() {
      const tbody = document.getElementById('propertiesTableBody');
      tbody.innerHTML = '';
      appData.properties.forEach(property => {
        const tr = document.createElement('tr');
        const owner = users.find(u => u.id === property.ownerId);
        const manager = users.find(u => u.id === property.managerId);
        const unitsCount = appData.units.filter(u => u.propertyId === property.id).length;
        tr.innerHTML = `
          <td>${property.name}</td>
          <td>${property.address}</td>
          <td>${unitsCount}</td>
          <td>${owner ? owner.name : ''}</td>
          <td>${manager ? manager.name : ''}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${property.id}">Edit</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    // Populate owner and manager selects in property modal
    function populateOwnerManagerSelects() {
      const ownerSelect = document.getElementById('propertyOwner');
      const managerSelect = document.getElementById('propertyManager');
      ownerSelect.innerHTML = '';
      managerSelect.innerHTML = '';
      users.filter(u => u.role === 'owner').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.name;
        ownerSelect.appendChild(opt);
      });
      users.filter(u => u.role === 'manager').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.name;
        managerSelect.appendChild(opt);
      });
    }
    // Add property button event
    document.getElementById('addPropertyBtn').addEventListener('click', () => {
      document.getElementById('propertyModalLabel').textContent = 'Add Property';
      document.getElementById('propertyId').value = '';
      document.getElementById('propertyName').value = '';
      document.getElementById('propertyAddress').value = '';
      populateOwnerManagerSelects();
      const propertyModal = new bootstrap.Modal(document.getElementById('propertyModal'));
      propertyModal.show();
    });
    // Handle edit property click
    document.getElementById('propertiesTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'edit') {
        const id = parseInt(e.target.dataset.id, 10);
        const property = appData.properties.find(p => p.id === id);
        if (property) {
          document.getElementById('propertyModalLabel').textContent = 'Edit Property';
          document.getElementById('propertyId').value = property.id;
          document.getElementById('propertyName').value = property.name;
          document.getElementById('propertyAddress').value = property.address;
          populateOwnerManagerSelects();
          document.getElementById('propertyOwner').value = property.ownerId || '';
          document.getElementById('propertyManager').value = property.managerId || '';
          const propertyModal = new bootstrap.Modal(document.getElementById('propertyModal'));
          propertyModal.show();
        }
      }
    });
    // Save property form submit
    document.getElementById('propertyForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('propertyId');
      const name = document.getElementById('propertyName').value.trim();
      const address = document.getElementById('propertyAddress').value.trim();
      const ownerId = parseInt(document.getElementById('propertyOwner').value, 10) || null;
      const managerId = parseInt(document.getElementById('propertyManager').value, 10) || null;
      if (!name || !address) return;
      if (idField.value) {
        // update existing property
        const prop = appData.properties.find(p => p.id === parseInt(idField.value, 10));
        if (prop) {
          prop.name = name;
          prop.address = address;
          prop.ownerId = ownerId;
          prop.managerId = managerId;
        }
      } else {
        // add new property
        appData.properties.push({ id: Date.now(), name, address, ownerId, managerId });
      }
      saveAppData(appData);
      renderProperties();
      updateDashboardMetrics();
      bootstrap.Modal.getInstance(document.getElementById('propertyModal')).hide();
    });

    /**
     * Units
     */
    function populateUnitPropertySelect(selectId) {
      const select = document.getElementById(selectId);
      select.innerHTML = '';
      appData.properties.forEach(prop => {
        const opt = document.createElement('option');
        opt.value = prop.id;
        opt.textContent = prop.name;
        select.appendChild(opt);
      });
    }
    function renderUnits() {
      const tbody = document.getElementById('unitsTableBody');
      tbody.innerHTML = '';
      appData.units.forEach(unit => {
        const property = appData.properties.find(p => p.id === unit.propertyId);
        const tenant = appData.tenants.find(t => t.id === unit.tenantId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${property ? property.name : ''}</td>
          <td>${unit.number}</td>
          <td>${formatCurrency(unit.rent)}</td>
          <td>${unit.occupied ? 'Occupied' : 'Vacant'}</td>
          <td>${tenant ? tenant.name : ''}</td>
          <td><button class="btn btn-sm btn-secondary" data-action="edit" data-id="${unit.id}">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addUnitBtn').addEventListener('click', () => {
      document.getElementById('unitModalLabel').textContent = 'Add Unit';
      document.getElementById('unitId').value = '';
      document.getElementById('unitNumber').value = '';
      document.getElementById('unitRent').value = '';
      populateUnitPropertySelect('unitProperty');
      const unitModal = new bootstrap.Modal(document.getElementById('unitModal'));
      unitModal.show();
    });
    document.getElementById('unitsTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'edit') {
        const id = parseInt(e.target.dataset.id, 10);
        const unit = appData.units.find(u => u.id === id);
        if (unit) {
          document.getElementById('unitModalLabel').textContent = 'Edit Unit';
          document.getElementById('unitId').value = unit.id;
          document.getElementById('unitNumber').value = unit.number;
          document.getElementById('unitRent').value = unit.rent;
          populateUnitPropertySelect('unitProperty');
          document.getElementById('unitProperty').value = unit.propertyId;
          const unitModal = new bootstrap.Modal(document.getElementById('unitModal'));
          unitModal.show();
        }
      }
    });
    document.getElementById('unitForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('unitId');
      const propertyId = parseInt(document.getElementById('unitProperty').value, 10);
      const number = document.getElementById('unitNumber').value.trim();
      const rent = parseFloat(document.getElementById('unitRent').value);
      if (!number || isNaN(rent)) return;
      if (idField.value) {
        const unit = appData.units.find(u => u.id === parseInt(idField.value, 10));
        if (unit) {
          unit.propertyId = propertyId;
          unit.number = number;
          unit.rent = rent;
        }
      } else {
        appData.units.push({ id: Date.now(), propertyId, number, rent, occupied: false, tenantId: null });
      }
      saveAppData(appData);
      renderUnits();
      updateDashboardMetrics();
      bootstrap.Modal.getInstance(document.getElementById('unitModal')).hide();
    });

    /**
     * Tenants
     */
    function populateTenantSelects() {
      // Populate property and unit selects in tenant form
      const propertySel = document.getElementById('tenantProperty');
      const unitSel = document.getElementById('tenantUnit');
      propertySel.innerHTML = '';
      unitSel.innerHTML = '';
      appData.properties.forEach(prop => {
        const opt = document.createElement('option');
        opt.value = prop.id;
        opt.textContent = prop.name;
        propertySel.appendChild(opt);
      });
      // When property changes, update units select
      propertySel.addEventListener('change', () => {
        unitSel.innerHTML = '';
        const selectedProp = parseInt(propertySel.value, 10);
        appData.units.filter(u => u.propertyId === selectedProp).forEach(unit => {
          const opt = document.createElement('option');
          opt.value = unit.id;
          opt.textContent = unit.number;
          unitSel.appendChild(opt);
        });
      });
      // Trigger change to populate initial units
      if (appData.properties.length > 0) {
        propertySel.dispatchEvent(new Event('change'));
      }
    }
    function renderTenants() {
      const tbody = document.getElementById('tenantsTableBody');
      tbody.innerHTML = '';
      appData.tenants.forEach(tenant => {
        const property = appData.properties.find(p => p.id === tenant.propertyId);
        const unit = appData.units.find(u => u.id === tenant.unitId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tenant.name}</td>
          <td>${tenant.email}</td>
          <td>${tenant.phone}</td>
          <td>${property ? property.name : ''}</td>
          <td>${unit ? unit.number : ''}</td>
          <td><button class="btn btn-sm btn-secondary" data-action="edit" data-id="${tenant.id}">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    // Add tenant button
    document.getElementById('addTenantBtn').addEventListener('click', () => {
      document.getElementById('tenantModalLabel').textContent = 'Add Tenant';
      document.getElementById('tenantId').value = '';
      document.getElementById('tenantName').value = '';
      document.getElementById('tenantEmail').value = '';
      document.getElementById('tenantPhone').value = '';
      populateTenantSelects();
      const tenantModal = new bootstrap.Modal(document.getElementById('tenantModal'));
      tenantModal.show();
    });
    // Edit tenant
    document.getElementById('tenantsTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'edit') {
        const id = parseInt(e.target.dataset.id, 10);
        const tenant = appData.tenants.find(t => t.id === id);
        if (tenant) {
          document.getElementById('tenantModalLabel').textContent = 'Edit Tenant';
          document.getElementById('tenantId').value = tenant.id;
          document.getElementById('tenantName').value = tenant.name;
          document.getElementById('tenantEmail').value = tenant.email;
          document.getElementById('tenantPhone').value = tenant.phone;
          populateTenantSelects();
          document.getElementById('tenantProperty').value = tenant.propertyId;
          // trigger change to load units
          document.getElementById('tenantProperty').dispatchEvent(new Event('change'));
          document.getElementById('tenantUnit').value = tenant.unitId;
          const tenantModal = new bootstrap.Modal(document.getElementById('tenantModal'));
          tenantModal.show();
        }
      }
    });
    // Save tenant form
    document.getElementById('tenantForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('tenantId');
      const name = document.getElementById('tenantName').value.trim();
      const email = document.getElementById('tenantEmail').value.trim().toLowerCase();
      const phone = document.getElementById('tenantPhone').value.trim();
      const propertyId = parseInt(document.getElementById('tenantProperty').value, 10);
      const unitId = parseInt(document.getElementById('tenantUnit').value, 10);
      if (!name || !email || !phone) return;
      // For every tenant we also ensure a user exists
      let tenantUser = users.find(u => u.email === email);
      if (!tenantUser) {
        // create new user with tenant role
        tenantUser = { id: Date.now(), name, email, password: 'password', role: 'tenant' };
        users.push(tenantUser);
        saveUsers(users);
      }
      if (idField.value) {
        // update tenant record
        const tenant = appData.tenants.find(t => t.id === parseInt(idField.value, 10));
        if (tenant) {
          tenant.name = name;
          tenant.email = email;
          tenant.phone = phone;
          tenant.propertyId = propertyId;
          tenant.unitId = unitId;
        }
      } else {
        // new tenant record
        appData.tenants.push({ id: Date.now(), userId: tenantUser.id, name, email, phone, propertyId, unitId });
      }
      // update unit occupancy
      appData.units.forEach(u => {
        if (u.id === unitId) {
          u.occupied = true;
          u.tenantId = tenantUser.id;
        } else if (idField.value && u.tenantId === parseInt(idField.value, 10)) {
          // occupant changed: free old unit
          u.occupied = false;
          u.tenantId = null;
        }
      });
      saveAppData(appData);
      renderTenants();
      renderUnits();
      updateDashboardMetrics();
      bootstrap.Modal.getInstance(document.getElementById('tenantModal')).hide();
    });

    /**
     * Leases
     */
    function populateLeaseSelects() {
      const tenantSel = document.getElementById('leaseTenant');
      const propertySel = document.getElementById('leaseProperty');
      const unitSel = document.getElementById('leaseUnit');
      tenantSel.innerHTML = '';
      propertySel.innerHTML = '';
      unitSel.innerHTML = '';
      appData.tenants.forEach(tenant => {
        const opt = document.createElement('option');
        opt.value = tenant.id;
        opt.textContent = tenant.name;
        tenantSel.appendChild(opt);
      });
      appData.properties.forEach(prop => {
        const opt = document.createElement('option');
        opt.value = prop.id;
        opt.textContent = prop.name;
        propertySel.appendChild(opt);
      });
      propertySel.addEventListener('change', () => {
        unitSel.innerHTML = '';
        const selectedPropId = parseInt(propertySel.value, 10);
        appData.units.filter(u => u.propertyId === selectedPropId).forEach(unit => {
          const opt = document.createElement('option');
          opt.value = unit.id;
          opt.textContent = unit.number;
          unitSel.appendChild(opt);
        });
      });
      if (appData.properties.length > 0) {
        propertySel.dispatchEvent(new Event('change'));
      }
    }
    function renderLeases() {
      const tbody = document.getElementById('leasesTableBody');
      tbody.innerHTML = '';
      appData.leases.forEach(lease => {
        const tenant = appData.tenants.find(t => t.id === lease.tenantId);
        const property = appData.properties.find(p => p.id === lease.propertyId);
        const unit = appData.units.find(u => u.id === lease.unitId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tenant ? tenant.name : ''}</td>
          <td>${property ? property.name : ''}</td>
          <td>${unit ? unit.number : ''}</td>
          <td>${formatDate(lease.startDate)}</td>
          <td>${formatDate(lease.endDate)}</td>
          <td>${formatCurrency(lease.rent)}</td>
          <td><button class="btn btn-sm btn-secondary" data-action="edit" data-id="${lease.id}">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    // Add lease
    document.getElementById('addLeaseBtn').addEventListener('click', () => {
      document.getElementById('leaseModalLabel').textContent = 'Add Lease';
      document.getElementById('leaseId').value = '';
      document.getElementById('leaseRent').value = '';
      document.getElementById('leaseStart').value = '';
      document.getElementById('leaseEnd').value = '';
      populateLeaseSelects();
      const leaseModal = new bootstrap.Modal(document.getElementById('leaseModal'));
      leaseModal.show();
    });
    // Edit lease
    document.getElementById('leasesTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'edit') {
        const id = parseInt(e.target.dataset.id, 10);
        const lease = appData.leases.find(l => l.id === id);
        if (lease) {
          document.getElementById('leaseModalLabel').textContent = 'Edit Lease';
          document.getElementById('leaseId').value = lease.id;
          populateLeaseSelects();
          document.getElementById('leaseTenant').value = lease.tenantId;
          document.getElementById('leaseProperty').value = lease.propertyId;
          // trigger property change to load units
          document.getElementById('leaseProperty').dispatchEvent(new Event('change'));
          document.getElementById('leaseUnit').value = lease.unitId;
          document.getElementById('leaseStart').value = formatDate(lease.startDate);
          document.getElementById('leaseEnd').value = formatDate(lease.endDate);
          document.getElementById('leaseRent').value = lease.rent;
          const leaseModal = new bootstrap.Modal(document.getElementById('leaseModal'));
          leaseModal.show();
        }
      }
    });
    // Save lease form
    document.getElementById('leaseForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('leaseId');
      const tenantId = parseInt(document.getElementById('leaseTenant').value, 10);
      const propertyId = parseInt(document.getElementById('leaseProperty').value, 10);
      const unitId = parseInt(document.getElementById('leaseUnit').value, 10);
      const startDate = document.getElementById('leaseStart').value;
      const endDate = document.getElementById('leaseEnd').value;
      const rent = parseFloat(document.getElementById('leaseRent').value);
      if (!startDate || !endDate || isNaN(rent)) return;
      if (idField.value) {
        const lease = appData.leases.find(l => l.id === parseInt(idField.value, 10));
        if (lease) {
          lease.tenantId = tenantId;
          lease.propertyId = propertyId;
          lease.unitId = unitId;
          lease.startDate = startDate;
          lease.endDate = endDate;
          lease.rent = rent;
        }
      } else {
        // new lease
        const newLeaseId = Date.now();
        appData.leases.push({ id: newLeaseId, tenantId, propertyId, unitId, startDate, endDate, rent });
        // Mark unit occupied
        const unit = appData.units.find(u => u.id === unitId);
        if (unit) {
          unit.occupied = true;
          unit.tenantId = tenantId;
        }
        // Generate monthly payments for one year (or until end date)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dueDate = new Date(start);
        while (dueDate <= end) {
          appData.payments.push({ id: Date.now() + Math.random(), tenantId, propertyId, unitId, amount: rent, dueDate: formatDate(dueDate), status: 'Due', leaseId: newLeaseId });
          // add one month
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
      }
      saveAppData(appData);
      renderLeases();
      renderUnits();
      updateDashboardMetrics();
      bootstrap.Modal.getInstance(document.getElementById('leaseModal')).hide();
    });

    /**
     * Payments
     */
    function renderPayments() {
      const tbody = document.getElementById('paymentsTableBody');
      tbody.innerHTML = '';
      const info = document.getElementById('paymentsInfo');
      // Determine whether user is tenant or manager/owner
      let paymentsToDisplay = appData.payments;
      if (currentUser.role === 'tenant') {
        // only show payments for this tenant
        const tenantRecord = appData.tenants.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
        if (tenantRecord) {
          paymentsToDisplay = appData.payments.filter(p => p.tenantId === tenantRecord.id);
        }
      }
      info.textContent = '';
      if (paymentsToDisplay.length === 0) {
        info.textContent = 'No payments found.';
      }
      paymentsToDisplay.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
      paymentsToDisplay.forEach(payment => {
        const tenant = appData.tenants.find(t => t.id === payment.tenantId);
        const property = appData.properties.find(p => p.id === payment.propertyId);
        const unit = appData.units.find(u => u.id === payment.unitId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tenant ? tenant.name : ''}</td>
          <td>${property ? property.name : ''}</td>
          <td>${unit ? unit.number : ''}</td>
          <td>${payment.dueDate}</td>
          <td>${formatCurrency(payment.amount)}</td>
          <td>${payment.status}</td>
          <td>
            ${payment.status === 'Due' ? '<button class="btn btn-sm btn-success" data-action="pay" data-id="'+payment.id+'">Pay</button>' : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('paymentsTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'pay') {
        const paymentId = e.target.dataset.id;
        const payment = appData.payments.find(p => String(p.id) === paymentId);
        if (payment) {
          payment.status = 'Paid';
          payment.paidDate = formatDate(new Date());
          // Add to accounting incomes
          appData.expenses.push({ id: Date.now(), date: payment.paidDate, description: 'Rent Payment', amount: payment.amount, type: 'Income' });
          saveAppData(appData);
          renderPayments();
          renderAccounting();
          updateDashboardMetrics();
        }
      }
    });

    /**
     * Maintenance
     */
    function populateRequestSelects() {
      // For tenants: limited to their own property and unit
      const tenantSel = document.getElementById('requestTenant');
      const propertySel = document.getElementById('requestProperty');
      const unitSel = document.getElementById('requestUnit');
      tenantSel.innerHTML = '';
      propertySel.innerHTML = '';
      unitSel.innerHTML = '';
      if (currentUser.role === 'tenant') {
        const tenant = appData.tenants.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
        if (tenant) {
          const optTenant = document.createElement('option');
          optTenant.value = tenant.id;
          optTenant.textContent = tenant.name;
          tenantSel.appendChild(optTenant);
          const prop = appData.properties.find(p => p.id === tenant.propertyId);
          const propOpt = document.createElement('option');
          propOpt.value = prop.id;
          propOpt.textContent = prop.name;
          propertySel.appendChild(propOpt);
          const unitsForProp = appData.units.filter(u => u.propertyId === tenant.propertyId);
          unitsForProp.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.number;
            unitSel.appendChild(opt);
          });
          unitSel.value = tenant.unitId;
        }
      } else {
        // For managers/owners/admins: list all tenants, properties, units
        appData.tenants.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          tenantSel.appendChild(opt);
        });
        appData.properties.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          propertySel.appendChild(opt);
        });
        propertySel.addEventListener('change', () => {
          unitSel.innerHTML = '';
          const selectedPropId = parseInt(propertySel.value, 10);
          appData.units.filter(u => u.propertyId === selectedPropId).forEach(unit => {
            const opt = document.createElement('option');
            opt.value = unit.id;
            opt.textContent = unit.number;
            unitSel.appendChild(opt);
          });
        });
        if (appData.properties.length > 0) {
          propertySel.dispatchEvent(new Event('change'));
        }
      }
    }
    function renderMaintenance() {
      const tbody = document.getElementById('maintenanceTableBody');
      tbody.innerHTML = '';
      let requestsToShow = appData.maintenanceRequests;
      if (currentUser.role === 'tenant') {
        const tenantRecord = appData.tenants.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
        if (tenantRecord) {
          requestsToShow = requestsToShow.filter(r => r.tenantId === tenantRecord.id);
        }
      }
      if (currentUser.role === 'vendor') {
        // Show only assigned requests
        requestsToShow = requestsToShow.filter(r => r.vendorId === currentUser.id);
      }
      requestsToShow.forEach(req => {
        const tenant = appData.tenants.find(t => t.id === req.tenantId);
        const property = appData.properties.find(p => p.id === req.propertyId);
        const unit = appData.units.find(u => u.id === req.unitId);
        const vendor = users.find(u => u.id === req.vendorId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tenant ? tenant.name : ''}</td>
          <td>${property ? property.name : ''}</td>
          <td>${unit ? unit.number : ''}</td>
          <td>${req.description}</td>
          <td>${req.priority}</td>
          <td>${req.status}</td>
          <td>${vendor ? vendor.name : ''}</td>
          <td>
            ${(currentUser.role === 'manager' || currentUser.role === 'admin') ? '<button class="btn btn-sm btn-secondary" data-action="assign" data-id="'+req.id+'">Assign</button>' : ''}
            ${currentUser.role === 'vendor' && req.status !== 'Completed' ? '<button class="btn btn-sm btn-success" data-action="complete" data-id="'+req.id+'">Complete</button>' : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    // Add request button
    document.getElementById('addRequestBtn').addEventListener('click', () => {
      document.getElementById('requestModalLabel').textContent = 'Add Maintenance Request';
      document.getElementById('requestId').value = '';
      document.getElementById('requestDescription').value = '';
      document.getElementById('requestPriority').value = 'Low';
      populateRequestSelects();
      const reqModal = new bootstrap.Modal(document.getElementById('requestModal'));
      reqModal.show();
    });
    // Save request form
    document.getElementById('requestForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('requestId');
      const tenantId = parseInt(document.getElementById('requestTenant').value, 10);
      const propertyId = parseInt(document.getElementById('requestProperty').value, 10);
      const unitId = parseInt(document.getElementById('requestUnit').value, 10);
      const description = document.getElementById('requestDescription').value.trim();
      const priority = document.getElementById('requestPriority').value;
      if (!description) return;
      if (idField.value) {
        const req = appData.maintenanceRequests.find(r => r.id === parseInt(idField.value, 10));
        if (req) {
          req.tenantId = tenantId;
          req.propertyId = propertyId;
          req.unitId = unitId;
          req.description = description;
          req.priority = priority;
        }
      } else {
        appData.maintenanceRequests.push({ id: Date.now(), tenantId, propertyId, unitId, description, priority, status: 'New', vendorId: null });
      }
      saveAppData(appData);
      renderMaintenance();
      bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
    });
    // Assign vendor or complete request actions
    document.getElementById('maintenanceTableBody').addEventListener('click', e => {
      const reqId = parseInt(e.target.dataset.id, 10);
      const req = appData.maintenanceRequests.find(r => r.id === reqId);
      if (!req) return;
      if (e.target.dataset.action === 'assign' && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
        // Prompt to select vendor
        const vendorOptions = users.filter(u => u.role === 'vendor');
        const vendorId = prompt('Enter vendor ID to assign:\n' + vendorOptions.map(v => `${v.id}: ${v.name}`).join('\n'));
        const vendor = vendorOptions.find(v => String(v.id) === vendorId);
        if (vendor) {
          req.vendorId = vendor.id;
          req.status = 'Assigned';
          saveAppData(appData);
          renderMaintenance();
        }
      }
      if (e.target.dataset.action === 'complete' && currentUser.role === 'vendor') {
        req.status = 'Completed';
        saveAppData(appData);
        renderMaintenance();
      }
    });

    /**
     * Accounting
     */
    function renderAccounting() {
      const tbody = document.getElementById('accountingTableBody');
      tbody.innerHTML = '';
      // Combine payments income and manual expenses/incomes
      appData.expenses.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.date}</td>
          <td>${item.description}</td>
          <td>${formatCurrency(item.amount)}</td>
          <td>${item.type}</td>
          <td></td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addExpenseBtn').addEventListener('click', () => {
      document.getElementById('expenseModalLabel').textContent = 'Add Expense';
      document.getElementById('expenseId').value = '';
      document.getElementById('expenseDate').value = formatDate(new Date());
      document.getElementById('expenseDescription').value = '';
      document.getElementById('expenseAmount').value = '';
      document.getElementById('expenseType').value = 'Expense';
      const expenseModal = new bootstrap.Modal(document.getElementById('expenseModal'));
      expenseModal.show();
    });
    document.getElementById('expenseForm').addEventListener('submit', e => {
      e.preventDefault();
      const date = document.getElementById('expenseDate').value;
      const description = document.getElementById('expenseDescription').value.trim();
      const amount = parseFloat(document.getElementById('expenseAmount').value);
      const type = document.getElementById('expenseType').value;
      if (!date || !description || isNaN(amount)) return;
      appData.expenses.push({ id: Date.now(), date, description, amount, type });
      saveAppData(appData);
      renderAccounting();
      updateDashboardMetrics();
      bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
    });

    /**
     * CRM
     */
    function renderCRM() {
      const tbody = document.getElementById('crmTableBody');
      tbody.innerHTML = '';
      appData.leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${lead.name}</td>
          <td>${lead.email}</td>
          <td>${lead.phone}</td>
          <td>${lead.stage}</td>
          <td><button class="btn btn-sm btn-secondary" data-action="edit" data-id="${lead.id}">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addLeadBtn').addEventListener('click', () => {
      document.getElementById('leadModalLabel').textContent = 'Add Lead';
      document.getElementById('leadId').value = '';
      document.getElementById('leadName').value = '';
      document.getElementById('leadEmail').value = '';
      document.getElementById('leadPhone').value = '';
      document.getElementById('leadStage').value = 'New';
      const leadModal = new bootstrap.Modal(document.getElementById('leadModal'));
      leadModal.show();
    });
    document.getElementById('crmTableBody').addEventListener('click', e => {
      if (e.target.dataset.action === 'edit') {
        const id = parseInt(e.target.dataset.id, 10);
        const lead = appData.leads.find(l => l.id === id);
        if (lead) {
          document.getElementById('leadModalLabel').textContent = 'Edit Lead';
          document.getElementById('leadId').value = lead.id;
          document.getElementById('leadName').value = lead.name;
          document.getElementById('leadEmail').value = lead.email;
          document.getElementById('leadPhone').value = lead.phone;
          document.getElementById('leadStage').value = lead.stage;
          const leadModal = new bootstrap.Modal(document.getElementById('leadModal'));
          leadModal.show();
        }
      }
    });
    document.getElementById('leadForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('leadId');
      const name = document.getElementById('leadName').value.trim();
      const email = document.getElementById('leadEmail').value.trim();
      const phone = document.getElementById('leadPhone').value.trim();
      const stage = document.getElementById('leadStage').value;
      if (!name || !email || !phone) return;
      if (idField.value) {
          const lead = appData.leads.find(l => l.id === parseInt(idField.value, 10));
          if (lead) {
            lead.name = name;
            lead.email = email;
            lead.phone = phone;
            lead.stage = stage;
          }
      } else {
          appData.leads.push({ id: Date.now(), name, email, phone, stage });
      }
      saveAppData(appData);
      renderCRM();
      bootstrap.Modal.getInstance(document.getElementById('leadModal')).hide();
    });

    /**
     * Communication
     */
    function renderMessages() {
      const tbody = document.getElementById('messagesTableBody');
      tbody.innerHTML = '';
      // Filter messages based on recipients
      const visibleMessages = appData.messages.filter(msg => {
        if (msg.recipients.includes('all')) return true;
        return msg.recipients.includes(currentUser.role + 's') || msg.recipients.includes(currentUser.role);
      });
      visibleMessages.sort((a,b) => new Date(b.date) - new Date(a.date));
      visibleMessages.forEach(msg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${msg.subject}</td>
          <td>${msg.body}</td>
          <td>${msg.recipients.join(', ')}</td>
          <td>${msg.date}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addMessageBtn').addEventListener('click', () => {
      document.getElementById('messageModalLabel').textContent = 'Send Message';
      document.getElementById('messageSubject').value = '';
      document.getElementById('messageBody').value = '';
      document.getElementById('messageRecipients').value = '';
      const messageModal = new bootstrap.Modal(document.getElementById('messageModal'));
      messageModal.show();
    });
    document.getElementById('messageForm').addEventListener('submit', e => {
      e.preventDefault();
      const subject = document.getElementById('messageSubject').value.trim();
      const body = document.getElementById('messageBody').value.trim();
      const recipientsSelect = document.getElementById('messageRecipients');
      const selected = Array.from(recipientsSelect.selectedOptions).map(opt => opt.value);
      if (!subject || !body || selected.length === 0) return;
      appData.messages.push({ id: Date.now(), subject, body, recipients: selected, date: formatDate(new Date()) });
      saveAppData(appData);
      renderMessages();
      bootstrap.Modal.getInstance(document.getElementById('messageModal')).hide();
    });

    /**
     * Reports
     */
    document.getElementById('generateReportBtn').addEventListener('click', () => {
      const type = document.getElementById('reportType').value;
      const container = document.getElementById('reportContainer');
      container.innerHTML = '';
      if (type === 'occupancy') {
        // simple occupancy table per property
        const table = document.createElement('table');
        table.className = 'table table-striped';
        table.innerHTML = '<thead><tr><th>Property</th><th>Total Units</th><th>Occupied</th><th>Vacant</th><th>Occupancy Rate (%)</th></tr></thead>';
        const tbody = document.createElement('tbody');
        appData.properties.forEach(prop => {
          const units = appData.units.filter(u => u.propertyId === prop.id);
          const occupied = units.filter(u => u.occupied).length;
          const vacant = units.length - occupied;
          const rate = units.length ? Math.round((occupied / units.length) * 100) : 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${prop.name}</td><td>${units.length}</td><td>${occupied}</td><td>${vacant}</td><td>${rate}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
      }
      if (type === 'revenue') {
        // revenue by property
        const table = document.createElement('table');
        table.className = 'table table-striped';
        table.innerHTML = '<thead><tr><th>Property</th><th>Total Revenue</th></tr></thead>';
        const tbody = document.createElement('tbody');
        appData.properties.forEach(prop => {
          const revenue = appData.payments.filter(p => p.status === 'Paid' && p.propertyId === prop.id).reduce((sum,p) => sum + Number(p.amount),0);
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${prop.name}</td><td>${formatCurrency(revenue)}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
      }
      if (type === 'expenses') {
        // expense report
        const table = document.createElement('table');
        table.className = 'table table-striped';
        table.innerHTML = '<thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>';
        const tbody = document.createElement('tbody');
        appData.expenses.filter(e => e.type === 'Expense').forEach(exp => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${exp.date}</td><td>${exp.description}</td><td>${formatCurrency(exp.amount)}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
      }
      if (type === 'profit') {
        // profit & loss summary: total revenue minus total expense
        const totalRevenue = appData.expenses.filter(e => e.type === 'Income').reduce((sum,e) => sum + Number(e.amount), 0);
        const totalExpense = appData.expenses.filter(e => e.type === 'Expense').reduce((sum,e) => sum + Number(e.amount), 0);
        const table = document.createElement('table');
        table.className = 'table';
        table.innerHTML = '<thead><tr><th>Metric</th><th>Amount</th></tr></thead>';
        const tbody = document.createElement('tbody');
        tbody.innerHTML = `<tr><td>Total Revenue</td><td>${formatCurrency(totalRevenue)}</td></tr><tr><td>Total Expense</td><td>${formatCurrency(totalExpense)}</td></tr><tr><td>Net Profit/Loss</td><td>${formatCurrency(totalRevenue - totalExpense)}</td></tr>`;
        table.appendChild(tbody);
        container.appendChild(table);
      }
    });

    /**
     * Files
     */
    function renderFiles() {
      const tbody = document.getElementById('filesTableBody');
      tbody.innerHTML = '';
      appData.files.forEach(file => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${file.name}</td>
          <td>${file.description}</td>
          <td>${file.date}</td>
          <td>${file.tags.join(', ')}</td>
          <td></td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addFileBtn').addEventListener('click', () => {
      document.getElementById('fileModalLabel').textContent = 'Add File';
      document.getElementById('fileId').value = '';
      document.getElementById('fileName').value = '';
      document.getElementById('fileDescription').value = '';
      document.getElementById('fileTags').value = '';
      const fileModal = new bootstrap.Modal(document.getElementById('fileModal'));
      fileModal.show();
    });
    document.getElementById('fileForm').addEventListener('submit', e => {
      e.preventDefault();
      const idField = document.getElementById('fileId');
      const name = document.getElementById('fileName').value.trim();
      const description = document.getElementById('fileDescription').value.trim();
      const tagsStr = document.getElementById('fileTags').value.trim();
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
      if (!name) return;
      const date = formatDate(new Date());
      if (idField.value) {
        const file = appData.files.find(f => f.id === parseInt(idField.value, 10));
        if (file) {
          file.name = name;
          file.description = description;
          file.tags = tags;
        }
      } else {
        appData.files.push({ id: Date.now(), name, description, tags, date });
      }
      saveAppData(appData);
      renderFiles();
      bootstrap.Modal.getInstance(document.getElementById('fileModal')).hide();
    });

    /**
     * Owner Portal
     */
    function renderOwnerPortal() {
      const info = document.getElementById('ownerInfo');
      const container = document.getElementById('ownerProperties');
      info.textContent = 'Here you can view your properties and their performance.';
      container.innerHTML = '';
      if (currentUser.role !== 'owner') {
        container.textContent = 'You are not an owner.';
        return;
      }
      // Find properties owned by current user
      const owned = appData.properties.filter(p => p.ownerId === currentUser.id);
      if (owned.length === 0) {
        container.textContent = 'No properties owned.';
        return;
      }
      owned.forEach(prop => {
        const units = appData.units.filter(u => u.propertyId === prop.id);
        const occupied = units.filter(u => u.occupied).length;
        const revenue = appData.payments.filter(p => p.status === 'Paid' && p.propertyId === prop.id).reduce((sum,p) => sum + Number(p.amount), 0);
        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML = `
          <div class="card-body">
            <h5 class="card-title">${prop.name}</h5>
            <p class="card-text">Address: ${prop.address}</p>
            <p class="card-text">Units: ${units.length} | Occupied: ${occupied} | Vacant: ${units.length - occupied}</p>
            <p class="card-text">Revenue Collected: ${formatCurrency(revenue)}</p>
          </div>
        `;
        container.appendChild(card);
      });
    }

    /**
     * Users (Admin)
     */
    function renderUsers() {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = '';
      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${user.name}</td><td>${user.email}</td><td>${user.role}</td><td></td>`;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('addUserBtn').addEventListener('click', () => {
      document.getElementById('userModalLabel').textContent = 'Add User';
      document.getElementById('userId').value = '';
      document.getElementById('userName').value = '';
      document.getElementById('userEmail').value = '';
      document.getElementById('userPassword').value = '';
      document.getElementById('userRole').value = 'tenant';
      const userModal = new bootstrap.Modal(document.getElementById('userModal'));
      userModal.show();
    });
    document.getElementById('userForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('userName').value.trim();
      const email = document.getElementById('userEmail').value.trim().toLowerCase();
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;
      if (!name || !email || !password) return;
      if (users.some(u => u.email === email)) {
        alert('User with that email already exists');
        return;
      }
      const newUser = { id: Date.now(), name, email, password, role };
      users.push(newUser);
      saveUsers(users);
      renderUsers();
      bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    });

    // Initial render functions for each section on load where needed
    renderProperties();
    renderUnits();
    renderTenants();
    renderLeases();
    renderPayments();
    renderMaintenance();
    renderAccounting();
    renderCRM();
    renderMessages();
    renderFiles();
    if (currentUser.role === 'owner') renderOwnerPortal();
    if (currentUser.role === 'admin') renderUsers();
  });
})();