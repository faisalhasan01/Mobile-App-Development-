// ==================== CONFIGURATION & STATE ====================

// Automatically determine backend port
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? window.location.origin 
    : 'http://localhost:8080';

// Local storage session keys
const DB_SESSION_EMAIL_KEY = 'bmi_api_session_email';
const DB_SESSION_NAME_KEY = 'bmi_api_session_name';
const DB_THEME_KEY = 'bmi_api_theme';

// Client-side state
let state = {
    currentUserEmail: null,
    currentUserName: null,
    profiles: [],
    currentProfileIndex: 0,
    activeUnits: {
        weight: 'kg', // 'kg' or 'lb'
        height: 'cm'  // 'cm' or 'in'
    },
    activeGender: 'Male',
    chartInstance: null
};

// Generic API Client Helper
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.currentUserEmail) {
        headers['x-user-email'] = state.currentUserEmail;
    }
    
    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Server returned an error.');
        }
        return data;
    } catch (err) {
        showToast(err.message || 'API request failed.', 'error');
        throw err;
    }
}

// Startup initializations
async function initApp() {
    // Load theme setting
    const storedTheme = localStorage.getItem(DB_THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', storedTheme);
    updateThemeIcon(storedTheme);

    // Default weight entry date
    document.getElementById('log-date-input').value = getTodayDateString();

    // Check session persistence
    const savedEmail = localStorage.getItem(DB_SESSION_EMAIL_KEY);
    const savedName = localStorage.getItem(DB_SESSION_NAME_KEY);

    if (savedEmail && savedName) {
        state.currentUserEmail = savedEmail;
        state.currentUserName = savedName;
        state.currentProfileIndex = 0;
        
        try {
            await fetchProfilesData();
            showDashboardView();
        } catch (e) {
            // If API connection fails on start, clear sessions
            handleLogout();
        }
    } else {
        showAuthView();
    }
}

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}


// ==================== THEME CONTROLLER ====================

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(DB_THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
    
    if (state.chartInstance) {
        renderWeightChart();
    }
    
    showToast(`Switched to ${newTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
}

function updateThemeIcon(theme) {
    const iconBtn = document.getElementById('theme-toggle-icon');
    if (theme === 'dark') {
        iconBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path></svg>`;
    } else {
        iconBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
}


// ==================== TOAST MESSAGES ====================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const msgSpan = document.getElementById('toast-message');
    
    toast.className = `toast-notification toast-${type} show`;
    msgSpan.innerText = message;
    
    if (type === 'success') {
        icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;
    } else if (type === 'error') {
        icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// ==================== AUTHENTICATION HANDLING ====================

function showAuthView() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    switchAuthTab('login');
}

function showDashboardView() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    
    state.activeUnits.weight = 'kg';
    state.activeUnits.height = 'cm';
    updateUnitPillsUI();
    
    loadDashboardContents();
    showToast(`Welcome back, ${state.currentUserName}!`, 'success');
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-form');
    const socialArea = document.getElementById('auth-social-login');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    forgotForm.classList.add('hidden');
    socialArea.classList.remove('hidden');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        authTitle.innerText = "Welcome Back";
        authSubtitle.innerText = "Monitor and manage your fitness journey";
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
        authTitle.innerText = "Join Us";
        authSubtitle.innerText = "Start tracking your BMI and fitness goals";
    }

    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
}

function showForgotPassword() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('forgot-form').classList.remove('hidden');
    document.getElementById('auth-social-login').classList.add('hidden');
    document.getElementById('auth-title').innerText = "Reset Password";
    document.getElementById('auth-subtitle').innerText = "Enter your email to receive recovery instructions";
}

function hideForgotPassword() {
    switchAuthTab('login');
}

// EMAIL AND PASSWORD LOGIN
async function handleEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    const emailError = document.getElementById('login-email-error');
    const passError = document.getElementById('login-password-error');
    emailError.style.display = 'none';
    passError.style.display = 'none';

    if (!validateEmailFormat(email)) {
        emailError.innerText = "Please enter a valid email address.";
        emailError.style.display = 'flex';
        return;
    }

    try {
        const res = await apiRequest('/api/auth/login', 'POST', { email, password });
        
        // Save session
        state.currentUserEmail = res.email;
        state.currentUserName = res.name;
        state.profiles = res.profiles;
        state.currentProfileIndex = 0;

        localStorage.setItem(DB_SESSION_EMAIL_KEY, res.email);
        localStorage.setItem(DB_SESSION_NAME_KEY, res.name);

        showDashboardView();
    } catch (err) {
        // Handled by apiRequest toast
    }
}

