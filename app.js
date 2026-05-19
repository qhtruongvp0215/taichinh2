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
                    <button class="btn-delete" onclick="deleteTransaction('${t.id}')">
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
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#f8fafc' }
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
                scales: {
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
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

// Events
document.addEventListener('DOMContentLoaded', () => {
    // Tab Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            switchTab(e.currentTarget.dataset.tab);
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
            const newTx = {
                id: Date.now().toString(),
                type: 'income',
                amount: parseFloat(document.getElementById('income-amount').value.replace(/,/g, '')),
                category: document.getElementById('income-category').value,
                date: document.getElementById('income-date').value,
                note: document.getElementById('income-note').value
            };
            db.collection('transactions').doc(newTx.id).set(newTx)
                .then(() => {
                    document.getElementById('income-amount').value = '';
                    document.getElementById('income-note').value = '';
                    alert('Đã thêm khoản thu thành công!');
                })
                .catch(error => {
                    console.error("Lỗi thêm khoản thu:", error);
                    alert("Lỗi thêm khoản thu: " + error.message);
                });
        });
    }

    // Submit Form Chi
    const expenseForm = document.getElementById('expense-form');
    if(expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newTx = {
                id: Date.now().toString(),
                type: 'expense',
                amount: parseFloat(document.getElementById('expense-amount').value.replace(/,/g, '')),
                category: document.getElementById('expense-category').value,
                date: document.getElementById('expense-date').value,
                note: document.getElementById('expense-note').value
            };
            db.collection('transactions').doc(newTx.id).set(newTx)
                .then(() => {
                    document.getElementById('expense-amount').value = '';
                    document.getElementById('expense-note').value = '';
                    alert('Đã thêm khoản chi thành công!');
                })
                .catch(error => {
                    console.error("Lỗi thêm khoản chi:", error);
                    alert("Lỗi thêm khoản chi: " + error.message);
                });
        });
    }

    // Lọc bảng giao dịch
    const incomeFilter = document.getElementById('income-filter-month');
    if(incomeFilter) incomeFilter.addEventListener('change', renderTransactionTables);
    
    const expenseFilter = document.getElementById('expense-filter-month');
    if(expenseFilter) expenseFilter.addEventListener('change', renderTransactionTables);
    
    // Lọc báo cáo
    document.getElementById('report-month-filter').addEventListener('change', updateCharts);

    // Xác thực báo cáo
    const reportsLoginForm = document.getElementById('reports-login-form');
    if (reportsLoginForm) {
        reportsLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('login-username').value;
            const pass = document.getElementById('login-password').value;
            
            if (user === 'nguyenanh2021' && pass === 'hokt1111') {
                isReportsAuthenticated = true;
                document.getElementById('reports-login-container').style.display = 'none';
                document.getElementById('reports-content-container').style.display = 'block';
                updateCharts(); // Vẽ lại biểu đồ khi hiển thị
            } else {
                document.getElementById('login-error').style.display = 'block';
            }
        });
    }

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
});
