// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIRBgoC_vl3RE6pQH7V8Ep1rL8umCXXXo",
  authDomain: "taichinhdemo2.firebaseapp.com",
  projectId: "taichinhdemo2",
  storageBucket: "taichinhdemo2.firebasestorage.app",
  messagingSenderId: "852100070490",
  appId: "1:852100070490:web:9182a4855b820696a56c63",
  measurementId: "G-Q8NXGMNLQX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const analytics = firebase.analytics();

// Cấu hình ban đầu
const CATEGORIES = {
    expense: [
        { id: 'food', name: 'Ăn uống', icon: 'fa-utensils' },
        { id: 'transport', name: 'Di chuyển', icon: 'fa-car' },
        { id: 'shopping', name: 'Mua sắm', icon: 'fa-bag-shopping' },
        { id: 'housing', name: 'Nhà cửa', icon: 'fa-house' },
        { id: 'utilities', name: 'Hóa đơn', icon: 'fa-file-invoice-dollar' },
        { id: 'entertainment', name: 'Giải trí', icon: 'fa-film' },
        { id: 'health', name: 'Sức khỏe', icon: 'fa-notes-medical' },
        { id: 'other_expense', name: 'Khác', icon: 'fa-ellipsis' }
    ],
    income: [
        { id: 'salary', name: 'Lương', icon: 'fa-money-bill-wave' },
        { id: 'business', name: 'Kinh doanh', icon: 'fa-store' },
        { id: 'investment', name: 'Đầu tư', icon: 'fa-chart-line' },
        { id: 'gift', name: 'Được tặng', icon: 'fa-gift' },
        { id: 'other_income', name: 'Khác', icon: 'fa-ellipsis' }
    ]
};

// Khởi tạo state
let transactions = [];
let currentTab = 'dashboard';
let charts = {}; // Lưu trữ instance của Chart.js
let isReportsAuthenticated = false; // Trạng thái đăng nhập Báo cáo
let editingTransactionId = null; // ID của giao dịch đang được chỉnh sửa

// Format tiền tệ Việt Nam
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Format input tiền tệ với dấu phẩy
const formatInputCurrency = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
        e.target.value = new Intl.NumberFormat('en-US').format(value);
    } else {
        e.target.value = '';
    }
};

// Format ngày tháng
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
};

// Lấy icon danh mục
const getCategoryIcon = (type, categoryId) => {
    const cat = CATEGORIES[type].find(c => c.id === categoryId);
    return cat ? cat.icon : 'fa-circle-question';
};
const getCategoryName = (type, categoryId) => {
    const cat = CATEGORIES[type].find(c => c.id === categoryId);
    return cat ? cat.name : 'Không rõ';
};

// Tính toán các chỉ số
const calculateSummary = (targetMonth = null) => {
    const now = new Date();
    const currentMonth = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let totalBalance = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    transactions.forEach(t => {
        if (t.type === 'income') totalBalance += t.amount;
        else totalBalance -= t.amount;

        const tMonth = t.date.substring(0, 7); 
        if (tMonth === currentMonth) {
            if (t.type === 'income') monthIncome += t.amount;
            else monthExpense += t.amount;
        }
    });

    return { totalBalance, monthIncome, monthExpense };
};

// Cập nhật thẻ Dashboard
const updateDashboardSummary = () => {
    const summary = calculateSummary();
    document.getElementById('total-balance').textContent = formatCurrency(summary.totalBalance);
    document.getElementById('total-income').textContent = formatCurrency(summary.monthIncome);
    document.getElementById('total-expense').textContent = formatCurrency(summary.monthExpense);
};

// Render danh sách giao dịch (Dashboard)
const renderRecentTransactions = () => {
    const list = document.getElementById('recent-transaction-list');
    list.innerHTML = '';
    
    const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    if (recent.length === 0) {
        list.innerHTML = '<li class="text-muted" style="text-align:center; padding: 1rem;">Chưa có giao dịch nào</li>';
        return;
    }

    recent.forEach(t => {
        const isIncome = t.type === 'income';
        const sign = isIncome ? '+' : '-';
        const li = document.createElement('li');
        li.className = 'transaction-item';
        li.innerHTML = `
            <div class="t-info">
                <div class="t-icon ${t.type}">
                    <i class="fa-solid ${getCategoryIcon(t.type, t.category)}"></i>
                </div>
                <div class="t-details">
                    <h4>${getCategoryName(t.type, t.category)}</h4>
                    <p>${formatDate(t.date)} ${t.note ? '• ' + t.note : ''}</p>
                </div>
            </div>
            <div class="t-amount ${t.type}">${sign}${formatCurrency(t.amount)}</div>
        `;
        list.appendChild(li);
    });
};

