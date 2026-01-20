// client/app.js
/*
  Front‑end logic for Melann Lending Loan Monitoring UI.
  - Fetches loan data from the backend (expects JWT in localStorage under "token").
  - Renders a spreadsheet‑style grid with colour‑coded status badges.
  - Supports filtering, search, and totals row.
  - Allows inline editing of "Amount Collected" (updates via PUT).
  - Export buttons trigger CSV or PDF download.
  - Minimal error handling – displays console errors.
*/

const API_BASE = '/api';
const token = localStorage.getItem('token');
const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

// Redirect to login if no token
if (!token && !window.location.href.includes('login.html')) {
  window.location.href = 'login.html';
}

// Display user info
document.addEventListener('DOMContentLoaded', () => {
  if (userInfo.username) {
    const collectorNameEl = document.getElementById('collectorName');
    if (collectorNameEl) collectorNameEl.textContent = `User: ${userInfo.full_name || userInfo.username}`;

    // Refresh dropdowns immediately on load
    loadCollectorFilter();
    populateMainFilterYear();

    const roleEl = document.getElementById('userRole');
    if (roleEl) {
      roleEl.textContent = `Role: ${userInfo.role.toUpperCase()}`;
      roleEl.className = `badge ${userInfo.role === 'admin' ? 'overdue' : userInfo.role === 'supervisor' ? 'normal' : 'paid'}`;
    }
  }

  if (userInfo.role === 'admin' || userInfo.role === 'supervisor') {
    const actionsHeader = document.getElementById('actionsHeader');
    if (actionsHeader) actionsHeader.classList.remove('hidden');

    initLoanFormLogic();

    const viewColBtnWrapper = document.getElementById('viewCollectorsWrapper');
    if (viewColBtnWrapper) viewColBtnWrapper.classList.remove('hidden');

    // Fallback if wrapper doesn't exist
    const viewColBtn = document.getElementById('viewCollectors');
    if (viewColBtn && !viewColBtnWrapper) viewColBtn.classList.remove('hidden');
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      window.location.href = 'login.html';
    });
  }
});

// Utility: build query string from filter UI
function buildQuery() {
  const params = new URLSearchParams();
  const collector = document.getElementById('filterCollector').value;
  const status = document.getElementById('filterStatus').value;
  const location = document.getElementById('filterLocation').value;
  const area = document.getElementById('filterArea').value;
  const city = document.getElementById('filterCity').value;
  const barangay = document.getElementById('filterBarangay').value;

  // New Range Logic (From Year/Month -> To Year/Month)
  const startYear = document.getElementById('filterStartYear')?.value;
  const startMonth = document.getElementById('filterStartMonth')?.value || '01'; // Default: Jan start
  const endYear = document.getElementById('filterEndYear')?.value;
  const endMonth = document.getElementById('filterEndMonth')?.value || '12'; // Default: Dec end

  if (collector) params.append('collector_id', collector);
  if (status) params.append('moving_status', status);
  if (location) params.append('location_status', location);
  if (area) params.append('area', area);
  if (city) params.append('city', city);
  if (barangay) params.append('barangay', barangay);

  // Range Construction:
  // Convert "Year + Month" into YYYY-MM-DD
  // Start Date: YYYY-MM-01
  // End Date: YYYY-MM-LastDay
  if (startYear) {
    params.append('start_date', `${startYear}-${startMonth}-01`);
  }
  if (endYear) {
    // Get last day of month
    const lastDay = new Date(Number(endYear), Number(endMonth), 0).getDate();
    params.append('end_date', `${endYear}-${endMonth}-${lastDay}`);
  }

  const search = document.getElementById('searchInput').value;
  if (search) params.append('search', search);

  return params.toString();
}

function populateMainFilterYear() {
  const selStart = document.getElementById('filterStartYear');
  const selEnd = document.getElementById('filterEndYear');
  if (!selStart || !selEnd) return;
  if (selStart.options.length > 0) return; // already populated

  // Add default placeholder
  const addPlaceholder = (sel) => {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Year';
    sel.appendChild(opt);
  };
  addPlaceholder(selStart);
  addPlaceholder(selEnd);

  const current = new Date().getFullYear();
  const startYearRange = 2016; // As per user request "from Year 2016"

  // Range: 2016 to Current + 1
  // We populate in descending order usually
  for (let y = current + 1; y >= startYearRange; y--) {
    const optS = document.createElement('option');
    optS.value = y;
    optS.textContent = y;
    // Removed auto-select default (y === current)
    selStart.appendChild(optS);

    const optE = document.createElement('option');
    optE.value = y;
    optE.textContent = y;
    // Removed auto-select default (y === current)
    selEnd.appendChild(optE);
  }
}


function updateDashboard(loans) {
  const totalAccounts = loans.length;
  const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
  const totalCollected = loans.reduce((sum, l) => sum + Number(l.amount_collected), 0);
  const totalRunning = loans.reduce((sum, l) => sum + Number(l.running_balance), 0);
  const paidCount = loans.filter(l => l.moving_status === 'Paid').length;
  const nmCount = loans.filter(l => l.moving_status === 'NM' || l.moving_status === 'NMSR').length;

  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById('statTotalAccounts').textContent = totalAccounts;
  document.getElementById('statOutstanding').textContent = fmt(totalOutstanding);
  document.getElementById('statCollected').textContent = fmt(totalCollected);
  document.getElementById('statRunning').textContent = fmt(totalRunning);
  document.getElementById('statPaidCount').textContent = paidCount;
  document.getElementById('statNMCount').textContent = nmCount;
}