// REGISTER NEW USER ACCOUNT
async function handleEmailRegister(event) {
    event.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    const nameError = document.getElementById('signup-name-error');
    const emailError = document.getElementById('signup-email-error');
    const passError = document.getElementById('signup-password-error');
    nameError.style.display = 'none';
    emailError.style.display = 'none';
    passError.style.display = 'none';

    if (name.length < 2) {
        nameError.innerText = "Name must be at least 2 characters.";
        nameError.style.display = 'flex';
        return;
    }

    if (!validateEmailFormat(email)) {
        emailError.innerText = "Please enter a valid email address.";
        emailError.style.display = 'flex';
        return;
    }

    if (password.length < 8) {
        passError.innerText = "Password must be at least 8 characters.";
        passError.style.display = 'flex';
        return;
    }

    try {
        const res = await apiRequest('/api/auth/register', 'POST', { name, email, password });
        
        state.currentUserEmail = res.email;
        state.currentUserName = res.name;
        state.profiles = res.profiles;
        state.currentProfileIndex = 0;

        localStorage.setItem(DB_SESSION_EMAIL_KEY, res.email);
        localStorage.setItem(DB_SESSION_NAME_KEY, res.name);

        showDashboardView();
    } catch (err) {
        // Handled by apiRequest toast
    }
}

// GOOGLE AUTH SIGN IN SIMULATOR
async function handleGoogleLogin() {
    showToast("Connecting to Google Auth...", "info");
    
    setTimeout(async () => {
        try {
            const res = await apiRequest('/api/auth/google', 'POST', {
                email: 'google.user@gmail.com',
                name: 'Google Explorer'
            });

            state.currentUserEmail = res.email;
            state.currentUserName = res.name;
            state.profiles = res.profiles;
            state.currentProfileIndex = 0;

            localStorage.setItem(DB_SESSION_EMAIL_KEY, res.email);
            localStorage.setItem(DB_SESSION_NAME_KEY, res.name);

            showDashboardView();
        } catch (err) {
            // Handled
        }
    }, 1200);
}

// FORGOT PASSWORD SUBMIT SIMULATION
function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const errorDiv = document.getElementById('forgot-email-error');
    errorDiv.style.display = 'none';

    if (!validateEmailFormat(email)) {
        errorDiv.innerText = "Please enter a valid email address.";
        errorDiv.style.display = 'flex';
        return;
    }

    showToast(`Password recovery link sent to ${email}`, 'success');
    setTimeout(() => {
        hideForgotPassword();
    }, 2000);
}

function handleLogout() {
    state.currentUserEmail = null;
    state.currentUserName = null;
    state.profiles = [];
    state.currentProfileIndex = 0;

    localStorage.removeItem(DB_SESSION_EMAIL_KEY);
    localStorage.removeItem(DB_SESSION_NAME_KEY);

    showAuthView();
    showToast("Signed out successfully", "info");
}

function validateEmailFormat(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}


// ==================== DASHBOARD & PROFILES CONTROLLER ====================

async function fetchProfilesData() {
    const res = await apiRequest('/api/profiles', 'GET');
    state.profiles = res.profiles;
}

function getActiveProfile() {
    if (state.profiles && state.profiles.length > 0) {
        return state.profiles[state.currentProfileIndex];
    }
    return null;
}

function loadDashboardContents() {
    // Set user headers
    document.getElementById('current-quick-name').innerText = state.currentUserName;
    document.getElementById('current-quick-avatar').innerText = state.currentUserName.charAt(0).toUpperCase();

    renderProfilesSwitcher();
    loadActiveProfileMetrics();
}