// Render bảng giao dịch (Thu và Chi)
const renderTransactionTables = () => {
    ['income', 'expense'].forEach(type => {
        const tbody = document.getElementById(`${type}-transaction-list`);
        if(!tbody) return;
        const filterMonth = document.getElementById(`${type}-filter-month`).value;
        
        let filtered = transactions.filter(t => t.type === type).sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (filterMonth !== 'all') {
            filtered = filtered.filter(t => t.date.substring(0, 7) === filterMonth);
        }

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Không có dữ liệu</td></tr>';
            return;
        }

        filtered.forEach(t => {
            const sign = type === 'income' ? '+' : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(t.date)}</td>
                <td>
                    <span style="display:flex; align-items:center; gap:0.5rem;">
                        <i class="fa-solid ${getCategoryIcon(t.type, t.category)}" style="color: ${type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'}"></i>
                        ${getCategoryName(t.type, t.category)}
                    </span>
                </td>
                <td>${t.note || '-'}</td>
                <td class="text-right t-amount ${t.type}">${sign}${formatCurrency(t.amount)}</td>
                <td>
                    <button class="btn-edit" onclick="editTransaction('${t.id}')" title="Sửa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteTransaction('${t.id}')" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
};

// Xóa giao dịch
window.deleteTransaction = (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
        // Nếu đang sửa chính giao dịch này thì hủy sửa trước khi xóa
        if (editingTransactionId === id) {
            const t = transactions.find(item => item.id === id);
            if (t) cancelEditing(t.type);
        }
        db.collection('transactions').doc(id).delete()
            .then(() => {
                console.log("Đã xóa giao dịch khỏi Firestore:", id);
            })
            .catch(error => {
                console.error("Lỗi khi xóa giao dịch:", error);
                alert("Lỗi khi xóa giao dịch: " + error.message);
            });
    }
};

// Thiết lập trạng thái sửa giao dịch
window.editTransaction = (id) => {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    
    editingTransactionId = id;
    const type = t.type;
    
    // Điền dữ liệu vào form
    const amountInput = document.getElementById(type + '-amount');
    const categorySelect = document.getElementById(type + '-category');
    const dateInput = document.getElementById(type + '-date');
    const noteInput = document.getElementById(type + '-note');
    
    if (amountInput) amountInput.value = new Intl.NumberFormat('en-US').format(t.amount);
    if (categorySelect) categorySelect.value = t.category;
    if (dateInput) dateInput.value = t.date;
    if (noteInput) noteInput.value = t.note || '';
    
    // Đổi tiêu đề form & nút lưu
    const formTitle = document.getElementById(type + '-form-title');
    const submitBtn = document.getElementById(type + '-submit-btn');
    const cancelBtn = document.getElementById(type + '-cancel-btn');
    
    if (formTitle) formTitle.textContent = type === 'income' ? 'Sửa Khoản Thu' : 'Sửa Khoản Chi';
    if (submitBtn) submitBtn.textContent = type === 'income' ? 'Cập Nhật Thu' : 'Cập Nhật Chi';
    if (cancelBtn) cancelBtn.style.display = 'block';
    
    // Cuộn lên đầu form nếu trên di động
    const formContainer = amountInput.closest('.form-container');
    if (formContainer) {
        formContainer.scrollIntoView({ behavior: 'smooth' });
    }
};

// Hủy trạng thái sửa giao dịch
window.cancelEditing = (type) => {
    editingTransactionId = null;
    
    // Reset form
    const amountInput = document.getElementById(type + '-amount');
    const categorySelect = document.getElementById(type + '-category');
    const dateInput = document.getElementById(type + '-date');
    const noteInput = document.getElementById(type + '-note');
    
    if (amountInput) amountInput.value = '';
    if (categorySelect) categorySelect.selectedIndex = 0;
    if (dateInput) dateInput.valueAsDate = new Date();
    if (noteInput) noteInput.value = '';
    
    // Reset tiêu đề form & nút lưu
    const formTitle = document.getElementById(type + '-form-title');
    const submitBtn = document.getElementById(type + '-submit-btn');
    const cancelBtn = document.getElementById(type + '-cancel-btn');
    
    if (formTitle) formTitle.textContent = type === 'income' ? 'Thêm Khoản Thu' : 'Thêm Khoản Chi';
    if (submitBtn) submitBtn.textContent = type === 'income' ? 'Lưu Khoản Thu' : 'Lưu Khoản Chi';
    if (cancelBtn) cancelBtn.style.display = 'none';
};

// Cập nhật dropdown chọn tháng cho Thu và Chi
const updateMonthFilters = () => {
    const months = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort().reverse();
    
    ['income-filter-month', 'expense-filter-month'].forEach(id => {
        const filter = document.getElementById(id);
        if(!filter) return;
        const currentValue = filter.value || 'all';
        filter.innerHTML = '<option value="all">Tất cả các tháng</option>';
        months.forEach(m => {
            const [year, month] = m.split('-');
            const option = document.createElement('option');
            option.value = m;
            option.textContent = `Tháng ${month}/${year}`;
            filter.appendChild(option);
        });
        if (months.includes(currentValue) || currentValue === 'all') {
            filter.value = currentValue;
        }
    });
};

// Biểu đồ
const initCharts = () => {
    // Đăng ký plugin hiển thị nhãn số liệu trực tiếp trên biểu đồ
    Chart.register(ChartDataLabels);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#f8fafc' }
            },
            datalabels: {
                display: false // Ẩn mặc định cho các biểu đồ khác (doughnut)
            }
        }
    };

    const ctxOverview = document.getElementById('overviewChart');
    if(ctxOverview) {
        charts.overview = new Chart(ctxOverview.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'top',
                        color: '#f8fafc',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: function(value) {
                            if (value === 0) return '';
                            if (value >= 1000000) {
                                return (value / 1000000) + 'M';
                            }
                            return new Intl.NumberFormat('vi-VN').format(value);
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    const val = context.parsed.y;
                                    if (val >= 1000000) {
                                        label += (val / 1000000) + 'M ₫';
                                    } else {
                                        label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
                                    }
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grace: '10%', // Thêm khoảng trống ở đỉnh để nhãn không bị đè/cắt
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                if (value === 0) return '0';
                                if (value >= 1000000) {
                                    return (value / 1000000) + 'M';
                                }
                                return value;
                            }
                        },
                        grid: { color: '#334155' }
                    },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }

    const ctxExpense = document.getElementById('expenseCategoryChart');
    if(ctxExpense) {
        charts.expense = new Chart(ctxExpense.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: commonOptions
        });
    }

    const ctxIncome = document.getElementById('incomeCategoryChart');
    if(ctxIncome) {
        charts.income = new Chart(ctxIncome.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: commonOptions
        });
    }
};