function renderGrid(loans) {
  const tbody = document.querySelector('#loanGrid tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const today = new Date();
  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  loans.forEach(loan => {
    // Debug: verify we are processing rows
    // console.log('Rendering loan:', loan.loan_code);
    const tr = document.createElement('tr');

    // Helper to create cell
    const td = (text, className) => {
      const cell = document.createElement('td');
      if (className) cell.className = className;
      cell.textContent = text;
      return cell;
    };

    tr.appendChild(td(loan.collector_name || '—'));
    tr.appendChild(td(loan.loan_code));

    // Make borrower name clickable
    const nameTd = document.createElement('td');
    nameTd.textContent = loan.borrower_name;
    nameTd.style.cursor = 'pointer';
    nameTd.style.color = '#38bdf8'; // light blue to indicate link
    nameTd.style.textDecoration = 'underline';
    nameTd.onclick = () => openClientProfile(loan);
    tr.appendChild(nameTd);

    tr.appendChild(td(loan.month_reported));
    tr.appendChild(td(new Date(loan.due_date).toLocaleDateString()));
    tr.appendChild(td(fmt(loan.outstanding_balance)));

    // Amount Collected – editable cell
    const collectedCell = document.createElement('td');
    collectedCell.classList.add('editable');
    collectedCell.dataset.loanId = loan.loan_id;
    collectedCell.dataset.field = 'amount_collected';
    collectedCell.textContent = fmt(loan.amount_collected);
    collectedCell.addEventListener('dblclick', startEdit);
    tr.appendChild(collectedCell);

    // Running Balance (computed)
    tr.appendChild(td(fmt(loan.running_balance)));

    // Status badge
    const statusTd = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.classList.add('badge');

    // Display actual status without "Overdue" override
    statusBadge.textContent = loan.moving_status;

    if (loan.moving_status === 'Paid') {
      statusBadge.classList.add('paid');
    } else if (loan.moving_status === 'NM' || loan.moving_status === 'NMSR') {
      statusBadge.classList.add('overdue'); // Use red for non-moving categories
    } else {
      statusBadge.classList.add('normal'); // Use blue for "Moving"
    }
    statusTd.appendChild(statusBadge);
    tr.appendChild(statusTd);

    // Location badge
    const locTd = document.createElement('td');
    const locBadge = document.createElement('span');
    locBadge.classList.add('badge');
    if (loan.location_status === 'L') {
      locBadge.classList.add('paid');
      locBadge.textContent = 'Located';
    } else {
      locBadge.classList.add('normal');
      locBadge.textContent = 'Not Located';
    }
    locTd.appendChild(locBadge);
    tr.appendChild(locTd);

    // Area, City, Barangay
    tr.appendChild(td(loan.area || '—'));
    tr.appendChild(td(loan.city || '—'));
    tr.appendChild(td(loan.barangay || '—'));


    // Actions Column
    const actionTd = document.createElement('td');

    // Only add buttons if authorized
    if (userInfo.role === 'admin' || userInfo.role === 'supervisor' || userInfo.role === 'collector') {
      const payBtn = document.createElement('button');
      payBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512" style="fill:currentColor"><path d="M512 80c8.8 0 16 7.2 16 16v32H48V96c0-8.8 7.2-16 16-16H512zm16 144V416c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V224H528zM64 32C28.6 32 0 60.6 0 96V416c0 35.4 28.6 64 64 64H512c35.4 0 64-28.6 64-64V96c0-35.4-28.6-64-64-64H64zM208 256h64c8.8 0 16-7.2 16-16s-7.2-16-16-16H208c-8.8 0-16 7.2-16 16s7.2 16 16 16zm-64 0h64c8.8 0 16-7.2 16-16s-7.2-16-16-16H144c-8.8 0-16 7.2-16 16s7.2 16 16 16zm64 64h64c8.8 0 16-7.2 16-16s-7.2-16-16-16H208c-8.8 0-16 7.2-16 16s7.2 16 16 16zm-64 0h64c8.8 0 16-7.2 16-16s-7.2-16-16-16H144c-8.8 0-16 7.2-16 16s7.2 16 16 16zM432 248a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/></svg>'; // MONEY BILL WAVE (Hand holding dollar alternative)
      payBtn.className = 'history-btn';
      payBtn.title = 'Add Payment';
      payBtn.style.marginRight = '5px';
      payBtn.style.color = 'var(--color-success)';
      payBtn.onclick = () => openPaymentModal(loan);
      actionTd.appendChild(payBtn);

      const pmtsBtn = document.createElement('button');
      pmtsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 384 512" style="fill:currentColor"><path d="M14 2.2C22.5-1.7 32.5-.3 39.6 5.8L80 40.4 120.4 5.8c9-7.7 22.3-7.7 31.2 0L192 40.4 232.4 5.8c9-7.7 22.3-7.7 31.2 0L304 40.4 344.4 5.8c7.1-6.1 17.1-7.5 25.6-3.6s14 12.4 14 21.8V488c0 9.4-5.5 17.9-14 21.8s-18.5 2.5-25.6-3.6L304 471.6l-40.4 34.6c-9 7.7-22.3 7.7-31.2 0L192 471.6 151.6 506.2c-9 7.7-22.3 7.7-31.2 0L80 471.6 39.6 506.2c-7.1 6.1-17.1 7.5-25.6 3.6S0 497.4 0 488V24C0 14.6 5.5 6.1 14 2.2zM96 144c-8.8 0-16 7.2-16 16s7.2 16 16 16H288c8.8 0 16-7.2 16-16s-7.2-16-16-16H96zM80 352c0 8.8 7.2 16 16 16H288c8.8 0 16-7.2 16-16s-7.2-16-16-16H96c-8.8 0-16 7.2-16 16zM96 240c-8.8 0-16 7.2-16 16s7.2 16 16 16H288c8.8 0 16-7.2 16-16s-7.2-16-16-16H96z"/></svg>'; // RECEIPT
      pmtsBtn.className = 'history-btn';
      pmtsBtn.title = 'Payment History';
      pmtsBtn.style.marginRight = '5px';
      pmtsBtn.onclick = () => showPaymentHistory(loan);
      actionTd.appendChild(pmtsBtn);

      if (userInfo.role === 'admin' || userInfo.role === 'supervisor') {
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" style="fill:currentColor"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>'; // PEN TO SQUARE
        editBtn.className = 'history-btn';
        editBtn.title = 'Edit Loan';
        editBtn.style.marginRight = '5px';
        editBtn.onclick = () => openLoanModal(loan);
        actionTd.appendChild(editBtn);

        const histBtn = document.createElement('button');
        histBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" style="fill:currentColor"><path d="M75 75L41 41C25.9 25.9 0 36.6 0 57.9V168c0 13.3 10.7 24 24 24H134.1c21.4 0 32.1-25.9 17-41l-30.8-30.8C155 85.5 203 64 256 64c106 0 192 86 192 192s-86 192-192 192c-40.8 0-78.6-12.7-109.7-34.4c-14.5-10.1-34.3-6.6-44.6 7.9s-6.6 34.3 7.9 44.6C151.2 495 201.7 512 256 512c141.4 0 256-114.6 256-256S397.4 0 256 0C185.3 0 121.3 28.7 75 75zm181 53c-13.3 0-24 10.7-24 24V256c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65V152c0-13.3-10.7-24-24-24z"/></svg>'; // CLOCK ROTATE LEFT
        histBtn.className = 'history-btn';
        histBtn.title = 'View History';
        histBtn.style.marginRight = '5px';
        histBtn.onclick = () => showHistory(loan.loan_id);
        actionTd.appendChild(histBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512" style="fill:currentColor"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>'; // TRASH
        deleteBtn.className = 'history-btn';
        deleteBtn.title = 'Delete Loan';
        deleteBtn.style.color = 'var(--color-danger)';
        deleteBtn.onclick = () => deleteLoanRecord(loan.loan_id);
        actionTd.appendChild(deleteBtn);
      }
    }

    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
}

const historyModal = document.getElementById('historyModal');
const closeModal = document.getElementById('closeModal');

if (closeModal) {
  closeModal.onclick = () => historyModal.classList.add('hidden');
  window.onclick = (e) => { if (e.target === historyModal) historyModal.classList.add('hidden'); };
}

async function showHistory(loanId) {
  historyModal.classList.remove('hidden');
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading history...</td></tr>';

  try {
    const resp = await fetch(`${API_BASE}/loans/${loanId}/history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const history = await resp.json();
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No changes recorded yet.</td></tr>';
      return;
    }

    history.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td>${h.field_name}</td>
                <td class="muted">${h.old_value || '—'}</td>
                <td>${h.new_value}</td>
                <td>${h.changed_by_name}</td>
                <td style="font-size:0.8rem">${new Date(h.changed_at).toLocaleString()}</td>
            `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--color-danger)">Failed to load history.</td></tr>';
  }
}

function computeTotals(loans) {
  const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
  const totalCollected = loans.reduce((sum, l) => sum + Number(l.amount_collected), 0);
  const totalRunning = loans.reduce((sum, l) => sum + Number(l.running_balance), 0);

  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const outstandingEl = document.getElementById('totalOutstanding');
  const collectedEl = document.getElementById('totalCollected');
  const runningEl = document.getElementById('totalRunning');

  if (outstandingEl) outstandingEl.textContent = fmt(totalOutstanding);
  if (collectedEl) collectedEl.textContent = fmt(totalCollected);
  if (runningEl) runningEl.textContent = fmt(totalRunning);
}

// Inline edit for Amount Collected
function startEdit(event) {
  const cell = event.currentTarget;
  const original = cell.textContent.replace(/[^0-9.-]+/g, '');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 0;
  input.step = '0.01';
  input.value = original;
  input.style.width = '100%';
  input.addEventListener('blur', () => finishEdit(cell, input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { cell.textContent = cell.dataset.original; }
  });
  cell.dataset.original = cell.textContent;
  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
}

async function finishEdit(cell, newValue) {
  const loanId = cell.dataset.loanId;
  const payload = { amount_collected: Number(newValue) };
  try {
    const resp = await fetch(`${API_BASE}/loans/${loanId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error('Update failed');
    await loadLoans();
  } catch (e) {
    console.error(e);
    cell.textContent = cell.dataset.original;
  }
}

// Export handlers
function exportCSV() {
  const query = buildQuery();
  const url = `${API_BASE}/export/csv${query ? '?' + query : ''}`;
  window.open(url, '_blank');
}
function exportPDF() {
  const query = buildQuery();
  const url = `${API_BASE}/export/pdf${query ? '?' + query : ''}`;
  window.open(url, '_blank');
}

// Attach event listeners
const pdfBtn = document.getElementById('exportPdf');
const xlsBtn = document.getElementById('exportXls');
if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);
if (xlsBtn) xlsBtn.addEventListener('click', exportCSV);

// Tab switching logic
const viewDashboardBtn = document.getElementById('viewDashboard');
const viewGridBtn = document.getElementById('viewGrid');
const viewReportsBtn = document.getElementById('viewReports');
const viewPaymentInputBtn = document.getElementById('viewPaymentInput');
const viewMonthlyBtn = document.getElementById('viewMonthly');
const viewCollectorsBtn = document.getElementById('viewCollectors');

const dashboardSection = document.getElementById('dashboardSection');
const gridSection = document.getElementById('gridSection');
const reportsSection = document.getElementById('reportsSection');
const paymentInputSection = document.getElementById('paymentInputSection');
const monthlyReportSection = document.getElementById('monthlyReportSection');
const collectorsSection = document.getElementById('collectorsSection');
const gridFilters = document.querySelector('.grid-filters');

if (viewGridBtn && viewReportsBtn) {
  const switchTab = (activeBtn, showSection, storageKey) => {
    // 1. Reset all visual active states on list items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // 2. Hide all sections
    const pendingUsersSection = document.getElementById('pendingUsersSection');
    const collectionSheetSection = document.getElementById('collectionSheetSection');
    [dashboardSection, gridSection, reportsSection, paymentInputSection, monthlyReportSection, collectorsSection, pendingUsersSection, collectionSheetSection].forEach(s => s?.classList.add('hidden'));

    // 3. Set active class on parent LI of the clicked button
    if (activeBtn.parentElement && activeBtn.parentElement.classList.contains('nav-item')) {
      activeBtn.parentElement.classList.add('active');
    }

    // 4. Show the target section
    showSection.classList.remove('hidden');

    if (gridFilters) {
      if (activeBtn === viewGridBtn) gridFilters.classList.remove('hidden');
      else gridFilters.classList.add('hidden');
    }

    // 5. Persist State
    if (storageKey) {
      localStorage.setItem('activeTab', storageKey);
    }
  };

  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', () => {
      switchTab(viewDashboardBtn, dashboardSection, 'dashboard');
      loadDashboardData();
    });
  }

  viewGridBtn.addEventListener('click', () => {
    switchTab(viewGridBtn, gridSection, 'loans');
    loadLoans();
    loadCollectorFilter();
  });


  viewReportsBtn.addEventListener('click', () => {
    switchTab(viewReportsBtn, reportsSection, 'performance');
    loadReports();
  });



  if (viewPaymentInputBtn) {
    viewPaymentInputBtn.addEventListener('click', () => {
      switchTab(viewPaymentInputBtn, paymentInputSection, 'receivePayment');
      // Reset form
      document.getElementById('paymentInputCode').value = '';
      document.getElementById('paymentSearchResult').classList.add('hidden');
      document.getElementById('paymentSearchError').classList.add('hidden');
      document.getElementById('payInputDate').valueAsDate = new Date();
    });
  }

  if (viewMonthlyBtn) {
    viewMonthlyBtn.addEventListener('click', () => {
      switchTab(viewMonthlyBtn, monthlyReportSection, 'monthlyReport');
      populateMonthlyYear();
      loadMonthlyReport();
    });
  }

  if (userInfo.role === 'admin') {
    const viewPendingWrapper = document.getElementById('viewPendingUsersWrapper');
    if (viewPendingWrapper) viewPendingWrapper.classList.remove('hidden');
  }

  // ... (previous collectors wrapper check)

  if (viewCollectorsBtn) {
    viewCollectorsBtn.addEventListener('click', () => {
      switchTab(viewCollectorsBtn, collectorsSection, 'manageCollectors');
      loadCollectorsList();
    });
  }

  const viewPendingUsersBtn = document.getElementById('viewPendingUsers');
  const pendingUsersSection = document.getElementById('pendingUsersSection');

  if (viewPendingUsersBtn && pendingUsersSection) {
    viewPendingUsersBtn.addEventListener('click', () => {
      switchTab(viewPendingUsersBtn, pendingUsersSection, 'pendingApprovals');
      loadPendingUsers();
    });
    document.getElementById('refreshPendingBtn')?.addEventListener('click', loadPendingUsers);
  }

  const viewCollectionSheetBtn = document.getElementById('viewCollectionSheet');
  if (viewCollectionSheetBtn) {
    viewCollectionSheetBtn.addEventListener('click', () => {
      switchTab(viewCollectionSheetBtn, document.getElementById('collectionSheetSection'), 'collectionSheet');
      loadCollectionSheetButtons();
    });
  }

  // Restore State Logic
  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    const tabMap = {
      'dashboard': viewDashboardBtn,
      'loans': viewGridBtn,
      'performance': viewReportsBtn,
      'receivePayment': viewPaymentInputBtn,
      'monthlyReport': viewMonthlyBtn,
      'manageCollectors': viewCollectorsBtn,
      'pendingApprovals': viewPendingUsersBtn,
      'collectionSheet': viewCollectionSheetBtn
    };

    const btnToClick = tabMap[savedTab];
    if (btnToClick) {
      // Use setTimeout to ensure all listeners/DOM are ready if needed, generally safe here though.
      btnToClick.click();
    } else {
      if (viewDashboardBtn) viewDashboardBtn.click();
    }
  } else {
    // Default
    if (viewDashboardBtn) viewDashboardBtn.click();
  }

}

async function loadPendingUsers() {
  const tbody = document.querySelector('#pendingUsersTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading...</td></tr>';

  try {
    const resp = await fetch(`${API_BASE}/auth/pending-users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Failed to load pending users');
    const users = await resp.json();

    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No pending approvals.</td></tr>';
      return;
    }

    const fmtDate = (d) => new Date(d).toLocaleString();

    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td>${u.username}</td>
                <td>${u.full_name}</td>
                <td><span class="badge ${u.role === 'admin' ? 'overdue' : 'normal'}">${u.role.toUpperCase()}</span></td>
                <td>${fmtDate(u.created_at)}</td>
                <td>
                    <button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--color-success)" onclick="approveUser('${u.user_id}', 'active')">Approve</button>
                    <button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:var(--color-danger); margin-left:0.5rem;" onclick="approveUser('${u.user_id}', 'rejected')">Reject</button>
                </td>
            `;
      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--color-danger)">Error loading data.</td></tr>';
  }
}

window.approveUser = async function (userId, status) {
  if (!confirm(`Are you sure you want to ${status && status === 'active' ? 'approve' : 'reject'} this user?`)) return;

  try {
    const resp = await fetch(`${API_BASE}/auth/users/${userId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!resp.ok) throw new Error('Action failed');
    alert(`User ${status}`);
    loadPendingUsers();
  } catch (e) {
    alert(e.message);
  }
};

// Monthly Report Logic
let monthlyType = 'reported'; // 'reported' or 'collection'

document.getElementById('btnReported')?.addEventListener('click', (e) => {
  monthlyType = 'reported';
  document.getElementById('btnReported').classList.add('active');
  document.getElementById('btnReported').style.backgroundColor = ''; // Reset inline
  document.getElementById('btnCollection').classList.remove('active');
  document.getElementById('btnCollection').style.backgroundColor = '#047857';
  loadMonthlyReport();
});

document.getElementById('btnCollection')?.addEventListener('click', (e) => {
  monthlyType = 'collection';
  document.getElementById('btnCollection').classList.add('active');
  document.getElementById('btnCollection').style.backgroundColor = 'var(--color-primary)';
  document.getElementById('btnReported').classList.remove('active');
  document.getElementById('btnReported').style.backgroundColor = '#047857';
  loadMonthlyReport();
});

function populateMonthlyYear() {
  const sel = document.getElementById('monthlyYear');
  if (!sel || sel.options.length > 0) return;
  const current = new Date().getFullYear();
  for (let y = current; y >= 2020; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }
}

document.getElementById('refreshMonthly')?.addEventListener('click', loadMonthlyReport);
document.getElementById('exportMonthlyXls')?.addEventListener('click', () => {
  const html = document.getElementById('monthlyTable').outerHTML;
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Monthly_Report_${monthlyType}_${document.getElementById('monthlyYear').value}.xls`;
  a.click();
});
document.getElementById('printMonthly')?.addEventListener('click', () => {
  const content = document.getElementById('monthlyReportSection').innerHTML;
  const original = document.body.innerHTML;
  document.body.innerHTML = content;
  window.print();
  document.body.innerHTML = original;
  window.location.reload();
});

async function loadMonthlyReport() {
  const year = document.getElementById('monthlyYear').value;
  try {
    const resp = await fetch(`${API_BASE}/reports/monthly?year=${year}&type=${monthlyType}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Failed to load report');
    const data = await resp.json();
    renderMonthlyTable(data);
  } catch (err) {
    console.error(err);
  }
}

function renderMonthlyTable(data) {
  const table = document.getElementById('monthlyTable');

  // Define configurations for both report types
  const config = {
    reported: {
      title: 'REPORTED PAST DUE',
      headers: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      keyPrefix: '',
      dataKey: 'months', // matches backend pivoter
      accessKey: (i) => (i + 1).toString().padStart(2, '0') // 01, 02...
    },
    collection: {
      title: 'PAST DUE COLLECTION',
      headers: [
        'Jan 1 – Feb 15',
        'Feb 16 – Mar 31',
        'Apr 1 – May 15',
        'May 16 – Jun 30',
        'Jul 1 – Aug 15',
        'Aug 16 – Sep 30',
        'Oct 1 – Nov 15',
        'Nov 16 – Dec 31'
      ],
      dataKey: 'periods',
      accessKey: (i) => `Period ${i + 1}` // Period 1, Period 2...
    }
  };

  const currentConfig = config[monthlyType] || config.reported;
  const colCount = currentConfig.headers.length;

  // Headers
  let thead = `
    <tr>
      <th style="text-align:left; background:#064e3b; color:#fff">COLLECTOR NAME</th>
      <th colspan="${colCount}" style="text-align:center; background:#022c22; color:#fff">${currentConfig.title} (${document.getElementById('monthlyYear').value})</th>
      <th style="background:#064e3b; color:#fff">TOTAL</th>
    </tr>
    <tr>
      <th style="background:#047857"></th>`;

  currentConfig.headers.forEach(h => thead += `<th style="text-align:right; background:#047857; font-size: 0.8rem; padding: 5px;">${h}</th>`);
  thead += `<th style="text-align:right; background:#047857"></th></tr>`;

  table.querySelector('thead').innerHTML = thead;
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  const fmt = (n) => n ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  let grandTotal = 0;
  let colTotals = Array(colCount).fill(0);

  data.forEach(row => {
    const tr = document.createElement('tr');
    let tds = `<td style="font-weight:bold; white-space:nowrap;">${row.collector}</td>`;

    currentConfig.headers.forEach((_, idx) => {
      // Access the data dynamically based on the report type
      const key = currentConfig.accessKey(idx);
      const container = row[currentConfig.dataKey] || {};
      const val = container[key] || 0;

      colTotals[idx] += val;
      tds += `<td style="text-align:right">${val > 0 ? fmt(val) : '-'}</td>`;
    });

    tds += `<td style="text-align:right; font-weight:bold">${fmt(row.total)}</td>`;
    tr.innerHTML = tds;
    tbody.appendChild(tr);

    grandTotal += row.total;
  });

  // Footer for Grand Totals
  const trF = document.createElement('tr');
  trF.style.background = '#064e3b';
  trF.style.fontWeight = 'bold';
  trF.style.color = '#fff';
  let fTds = `<td>GRAND TOTAL</td>`;
  colTotals.forEach(t => fTds += `<td style="text-align:right">${fmt(t)}</td>`);
  fTds += `<td style="text-align:right">${fmt(grandTotal)}</td>`;
  trF.innerHTML = fTds;
  tbody.appendChild(trF);
}




async function loadReports() {
  const headers = { Authorization: `Bearer ${token}` };

  // Helper to handle response
  const handleResp = async (resp, name) => {
    if (resp.status === 401 || resp.status === 403) {
      window.location.href = 'login.html';
      return null;
    }
    if (!resp.ok) throw new Error(`${name} API Error: ${resp.status}`);
    return await resp.json();
  };

  try {
    // Fetch Aging Report
    const agingResp = await fetch(`${API_BASE}/reports/aging`, { headers });
    const agingData = await handleResp(agingResp, 'Aging');
    if (agingData) renderAging(agingData);

    // Fetch Performance Report
    const perfResp = await fetch(`${API_BASE}/reports/performance`, { headers });
    const perfData = await handleResp(perfResp, 'Performance');

    if (perfData) {
      console.log('Performance Data:', perfData);
      if (perfData.length === 0) console.warn('No performance records found.');
      renderPerformance(perfData);
    }
  } catch (e) {
    console.error('Error loading reports:', e);
    alert(`Failed to load reports: ${e.message}`);
  }
}

function renderAging(data) {
  const table = document.getElementById('agingTable');
  if (!table) return;

  // 1. Update Header - Remove Collector column
  const thead = table.querySelector('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align:left">Bucket</th>
      <th style="text-align:center">Accounts</th>
      <th style="text-align:right">Reported Amount</th>
      <th style="text-align:right">Collected Amount</th>
      <th style="text-align:right">Ending Balance</th>
    </tr>
  `;

  // 2. Update Body
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Define standard buckets in order
  const standardBuckets = [
    '1-30 Days',
    '31-45 Days',
    '46-60 Days',
    '61-90 Days',
    '91-120 Days',
    '120+ Days'
  ];

  // Group data manually by Collector
  const grouped = {};
  data.forEach(row => {
    if (!grouped[row.collector_name]) {
      grouped[row.collector_name] = {};
    }
    grouped[row.collector_name][row.bucket] = row;
  });

  // Iterate over each collector found in the data
  Object.keys(grouped).forEach(collectorName => {
    // 3a. Collector Header
    const groupTr = document.createElement('tr');
    groupTr.style.backgroundColor = '#e2e8f0';
    groupTr.style.fontWeight = 'bold';
    groupTr.innerHTML = `
      <td colspan="5" style="color:#0f172a; padding-left: 1rem;">
        <i class="fas fa-user-tie" style="margin-right:8px; color:var(--color-primary)"></i>
        ${collectorName}
      </td>
    `;
    tbody.appendChild(groupTr);

    // 3b. Render ALL buckets for this collector
    standardBuckets.forEach(bucket => {
      const rowData = grouped[collectorName][bucket] || {
        accounts: 0,
        reported_amount: 0,
        collected_amount: 0,
        ending_balance: 0
      };

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding-left: 2rem;">${bucket}</td>
        <td style="text-align:center">${rowData.accounts}</td>
        <td style="text-align:right">${fmt(rowData.reported_amount)}</td>
        <td style="text-align:right">${fmt(rowData.collected_amount)}</td>
        <td style="text-align:right">${fmt(rowData.ending_balance)}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// Payment Input Logic
const paymentFindBtn = document.getElementById('paymentFindBtn');
if (paymentFindBtn) {
  paymentFindBtn.addEventListener('click', async () => {
    const code = document.getElementById('paymentInputCode').value.trim();
    const resultDiv = document.getElementById('paymentSearchResult');
    const errorDiv = document.getElementById('paymentSearchError');

    if (!code) return;

    try {
      const resp = await fetch(`${API_BASE}/loans?code=${encodeURIComponent(code)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const loans = await resp.json();

      if (loans.length > 0) {
        const loan = loans[0];
        const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        document.getElementById('payClientName').textContent = loan.borrower_name;
        document.getElementById('payClientCode').textContent = loan.loan_code;
        document.getElementById('payClientCollector').textContent = loan.collector_name || '—';
        document.getElementById('payClientArea').textContent = loan.area || '—';
        document.getElementById('payClientBalance').textContent = fmt(loan.running_balance);
        document.getElementById('payClientLoanId').value = loan.loan_id;

        resultDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        document.getElementById('payInputAmount').focus();
      } else {
        resultDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
      }
    } catch (e) {
      console.error(e);
      errorDiv.textContent = 'Error finding client';
      errorDiv.classList.remove('hidden');
    }
  });
}

const paymentInputForm = document.getElementById('paymentInputForm');
if (paymentInputForm) {
  paymentInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const loanId = document.getElementById('payClientLoanId').value;
    const date = document.getElementById('payInputDate').value;
    const amount = document.getElementById('payInputAmount').value;

    try {
      // Reuse existing API endpoint
      const resp = await fetch(`${API_BASE}/loans/${loanId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, payment_date: date })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Payment failed');
      }

      alert('Payment recorded successfully!');
      document.getElementById('paymentSearchResult').classList.add('hidden');
      document.getElementById('paymentInputCode').value = '';
      document.getElementById('paymentInputCode').focus();

      // Refresh grid if needed in background
      loadLoans();
    } catch (e) {
      alert(e.message);
    }
  });
}

function renderPerformance(data) {
  // 1. Render Table
  const tbody = document.querySelector('#performanceTable tbody');
  tbody.innerHTML = '';
  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
            <td>${row.collector_name}</td>
            <td>${row.total_accounts}</td>
            <td>${fmt(row.total_outstanding)}</td>
            <td>${fmt(row.total_collected)}</td>
            <td>${fmt(row.total_running_balance)}</td>
            <td>${row.collection_rate}%</td>
            <td>${row.paid_accounts}</td>
        `;
    tbody.appendChild(tr);
  });

  // 2. Render Chart
  renderPerformanceChart(data);
}

let perfChart = null;

function renderPerformanceChart(data) {
  const ctx = document.getElementById('performanceChart');
  if (!ctx) return;

  // Destroy previous chart if exists
  if (perfChart) {
    perfChart.destroy();
  }

  // Prepare data
  const labels = data.map(d => d.collector_name);
  // User requested Pie graph based on Rate(%)
  const rates = data.map(d => Number(d.collection_rate) || 0);

  // Generate colors for the pie slices
  const backgroundColors = [
    '#34d399', // Emerald
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4'  // Cyan
  ];

  // Helper to cycle colors if there are more collectors than colors
  const getColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(backgroundColors[i % backgroundColors.length]);
    }
    return colors;
  };

  perfChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Collection Rate (%)',
          data: rates,
          backgroundColor: getColors(rates.length),
          borderColor: '#1e293b', // Match dark bg
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8' }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      }
    }
  });
}