function renderProfilesSwitcher() {
    const container = document.getElementById('profiles-list');
    container.innerHTML = '';

    state.profiles.forEach((profile, index) => {
        const bmi = calculateBMIValue(profile.weight, profile.height).toFixed(1);
        const isActive = index === state.currentProfileIndex;
        const avatarLetter = profile.name.charAt(0).toUpperCase();

        const item = document.createElement('div');
        item.className = `profile-item ${isActive ? 'active' : ''}`;
        item.setAttribute('onclick', `switchActiveProfile(${index})`);
        
        item.innerHTML = `
            <div class="profile-info">
                <div class="profile-avatar">${avatarLetter}</div>
                <div>
                    <div class="profile-name">${profile.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${profile.gender}, ${profile.age} yrs</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="profile-bmi-pill">BMI ${bmi}</span>
                ${state.profiles.length > 1 ? `
                    <button class="profile-delete-btn" onclick="handleDeleteProfile(event, ${index})" title="Delete profile">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

function switchActiveProfile(index) {
    state.currentProfileIndex = index;
    renderProfilesSwitcher();
    loadActiveProfileMetrics();
    showToast(`Switched active profile`, 'info');
}

function loadActiveProfileMetrics() {
    const profile = getActiveProfile();
    if (!profile) return;

    state.activeGender = profile.gender;
    updateGenderUI();
    updateCalculatorRanges();

    // Default metric values from server (height: CM, weight: KG)
    let currentHeight = profile.height;
    let currentWeight = profile.weight;

    if (state.activeUnits.height === 'in') {
        currentHeight = parseFloat((profile.height / 2.54).toFixed(1));
    }
    if (state.activeUnits.weight === 'lb') {
        currentWeight = parseFloat((profile.weight * 2.20462).toFixed(1));
    }

    document.getElementById('slider-height').value = currentHeight;
    document.getElementById('slider-weight').value = currentWeight;

    updateCalculatorInputs();
    runBMICalculation();
    renderWeightLogsList();
    renderWeightChart();
}


// ==================== BMI CALCULATIONS & UNITS ====================

function calculateBMIValue(weightKg, heightCm) {
    if (!weightKg || !heightCm) return 0;
    const heightMeters = heightCm / 100;
    return weightKg / (heightMeters * heightMeters);
}

function getBMICategory(bmi) {
    if (bmi < 18.5) return { category: 'Underweight', class: 'status-underweight', advice: 'Your BMI indicates you are underweight. Consider consulting a nutritionist to build a healthy calorie plan.' };
    if (bmi < 25) return { category: 'Normal Weight', class: 'status-normal', advice: 'Fantastic! You fall within the healthy BMI weight range. Maintain active exercise and hydration.' };
    if (bmi < 30) return { category: 'Overweight', class: 'status-overweight', advice: 'You are slightly above the healthy threshold. Incorporate cardiovascular activities and high-fiber diets.' };
    return { category: 'Obese', class: 'status-obese', advice: 'Your BMI enters the obese threshold. We recommend consulting a healthcare expert for tailored guidance.' };
}

function runBMICalculation() {
    const profile = getActiveProfile();
    if (!profile) return;

    const heightVal = parseFloat(document.getElementById('slider-height').value);
    const weightVal = parseFloat(document.getElementById('slider-weight').value);

    let heightCm = heightVal;
    let weightKg = weightVal;

    if (state.activeUnits.height === 'in') {
        heightCm = heightVal * 2.54;
    }
    if (state.activeUnits.weight === 'lb') {
        weightKg = weightVal * 0.453592;
    }

    const bmi = calculateBMIValue(weightKg, heightCm);
    document.getElementById('bmi-display-value').innerText = bmi.toFixed(1);

    const categoryInfo = getBMICategory(bmi);
    const statusPill = document.getElementById('bmi-display-status');
    statusPill.innerText = categoryInfo.category;
    statusPill.className = `result-status-pill ${categoryInfo.class}`;
    document.getElementById('bmi-display-advice').innerText = categoryInfo.advice;

    const minBMI = 15;
    const maxBMI = 40;
    let percentage = ((bmi - minBMI) / (maxBMI - minBMI)) * 100;
    percentage = Math.max(2, Math.min(98, percentage));
    
    document.getElementById('bmi-indicator').style.left = `${percentage}%`;
    document.getElementById('bmi-glow').style.background = getThemeGlowColor(categoryInfo.category);
}

function getThemeGlowColor(category) {
    if (category === 'Underweight') return 'var(--warning)';
    if (category === 'Normal Weight') return 'var(--normal)';
    if (category === 'Overweight') return 'var(--warning)';
    return 'var(--danger)';
}

function changeUnits(type, unit) {
    if (state.activeUnits[type] === unit) return;

    state.activeUnits[type] = unit;
    updateUnitPillsUI();
    updateCalculatorRanges();

    const slider = document.getElementById(`slider-${type}`);
    let val = parseFloat(slider.value);

    if (type === 'height') {
        val = (unit === 'in') ? (val / 2.54) : (val * 2.54);
    } else {
        val = (unit === 'lb') ? (val * 2.20462) : (val / 2.20462);
    }

    slider.value = val.toFixed(1);

    updateCalculatorInputs();
    runBMICalculation();
    renderWeightLogsList();
    renderWeightChart();
}

function updateUnitPillsUI() {
    document.getElementById('unit-w-kg').className = state.activeUnits.weight === 'kg' ? 'toggle-pill-btn active' : 'toggle-pill-btn';
    document.getElementById('unit-w-lb').className = state.activeUnits.weight === 'lb' ? 'toggle-pill-btn active' : 'toggle-pill-btn';

    document.getElementById('unit-h-cm').className = state.activeUnits.height === 'cm' ? 'toggle-pill-btn active' : 'toggle-pill-btn';
    document.getElementById('unit-h-in').className = state.activeUnits.height === 'in' ? 'toggle-pill-btn active' : 'toggle-pill-btn';
}

function updateCalculatorRanges() {
    const heightSlider = document.getElementById('slider-height');
    const weightSlider = document.getElementById('slider-weight');

    if (state.activeUnits.height === 'cm') {
        heightSlider.min = 100;
        heightSlider.max = 220;
        heightSlider.step = 1;
        document.getElementById('height-unit-label').innerText = 'cm';
    } else {
        heightSlider.min = 40;
        heightSlider.max = 86;
        heightSlider.step = 0.5;
        document.getElementById('height-unit-label').innerText = 'in';
    }

    if (state.activeUnits.weight === 'kg') {
        weightSlider.min = 30;
        weightSlider.max = 150;
        weightSlider.step = 1;
        document.getElementById('weight-unit-label').innerText = 'kg';
        document.getElementById('log-weight-icon-unit').innerText = 'kg';
    } else {
        weightSlider.min = 66;
        weightSlider.max = 330;
        weightSlider.step = 1;
        document.getElementById('weight-unit-label').innerText = 'lbs';
        document.getElementById('log-weight-icon-unit').innerText = 'lbs';
    }
}

function updateCalculatorInputs() {
    document.getElementById('height-val').innerText = parseFloat(document.getElementById('slider-height').value);
    document.getElementById('weight-val').innerText = parseFloat(document.getElementById('slider-weight').value);
    runBMICalculation();
}

function changeGender(gender) {
    state.activeGender = gender;
    updateGenderUI();
}

function updateGenderUI() {
    document.getElementById('gender-male').className = state.activeGender === 'Male' ? 'gender-btn active' : 'gender-btn';
    document.getElementById('gender-female').className = state.activeGender === 'Female' ? 'gender-btn active' : 'gender-btn';
    document.getElementById('gender-other').className = state.activeGender === 'Other' ? 'gender-btn active' : 'gender-btn';
}

// SAVE DETAILED METRIC CHANGES TO API
async function saveProfileMetrics() {
    const heightVal = parseFloat(document.getElementById('slider-height').value);
    const weightVal = parseFloat(document.getElementById('slider-weight').value);

    let heightCm = heightVal;
    let weightKg = weightVal;

    if (state.activeUnits.height === 'in') {
        heightCm = parseFloat((heightVal * 2.54).toFixed(1));
    }
    if (state.activeUnits.weight === 'lb') {
        weightKg = parseFloat((weightVal * 0.453592).toFixed(1));
    }

    try {
        const res = await apiRequest(`/api/profiles/${state.currentProfileIndex}`, 'PUT', {
            height: heightCm,
            weight: weightKg,
            gender: state.activeGender
        });
        
        state.profiles = res.profiles;
        renderProfilesSwitcher();
        renderWeightLogsList();
        renderWeightChart();
        showToast('Profile metrics saved!', 'success');
    } catch (e) {
        // Handled
    }
}


// ==================== MULTI-USER MANAGEMENT ====================

function openAddProfileModal() {
    document.getElementById('add-profile-modal').style.display = 'flex';
}

function closeAddProfileModal() {
    document.getElementById('add-profile-modal').style.display = 'none';
    document.getElementById('new-profile-name').value = '';
    document.getElementById('new-profile-age').value = '';
    document.getElementById('new-profile-height').value = '';
    document.getElementById('new-profile-weight').value = '';
}

async function handleAddProfileSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('new-profile-name').value.trim();
    const age = parseInt(document.getElementById('new-profile-age').value);
    const height = parseFloat(document.getElementById('new-profile-height').value);
    const weight = parseFloat(document.getElementById('new-profile-weight').value);
    const gender = document.getElementById('new-profile-gender').value;

    try {
        const res = await apiRequest('/api/profiles', 'POST', {
            name, age, height, weight, gender
        });
        
        state.profiles = res.profiles;
        state.currentProfileIndex = state.profiles.length - 1;
        
        closeAddProfileModal();
        loadDashboardContents();
        showToast(`Profile "${name}" successfully created!`, 'success');
    } catch (e) {
        // Handled
    }
}

async function handleDeleteProfile(event, index) {
    event.stopPropagation();

    if (state.profiles.length <= 1) {
        showToast("Cannot delete the only profile.", "error");
        return;
    }

    const pName = state.profiles[index].name;
    if (confirm(`Are you sure you want to delete profile "${pName}"?`)) {
        try {
            const res = await apiRequest(`/api/profiles/${index}`, 'DELETE');
            state.profiles = res.profiles;
            
            if (state.currentProfileIndex >= state.profiles.length) {
                state.currentProfileIndex = state.profiles.length - 1;
            }

            loadDashboardContents();
            showToast(`Profile "${pName}" deleted`, 'info');
        } catch (e) {
            // Handled
        }
    }
}


// ==================== LOGS & ANALYTICS GRAPH ====================

function renderWeightLogsList() {
    const profile = getActiveProfile();
    const container = document.getElementById('weight-logs-list');
    container.innerHTML = '';

    if (!profile || !profile.weightHistory) return;

    const sortedHistory = [...profile.weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedHistory.forEach(log => {
        let weightVal = log.weight;
        let label = 'kg';

        if (state.activeUnits.weight === 'lb') {
            weightVal = parseFloat((log.weight * 2.20462).toFixed(1));
            label = 'lbs';
        }

        const dateObj = new Date(log.date);
        const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

        const row = document.createElement('div');
        row.className = 'log-row';
        row.innerHTML = `
            <span class="log-date">${displayDate}</span>
            <div style="display: flex; align-items: center; gap: 14px;">
                <span class="log-weight-val">${weightVal} ${label}</span>
                <button type="button" class="log-delete-btn" onclick="handleDeleteLog('${log.date}')" title="Delete log">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

// LOG AN ENTRY VIA API
async function handleAddWeightLog(event) {
    event.preventDefault();
    const weightInput = parseFloat(document.getElementById('log-weight-input').value);
    const dateInput = document.getElementById('log-date-input').value;

    if (!weightInput || !dateInput) {
        showToast("Invalid weight or date logs.", "error");
        return;
    }

    let finalWeightKg = weightInput;
    if (state.activeUnits.weight === 'lb') {
        finalWeightKg = parseFloat((weightInput * 0.453592).toFixed(1));
    }

    try {
        const res = await apiRequest(`/api/profiles/${state.currentProfileIndex}/logs`, 'POST', {
            weight: finalWeightKg,
            date: dateInput
        });
        
        state.profiles = res.profiles;
        renderWeightLogsList();
        renderWeightChart();
        
        document.getElementById('log-weight-input').value = '';
        showToast("Weight log added!", "success");
    } catch (e) {
        // Handled
    }
}

// DELETE AN ENTRY VIA API
async function handleDeleteLog(dateStr) {
    try {
        const res = await apiRequest(`/api/profiles/${state.currentProfileIndex}/logs/${dateStr}`, 'DELETE');
        state.profiles = res.profiles;
        
        renderWeightLogsList();
        renderWeightChart();
        showToast("Log entry removed", "info");
    } catch (e) {
        // Handled
    }
}

// Draw Weight history Chart using Chart.js
function renderWeightChart() {
    const canvas = document.getElementById('weightHistoryChart');
    if (!canvas) return;

    const profile = getActiveProfile();
    if (!profile || !profile.weightHistory) return;

    const filteredHistory = [...profile.weightHistory]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-7);

    const labels = filteredHistory.map(h => {
        const dateObj = new Date(h.date);
        return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    });

    const dataPoints = filteredHistory.map(h => {
        if (state.activeUnits.weight === 'lb') {
            return parseFloat((h.weight * 2.20462).toFixed(1));
        }
        return h.weight;
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const lineColor = '#8b5cf6';
    const fillGradientColorStart = isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.15)';
    const fillGradientColorEnd = 'rgba(139, 92, 246, 0)';

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, fillGradientColorStart);
    gradient.addColorStop(1, fillGradientColorEnd);

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Weight (${state.activeUnits.weight.toUpperCase()})`,
                data: dataPoints,
                borderColor: lineColor,
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: lineColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    titleColor: isDark ? '#ffffff' : '#0f172a',
                    bodyColor: isDark ? '#d1d5db' : '#475569',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    displayColors: false,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} ${state.activeUnits.weight.toUpperCase()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 11 }
                    }
                }
            }
        }
    });
}


// Initiate application on DOM Load
window.addEventListener('DOMContentLoaded', initApp);