const updateCharts = () => {
    if (!charts.overview) return;

    // 1. Overview Chart (6 tháng gần nhất)
    const last6Months = [];
    const now = new Date();
    for(let i=5; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const incomeData = last6Months.map(m => {
        return transactions.filter(t => t.type === 'income' && t.date.substring(0, 7) === m)
                           .reduce((sum, t) => sum + t.amount, 0);
    });
    const expenseData = last6Months.map(m => {
        return transactions.filter(t => t.type === 'expense' && t.date.substring(0, 7) === m)
                           .reduce((sum, t) => sum + t.amount, 0);
    });

    charts.overview.data = {
        labels: last6Months.map(m => m.substring(5) + '/' + m.substring(0,4)),
        datasets: [
            { label: 'Thu', data: incomeData, backgroundColor: '#10b981' },
            { label: 'Chi', data: expenseData, backgroundColor: '#f43f5e' }
        ]
    };
    charts.overview.update();

    // 2. Report tab charts
    const reportMonth = document.getElementById('report-month-filter').value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Expense Categories
    const expenseTx = transactions.filter(t => t.type === 'expense' && t.date.substring(0, 7) === reportMonth);
    const expCatData = {};
    CATEGORIES.expense.forEach(c => expCatData[c.id] = 0);
    expenseTx.forEach(t => expCatData[t.category] += t.amount);
    
    charts.expense.data = {
        labels: CATEGORIES.expense.map(c => c.name),
        datasets: [{
            data: CATEGORIES.expense.map(c => expCatData[c.id]),
            backgroundColor: ['#f43f5e', '#ec4899', '#d946ef', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6'],
            borderWidth: 0
        }]
    };
    charts.expense.update();

    // Income Categories
    const incomeTx = transactions.filter(t => t.type === 'income' && t.date.substring(0, 7) === reportMonth);
    const incCatData = {};
    CATEGORIES.income.forEach(c => incCatData[c.id] = 0);
    incomeTx.forEach(t => incCatData[t.category] += t.amount);

    charts.income.data = {
        labels: CATEGORIES.income.map(c => c.name),
        datasets: [{
            data: CATEGORIES.income.map(c => incCatData[c.id]),
            backgroundColor: ['#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b'],
            borderWidth: 0
        }]
    };
    charts.income.update();
};

// Điều hướng Tab
const switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    const titles = {
        'dashboard': 'Tổng quan',
        'income': 'Quản lý Thu Tiền',
        'expense': 'Quản lý Chi Tiền',
        'reports': 'Báo cáo & Phân tích'
    };
    document.getElementById('page-title').textContent = titles[tabId];
    currentTab = tabId;
};

// Cập nhật danh sách Categories trong Form
const updateCategorySelect = (type, selectId) => {
    const select = document.getElementById(selectId);
    if(!select) return;
    select.innerHTML = '';
    CATEGORIES[type].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
};

// Thay thế toàn bộ dữ liệu trên Firestore bằng bộ dữ liệu mới (Dành cho việc import share link)
const replaceFirestoreData = async (newTransactions) => {
    try {
        const snapshot = await db.collection('transactions').get();
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        newTransactions.forEach(tx => {
            const txId = tx.id || Date.now().toString();
            const docRef = db.collection('transactions').doc(txId);
            batch.set(docRef, { ...tx, id: txId });
        });
        
        await batch.commit();
        alert('Đã tải dữ liệu chia sẻ thành công!');
    } catch (error) {
        console.error("Lỗi thay thế dữ liệu từ link chia sẻ:", error);
        alert("Lỗi khi lưu dữ liệu chia sẻ: " + error.message);
    }
};

// Cập nhật tất cả View
const updateAllViews = () => {
    updateDashboardSummary();
    renderRecentTransactions();
    updateMonthFilters();
    renderTransactionTables();
    updateCharts();
};

// Đồng bộ dữ liệu real-time từ Firestore
const initFirestoreSync = () => {
    db.collection('transactions').orderBy('date', 'desc').onSnapshot((snapshot) => {
        const fetchedTransactions = [];
        snapshot.forEach(doc => {
            fetchedTransactions.push(doc.data());
        });
        
        transactions = fetchedTransactions;
        updateAllViews();
    }, (error) => {
        console.error("Lỗi khi đồng bộ từ Firestore:", error);
    });
};

// Tự động chuyển đổi dữ liệu từ localStorage lên Firestore (nếu có)
const migrateLocalStorageToFirestore = async () => {
    const localData = JSON.parse(localStorage.getItem('fin_transactions')) || [];
    if (localData.length > 0) {
        try {
            const snapshot = await db.collection('transactions').get();
            if (snapshot.empty) {
                console.log("Phát hiện dữ liệu local. Đang đồng bộ lên Firestore...");
                const batch = db.batch();
                localData.forEach(tx => {
                    const txId = tx.id || Date.now().toString();
                    const docRef = db.collection('transactions').doc(txId);
                    batch.set(docRef, { ...tx, id: txId });
                });
                await batch.commit();
                console.log("Đồng bộ dữ liệu local lên Firestore thành công!");
            }
            localStorage.removeItem('fin_transactions');
        } catch (error) {
            console.error("Lỗi khi di chuyển dữ liệu localStorage lên Firestore:", error);
        }
    }
};

// Xuất báo cáo Excel
const exportToExcel = async () => {
    const filterVal = document.getElementById('report-month-filter').value; // YYYY-MM
    if (!filterVal) {
        alert('Vui lòng chọn tháng báo cáo để xuất!');
        return;
    }
    
    const [year, month] = filterVal.split('-');
    
    // Lọc giao dịch trong tháng
    const filteredTxs = transactions.filter(t => t.date.substring(0, 7) === filterVal)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
        
    if (filteredTxs.length === 0) {
        alert(`Không có giao dịch nào trong tháng ${month}/${year} để xuất báo cáo!`);
        return;
    }
        
    // Tính toán chỉ số của tháng
    const summary = calculateSummary(filterVal);
    
    try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Tổng Quan');
        
        // --- 1. Tạo Bảng Tổng Quan bên trái ---
        ws.mergeCells('A1:C1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `BÁO CÁO TÀI CHÍNH THÁNG ${month}/${year}`;
        titleCell.font = { name: 'Calibri', size: 12, bold: true };
        
        ws.getColumn('A').width = 20; 
        ws.getColumn('B').width = 25; 
        ws.getColumn('C').width = 20; 
        
        ws.mergeCells('A3:B3');
        ws.getCell('A3').value = 'Chỉ Số Tổng Quan';
        ws.getCell('C3').value = 'Số Tiền (VND)';
        
        ws.mergeCells('A4:B4');
        ws.getCell('A4').value = 'Tổng Thu Nhập';
        ws.getCell('C4').value = summary.monthIncome;
        
        ws.mergeCells('A5:B5');
        ws.getCell('A5').value = 'Tổng Chi Tiêu';
        ws.getCell('C5').value = summary.monthExpense;
        
        ws.mergeCells('A6:B6');
        ws.getCell('A6').value = 'Thặng Dư (Số Dư)';
        ws.getCell('C6').value = summary.monthIncome - summary.monthExpense;
        
        ws.mergeCells('A8:C8');
        ws.getCell('A8').value = 'PHÂN TÍCH CHI TIẾT THEO DANH MỤC';
        
        ws.getCell('A9').value = 'Loại Giao Dịch';
        ws.getCell('B9').value = 'Danh Mục';
        ws.getCell('C9').value = 'Số Tiền (VND)';
        
        let currentRow = 10;
        
        const chartLabels = [];
        const chartData = [];
        
        // Chi tiết danh mục Thu
        CATEGORIES.income.forEach(cat => {
            const amt = filteredTxs.filter(t => t.type === 'income' && t.category === cat.id)
                .reduce((sum, t) => sum + t.amount, 0);
            if (amt > 0) {
                ws.getCell(`A${currentRow}`).value = 'Thu Nhập';
                ws.getCell(`B${currentRow}`).value = cat.name;
                ws.getCell(`C${currentRow}`).value = amt;
                chartLabels.push(cat.name);
                chartData.push(amt);
                currentRow++;
            }
        });
        
        // Chi tiết danh mục Chi
        CATEGORIES.expense.forEach(cat => {
            const amt = filteredTxs.filter(t => t.type === 'expense' && t.category === cat.id)
                .reduce((sum, t) => sum + t.amount, 0);
            if (amt > 0) {
                ws.getCell(`A${currentRow}`).value = 'Chi Tiêu';
                ws.getCell(`B${currentRow}`).value = cat.name;
                ws.getCell(`C${currentRow}`).value = amt;
                chartLabels.push(cat.name);
                chartData.push(amt);
                currentRow++;
            }
        });
        
        const borderStyle = {
            top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
        
        // Format A3:C6
        for (let r = 3; r <= 6; r++) {
            for (let c = 1; c <= 3; c++) {
                const cell = ws.getCell(r, c);
                cell.border = borderStyle;
                if (r === 3) {
                    cell.font = { name: 'Calibri', size: 11, bold: true };
                } else {
                    cell.font = { name: 'Calibri', size: 11 };
                }
                if (c === 3 && r > 3) {
                    cell.numFmt = '#,##0';
                }
            }
        }
        
        // Format A8:C{currentRow-1}
        ws.getCell('A8').font = { name: 'Calibri', size: 11, bold: true };
        for (let r = 9; r < currentRow; r++) {
            for (let c = 1; c <= 3; c++) {
                const cell = ws.getCell(r, c);
                cell.border = borderStyle;
                if (r === 9) {
                    cell.font = { name: 'Calibri', size: 11, bold: true };
                    cell.alignment = { horizontal: 'center' };
                } else {
                    cell.font = { name: 'Calibri', size: 11 };
                }
                if (c === 3 && r > 9) {
                    cell.numFmt = '#,##0';
                }
            }
        }
        
        // --- 2. Tạo Biểu Đồ Bằng Chart.js và chèn Ảnh ---
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 350;
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: '#4472c4', 
                    barPercentage: 0.4
                }]
            },
            options: {
                animation: false,
                devicePixelRatio: 2, 
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Các nguồn thu - chi',
                        font: { size: 16, family: 'Calibri' },
                        color: '#595959',
                        padding: { bottom: 20 }
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'top',
                        color: '#595959',
                        font: { family: 'Calibri', size: 10, weight: 'bold' },
                        formatter: function(value) {
                            if(value === 0) return '';
                            return new Intl.NumberFormat('en-US').format(value);
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grace: '15%', 
                        ticks: {
                            color: '#595959',
                            font: { family: 'Calibri', size: 10 },
                            callback: function(value) {
                                return new Intl.NumberFormat('en-US').format(value);
                            }
                        },
                        grid: { color: '#d9d9d9', drawBorder: false },
                        border: { display: false }
                    },
                    x: {
                        ticks: {
                            color: '#595959',
                            font: { family: 'Calibri', size: 11 }
                        },
                        grid: { display: false },
                        border: { color: '#8c8c8c' }
                    }
                }
            }
        });
        
        const imgData = canvas.toDataURL('image/png');
        document.body.removeChild(canvas); 
        
        const imageId = wb.addImage({
            base64: imgData,
            extension: 'png',
        });
        
        // E2:M17
        ws.addImage(imageId, 'E2:M17');
        
        // --- 3. Sheet 2: Danh Sách Giao Dịch ---
        const wsDetail = wb.addWorksheet('Chi Tiết Giao Dịch');
        wsDetail.getColumn('A').width = 15;
        wsDetail.getColumn('B').width = 15;
        wsDetail.getColumn('C').width = 20;
        wsDetail.getColumn('D').width = 20;
        wsDetail.getColumn('E').width = 30;
        
        wsDetail.mergeCells('A1:E1');
        wsDetail.getCell('A1').value = `DANH SÁCH CHI TIẾT GIAO DỊCH - THÁNG ${month}/${year}`;
        wsDetail.getCell('A1').font = { name: 'Calibri', bold: true, size: 12 };
        
        wsDetail.getCell('A3').value = 'Ngày Giao Dịch';
        wsDetail.getCell('B3').value = 'Loại Giao Dịch';
        wsDetail.getCell('C3').value = 'Danh Mục';
        wsDetail.getCell('D3').value = 'Số Tiền (VND)';
        wsDetail.getCell('E3').value = 'Ghi Chú';
        wsDetail.getRow(3).font = { name: 'Calibri', bold: true, size: 11 };
        
        let detailRow = 4;
        filteredTxs.forEach(t => {
            wsDetail.getCell(`A${detailRow}`).value = t.date;
            wsDetail.getCell(`B${detailRow}`).value = t.type === 'income' ? 'Thu Nhập' : 'Chi Tiêu';
            wsDetail.getCell(`C${detailRow}`).value = getCategoryName(t.type, t.category);
            const amtCell = wsDetail.getCell(`D${detailRow}`);
            amtCell.value = t.amount;
            amtCell.numFmt = '#,##0';
            wsDetail.getCell(`E${detailRow}`).value = t.note || '';
            
            for(let c=1; c<=5; c++) {
                wsDetail.getCell(detailRow, c).font = { name: 'Calibri', size: 11 };
            }
            detailRow++;
        });
        
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Bao_Cao_Tai_Chinh_${month}_${year}.xlsx`);
        
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        alert("Có lỗi xảy ra khi tạo file Excel: " + error.message);
    }
};

// Events
document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra trạng thái xác thực ứng dụng
    const checkAppAuthentication = () => {
        const isAuthenticated = localStorage.getItem('fin_app_authenticated') === 'true';
        const loginScreen = document.getElementById('app-login-screen');
        const appContainer = document.querySelector('.app-container');
        
        if (isAuthenticated) {
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            
            // Tự động bỏ qua xác thực báo cáo vì đã đăng nhập vào hệ thống
            const reportsLogin = document.getElementById('reports-login-container');
            const reportsContent = document.getElementById('reports-content-container');
            if (reportsLogin) reportsLogin.style.display = 'none';
            if (reportsContent) reportsContent.style.display = 'block';
            isReportsAuthenticated = true;
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
        }
    };

    // Chạy kiểm tra đăng nhập ngay lập tức
    checkAppAuthentication();

    // Xử lý sự kiện đăng nhập
    const appLoginForm = document.getElementById('app-login-form');
    if (appLoginForm) {
        appLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('app-username').value;
            const password = document.getElementById('app-password').value;
            const loginError = document.getElementById('app-login-error');
            
            if (username === 'nguyenanh2021' && password === 'hokt1111') {
                localStorage.setItem('fin_app_authenticated', 'true');
                if (loginError) loginError.style.display = 'none';
                checkAppAuthentication();
                updateCharts();
            } else {
                if (loginError) {
                    loginError.style.display = 'block';
                    loginError.textContent = 'Tài khoản hoặc mật khẩu không chính xác!';
                }
            }
        });
    }

    // Xử lý sự kiện đăng xuất
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                localStorage.removeItem('fin_app_authenticated');
                window.location.reload();
            }
        });
    }

    // Tab Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            switchTab(e.currentTarget.dataset.tab);
            if (e.currentTarget.dataset.tab === 'reports') {
                updateCharts();
            }
        });
    });

    // Cài đặt ngày mặc định
    document.getElementById('income-date').valueAsDate = new Date();
    document.getElementById('expense-date').valueAsDate = new Date();
    
    // Khởi tạo tháng cho tab Báo cáo
    const now = new Date();
    document.getElementById('report-month-filter').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const incomeAmountInput = document.getElementById('income-amount');
    if (incomeAmountInput) incomeAmountInput.addEventListener('input', formatInputCurrency);
    
    const expenseAmountInput = document.getElementById('expense-amount');
    if (expenseAmountInput) expenseAmountInput.addEventListener('input', formatInputCurrency);

    updateCategorySelect('income', 'income-category');
    updateCategorySelect('expense', 'expense-category');

    // Submit Form Thu
    const incomeForm = document.getElementById('income-form');
    if(incomeForm) {
        incomeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const isEdit = !!editingTransactionId;
            const newTx = {
                id: editingTransactionId || Date.now().toString(),
                type: 'income',
                amount: parseFloat(document.getElementById('income-amount').value.replace(/,/g, '')),
                category: document.getElementById('income-category').value,
                date: document.getElementById('income-date').value,
                note: document.getElementById('income-note').value
            };
            db.collection('transactions').doc(newTx.id).set(newTx)
                .then(() => {
                    cancelEditing('income');
                    alert(isEdit ? 'Đã cập nhật khoản thu thành công!' : 'Đã thêm khoản thu thành công!');
                })
                .catch(error => {
                    console.error("Lỗi lưu khoản thu:", error);
                    alert("Lỗi lưu khoản thu: " + error.message);
                });
        });
    }

    // Submit Form Chi
    const expenseForm = document.getElementById('expense-form');
    if(expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const isEdit = !!editingTransactionId;
            const newTx = {
                id: editingTransactionId || Date.now().toString(),
                type: 'expense',
                amount: parseFloat(document.getElementById('expense-amount').value.replace(/,/g, '')),
                category: document.getElementById('expense-category').value,
                date: document.getElementById('expense-date').value,
                note: document.getElementById('expense-note').value
            };
            db.collection('transactions').doc(newTx.id).set(newTx)
                .then(() => {
                    cancelEditing('expense');
                    alert(isEdit ? 'Đã cập nhật khoản chi thành công!' : 'Đã thêm khoản chi thành công!');
                })
                .catch(error => {
                    console.error("Lỗi lưu khoản chi:", error);
                    alert("Lỗi lưu khoản chi: " + error.message);
                });
        });
    }

    // Sự kiện nút Hủy sửa
    const incomeCancelBtn = document.getElementById('income-cancel-btn');
    if (incomeCancelBtn) {
        incomeCancelBtn.addEventListener('click', () => cancelEditing('income'));
    }
    
    const expenseCancelBtn = document.getElementById('expense-cancel-btn');
    if (expenseCancelBtn) {
        expenseCancelBtn.addEventListener('click', () => cancelEditing('expense'));
    }

    // Lọc bảng giao dịch
    const incomeFilter = document.getElementById('income-filter-month');
    if(incomeFilter) incomeFilter.addEventListener('change', renderTransactionTables);
    
    const expenseFilter = document.getElementById('expense-filter-month');
    if(expenseFilter) expenseFilter.addEventListener('change', renderTransactionTables);
    
    // Lọc báo cáo
    document.getElementById('report-month-filter').addEventListener('change', updateCharts);

    // Sự kiện nút Xuất Excel
    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', exportToExcel);
    }

    // Xác thực báo cáo (Đã được xử lý toàn cục)
    isReportsAuthenticated = true;

    // Kiểm tra dữ liệu được chia sẻ từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('shareData');
    if (sharedData) {
        try {
            const decodedStr = decodeURIComponent(escape(atob(sharedData)));
            const importedTransactions = JSON.parse(decodedStr);
            
            if (Array.isArray(importedTransactions) && importedTransactions.length > 0) {
                if (confirm('Bạn có muốn tải dữ liệu được chia sẻ từ liên kết này không? Dữ liệu hiện tại sẽ bị thay thế.')) {
                    replaceFirestoreData(importedTransactions);
                }
            }
            // Xóa tham số khỏi URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error("Lỗi đọc dữ liệu chia sẻ:", e);
            alert('Dữ liệu chia sẻ không hợp lệ hoặc bị lỗi!');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Xử lý nút Chia sẻ
    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            if (transactions.length === 0) {
                alert('Không có dữ liệu để chia sẻ!');
                return;
            }
            try {
                const jsonStr = JSON.stringify(transactions);
                const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
                
                const shareUrl = new URL(window.location.href);
                shareUrl.searchParams.set('shareData', base64Str);
                
                navigator.clipboard.writeText(shareUrl.toString()).then(() => {
                    alert('Đã sao chép liên kết chia sẻ! Bạn có thể dán (Ctrl+V) gửi cho người khác.');
                }).catch(err => {
                    prompt('Sao chép liên kết chia sẻ dưới đây:', shareUrl.toString());
                });
            } catch (error) {
                console.error("Lỗi khi tạo link chia sẻ:", error);
                alert('Có lỗi xảy ra khi tạo liên kết chia sẻ. Dữ liệu có thể quá lớn.');
            }
        });
    }

    // Khởi tạo
    initCharts();
    
    // Di chuyển dữ liệu cũ (nếu có) và bắt đầu đồng bộ Firestore
    migrateLocalStorageToFirestore()
        .catch(err => console.error("Lỗi di chuyển dữ liệu:", err))
        .finally(() => {
            initFirestoreSync();
        });

    // ==========================================
    // CHATBOT GEMINI INTEGRATION
    // ==========================================
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotSettingsBtn = document.getElementById('chatbot-settings-btn');
    
    const setupScreen = document.getElementById('chatbot-setup-screen');
    const chatScreen = document.getElementById('chatbot-chat-screen');
    
    const apiKeyInput = document.getElementById('chatbot-api-key-input');
    const saveKeyBtn = document.getElementById('chatbot-save-key-btn');
    
    const chatInput = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const messagesContainer = document.getElementById('chatbot-messages');
    
    let geminiApiKey = localStorage.getItem('fin_gemini_api_key');

    // API Key Management
    const checkApiKey = () => {
        if (!setupScreen || !chatScreen) return;
        geminiApiKey = localStorage.getItem('fin_gemini_api_key');
        if (geminiApiKey) {
            setupScreen.style.display = 'none';
            chatScreen.style.display = 'flex';
        } else {
            setupScreen.style.display = 'flex';
            chatScreen.style.display = 'none';
        }
    };
    checkApiKey();

    if(saveKeyBtn) saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('fin_gemini_api_key', key);
            checkApiKey();
        }
    });
    
    if(chatbotSettingsBtn) chatbotSettingsBtn.addEventListener('click', () => {
        localStorage.removeItem('fin_gemini_api_key');
        apiKeyInput.value = '';
        checkApiKey();
    });

    // Chat Logic
    const appendMessage = (role, content) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-message ${role}`;
        
        const avatar = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
        
        let displayContent = content;
        if (role === 'assistant' && typeof marked !== 'undefined') {
            displayContent = marked.parse(content);
        }

        msgDiv.innerHTML = `
            <div class="msg-avatar">${avatar}</div>
            <div class="msg-content">${displayContent}</div>
        `;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const appendTypingIndicator = () => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-message assistant typing-msg`;
        msgDiv.innerHTML = `
            <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return msgDiv;
    };

    const buildContextPrompt = () => {
        const summary = calculateSummary();
        return `Bạn là một trợ lý tài chính gia đình thông minh, thân thiện. 
Dưới đây là tóm tắt tình hình tài chính của người dùng hiện tại:
- Tổng số dư: ${formatCurrency(summary.totalBalance)}
- Tổng thu tháng này: ${formatCurrency(summary.monthIncome)}
- Tổng chi tháng này: ${formatCurrency(summary.monthExpense)}

Hãy trả lời ngắn gọn, dễ hiểu và đưa ra lời khuyên hữu ích dựa trên ngữ cảnh này. Đóng vai là trợ lý xưng hô là "tôi" và gọi người dùng là "bạn". Sử dụng markdown để định dạng văn bản (danh sách, in đậm) cho đẹp mắt.`;
    };

    const sendMessageToGemini = async (text) => {
        if (!geminiApiKey) return;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: buildContextPrompt() },
                        { text: text }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if(response.status === 400) throw new Error("API Key không hợp lệ hoặc lỗi request.");
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }

            const data = await response.json();
            const reply = data.candidates[0].content.parts[0].text;
            return reply;
        } catch (error) {
            console.error("Gemini API Error:", error);
            return `Xin lỗi, có lỗi xảy ra: ${error.message}. Vui lòng kiểm tra lại kết nối mạng hoặc API Key (bấm vào biểu tượng cài đặt phía trên để nhập lại).`;
        }
    };

    const handleSendMsg = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        
        // Disable input
        chatInput.value = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        
        appendMessage('user', text);
        const typingIndicator = appendTypingIndicator();
        
        const replyText = await sendMessageToGemini(text);
        
        typingIndicator.remove();
        appendMessage('assistant', replyText);
        
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.focus();
    };

    if(sendBtn) sendBtn.addEventListener('click', handleSendMsg);
    if(chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMsg();
        }
    });
});