// Filter change – debounce
let filterTimeout;
const filterEls = ['filterCollector', 'filterStartDate', 'filterEndDate', 'filterStatus', 'filterLocation', 'filterArea', 'filterCity', 'filterBarangay'];
filterEls.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(loadLoans, 300);
    });
  }
});

// Search Input - Live Search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(loadLoans, 300);
  });
}

document.getElementById('applyDateFilter')?.addEventListener('click', loadLoans);
document.getElementById('clearDateFilter')?.addEventListener('click', () => {
  // 1. Reset values
  const sY = document.getElementById('filterStartYear');
  const sM = document.getElementById('filterStartMonth');
  const eY = document.getElementById('filterEndYear');
  const eM = document.getElementById('filterEndMonth');
  if (sY) sY.value = '';
  if (sM) sM.value = '01';
  if (eY) eY.value = '';
  if (eM) eM.value = '12';

  // 2. Load loans (without date filters)
  loadLoans();
});

// Reload grid and totals
async function loadLoans() {
  const applyBtn = document.getElementById('applyDateFilter');
  if (applyBtn) {
    applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Filtering...';
  }

  const query = buildQuery();
  // DEBUG: verify params
  // alert('Sending Query: ' + query);

  try {
    const url = `${API_BASE}/loans?${query}&_t=${Date.now()}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (resp.status === 401 || resp.status === 403) {
      window.location.href = 'login.html';
      return;
    }

    if (!resp.ok) throw new Error('Failed to fetch loans');

    const loans = await resp.json();

    // Unified Search Behavior: Check for exact code match
    const searchVal = document.getElementById('searchInput').value.trim();
    if (searchVal && loans.length > 0) {
      const exactMatch = loans.find(l => l.loan_code === searchVal);
      if (exactMatch) {
        // If exact match found, ensure it is visible and maybe open profile
        // Requirement: "exact code match (e.g., 3484) immediately displays the corresponding client record"
        // We will open the profile if it is the ONLY result, OR if we prioritize it.
        // Let's go with: if exact match exists, open it.
        // However, if the user is typing "3", "34", "348", existing entries might match partially.
        // We only want to trigger this if it's a specific intent.
        // But the requirement says "entering a value... immediately displays".
        // It's safer to do this if it is the ONLY match, OR if the user explicitly hit Enter (which triggers reload).
        // Since loadLoans is debounced on input, it runs while typing.
        // If I type "1", and "1" is a code, it opens? That might be annoying if I meant "10".
        // BUT, `l.loan_code === searchVal` matches exact string.
        // If I have codes "1", "10", "11"... typing "1" -> exact match found.
        // Let's stick to: If unique result AND exact match.
        // Actually, the request says "without requiring additional actions".

        if (loans.length === 1 && exactMatch) {
          openClientProfile(exactMatch);
        }
      }
    }

    renderGrid(loans);
    updateDashboard(loans);
    computeTotals(loans);

    // Dynamically update dropdown options for Area, City, Barangay based on current results
    updateDynamicFilters(loans);
  } catch (err) {
    console.error('Failed to load loans', err);
  } finally {
    const applyBtn = document.getElementById('applyDateFilter');
    if (applyBtn) {
      applyBtn.innerHTML = '<i class="fas fa-filter"></i> Apply';
    }
  }
}

async function loadCollectorFilter() {
  const filter = document.getElementById('filterCollector');
  const formSelect = document.getElementById('collector_id');

  const currentFilterVal = filter ? filter.value : '';
  const currentFormVal = formSelect ? formSelect.value : '';

  try {
    const resp = await fetch(`${API_BASE}/auth/collectors`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collectors = await resp.json();

    // Update main dashboard filter
    if (filter) {
      filter.innerHTML = '<option value="">All Collector</option>';
      collectors.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.collector_id;
        opt.textContent = c.name;
        filter.appendChild(opt);
      });
      filter.value = currentFilterVal || '';
    }

    // Update Add New Client form dropdown
    if (formSelect) {
      formSelect.innerHTML = '<option value="">Select Collector</option>';
      collectors.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.collector_id;
        opt.textContent = c.name;
        formSelect.appendChild(opt);
      });
      formSelect.value = currentFormVal;
    }
  } catch (err) {
    console.error('Failed to reload collector lists:', err);
  }
}

/** Populates ALL dropdowns based on unique values in the current grid or predefined lists */
function updateDynamicFilters(loans) {
  // Dynamic fields
  const fields = ['month', 'status', 'location', 'area', 'city', 'barangay'];

  fields.forEach(field => {
    // Map internal field names to filter IDs
    let selectId = `filter${field.charAt(0).toUpperCase() + field.slice(1)}`;
    if (field === 'status') selectId = 'filterStatus';
    if (field === 'location') selectId = 'filterLocation';
    // Month filter removed
    if (field === 'month') return;

    const select = document.getElementById(selectId);
    if (!select) return;

    const currentVal = select.value;

    // Get unique data from the loans list
    let uniqueValues = [];
    if (field === 'status') {
      const inData = loans.map(l => l.moving_status);
      uniqueValues = [...new Set([...inData, 'Paid', 'Moving', 'NM', 'NMSR'])].filter(v => v).sort();
    } else if (field === 'location') {
      const inData = loans.map(l => l.location_status);
      uniqueValues = [...new Set([...inData, 'L', 'NL'])].filter(v => v).sort();
    } else if (field === 'month') {
      const inData = loans.map(l => l.month_reported);
      uniqueValues = [...new Set(inData)].filter(v => v).sort();
    } else {
      uniqueValues = [...new Set(loans.map(l => l[field]).filter(v => v))].sort();
    }

    const label = field.charAt(0).toUpperCase() + field.slice(1);
    select.innerHTML = `<option value="">All ${label}</option>`;

    uniqueValues.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      // Prettier labels for status/location
      if (field === 'status') {
        const labels = { 'Paid': 'Paid', 'Moving': 'M', 'NM': 'NM', 'NMSR': 'NMSR' };
        opt.textContent = labels[val] || val;
      } else if (field === 'location') {
        opt.textContent = val === 'L' ? 'Located' : 'Not Located';
      } else {
        opt.textContent = val;
      }
      select.appendChild(opt);
    });

    select.value = currentVal || '';
  });
}

async function loadCollectorsList() {
  const tbody = document.querySelector('#collectorsTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Loading collectors...</td></tr>';
  try {
    const resp = await fetch(`${API_BASE}/auth/collectors`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collectors = await resp.json();
    tbody.innerHTML = '';
    collectors.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.name}</td>
        <td>
          <button class="history-btn edit-col-btn" data-id="${c.collector_id}">Edit</button>
          <button class="history-btn delete-col-btn" data-id="${c.collector_id}" style="background:var(--color-danger)">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach listeners
    document.querySelectorAll('.edit-col-btn').forEach(btn => {
      btn.onclick = () => openCollectorModal(collectors.find(c => c.collector_id === btn.dataset.id));
    });
    document.querySelectorAll('.delete-col-btn').forEach(btn => {
      btn.onclick = () => deleteCollector(btn.dataset.id);
    });
  } catch (err) {
    console.error(err);
  }
}

function openCollectorModal(collector = null) {
  const modal = document.getElementById('collectorModal');
  const title = document.getElementById('collectorModalTitle');
  const form = document.getElementById('collectorForm');

  modal.classList.remove('hidden');
  form.reset();

  if (collector) {
    title.textContent = 'Edit Collector';
    document.getElementById('edit_collector_id').value = collector.collector_id;
    document.getElementById('col_name').value = collector.name;
  } else {
    title.textContent = 'Add New Collector';
    document.getElementById('edit_collector_id').value = '';
  }
}

async function deleteCollector(id) {
  if (!confirm('Are you sure you want to delete this collector? This might fail if they have assigned loans.')) return;
  try {
    const resp = await fetch(`${API_BASE}/auth/collectors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || 'Failed to delete');
    }
    loadCollectorsList();
    loadCollectorFilter();
  } catch (err) {
    alert(err.message);
  }
}

