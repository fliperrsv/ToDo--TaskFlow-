// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter = 'all';
let searchQuery = '';
let dragStartIndex = null;

// ========== СОХРАНЕНИЕ ==========
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getPriorityText(p) {
    if (p === 'high') return '🔥 Высокий';
    if (p === 'medium') return '⚡ Средний';
    return '🌿 Низкий';
}
function getPriorityClass(p) {
    if (p === 'high') return 'badge-priority-high';
    if (p === 'medium') return 'badge-priority-medium';
    return 'badge-priority-low';
}
function isOverdue(deadline) {
    if (!deadline) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(deadline);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
}
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/\n/g, '<br>');
}

// ========== ОТРИСОВКА ==========
function renderTasks() {
    let filtered = tasks;
    if (currentFilter === 'active') filtered = tasks.filter(t => !t.completed);
    if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);
    if (searchQuery) {
        filtered = filtered.filter(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    const taskList = document.getElementById('taskList');
    if (filtered.length === 0) {
        taskList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i> Нет задач</div>';
        updateStats();
        return;
    }
    taskList.innerHTML = '';
    filtered.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'task-completed' : ''}`;
        li.draggable = true;
        li.setAttribute('data-id', task.id);
        const overdue = !task.completed && isOverdue(task.deadline);
        li.innerHTML = `
            <div class="task-main">
                <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                <span class="task-text">${escapeHtml(task.text)}</span>
                <button class="delete-task" data-id="${task.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="task-meta">
                <span class="badge badge-category"><i class="fas fa-tag"></i> ${task.category || 'Работа'}</span>
                <span class="badge ${getPriorityClass(task.priority)}">${getPriorityText(task.priority)}</span>
                ${task.deadline ? `<span class="badge badge-deadline ${overdue ? 'overdue' : ''}"><i class="fas fa-calendar-alt"></i> ${task.deadline} ${overdue ? '(просрочено!)' : ''}</span>` : ''}
            </div>
        `;
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('drop', handleDrop);
        taskList.appendChild(li);
    });
    updateStats();
    attachTaskEvents();
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    document.getElementById('stats').innerHTML = `📊 Всего: ${total} | ✅ Выполнено: ${completed} | 🔄 Активных: ${active}`;
}

function attachTaskEvents() {
    document.querySelectorAll('.task-check').forEach(cb => {
        cb.removeEventListener('change', handleCheckChange);
        cb.addEventListener('change', handleCheckChange);
    });
    document.querySelectorAll('.delete-task').forEach(btn => {
        btn.removeEventListener('click', handleDeleteClick);
        btn.addEventListener('click', handleDeleteClick);
    });
}

function handleCheckChange(e) {
    const id = parseInt(e.target.dataset.id);
    const task = tasks.find(t => t.id === id);
    if (task) task.completed = e.target.checked;
    saveTasks();
    renderTasks();
}

function handleDeleteClick(e) {
    const id = parseInt(e.target.closest('.delete-task')?.dataset.id);
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
}

// ========== DRAG & DROP ==========
function handleDragStart(e) {
    dragStartIndex = parseInt(e.target.closest('.task-item')?.getAttribute('data-id'));
    e.target.closest('.task-item')?.classList.add('dragging');
}
function handleDragOver(e) {
    e.preventDefault();
}
function handleDrop(e) {
    e.preventDefault();
    const dragEndIndex = parseInt(e.target.closest('.task-item')?.getAttribute('data-id'));
    if (dragStartIndex && dragEndIndex && dragStartIndex !== dragEndIndex) {
        const startIndex = tasks.findIndex(t => t.id === dragStartIndex);
        const endIndex = tasks.findIndex(t => t.id === dragEndIndex);
        if (startIndex !== -1 && endIndex !== -1) {
            const [removed] = tasks.splice(startIndex, 1);
            tasks.splice(endIndex, 0, removed);
            saveTasks();
            renderTasks();
        }
    }
    document.querySelectorAll('.task-item').forEach(item => item.classList.remove('dragging'));
    dragStartIndex = null;
}

// ========== ДОБАВЛЕНИЕ ЗАДАЧИ ==========
function addTask() {
    const text = document.getElementById('taskTitle').value.trim();
    if (!text) return;
    const category = document.getElementById('taskCategory').value;
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    tasks.push({
        id: Date.now(),
        text: text,
        completed: false,
        category: category,
        priority: priority,
        deadline: deadline
    });
    saveTasks();
    renderTasks();
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDeadline').value = '';
}

// ========== ЭКСПОРТ / ИМПОРТ ==========
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_backup_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importTasks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (Array.isArray(imported)) {
                    tasks = imported;
                    saveTasks();
                    renderTasks();
                    alert('✅ Импорт выполнен успешно!');
                } else {
                    alert('❌ Неверный формат файла');
                }
            } catch (err) {
                alert('❌ Ошибка при импорте');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ========== ФИЛЬТРАЦИЯ ==========
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderTasks();
        });
    });
}

// ========== ТЁМНАЯ ТЕМА ==========
function initTheme() {
    const savedTheme = localStorage.getItem('taskTheme');
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').addEventListener('click', () => {
        const isDark = document.documentElement.hasAttribute('data-theme');
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('taskTheme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('taskTheme', 'dark');
        }
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    renderTasks();
    initFilters();
    initTheme();
    document.getElementById('addTaskBtn').addEventListener('click', addTask);
    document.getElementById('taskTitle').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    document.getElementById('clearCompletedBtn').addEventListener('click', () => {
        tasks = tasks.filter(t => !t.completed);
        saveTasks();
        renderTasks();
    });
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTasks();
    });
    document.getElementById('exportBtn').addEventListener('click', exportTasks);
    document.getElementById('importBtn').addEventListener('click', importTasks);
});