function openLoanModal(loan = null) {
  const modal = document.getElementById('loanModal');
  const title = document.getElementById('loanModalTitle');
  const form = document.getElementById('loanForm');

  modal.classList.remove('hidden');
  form.reset();

  if (loan) {
    title.textContent = 'Edit Loan Record';
    document.getElementById('edit_loan_id').value = loan.loan_id;
    document.getElementById('loan_code').value = loan.loan_code;
    document.getElementById('borrower_name').value = loan.borrower_name;
    document.getElementById('collector_id').value = loan.collector_id;
    document.getElementById('month_reported').value = loan.month_reported;
    document.getElementById('due_date').value = new Date(loan.due_date).toISOString().split('T')[0];
    document.getElementById('outstanding_balance').value = loan.outstanding_balance;
    document.getElementById('moving_status').value = loan.moving_status;
    document.getElementById('location_status').value = loan.location_status;
    document.getElementById('area').value = loan.area || '';
    document.getElementById('city').value = loan.city || '';
    document.getElementById('barangay').value = loan.barangay || '';
    document.getElementById('full_address').value = loan.full_address || '';
  } else {
    title.textContent = 'Input New Past Due Client';
    document.getElementById('edit_loan_id').value = '';
  }
}

function openPaymentModal(loan) {
  const modal = document.getElementById('paymentModal');
  const form = document.getElementById('paymentForm');
  const nameLabel = document.getElementById('paymentBorrowerName');

  modal.classList.remove('hidden');
  form.reset();

  document.getElementById('payment_loan_id').value = loan.loan_id;
  nameLabel.textContent = `Borrower: ${loan.borrower_name}`;

  // Set default date to today
  document.getElementById('payment_date').value = new Date().toISOString().split('T')[0];

  const balance = Number(loan.outstanding_balance) - Number(loan.amount_collected);
  document.getElementById('payment_amount').max = balance;
  document.getElementById('payment_amount').placeholder = `Max: ₱${balance.toLocaleString()}`;
}

async function showPaymentHistory(loan) {
  const modal = document.getElementById('paymentHistoryModal');
  const tbody = document.querySelector('#paymentHistoryTable tbody');
  const nameLabel = document.getElementById('historyBorrowerName');
  const totalLabel = document.getElementById('historyTotalCollected');
  const balanceLabel = document.getElementById('historyRunningBalance');

  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  modal.classList.remove('hidden');
  nameLabel.textContent = `Client: ${loan.borrower_name}`;
  totalLabel.textContent = fmt(loan.amount_collected || 0);
  balanceLabel.textContent = fmt(Number(loan.outstanding_balance) - Number(loan.amount_collected));

  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Loading payments...</td></tr>';

  try {
    const resp = await fetch(`${API_BASE}/loans/${loan.loan_id}/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payments = await resp.json();
    tbody.innerHTML = '';

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">No payments recorded.</td></tr>';
      return;
    }

    payments.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(p.payment_date).toLocaleString()}</td>
        <td style="font-weight:600">${fmt(p.amount)}</td>
        <td>${p.recorded_by_name}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="3" style="color:var(--color-danger)">Error loading payments.</td></tr>';
  }
}

// Collector Modal UI Logic
document.getElementById('addCollectorBtn').onclick = () => openCollectorModal();
document.getElementById('closeCollectorModal').onclick = () => document.getElementById('collectorModal').classList.add('hidden');
document.getElementById('collectorForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());
  const id = payload.collector_id;

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE}/auth/collectors/${id}` : `${API_BASE}/auth/collectors`;

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error || 'Failed to save collector');
    }
    document.getElementById('collectorModal').classList.add('hidden');
    loadCollectorsList();
    loadCollectorFilter();
  } catch (err) {
    alert(err.message);
  }
};

async function initLoanFormLogic() {
  const addBtn = document.getElementById('addLoanBtn');
  const modal = document.getElementById('loanModal');
  const closeBtn = document.getElementById('closeLoanModal');
  const form = document.getElementById('loanForm');

  if (!addBtn) return;

  // 1. Fetch collectors to populate dropdown
  loadCollectorFilter();

  // 2. Open/Close Modal
  addBtn.onclick = () => openLoanModal();
  closeBtn.onclick = () => modal.classList.add('hidden');

  // 3. Handle Form Submission
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Explicitly handle the hidden loan_id
    const loanId = payload.loan_id && payload.loan_id.trim() !== '' ? payload.loan_id : null;
    delete payload.loan_id; // remove from body

    const method = loanId ? 'PUT' : 'POST';
    const url = loanId ? `${API_BASE}/loans/${loanId}` : `${API_BASE}/loans`;

    console.log(`Submitting ${method} to ${url}`, payload);

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errData = await resp.json();
        let msg = errData.error || 'Failed to save loan';
        if (errData.errors && Array.isArray(errData.errors)) {
          msg = errData.errors.map(e => `${e.param || e.path}: ${e.msg}`).join('\n');
        }
        throw new Error(msg);
      }

      alert(loanId ? 'Client record updated successfully!' : 'Client record saved successfully!');
      modal.classList.add('hidden');
      form.reset();
      loadLoans(); // Refresh grid
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
}

// Initial load
loadLoans();

// Payment Form Handler
const paymentForm = document.getElementById('paymentForm');
if (paymentForm) {
  paymentForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(paymentForm);
    const data = Object.fromEntries(formData.entries());
    const loanId = data.loan_id;

    try {
      const resp = await fetch(`${API_BASE}/loans/${loanId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(data.amount),
          payment_date: data.payment_date // Send the selected date
        })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to record payment');
      }

      alert('Payment recorded successfully!');
      document.getElementById('paymentModal').classList.add('hidden');
      loadLoans();
    } catch (err) {
      alert(err.message);
    }
  };
}

// Modal closing helpers
document.getElementById('closePaymentModal').onclick = () => document.getElementById('paymentModal').classList.add('hidden');
document.getElementById('closePaymentHistoryModal').onclick = () => document.getElementById('paymentHistoryModal').classList.add('hidden');

// Print History Handler
document.getElementById('printPaymentHistoryBtn').onclick = () => {
  const printContent = document.getElementById('printablePaymentHistory').innerHTML;
  const originalContent = document.body.innerHTML;

  // Create a temporary print view
  document.body.innerHTML = `
    <div style="padding: 40px; color: black; background: white; font-family: sans-serif;">
      <h1 style="text-align:center">MELANN LENDING</h1>
      <p style="text-align:center">Payment History Report</p>
      <hr style="margin: 20px 0;"/>
      ${printContent}
      <div style="margin-top: 40px; text-align: right;">
        <p>Printed on: ${new Date().toLocaleString()}</p>
        <p>Verified by: ${userInfo.full_name}</p>
      </div>
    </div>
  `;

  window.print();
  document.body.innerHTML = originalContent;
  window.location.reload(); // Reload to restore event listeners
};

// --- Collection Sheet Logic ---

const viewCollectionSheetBtn = document.getElementById('viewCollectionSheet');
const collectionSheetSection = document.getElementById('collectionSheetSection');

// Handlers for Collection Sheet Preview Actions
const backToSheetSelectBtn = document.getElementById('backToSheetSelect');
const printSheetBtn = document.getElementById('printSheetBtn');

if (backToSheetSelectBtn) {
  backToSheetSelectBtn.onclick = () => {
    document.getElementById('collectionSheetSelectWrapper').classList.remove('hidden');
    document.getElementById('collectionSheetPreviewWrapper').classList.add('hidden');
  };
}

if (printSheetBtn) {
  printSheetBtn.onclick = () => {
    const content = document.getElementById('collectionSheetPreview').innerHTML;
    const original = document.body.innerHTML;
    document.body.innerHTML = content;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };
}

async function loadCollectionSheetButtons() {
  const container = document.getElementById('collectionSheetButtons');
  container.innerHTML = 'Loading...';
  try {
    const resp = await fetch(`${API_BASE}/auth/collectors`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collectors = await resp.json();
    container.innerHTML = '';

    collectors.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'collection-btn';

      const icon = document.createElement('i');
      if (c.name.toUpperCase().includes('PAST DUE')) {
        icon.className = 'fas fa-map-marker-alt';
      } else {
        icon.className = 'fas fa-user-tie';
      }

      const label = document.createElement('span');
      label.textContent = c.name;

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.onclick = () => generateCollectionSheet(c);
      container.appendChild(btn);
    });

  } catch (err) {
    container.textContent = 'Error loading collectors.';
  }
}

async function generateCollectionSheet(collector) {
  try {
    const resp = await fetch(`${API_BASE}/loans?collector_id=${collector.collector_id}&overdue=false`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    let loans = await resp.json();

    // Filter only active loans (balance > 0)
    loans = loans.filter(l => Number(l.running_balance) > 0);

    // Grouping Structure: cityMap = { 'CityName': { 'BrgyName': [loans...] } }
    const cityMap = {};

    loans.forEach(loan => {
      const city = loan.city || 'Unassigned City';
      const brgy = loan.barangay || 'Unassigned Barangay';

      if (!cityMap[city]) cityMap[city] = {};
      if (!cityMap[city][brgy]) cityMap[city][brgy] = [];

      cityMap[city][brgy].push(loan);
    });

    // Build Print View
    const dateStr = new Date().toLocaleDateString();
    let html = `
       <div style="font-family: sans-serif; color: black; padding: 20px;">
         <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
           <div>
             <h2>MELANN LENDING - Collection Sheet</h2>
             <h3>Collector: ${collector.name}</h3>
             <p>Date: ${dateStr}</p>
           </div>
           <div style="border:1px solid #000; padding:10px; width:250px;">
             <div style="margin-bottom:10px; border-bottom:1px solid #ccc; padding-bottom:5px;"><strong>Summary</strong></div>
             <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
               <span>Total Collection:</span>
               <span style="border-bottom:1px solid #000; width:80px; display:inline-block;"></span>
             </div>
             <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
               <span>Total Expense:</span>
               <span style="border-bottom:1px solid #000; width:80px; display:inline-block;"></span>
             </div>
             <div style="display:flex; justify-content:space-between; font-weight:bold;">
               <span>Grand Total:</span>
               <span style="border-bottom:1px solid #000; width:80px; display:inline-block;"></span>
             </div>
           </div>
         </div>
     `;

    // Sort cities alphabetically
    const sortedCities = Object.keys(cityMap).sort();

    sortedCities.forEach(city => {
      // City Header
      html += `<h3 style="margin-top:20px; border-bottom:2px solid #000; padding-bottom:5px;">City: ${city}</h3>`;

      // Start Table per City
      html += `
          <table style="width:100%; border-collapse: collapse; border: 1px solid #000; font-size:12px;">
            <thead>
              <tr style="background:#ddd;">
                <th style="border:1px solid #000; padding:5px;">Code</th>
                <th style="border:1px solid #000; padding:5px;">Full Name</th>
                <th style="border:1px solid #000; padding:5px;">Full Address</th>
                <th style="border:1px solid #000; padding:5px; text-align:right;">Balance</th>
                <th style="border:1px solid #000; padding:5px; min-width:100px;">Payment</th>
              </tr>
            </thead>
            <tbody>
        `;

      // Sort Barangays within City
      const brgyMap = cityMap[city];
      const sortedBrgys = Object.keys(brgyMap).sort();

      sortedBrgys.forEach(brgy => {
        const brgyLoans = brgyMap[brgy];

        // Sort Loans by Name
        brgyLoans.sort((a, b) => a.borrower_name.localeCompare(b.borrower_name));

        // Barangay Section Header Row
        html += `
          <tr style="background-color:#eaeaea; font-weight:bold;">
            <td colspan="5" style="border:1px solid #000; padding:5px;">Barangay: ${brgy}</td>
          </tr>
        `;

        brgyLoans.forEach(loan => {
          const fmtInfo = (num) => Number(num).toLocaleString(undefined, { minimumFractionDigits: 2 });
          const addressShow = loan.full_address || [loan.barangay, loan.city, loan.area].filter(Boolean).join(', ');

          html += `
            <tr>
              <td style="border:1px solid #000; padding:5px;">${loan.loan_code}</td>
              <td style="border:1px solid #000; padding:5px;">${loan.borrower_name}</td>
              <td style="border:1px solid #000; padding:5px;">${addressShow}</td>
              <td style="border:1px solid #000; padding:5px; text-align:right;">${fmtInfo(loan.running_balance)}</td>
              <td style="border:1px solid #000; padding:5px;"></td>
            </tr>
          `;
        });
      });

      // Close Table per City
      html += `</tbody></table><br/>`;
    });

    html += `
         <div style="margin-top:40px; border-top:1px dashed #000; padding-top:10px;">
           <p>Collector Signature: __________________________</p>
         </div>
       </div>
     `;

    // Show Preview
    const previewDiv = document.getElementById('collectionSheetPreview');
    previewDiv.innerHTML = html;

    document.getElementById('collectionSheetSelectWrapper').classList.add('hidden');
    document.getElementById('collectionSheetPreviewWrapper').classList.remove('hidden');

  } catch (err) {
    alert('Failed to generate sheet: ' + err.message);
  }
}


// Client Profile Logic
const profileModal = document.getElementById('clientProfileModal');
if (profileModal) {
  document.getElementById('closeProfileModal').onclick = () => profileModal.classList.add('hidden');
  document.getElementById('printProfileBtn').onclick = () => {
    const printContent = document.getElementById('printableProfile').innerHTML;
    const originalContent = document.body.innerHTML;

    document.body.innerHTML = `
      <div style="padding: 40px; color: black; background: white; font-family: sans-serif;">
        ${printContent}
        <div style="margin-top: 40px; text-align: right;">
          <p>Printed on: ${new Date().toLocaleString()}</p>
          <p>Verified by: ${userInfo.full_name || 'System'}</p>
        </div>
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };
}

async function openClientProfile(loan) {
  if (!loan) return;
  profileModal.classList.remove('hidden');

  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Populate basic info
  // Use optional chaining or defaults safely
  document.getElementById('cpCode').textContent = loan.loan_code || '';
  document.getElementById('cpName').textContent = loan.borrower_name || '';
  document.getElementById('cpCollector').textContent = loan.collector_name || '-';
  document.getElementById('cpAddress').textContent = loan.full_address || '-';
  document.getElementById('cpMonth').textContent = loan.month_reported || '';
  document.getElementById('cpDueDate').textContent = loan.due_date ? new Date(loan.due_date).toLocaleDateString() : '';
  document.getElementById('cpReported').textContent = fmt(loan.outstanding_balance || 0);
  document.getElementById('cpRunning').textContent = fmt(loan.running_balance || 0);

  // Load payment history
  const tbody = document.querySelector('#cpPaymentsTable tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #64748b;">Loading payments...</td></tr>';

  try {
    const resp = await fetch(`${API_BASE}/loans/${loan.loan_id}/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    let payments = await resp.json();

    tbody.innerHTML = '';
    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #64748b;">No payments recorded.</td></tr>';
    } else {
      // Calculate balances
      // 1. Sort ascending by date to calculate running balance progression
      const sortedAsc = [...payments].sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

      let currentBalance = Number(loan.outstanding_balance); // Start with reported/principal

      // Map to add balance_after property
      const withBalances = sortedAsc.map(p => {
        currentBalance -= Number(p.amount);
        return { ...p, balance_after: currentBalance };
      });

      // 2. Sort descending by date for display (Newest First)
      const displayList = withBalances.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

      displayList.forEach((p, index) => {
        const tr = document.createElement('tr');
        // Alternating row colors
        tr.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        tr.style.borderBottom = '1px solid #f1f5f9';

        const tdStyle = 'padding: 1rem; color: #334155; font-size: 0.9rem;';

        tr.innerHTML = `
          <td style="${tdStyle}">${new Date(p.payment_date).toLocaleDateString()}</td>
          <td style="${tdStyle} color: #94a3b8;">—</td> <!-- OR Number Placeholder -->
          <td style="${tdStyle} text-align: right; font-weight: 600; color: #059669;">${fmt(p.amount)}</td>
          <td style="${tdStyle} text-align: right; font-weight: 600;">${fmt(p.balance_after)}</td>
          <td style="${tdStyle}">${p.recorded_by_name || 'System'}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #ef4444;">Error loading history.</td></tr>';
  }
}

async function deleteLoanRecord(id) {
  if (!confirm('Are you sure you want to delete this loan record? This action cannot be undone.')) return;

  try {
    const resp = await fetch(`${API_BASE}/loans/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || 'Failed to delete');
    }

    alert('Loan record deleted successfully.');
    loadLoans();
  } catch (err) {
    alert(err.message);
  }
}

// --- Dashboard Specific Logic ---

let dashPerfChart = null;
let dashStatusChart = null;

async function loadDashboardData() {
  // Update Date Context
  const dateEl = document.getElementById('dashDateContext');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Fetch Loans for KPI Cards & Status Chart
    // Optimization: In a real app, use a dedicated endpoint. Here we fetch all loans as the dataset is small.
    const loansResp = await fetch(`${API_BASE}/loans`, { headers });
    if (!loansResp.ok) throw new Error('Failed to fetch dashboard data');
    const loans = await loansResp.json();

    updateDashboardKPIs(loans);
    renderDashboardStatusChart(loans);

    // 2. Fetch Collector Performance for Bar Chart
    const perfResp = await fetch(`${API_BASE}/reports/performance`, { headers });
    if (perfResp.ok) {
      const perfData = await perfResp.json();
      renderDashboardPerfChart(perfData);
      updateQuickInsights(perfData, loans);
    }

  } catch (err) {
    console.error('Dashboard Load Error:', err);
  }
}

function updateDashboardKPIs(loans) {
  const totalAccounts = loans.length;
  const totalOutstanding = loans.reduce((sum, l) => sum + Number(l.outstanding_balance), 0);
  const totalCollected = loans.reduce((sum, l) => sum + Number(l.amount_collected), 0);
  const totalRunning = loans.reduce((sum, l) => sum + Number(l.running_balance), 0);

  const paidCount = loans.filter(l => l.moving_status === 'Paid').length;
  const nmCount = loans.filter(l => l.moving_status === 'NM').length;
  const movingCount = loans.filter(l => l.moving_status === 'Moving').length;
  const nmsrCount = loans.filter(l => l.moving_status === 'NMSR').length;

  const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // These IDs should match the dashboard section statistics
  // Reuse existing update logic but target dashboard specific elements if IDs are unique (they are)
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('statTotalAccounts', totalAccounts);
  setTxt('statOutstanding', fmt(totalOutstanding));
  setTxt('statCollected', fmt(totalCollected));
  setTxt('statRunning', fmt(totalRunning));
  setTxt('statPaidCount', paidCount);
  setTxt('statNMCount', nmCount);
  setTxt('statMovingCount', movingCount); // New
  setTxt('statNMSRCount', nmsrCount);     // New
}

function renderDashboardPerfChart(data) {
  const ctx = document.getElementById('dashPerfChart');
  if (!ctx) return;

  if (dashPerfChart) dashPerfChart.destroy();

  const labels = data.map(d => d.collector_name);
  const collected = data.map(d => d.total_collected);
  const reported = data.map(d => d.total_outstanding); // "Reported" amount usually refers to Outstanding/Principal or Target

  dashPerfChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Collected Amount',
          data: collected,
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Reported Amount', // or Outstanding
          data: reported,
          backgroundColor: '#cbd5e1',
          borderRadius: 4,
          hidden: true // Optional: hide by default to focus on collection? or show both.
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}

function renderDashboardStatusChart(loans) {
  const ctx = document.getElementById('dashStatusChart');
  if (!ctx) return;

  if (dashStatusChart) dashStatusChart.destroy();

  const statuses = ['Paid', 'Moving', 'NM', 'NMSR'];
  const counts = statuses.map(s => loans.filter(l => l.moving_status === s).length);
  const bgColors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  dashStatusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: statuses,
      datasets: [{
        data: counts,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

function updateQuickInsights(perfData, loans) {
  // 1. Top Performing Collector (Highest Collected)
  if (perfData.length > 0) {
    // Sort by total_collected desc
    const sorted = [...perfData].sort((a, b) => Number(b.total_collected) - Number(a.total_collected));
    const top = sorted[0];
    const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; // No decimals for quick view

    const topName = top.collector_name;
    const topVal = fmt(top.total_collected);

    const el = document.getElementById('insightTopCollector');
    if (el) el.innerHTML = `${topName} <span style="font-size:0.8em; font-weight:normal; color:#64748b">(${topVal})</span>`;
  }

  // 2. Highest Outstanding Balance by Collector
  if (perfData.length > 0) {
    const sortedOut = [...perfData].sort((a, b) => Number(b.total_outstanding) - Number(a.total_outstanding));
    const highest = sortedOut[0];
    const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const el = document.getElementById('insightHighOutstanding');
    if (el) el.innerHTML = `${highest.collector_name} <span style="font-size:0.8em; font-weight:normal; color:#64748b">(${fmt(highest.total_outstanding)})</span>`;
  }
}


// Collection Summary by Date Range
const btnGenerateSummary = document.getElementById('btnGenerateSummary');
if (btnGenerateSummary) {
  btnGenerateSummary.addEventListener('click', loadCollectionSummary);
}

async function loadCollectionSummary() {
  const startDate = document.getElementById('summaryStartDate').value;
  const endDate = document.getElementById('summaryEndDate').value;
  const tbody = document.querySelector('#summaryTable tbody');

  if (!startDate || !endDate) {
    alert('Please select a start and end date.');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Loading...</td></tr>';

  try {
    const resp = await fetch(`${API_BASE}/reports/collection-summary?start_date=${startDate}&end_date=${endDate}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) throw new Error('Failed to load summary');

    const data = await resp.json();
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No collections found for this period.</td></tr>';
      return;
    }

    const fmt = (num) => `₱${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    let total = 0;

    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td>${row.collector_name}</td>
                <td style="text-align:right;">${fmt(row.total_collected)}</td>
            `;
      tbody.appendChild(tr);
      total += Number(row.total_collected);
    });

    // Total Row
    const trF = document.createElement('tr');
    trF.style.background = '#064e3b';
    trF.style.fontWeight = 'bold';
    trF.style.color = '#fff';
    trF.innerHTML = `
            <td>GRAND TOTAL</td>
            <td style="text-align:right;">${fmt(total)}</td>
        `;
    tbody.appendChild(trF);

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ef4444;">Error loading data.</td></tr>';
  }
}
