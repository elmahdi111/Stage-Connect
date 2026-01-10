// StageConnect SPA extracted from indexlib2.html
// This file contains the application logic. To open a specific page on load,
// set `window.__initialPage = 'home'` (or 'listings', 'detail', 'login', 'profile', 'apply', 'success', 'employer')

// --- Data & State ---
const state = {
    currentPage: 'home',
    lang: 'fr',
    user: null,
    userType: 'trainee', // 'trainee' or 'employer'
    selectedJob: null,
    searchTerm: '',
    selectedRegion: '',
    traineeApplications: [],
    notifications: [], // Store active notifications
    selectedApplicationIds: new Set(), // Track selected apps for bulk delete
    selectedOfferIds: new Set() // Track selected offers for bulk delete (admin)
};

// Track pending like requests to avoid double submits
const pendingLikes = new Set();

// --- Notifications disabled ---
// Notifications removed by user request. Provide a minimal safe stub so existing calls don't break.
const notificationSystem = {
    config: { soundEnabled: false, persistHistory: false, maxActive: 5, maxHistory: 50 },
    show(message, type='info', options={}) { console.log('[notification]', type, message); return Date.now(); },
    success(message, ...rest) { return this.show(message, 'success'); },
    error(message, ...rest) { return this.show(message, 'error'); },
    warning(message, ...rest) { return this.show(message, 'warning'); },
    info(message, ...rest) { return this.show(message, 'info'); },
    required(field, ...rest) { return this.show(field + ' is required', 'warning'); },
    loading(message, ...rest) { return this.show(message, 'info'); },
    update(id, updates) { /* noop */ },
    remove(id) { /* noop */ },
    clear() { /* noop */ },
    getHistory() { return []; },
    executeAction(id) { /* noop */ },
    toggleSound() { this.config.soundEnabled = !this.config.soundEnabled; return this.config.soundEnabled; },
    toggleCenter() { /* noop */ },
    _saveHistory() { /* noop */ },
    _loadHistory() { /* noop */ },
    playSound() { /* noop */ }
};

function renderNotifications() {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    container.innerHTML = '';
}

// --- Notifications: client polling and UI helpers (DB-backed) ---
let __notificationsPollTimer = null;
async function fetchServerNotifications() {
    try {
        const res = await fetch('api/notifications.php', { credentials: 'same-origin' });
        const j = await res.json();
        if (!j.success) return;
        // normalize to expected fields
        state.notifications = (j.data || []).map(n => ({
            id: n.id,
            actor_id: n.actor_id,
            type: n.type,
            title: n.title,
            body: n.body,
            message: n.title || n.body || '',
            data: n.data || null,
            read_at: n.read_at,
            created_at: n.created_at
        }));
        state.unreadCount = j.unread || 0;
        // re-render navigation to update badge
        try { renderNavigation(); if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch(e){}
    } catch (e) {
        // network errors ignored
        console.error('fetchServerNotifications error', e);
    }
}

function startNotificationsPolling(intervalMs = 8000) {
    stopNotificationsPolling();
    // initial fetch
    fetchServerNotifications();
    __notificationsPollTimer = setInterval(fetchServerNotifications, intervalMs);
}

function stopNotificationsPolling() {
    if (__notificationsPollTimer) { clearInterval(__notificationsPollTimer); __notificationsPollTimer = null; }
}

function toggleNotificationDropdown() {
    const el = document.getElementById('notification-dropdown');
    if (!el) return;
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        // mark as open; ensure latest notifications shown
        renderNotificationDropdown();
    } else {
        el.classList.add('hidden');
    }
}

function renderNotificationDropdown() {
    const el = document.getElementById('notification-dropdown');
    if (!el) return;
    const t = translations[state.lang];
    if (!state.notifications || state.notifications.length === 0) {
        el.innerHTML = `<div class="p-4 text-center text-slate-400 text-sm">${t.noNotifications || 'No notifications'}</div>`;
        return;
    }
    const items = state.notifications.map((notif, idx) => `
        <div class="p-3 border-b border-slate-700 hover:bg-slate-700/50 transition flex justify-between items-start gap-2">
            <div class="flex-1">
                <p class="text-sm text-white">${escapeHtml(notif.message || notif.title || notif.body)}</p>
                <div class="text-xs text-slate-400">${new Date(notif.created_at).toLocaleString()}</div>
            </div>
            <div class="ml-2 flex flex-col gap-2">
                <button onclick="markNotificationRead(${notif.id})" class="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Mark read</button>
            </div>
        </div>`).join('');
    el.innerHTML = `
        <div class="p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800">
            <h3 class="font-bold text-white">${t.notifications || 'Notifications'}</h3>
            <button onclick="clearAllNotifications()" class="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded transition">Mark all read</button>
        </div>
        ${items}
    `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) setTimeout(() => lucide.createIcons(), 0);
}

async function markNotificationRead(notifId) {
    try {
        const fd = new FormData(); fd.append('notification_id', notifId);
        const res = await fetch('api/notifications_mark_read.php', { method: 'POST', body: fd, credentials: 'same-origin' });
        const j = await res.json();
        if (!j.success) return;
        // refresh
        await fetchServerNotifications();
        renderNotificationDropdown();
    } catch (e) { console.error(e); }
}

async function clearAllNotifications() {
    try {
        const res = await fetch('api/notifications_mark_all_read.php', { method: 'POST', credentials: 'same-origin' });
        const j = await res.json();
        if (!j.success) return;
        await fetchServerNotifications();
        renderNotificationDropdown();
    } catch (e) { console.error(e); }
}

// Restore language from localStorage - French is default, but user selection persists
try {
    const savedLang = localStorage.getItem('sc_lang');
    if (savedLang && ['ar','fr','en'].includes(savedLang)) state.lang = savedLang;
} catch (e) {
    // localStorage may be unavailable in some environments
}

// Load hotel ratings and render stars
function loadHotelRatings(hotelName) {
    if (!hotelName) return;
    const starsContainer = document.getElementById('hotel-rating-stars');
    const avgEl = document.getElementById('hotel-rating-avg');
    const countEl = document.getElementById('hotel-rating-count');
    if (!starsContainer) return;

    // show loading placeholder
    starsContainer.innerHTML = 'Loading...';
    fetch(`api/get_ratings.php?hotel=${encodeURIComponent(hotelName)}`)
        .then(r => r.json())
        .then(j => {
            if (!j.success) {
                starsContainer.innerHTML = '';
                return;
            }
            const avg = parseFloat(j.avg) || 0;
            const count = parseInt(j.count) || 0;
            const myRating = j.my_rating || 0;
            avgEl && (avgEl.textContent = `${avg.toFixed(1)} ⭐`);
            countEl && (countEl.textContent = `${count} ${count===1? 'rating':'ratings'}`);
            // render interactive stars
            renderRatingStars(starsContainer, hotelName, myRating, avg);
        }).catch(err => {
            console.error('Rating load error', err);
            starsContainer.innerHTML = '';
        });
}

function renderRatingStars(container, hotelName, myRating, avg) {
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'px-1';
        btn.title = `Rate ${i} star${i>1?'s':''}`;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="${i <= (myRating || Math.round(avg)) ? '#F59E0B' : 'none'}" stroke="#F59E0B"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.972a1 1 0 00.95.69h4.178c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.973c.3.921-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.176 0l-3.38 2.455c-.784.57-1.84-.197-1.54-1.118l1.286-3.973a1 1 0 00-.364-1.118L2.046 9.4c-.783-.57-.38-1.81.588-1.81h4.178a1 1 0 00.95-.69L11.05 2.927z"/></svg>`;
        // click to rate
        btn.addEventListener('click', () => {
            submitHotelRating(hotelName, i);
        });
        container.appendChild(btn);
    }
}

function submitHotelRating(hotelName, rating) {
    if (!hotelName) return alert('Hotel not specified');
    if (!confirm('Submit your rating?')) return;
    const fd = new FormData();
    fd.append('hotel', hotelName);
    fd.append('rating', rating);
    fetch('api/submit_rating.php', { method: 'POST', body: fd }).then(r => r.json()).then(j => {
        if (!j.success) {
            if (j.error) alert(j.error); else alert('Failed to submit rating');
            return;
        }
        // refresh ratings
        loadHotelRatings(hotelName);
    }).catch(err => { console.error('submit rating', err); alert('Error submitting rating'); });
}

// State for offer modal (create/edit)
let offerModalState = { mode: null, id: null };

const translations = {
    ar: {
        home: "الرئيسية",
        listings: "عروض التدريب",
        login: "تسجيل الدخول",
        logout: "تسجيل الخروج",
        profile: "ملفي الشخصي",
        dashboard: "لوحة التحكم",
        heroTitle: "ابحث عن فترة تدريبك في",
        heroHighlight: "أفخم فنادق أكادير",
        heroDesc: "المنصة الرسمية لربط متدربي التكوين المهني (OFPPT) والمؤسسات التابعة له بأفضل المؤسسات السياحية في أكادير.",
        browse: "تصفح العروض",
        iamHotel: "أنا فندق / مُشغّل",
        searchPlaceholder: "ابحث عن اسم الفندق أو التخصص...",
        searchBtn: "بحث",
        latestOffers: "أحدث فرص التدريب",
        applyNow: "تقدم الآن",
        details: "التفاصيل",
        welcomeBack: "مرحباً بك مجدداً",
        loginDesc: "سجل الدخول للوصول إلى حسابك.",
        fullName: "الاسم الكامل",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        rememberMe: "تذكرني",
        noAccount: "ليس لديك حساب؟",
        alreadyAccount: "هل لديك حساب بالفعل؟",
        createAccount: "أنشئ حساباً جديداً",
        myApplications: "طلباتي",
        status: "الحالة",
        pending: "قيد المعالجة",
        approved: "مقبول",
        rejected: "مرفوض",
        applicationDate: "تاريخ الطلب",
        footerDesc: "منصة مخصصة لمتدربي التكوين المهني ومكتب التكوين المهني وإنعاش الشغل (OFPPT) الباحثين عن فرص تدريب.",
        allRegions: "كل المناطق",
        allDepts: "كل الأقسام",
        regions: { "Zone Touristique": "المنطقة السياحية", "Taghazout Bay": "تغازوت باي", "Agadir Centre": "وسط المدينة", "Imi Ouaddar": "إمي وادار" },
        requirements: "المتطلبات",
        summary: "ملخص",
        durationLabel: "المدة",
        typeLabel: "القسم",
        mapLink: "الخريطة",
        reqList: ["مظهر وسلوك مهني.", "مسجل حالياً في تخصص الفندقة.", "متاح طوال فترة التدريب."],
        // Columns
        colHotel: "الفندق",
        colRole: "المنصب",
        // Employer Specific
        employerDashboard: "لوحة تحكم المشغل",
        receivedApps: "الطلبات الواردة",
        applicant: "المترشح",
        position: "المنصب",
        actions: "إجراءات",
        viewCV: "عرض CV",
        accept: "قبول",
        reject: "رفض",
        loginAsTrainee: "دخول كمتدرب",
        loginAsEmployer: "دخول كفندق",
        downloadCV: "تحميل السيرة الذاتية",
        cvPreview: "معاينة الملف",
        skills: "المهارات",
        education: "التعليم",
        close: "إغلاق",
        noApps: "لا توجد طلبات حتى الآن.",
        createOffer: "إضافة عرض",
        saveOffer: "حفظ",
        cancel: "إلغاء",
        offerTitle: "عنوان العرض",
        offerDesc: "وصف العرض",
        offerLocation: "الموقع",
        offerDuration: "المدة",
        offerJobType: "المنصب",
        offerStartDate: "تاريخ البدء",
        image: "الصورة",
        days: "أيام",
        weeks: "أسابيع",
        months: "أشهر",
        years: "سنوات",
        edit: "تعديل",
        delete: "حذف",
        phone: "الهاتف",
        institution: "المؤسسة / المدرسة",
        clearFilters: "مسح الفلاتر",
        noResultsFound: "لم يتم العثور على نتائج",
        tryAdjusting: "حاول تعديل البحث أو المرشحات",
        uploadCV: "رفع السيرة الذاتية",
        pdfOrDocx: "PDF أو DOCX (الحد الأقصى 5MB)",
        submitApplication: "إرسال الطلب",
        premiumInternships: "فرص تدريب متميزة في المغرب",
        createProfileTitle: "إنشاء ملف شخصي",
        createProfileDesc: "بناء ملف شخصي احترافي يعرض مهاراتك.",
        searchOpportunitiesTitle: "البحث عن الفرص",
        searchOpportunitiesDesc: "البحث من خلال العروض التدريبية الحصرية.",
        getHiredTitle: "احصل على وظيفة",
        getHiredDesc: "قدم طلبك مباشرة من خلال منصتنا.",
        isRequired: "مطلوب",
        applicationStatusChanged: "تم تحديث حالة طلبك",
        applicationApproved: "تم قبول طلبك!",
        applicationRejected: "للأسف، تم رفض طلبك",
        postLiked: "أعجب شخص ما بمنشورك",
        fillAllFields: "يرجى ملء جميع الحقول المطلوبة",
        notifications: "الإشعارات",
        noNotifications: "لا توجد إشعارات",
        social: "الشبكة الاجتماعية",
        feed: "الخلاصة",
        discover: "استكشف",
        follow: "متابعة",
        following: "متابع",
        followers: "المتابعون",
        unfollow: "إلغاء المتابعة",
        posts: "المنشورات",
        writePost: "اكتب منشورًا...",
        shareYourThoughts: "شارك أفكارك مع المجتمع",
        noPostsYet: "لا توجد منشورات حتى الآن",
        startFollowing: "ابدأ في متابعة الأشخاص"
    },
    fr: {
        home: "Accueil",
        listings: "Offres de Stage",
        login: "Se connecter",
        logout: "Déconnexion",
        profile: "Mon Profil",
        dashboard: "Tableau de bord",
        heroTitle: "Trouvez votre stage dans les",
        heroHighlight: "meilleurs hôtels d'Agadir",
        heroDesc: "La plateforme de référence connectant les stagiaires de la Formation Professionnelle (OFPPT) aux meilleurs établissements hôteliers.",
        browse: "Voir les offres",
        iamHotel: "Espace Recruteur",
        searchPlaceholder: "Rechercher un hôtel ou un poste...",
        searchBtn: "Rechercher",
        latestOffers: "Dernières offres de stage",
        applyNow: "Postuler maintenant",
        details: "Détails",
        welcomeBack: "Bon retour",
        loginDesc: "Connectez-vous pour accéder à votre compte.",
        fullName: "Nom Complet",
        email: "Email",
        password: "Mot de passe",
        rememberMe: "Se souvenir de moi",
        noAccount: "Pas de compte ?",
        alreadyAccount: "Vous avez déjà un compte ?",
        createAccount: "Créer un compte",
        myApplications: "Mes candidatures",
        status: "Statut",
        pending: "En cours",
        approved: "Accepté",
        rejected: "Refusé",
        applicationDate: "Date de demande",
        footerDesc: "Une plateforme dédiée aux stagiaires de l'OFPPT et ses établissements affiliés cherchant des stages.",
        allRegions: "Toutes les régions",
        allDepts: "Tous les départements",
        regions: { "Zone Touristique": "Zone Touristique", "Taghazout Bay": "Taghazout Bay", "Agadir Centre": "Centre Ville", "Imi Ouaddar": "Imi Ouaddar" },
        requirements: "Prérequis",
        summary: "Résumé",
        durationLabel: "Durée",
        typeLabel: "Département",
        mapLink: "Carte",
        reqList: ["Présentation et attitude professionnelles.", "Actuellement inscrit en gestion hôtelière.", "Disponible pour la durée du stage."],
        // Columns
        colHotel: "Hôtel",
        colRole: "Poste",
        // Employer Specific
        employerDashboard: "Espace Recruteur",
        receivedApps: "Candidatures Reçues",
        applicant: "Candidat",
        position: "Poste",
        actions: "Actions",
        viewCV: "Voir CV",
        accept: "Accepter",
        reject: "Refuser",
        loginAsTrainee: "Espace Stagiaire",
        loginAsEmployer: "Espace Hôtel",
        downloadCV: "Télécharger CV",
        cvPreview: "Aperçu du fichier",
        skills: "Compétences",
        education: "Éducation",
        close: "Fermer",
        noApps: "Aucune candidature pour le moment.",
        createOffer: "Créer une offre",
        saveOffer: "Enregistrer",
        cancel: "Annuler",
        offerTitle: "Titre de l'offre",
        offerDesc: "Description",
        offerLocation: "Lieu",
        offerDuration: "Durée",
        offerJobType: "Poste",
        offerStartDate: "Date de début",
        image: "Image",
        days: "Jours",
        weeks: "Semaines",
        months: "Mois",
        years: "Ans",
        edit: "Modifier",
        delete: "Supprimer",
        phone: "Téléphone",
        institution: "Institution / Établissement",
        clearFilters: "Effacer les filtres",
        noResultsFound: "Aucun résultat trouvé",
        tryAdjusting: "Essayez d'ajuster votre recherche ou vos filtres.",
        uploadCV: "Télécharger votre CV",
        pdfOrDocx: "PDF ou DOCX (Max 5MB)",
        submitApplication: "Soumettre la candidature",
        premiumInternships: "Stages premium au Maroc",
        createProfileTitle: "Créer un profil",
        createProfileDesc: "Construisez un profil professionnel qui met en valeur vos compétences.",
        searchOpportunitiesTitle: "Rechercher des opportunités",
        searchOpportunitiesDesc: "Filtrez les offres de stage exclusives.",
        getHiredTitle: "Obtenir un stage",
        getHiredDesc: "Postulez directement via notre plateforme.",
        isRequired: "est requis",
        applicationStatusChanged: "Votre candidature a été mise à jour",
        applicationApproved: "Votre candidature a été acceptée!",
        applicationRejected: "Malheureusement, votre candidature a été refusée",
        postLiked: "Quelqu'un a aimé votre publication",
        fillAllFields: "Veuillez remplir tous les champs requis",
        notifications: "Notifications",
        noNotifications: "Pas de notifications",
        social: "Réseau social",
        feed: "Fil d'actualité",
        discover: "Découvrir",
        follow: "Suivre",
        following: "Suivi",
        followers: "Abonnés",
        unfollow: "Ne plus suivre",
        posts: "Publications",
        writePost: "Écrivez une publication...",
        shareYourThoughts: "Partagez vos pensées avec la communauté",
        noPostsYet: "Aucune publication pour le moment",
        startFollowing: "Commencez à suivre des personnes"
    },
    en: {
        home: "Home",
        listings: "Internships",
        login: "Login",
        logout: "Logout",
        profile: "My Profile",
        dashboard: "Dashboard",
        heroTitle: "Find your internship at",
        heroHighlight: "Agadir's finest hotels",
        heroDesc: "The official platform connecting Vocational Training (OFPPT) trainees with top tourism establishments in Agadir.",
        browse: "Browse Offers",
        iamHotel: "I am a Hotel",
        searchPlaceholder: "Search hotel or position...",
        searchBtn: "Search",
        latestOffers: "Latest Internship Opportunities",
        applyNow: "Apply Now",
        details: "Details",
        welcomeBack: "Welcome Back",
        loginDesc: "Login to access your account.",
        fullName: "Full Name",
        email: "Email",
        password: "Password",
        rememberMe: "Remember me",
        noAccount: "No account?",
        alreadyAccount: "Already have an account?",
        createAccount: "Create new account",
        myApplications: "My Applications",
        status: "Status",
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        applicationDate: "Date Applied",
        footerDesc: "Dedicated to OFPPT vocational training trainees seeking internship opportunities.",
        allRegions: "All Regions",
        allDepts: "All Departments",
        regions: { "Zone Touristique": "Tourist Zone", "Taghazout Bay": "Taghazout Bay", "Agadir Centre": "City Center", "Imi Ouaddar": "Imi Ouaddar" },
        requirements: "Requirements",
        summary: "Summary",
        durationLabel: "Duration",
        typeLabel: "Department",
        mapLink: "Map",
        reqList: ["Professional appearance and attitude.", "Currently enrolled in Hospitality Management.", "Available for the internship duration."],
        // Columns
        colHotel: "Hotel",
        colRole: "Role",
        // Employer Specific
        employerDashboard: "Employer Dashboard",
        receivedApps: "Received Applications",
        applicant: "Applicant",
        position: "Position",
        actions: "Actions",
        viewCV: "View CV",
        accept: "Accept",
        reject: "Reject",
        loginAsTrainee: "Trainee Login",
        loginAsEmployer: "Hotel Login",
        downloadCV: "Download CV",
        cvPreview: "File Preview",
        skills: "Skills",
        education: "Education",
        close: "Close",
        noApps: "No applications yet.",
        createOffer: "Create Offer",
        saveOffer: "Save",
        cancel: "Cancel",
        offerTitle: "Offer Title",
        offerDesc: "Description",
        offerLocation: "Location",
        offerDuration: "Duration",
        offerJobType: "Job Position",
        offerStartDate: "Start Date",
        image: "Image",
        days: "Days",
        weeks: "Weeks",
        months: "Months",
        years: "Years",
        edit: "Edit",
        delete: "Delete",
        phone: "Phone",
        institution: "Institution / School",
        clearFilters: "Clear Filters",
        noResultsFound: "No results found",
        tryAdjusting: "Try adjusting your search or filters.",
        uploadCV: "Upload your CV",
        pdfOrDocx: "PDF or DOCX (Max 5MB)",
        submitApplication: "Submit Application",
        premiumInternships: "Premium Internships in Morocco",
        createProfileTitle: "Create Profile",
        createProfileDesc: "Build a professional profile that showcases your skills.",
        searchOpportunitiesTitle: "Search Opportunities",
        searchOpportunitiesDesc: "Filter through exclusive internship offers.",
        getHiredTitle: "Get Hired",
        getHiredDesc: "Apply directly through our platform.",
        isRequired: "is required",
        applicationStatusChanged: "Your application status has been updated",
        applicationApproved: "Your application has been approved!",
        applicationRejected: "Unfortunately, your application was rejected",
        postLiked: "Someone liked your post",
        fillAllFields: "Please fill all required fields",
        notifications: "Notifications",
        noNotifications: "No notifications",
        social: "Social Network",
        feed: "Feed",
        discover: "Discover",
        follow: "Follow",
        following: "Following",
        followers: "Followers",
        unfollow: "Unfollow",
        posts: "Posts",
        writePost: "Write a post...",
        shareYourThoughts: "Share your thoughts with the community",
        noPostsYet: "No posts yet",
        startFollowing: "Start following people"
    }
};

// Predefined job titles for hotels
const hotelJobTitles = [
    { ar: "مدير الفندق", fr: "Directeur d'Hôtel", en: "Hotel Manager" },
    { ar: "مدير الاستقبال", fr: "Chef de Réception", en: "Front Office Manager" },
    { ar: "موظف استقبال", fr: "Réceptionniste", en: "Receptionist" },
    { ar: "نادل/نادلة", fr: "Serveur/Serveuse", en: "Waiter/Waitress" },
    { ar: "شيف الطبخ", fr: "Chef Cuisinier", en: "Head Chef" },
    { ar: "مساعد طبخ", fr: "Commis de Cuisine", en: "Kitchen Assistant" },
    { ar: "مشرف تنظيف", fr: "Chef de Rang", en: "Housekeeping Supervisor" },
    { ar: "عامل تنظيف", fr: "Femme/Valet de Chambre", en: "Housekeeper" },
    { ar: "أمين الصندوق", fr: "Caissier", en: "Cashier" },
    { ar: "محاسب", fr: "Comptable", en: "Accountant" },
    { ar: "موظف إداري", fr: "Commis Administratif", en: "Administrative Staff" },
    { ar: "حارس الأمن", fr: "Agent de Sécurité", en: "Security Guard" },
    { ar: "سائق", fr: "Chauffeur", en: "Driver" },
    { ar: "عامل في السبا", fr: "Agent Spa", en: "Spa Therapist" },
    { ar: "مدير المبيعات", fr: "Responsable Commercial", en: "Sales Manager" },
    { ar: "موظف خدمة العملاء", fr: "Agent de Client", en: "Customer Service Staff" }
];

// Duration units in all languages
const durationUnits = [
    { ar: "أيام", fr: "Jours", en: "Days" },
    { ar: "أسابيع", fr: "Semaines", en: "Weeks" },
    { ar: "أشهر", fr: "Mois", en: "Months" },
    { ar: "سنوات", fr: "Ans", en: "Years" }
];

let internships = [
    { id: 1, title: { ar: "متدرب في قسم الاستقبال", fr: "Stagiaire Réception", en: "Front Office Trainee" }, hotel: "Royal Atlas Agadir", location: "Zone Touristique", type: { ar: "استقبال", fr: "Réception", en: "Front Office" }, duration: { ar: "3 أشهر", fr: "3 Mois", en: "3 Months" }, rating: 5, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000", description: { ar: "نبحث عن متدربين شغوفين للانضمام لفريق الاستقبال.", fr: "Nous recherchons des stagiaires passionnés.", en: "Looking for passionate trainees." } },
    { id: 2, title: { ar: "مساعد شيف", fr: "Commis de Cuisine", en: "Kitchen Assistant" }, hotel: "Sofitel Agadir Thalassa", location: "Agadir Centre", type: { ar: "طبخ", fr: "Cuisine", en: "Cuisine" }, duration: { ar: "6 أشهر", fr: "6 Mois", en: "6 Months" }, rating: 5, image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=1000", description: { ar: "فرصة للتدرب في مطبخ عالمي.", fr: "Opportunité de stage dans une cuisine internationale.", en: "Opportunity to train in a world-class kitchen." } },
    { id: 3, title: { ar: "خدمة الغرف", fr: "Femme/Valet de Chambre", en: "Housekeeping" }, hotel: "Hyatt Regency Taghazout", location: "Taghazout Bay", type: { ar: "تدبير فندقي", fr: "Housekeeping", en: "Housekeeping" }, duration: { ar: "4 أشهر", fr: "4 Mois", en: "4 Months" }, rating: 5, image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000", description: { ar: "تعلم أصول التدبير الفندقي.", fr: "Apprenez les standards du housekeeping.", en: "Learn housekeeping standards." } },
    { id: 4, title: { ar: "نادِل / نادِلة", fr: "Serveur / Serveuse", en: "Waiter / Waitress" }, hotel: "Robinson Club", location: "Zone Touristique", type: { ar: "مطعم", fr: "Restauration", en: "Restaurant" }, duration: { ar: "3 أشهر", fr: "3 Mois", en: "3 Months" }, rating: 4, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000", description: { ar: "مطلوب متدربين لخدمة المطعم.", fr: "Stagiaires recherchés pour le service.", en: "Trainees needed for restaurant service." } },
    { id: 5, title: { ar: "متدربة في السبا", fr: "Stagiaire Spa", en: "Spa Therapist Trainee" }, hotel: "Fairmont Taghazout Bay", location: "Taghazout Bay", type: { ar: "صحة ورفاهية", fr: "Bien-être", en: "SPA & Wellness" }, duration: { ar: "6 أشهر", fr: "6 Mois", en: "6 Months" }, rating: 5, image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=1000", description: { ar: "انضم لفريق المركز الصحي الفاخر.", fr: "Rejoignez notre équipe bien-être.", en: "Join our luxury wellness center team." } },
    { id: 8, title: { ar: "مساعد ساقي", fr: "Assistant Barman", en: "Barman Assistant" }, hotel: "Hilton Taghazout Bay", location: "Taghazout Bay", type: { ar: "مطعم", fr: "Restauration", en: "Restaurant" }, duration: { ar: "3 أشهر", fr: "3 Mois", en: "3 Months" }, rating: 5, image: "https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&q=80&w=1000", description: { ar: "المساعدة في عمليات البار.", fr: "Assister aux opérations du bar.", en: "Assist in bar operations." } }
];

// Mutable Data for Employer Dashboard
let employerApplications = [];

// --- Core Functions ---

function updatePageTitle() {
    const t = translations[state.lang];
    let title = 'StageConnect';
    
    if (state.user && state.user.name) {
        title = `${state.user.name} - `;
    }
    
    switch(state.currentPage) {
        case 'home':
            title += t.home || 'Home';
            break;
        case 'listings':
            title += t.listings || 'Listings';
            break;
        case 'detail':
            title += t.offer || 'Offer Details';
            break;
        case 'hotelProfile':
            title += (state.selectedHotel || t.hotelProfile || 'Hotel Profile');
            break;
        case 'search':
            title += t.search || 'Search';
            break;
        case 'traineeProfile':
            title += t.profile || 'Profile';
            break;
        case 'login':
            title += t.login || 'Login';
            break;
        case 'signup':
            title += t.signup || 'Sign Up';
            break;
        case 'profile':
            if (state.userType === 'employer') {
                title += t.dashboard || 'Dashboard';
            } else {
                title += t.profile || 'Profile';
            }
            break;
        case 'admin':
            title += 'Admin Dashboard';
            break;
        case 'apply':
            title += t.apply || 'Apply';
            break;
        case 'success':
            title += t.success || 'Success';
            break;
        default:
            title += t.home || 'Home';
    }
    
    document.title = title;
}

function renderApp() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    updatePageTitle();
    renderNavigation();
    renderMainContent();
    renderFooter();
    try { console.log('[admin] render offers, internships count=', (internships || []).length); } catch(e){}
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

    // --- Employer offers: view/edit/delete offers owned by this employer ---
    function openEditOffer(internshipId) {
        const it = (internships || []).find(i => i.id === internshipId);
        if (!it) return alert('Internship not found');
        // open modal-based editor
        openEditOfferModal(internshipId);
    }

    function deleteOffer(internshipId) {
        if (!confirm('Delete this offer? This will not remove existing applications but will unassign them.')) return;
        fetch('api/delete_internship.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: internshipId })
        }).then(r => r.json()).then(j => {
            if (j.success) {
                fetchDataFromServer().then(() => renderApp());
                alert('Deleted');
            } else {
                alert('Error: ' + (j.error || 'Delete failed'));
            }
        }).catch(e => alert('Network error'));
    }

    function deleteAllOffers() {
        if (!confirm('Delete ALL offers? This will remove all your internship offers and their associated applications. This action cannot be undone.')) return;
        fetch('api/delete_all_offers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).then(r => r.json()).then(j => {
            if (j.success) {
                alert(`Deleted ${j.deleted_internships} offers. Your dashboard is now empty.`);
                fetchDataFromServer().then(() => renderApp());
            } else {
                alert('Error: ' + (j.error || 'Delete failed'));
            }
        }).catch(e => {
            console.error('deleteAllOffers error', e);
            alert('Network error');
        });
    }

function renderNavigation() {
    const t = translations[state.lang];
    const navHTML = `
        <nav class="bg-gradient-to-r from-slate-900/95 to-slate-900/90 text-white sticky top-0 z-50 border-b border-white/5 backdrop-blur-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-20">
                    <!-- Logo -->
                    <div class="flex items-center gap-3 cursor-pointer select-none" onclick="navigateTo('home')">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center shadow-md transform hover:scale-105 transition">
                                <i data-lucide="award" class="w-5 h-5 text-white"></i>
                            </div>
                            <div class="flex flex-col leading-none">
                                <span class="font-serif font-bold text-lg text-white">Stage<span class="text-yellow-400">Connect</span></span>
                                <span class="text-xs text-slate-400">Hospitality Internships</span>
                            </div>
                        </div>
                    </div>

                    <!-- Center navigation (hidden on small screens) -->
                    <div class="hidden md:flex items-center gap-4">
                        <div class="flex items-center gap-2 bg-slate-800/40 rounded-full px-3 py-1">
                            <button onclick="navigateTo('home')" class="px-4 py-1.5 rounded-full text-sm font-medium transition duration-200 ${state.currentPage === 'home' ? 'text-slate-900 bg-yellow-500 shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'}">${t.home}</button>
                            <button onclick="navigateTo('listings')" class="px-4 py-1.5 rounded-full text-sm font-medium transition duration-200 ${state.currentPage === 'listings' ? 'text-slate-900 bg-yellow-500 shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'}">${t.listings}</button>
                            ${state.user ? `<button onclick="navigateTo('social')" class="px-4 py-1.5 rounded-full text-sm font-medium transition duration-200 ${state.currentPage === 'social' ? 'text-slate-900 bg-yellow-500 shadow' : 'text-gray-300 hover:text-white hover:bg-white/5'}">${t.social}</button>` : ''}
                        </div>
                        <div class="ml-4 hidden lg:flex items-center bg-white/5 rounded-full px-3 py-1 border border-white/5">
                            <input id="nav-search-input" onkeydown="if(event.key==='Enter'){ openSearch(this.value); event.preventDefault(); }" type="search" placeholder="Search posts, offers, users..." class="bg-transparent outline-none text-sm text-white placeholder:text-slate-400 px-3 w-64" />
                            <button onclick="doSearch(document.getElementById('nav-search-input').value)" class="ml-2 px-3 py-1 rounded-full bg-yellow-500 text-slate-900 text-sm font-medium">${t.searchBtn}</button>
                        </div>
                    </div>

                    <!-- Right actions -->
                    <div class="flex items-center gap-3">
                        <div class="hidden md:flex items-center bg-slate-800/40 rounded-full px-3 py-1 border border-white/5">
                            <i data-lucide="globe" class="w-4 h-4 text-gray-300 mr-2"></i>
                            <select onchange="changeLang(this.value)" class="bg-transparent text-sm text-gray-200 outline-none border-none cursor-pointer font-medium">
                                <option value="ar" ${state.lang === 'ar' ? 'selected' : ''}>العربية</option>
                                <option value="fr" ${state.lang === 'fr' ? 'selected' : ''}>Français</option>
                                <option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>

                        ${state.user ? `
                            <div class="flex items-center gap-3">
                                <button onclick="toggleNotificationDropdown()" class="relative p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/10 transition">
                                    <i data-lucide="bell" class="w-5 h-5 text-gray-200"></i>
                                    ${state.notifications && state.notifications.length > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">${state.notifications.length}</span>` : ''}
                                </button>
                                <button onclick="goToUserProfile()" class="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-slate-900 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:scale-105 transition">
                                    <i data-lucide="user" class="w-4 h-4"></i>
                                    <span class="hidden sm:inline">${state.user.name}</span>
                                </button>
                            </div>
                        ` : `
                            <button onclick="navigateTo('login')" class="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-full text-sm font-semibold transition">${t.login}</button>
                        `}

                        <div class="-mr-2 flex md:hidden">
                            <button onclick="toggleMobileMenu()" class="bg-slate-800 p-2 rounded-md text-gray-300 hover:text-white hover:bg-slate-700">
                                <i data-lucide="menu" class="h-6 w-6"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile menu -->
            <div id="mobile-menu" class="hidden md:hidden bg-slate-900 border-t border-slate-800 px-4 pt-4 pb-6 space-y-2 text-center">
                <div class="px-2">
                    <input id="mobile-search-input" type="search" placeholder="Search..." class="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-700" onkeydown="if(event.key==='Enter'){ openSearch(this.value); return false; }" />
                    <div class="mt-2"><button onclick="openSearch(document.getElementById('mobile-search-input').value)" class="w-full px-4 py-2 rounded bg-yellow-500 text-slate-900 font-medium">${t.searchBtn}</button></div>
                </div>
                <button onclick="navigateTo('home')" class="text-gray-300 hover:text-white hover:bg-slate-800 block px-3 py-3 rounded-xl text-base font-medium w-full transition">${t.home}</button>
                <button onclick="navigateTo('listings')" class="text-gray-300 hover:text-white hover:bg-slate-800 block px-3 py-3 rounded-xl text-base font-medium w-full transition">${t.listings}</button>
                ${state.user ? `<button onclick="goToUserProfile()" class="bg-yellow-500 text-slate-900 block px-3 py-3 rounded-xl text-base font-bold w-full shadow-lg mt-4">${t.profile}</button>` : `<button onclick="navigateTo('login')" class="bg-white/10 text-white block px-3 py-3 rounded-xl text-base font-bold w-full mt-4 border border-white/10">${t.login}</button>`}
            </div>
        </nav>
    `;
    document.getElementById('nav-container').innerHTML = state.currentPage === 'login' ? '' : navHTML;
}

function openCreateOfferModal() {
    offerModalState.mode = 'create';
    offerModalState.id = null;
    renderOfferModal();
}

function openEditOfferModal(internshipId) {
    offerModalState.mode = 'edit';
    offerModalState.id = internshipId;
    renderOfferModal();
}

function closeOfferModal() {
    const modal = document.getElementById('offer-modal');
    const body = document.body;
    if (!modal) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    body.classList.remove('modal-active');
}

function renderOfferModal() {
    const modal = document.getElementById('offer-modal');
    const content = document.getElementById('offer-modal-content');
    const body = document.body;
    if (!modal || !content) return;
    const t = translations[state.lang];

    // populate fields if editing
    let titleVal = '';
    let descVal = '';
    let locationVal = '';
    let durationNumVal = '';
    let durationUnitVal = 'Months';
    let jobTypeVal = '';
    let startDateVal = '';
    if (offerModalState.mode === 'edit' && offerModalState.id) {
        const it = (internships || []).find(i => i.id === offerModalState.id);
        if (it) {
            titleVal = (it.title && it.title[state.lang]) || (it.title && it.title.en) || '';
            descVal = (it.description && it.description[state.lang]) || (it.description && it.description.en) || '';
            locationVal = it.location || '';
            // Parse duration: "3 Months" -> num="3", unit="Months"
            const durationText = (it.duration && it.duration[state.lang]) || (it.duration && it.duration.en) || '';
            const durationMatch = durationText.match(/^(\d+)\s*(.*)$/);
            if (durationMatch) {
                durationNumVal = durationMatch[1];
                durationUnitVal = durationMatch[2] || 'Months';
            }
            jobTypeVal = (it.type && it.type[state.lang]) || (it.type && it.type.en) || '';
            startDateVal = it.start_date || '';
        }
    }

    // Build job type dropdown options
    const jobTypeOptions = hotelJobTitles.map(job => {
        const jobLabel = state.lang === 'ar' ? job.ar : state.lang === 'fr' ? job.fr : job.en;
        return `<option value="${escapeHtml(jobLabel)}" ${jobTypeVal === jobLabel ? 'selected' : ''}>${escapeHtml(jobLabel)}</option>`;
    }).join('');

    // Build duration unit dropdown options
    const unitLabelEn = state.lang === 'en' ? 'en' : state.lang === 'ar' ? 'ar' : 'fr';
    const durationUnitOptions = durationUnits.map(unit => {
        const unitLabel = state.lang === 'ar' ? unit.ar : state.lang === 'fr' ? unit.fr : unit.en;
        const unitValue = unit.en;
        return `<option value="${escapeHtml(unitValue)}" ${durationUnitVal === unitValue ? 'selected' : ''}>${escapeHtml(unitLabel)}</option>`;
    }).join('');

    content.innerHTML = `
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 class="text-lg font-bold">${offerModalState.mode === 'edit' ? 'Edit Offer' : t.createOffer}</h3>
            <button onclick="closeOfferModal()" class="text-gray-400 hover:text-red-500"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="p-6">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerJobType}</label>
                    <select id="offer-job-type" class="w-full border p-3 rounded">
                        <option value="">-- ${t.offerJobType} --</option>
                        ${jobTypeOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerTitle}</label>
                    <input id="offer-title" class="w-full border p-3 rounded" value="${escapeHtml(titleVal)}" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerDesc}</label>
                    <textarea id="offer-desc" class="w-full border p-3 rounded" rows="5">${escapeHtml(descVal)}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerLocation}</label>
                        <input id="offer-location" type="text" class="w-full border p-3 rounded" value="${escapeHtml(locationVal)}" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerStartDate}</label>
                        <input id="offer-start-date" type="date" class="w-full border p-3 rounded" value="${escapeHtml(startDateVal)}" />
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerDuration}</label>
                        <input id="offer-duration" type="number" min="1" class="w-full border p-3 rounded" placeholder="e.g., 3" value="${escapeHtml(durationNumVal)}" />
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">${t.offerDuration} ${t.typeLabel}</label>
                        <select id="offer-duration-unit" class="w-full border p-3 rounded">
                            ${durationUnitOptions}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">${t.image}</label>
                    <input id="offer-image" type="file" accept="image/*" class="w-full border p-3 rounded" />
                    <p class="text-xs text-gray-500 mt-1">PNG, JPG, GIF (max 5MB)</p>
                </div>
            </div>
        </div>
        <div class="p-4 border-t border-gray-100 flex justify-end gap-3">
            <button onclick="closeOfferModal()" class="px-4 py-2 rounded border border-gray-200">${t.cancel}</button>
            <button onclick="submitOfferForm()" class="px-4 py-2 rounded bg-green-600 text-white">${t.saveOffer}</button>
        </div>
    `;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    body.classList.add('modal-active');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

async function submitOfferForm() {
    const title = document.getElementById('offer-title').value.trim();
    const desc = document.getElementById('offer-desc').value.trim();
    const location = document.getElementById('offer-location').value.trim();
    const durationNum = document.getElementById('offer-duration').value.trim();
    const durationUnit = document.getElementById('offer-duration-unit').value.trim();
    const jobType = document.getElementById('offer-job-type').value.trim();
    const startDate = document.getElementById('offer-start-date').value.trim();
    const imageFile = document.getElementById('offer-image').files[0];
    if (!title) return alert('Please enter a title');
    if (!location) return alert('Please enter a location');
    if (!jobType) return alert('Please select a job position');
    if (!startDate) return alert('Please select a start date');
    if (!durationNum) return alert('Please enter duration');

    // Combine duration number and unit (e.g., "3 Months")
    const duration = durationNum + ' ' + durationUnit;

    // Find the job title object to get all language versions
    const jobTitleObj = hotelJobTitles.find(job => job.en === jobType);
    
    // Use FormData to support file upload
    const formData = new FormData();
    formData.append('title_en', title);
    formData.append('title_ar', title);
    formData.append('title_fr', title);
    formData.append('description_en', desc);
    formData.append('description_ar', desc);
    formData.append('description_fr', desc);
    formData.append('location', location);
    formData.append('duration_en', duration);
    formData.append('duration_ar', duration);
    formData.append('duration_fr', duration);
    formData.append('type_en', jobTitleObj ? jobTitleObj.en : jobType);
    formData.append('type_ar', jobTitleObj ? jobTitleObj.ar : jobType);
    formData.append('type_fr', jobTitleObj ? jobTitleObj.fr : jobType);
    formData.append('start_date', startDate);
    if (imageFile) {
        formData.append('image_file', imageFile);
    }

    try {
        let url = 'api/create_internship.php';
        if (offerModalState.mode === 'edit' && offerModalState.id) {
            url = 'api/edit_internship.php';
            formData.append('id', offerModalState.id);
        }
        // Send FormData without setting Content-Type header; browser will set multipart/form-data automatically
        const resp = await fetch(url, { method: 'POST', credentials: 'same-origin', body: formData });
        const j = await resp.json();
        if (j.success) {
            closeOfferModal();
            await fetchDataFromServer();
            renderApp();
            alert('Saved');
        } else {
            alert('Error: ' + (j.error || 'Save failed'));
        }
    } catch (e) {
        alert('Network error: ' + e.message);
    }
}

function createOffer() {
    openCreateOfferModal();
}

// Check if user has access to the requested page
function checkPageAccess() {
    const page = state.currentPage;
    const isLoggedIn = !!state.user;
    const userType = state.userType;
    
    // Pages only for logged-in trainees
    const traineeOnlyPages = ['apply', 'profile'];
    
    // Pages only for logged-in employers/admins
    const employerOnlyPages = ['employer'];
    
    // Check trainee-only pages
    if (traineeOnlyPages.includes(page)) {
        if (!isLoggedIn || userType !== 'trainee') {
            navigateTo('login');
            return false;
        }
    }
    
    // Check employer-only pages
    if (employerOnlyPages.includes(page)) {
        if (!isLoggedIn || (userType !== 'employer' && !(state.user && state.user.is_admin))) {
            navigateTo('login');
            return false;
        }
    }
    
    // If page is 'profile', check user type matches
    if (page === 'profile' && isLoggedIn && userType !== 'trainee') {
        // For employers, profile page becomes dashboard (handled in renderMainContent)
        // This is OK
    }
    
    return true;
}

function renderMainContent() {
    // Check access control first
    if (!checkPageAccess()) {
        return; // Access denied, checkPageAccess will redirect
    }
    
    const main = document.getElementById('main-content');
    main.className = "flex-grow fade-in";
    
    // Double check - if access check redirected us, don't continue
    if (state.currentPage === 'profile' && !state.user) {
        return;
    }
    
    switch (state.currentPage) {
        case 'home': main.innerHTML = getHomeHTML(); break;
        case 'listings': main.innerHTML = getListingsHTML(); break;
        case 'detail': main.innerHTML = getDetailHTML(); break;
        case 'hotelProfile': main.innerHTML = getHotelProfileHTML(); break;
        case 'search': main.innerHTML = getSearchHTML(); break;
        case 'traineeProfile': main.innerHTML = getTraineeProfileHTML(); break;
        case 'social': {
            if (!state.user) {
                main.innerHTML = getLoginHTML();
            } else {
                main.innerHTML = getSocialFeedHTML();
            }
            break;
        }
        case 'login': main.innerHTML = getLoginHTML(); break;
        case 'signup': main.innerHTML = getSignupHTML(); break;
        case 'profile': {
            // Extra safety check - profile requires login
            if (!state.user) {
                main.innerHTML = '';
            } else {
                main.innerHTML = getProfileHTML();
            }
            break;
        }
        case 'admin': main.innerHTML = getAdminHTML(); break;
        case 'employer': {
            if (!state.user || state.userType !== 'employer') {
                main.innerHTML = '';
            } else {
                main.innerHTML = getEmployerDashboardHTML();
            }
            break;
        }
        case 'apply': main.innerHTML = getApplyHTML(); break;
        case 'success': main.innerHTML = getSuccessHTML(); break;
        default: main.innerHTML = getHomeHTML();
    }
}

function renderFooter() {
    if (state.currentPage === 'login') {
        document.getElementById('footer-container').innerHTML = '';
        return;
    }
    const t = translations[state.lang];
    const footerHTML = `
        <footer class="bg-slate-900 text-gray-400 py-20 border-t border-slate-800 mt-auto">
            <div class="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
                <div class="col-span-1">
                    <div class="flex items-center mb-6 gap-3">
                         <div class="flex items-center gap-2 select-none">
                            <div class="relative w-8 h-8 flex items-center justify-center">
                                <div class="absolute inset-0 rounded-full blur-sm bg-yellow-500/20"></div>
                                <div class="relative w-full h-full rounded-lg flex items-center justify-center border shadow-md bg-gradient-to-br from-slate-800 to-slate-900 border-white/10">
                                    <i data-lucide="award" class="w-4 h-4 text-yellow-500"></i>
                                </div>
                            </div>
                            <span class="font-serif font-bold text-lg leading-none tracking-wide text-white">Stage<span class="text-yellow-500">Connect</span></span>
                        </div>
                    </div>
                    <p class="leading-relaxed mb-8 text-gray-400 font-light">${t.footerDesc}</p>
                </div>
                <div>
                    <h4 class="text-white font-bold text-lg mb-8 font-serif">Quick Links</h4>
                    <ul class="space-y-4">
                        <li><a href="#" class="hover:text-yellow-500 transition flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> About Us</a></li>
                        <li><a href="#" class="hover:text-yellow-500 transition flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Find Internships</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="text-white font-bold text-lg mb-8 font-serif">Contact</h4>
                    <ul class="space-y-4">
                        <li class="flex items-start gap-3"><i data-lucide="map-pin" class="w-5 h-5 text-yellow-500 shrink-0"></i> Agadir, Morocco</li>
                        <li class="flex items-start gap-3"><i data-lucide="mail" class="w-5 h-5 text-yellow-500 shrink-0"></i> contact@stageconnect.ma</li>
                    </ul>
                </div>
            </div>
            <div class="max-w-7xl mx-auto px-4 mt-16 pt-8 border-t border-slate-800 text-center text-xs text-gray-500 flex flex-col md:flex-row justify-between items-center">
                <p>&copy; 2024 StageConnect. All Rights Reserved.</p>
                <p class="mt-2 md:mt-0">Designed for CMC & OFPPT Trainees</p>
            </div>
        </footer>
    `;
    document.getElementById('footer-container').innerHTML = footerHTML;
}

// --- HTML Generators for Views ---

function getHomeHTML() {
    const t = translations[state.lang];
    return `
        <div class="relative bg-slate-900 overflow-hidden">
            <div class="absolute inset-0">
                <img class="w-full h-full object-cover opacity-30" src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=2000" alt="Agadir Hotel" />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40"></div>
            </div>
            <div class="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8 text-center">
                <div class="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
                    <i data-lucide="award" class="w-4 h-4 text-yellow-500"></i>
                    <span class="text-yellow-500 text-xs font-bold tracking-wider uppercase">${t.premiumInternships}</span>
                </div>
                <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-7xl mb-6 font-serif">
                    ${t.heroTitle} <span class="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">${t.heroHighlight}</span>
                </h1>
                <p class="mt-6 text-xl text-gray-300 max-w-3xl mx-auto font-light leading-relaxed">${t.heroDesc}</p>
                <div class="mt-10 flex justify-center gap-4 flex-wrap">
                    <button onclick="navigateTo('listings')" class="px-8 py-4 border border-transparent text-base font-bold rounded-full text-slate-900 bg-yellow-500 hover:bg-yellow-400 md:text-lg md:px-12 transition shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] transform hover:-translate-y-1">${t.browse}</button>
                    <button onclick="navigateTo('login')" class="px-8 py-4 border border-white/20 text-base font-bold rounded-full text-white hover:bg-white/10 md:text-lg md:px-12 transition backdrop-blur-sm">${t.iamHotel}</button>
                </div>
            </div>
        </div>
        <div class="max-w-7xl mx-auto px-4 py-24">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
                <div class="p-10 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition duration-500 transform hover:-translate-y-2 group">
                    <div class="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition duration-500"><i data-lucide="user" class="w-10 h-10"></i></div>
                    <h3 class="font-bold text-2xl mb-4 font-serif text-slate-900">${t.createProfileTitle}</h3>
                    <p class="text-gray-500 leading-relaxed">${t.createProfileDesc}</p>
                </div>
                <div class="p-10 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition duration-500 transform hover:-translate-y-2 group">
                    <div class="w-24 h-24 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:bg-yellow-500 group-hover:text-slate-900 transition duration-500"><i data-lucide="search" class="w-10 h-10"></i></div>
                    <h3 class="font-bold text-2xl mb-4 font-serif text-slate-900">${t.searchOpportunitiesTitle}</h3>
                    <p class="text-gray-500 leading-relaxed">${t.searchOpportunitiesDesc}</p>
                </div>
                <div class="p-10 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition duration-500 transform hover:-translate-y-2 group">
                    <div class="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:bg-green-600 group-hover:text-white transition duration-500"><i data-lucide="check-circle" class="w-10 h-10"></i></div>
                    <h3 class="font-bold text-2xl mb-4 font-serif text-slate-900">${t.getHiredTitle}</h3>
                    <p class="text-gray-500 leading-relaxed">${t.getHiredDesc}</p>
                </div>
            </div>
        </div>
    `;
}

function getListingsHTML() {
    const t = translations[state.lang];
    
    // If user is employer, only show their own offers; if trainee, show all
    let jobsToShow = internships;
    if (state.userType === 'employer' && state.user) {
        jobsToShow = internships.filter(job => job.hotel === state.user.name);
    }
    
    const filtered = jobsToShow.filter(job => {
        const sTerm = state.searchTerm.toLowerCase();
        const matchText = job.hotel.toLowerCase().includes(sTerm) ||
                          job.title[state.lang].toLowerCase().includes(sTerm) ||
                          job.title.ar.toLowerCase().includes(sTerm) ||
                          job.title.fr.toLowerCase().includes(sTerm) ||
                          job.title.en.toLowerCase().includes(sTerm);
        const matchRegion = state.selectedRegion === '' || job.location === state.selectedRegion;
        return matchText && matchRegion;
    });
    let cardsHTML = '';
    if (filtered.length > 0) {
        cardsHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">` +
        filtered.map(job => `
            <div class="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-2xl transition duration-500 border border-gray-100 flex flex-col h-full group cursor-pointer transform hover:-translate-y-1" onclick="openDetail(${job.id})">
                <div class="relative h-56 overflow-hidden">
                    <img class="w-full h-full object-cover group-hover:scale-110 transition duration-700" src="${job.image}" alt="${job.hotel}" />
                    <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition duration-500"></div>
                    <div class="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-900 flex items-center shadow-sm rtl:right-auto rtl:left-4">
                        <i data-lucide="star" class="w-3.5 h-3.5 text-yellow-500 mx-1 fill-current"></i> ${job.rating}.0
                    </div>
                </div>
                <div class="p-6 flex-1 flex flex-col">
                    <div class="flex justify-between items-start mb-3">
                        <span class="text-[10px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">${job.type[state.lang]}</span>
                        <span class="text-xs text-gray-500 flex items-center font-medium bg-gray-50 px-2 py-1 rounded-full"><i data-lucide="clock" class="w-3.5 h-3.5 mx-1"></i> ${job.duration[state.lang]}</span>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 mb-2 font-serif group-hover:text-yellow-600 transition leading-tight">${job.title[state.lang]}</h3>
                    <p class="text-sm text-gray-500 font-medium mb-4 flex items-center"><i data-lucide="building" class="w-4 h-4 mx-1 text-gray-400"></i> <a href="#" data-hotel="${escapeHtml(job.hotel)}" onclick="openHotelProfile(this.dataset.hotel); event.stopPropagation(); return false;" class="underline text-gray-700 hover:text-yellow-600">${escapeHtml(job.hotel)}</a></p>
                    ${job.start_date ? `<p class="text-xs text-gray-400 font-medium mb-2 flex items-center"><i data-lucide="calendar" class="w-3.5 h-3.5 mx-1"></i> Starts: ${job.start_date}</p>` : ''}
                    <div class="mt-auto pt-5 border-t border-gray-50 flex items-center justify-between">
                        <span class="text-xs text-gray-500 flex items-center font-medium"><i data-lucide="map-pin" class="w-3.5 h-3.5 mx-1"></i> ${t.regions[job.location]}</span>
                        <span class="text-slate-900 group-hover:text-yellow-600 font-bold text-xs transition rtl:flex-row-reverse flex items-center gap-1 bg-gray-50 group-hover:bg-yellow-50 px-3 py-1.5 rounded-full">${t.details} <span>&rarr;</span></span>
                    </div>
                </div>
            </div>
        `).join('') + `</div>`;
    } else {
        const emptyMsg = state.userType === 'employer' ? 'You have no offers yet. Create one from your dashboard!' : 'Try adjusting your search or filters.';
        cardsHTML = `
            <div class="text-center py-20 text-gray-500 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-2xl mx-auto">
                <div class="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse"><i data-lucide="search" class="w-10 h-10 text-gray-300"></i></div>
                <p class="text-2xl font-bold text-gray-800 mb-2">${t.noResultsFound}</p>
                <p class="text-gray-500 mb-6">${emptyMsg}</p>
                <button onclick="resetSearch()" class="text-white bg-slate-900 hover:bg-slate-800 px-8 py-3 rounded-full font-bold transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">${t.clearFilters}</button>
            </div>`;
    }
    return `
        <div class="bg-gray-50 min-h-screen pb-20">
            <div class="bg-slate-900 text-white py-20 px-4 mb-8 relative overflow-hidden">
                <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div class="absolute top-0 right-0 w-96 h-96 bg-yellow-500 rounded-full mix-blend-overlay filter blur-[100px] opacity-20"></div>
                <div class="max-w-7xl mx-auto text-center relative z-10">
                    <h2 class="text-3xl md:text-5xl font-bold mb-6 font-serif tracking-tight">${t.latestOffers}</h2>
                    <p class="text-gray-400 max-w-2xl mx-auto text-lg">Explore exclusive opportunities.</p>
                </div>
            </div>
            <div class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 -mt-16 relative z-10 mx-4 max-w-6xl md:mx-auto border border-white/50">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="relative md:col-span-2 group">
                        <i data-lucide="search" class="absolute right-4 top-3.5 text-gray-400 h-5 w-5 rtl:left-4 rtl:right-auto group-focus-within:text-yellow-500 transition-colors"></i>
                        <input type="text" value="${state.searchTerm}" oninput="updateSearch(this.value)" placeholder="${t.searchPlaceholder}" class="w-full px-12 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition shadow-sm" />
                    </div>
                    <div class="relative group">
                        <i data-lucide="map-pin" class="absolute right-4 top-3.5 text-gray-400 h-5 w-5 rtl:left-4 rtl:right-auto group-focus-within:text-yellow-500 transition-colors"></i>
                        <select onchange="updateRegion(this.value)" class="w-full px-12 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none text-gray-600 appearance-none transition shadow-sm cursor-pointer">
                            <option value="" ${state.selectedRegion === '' ? 'selected' : ''}>${t.allRegions}</option>
                            <option value="Zone Touristique" ${state.selectedRegion === 'Zone Touristique' ? 'selected' : ''}>${t.regions["Zone Touristique"]}</option>
                            <option value="Taghazout Bay" ${state.selectedRegion === 'Taghazout Bay' ? 'selected' : ''}>${t.regions["Taghazout Bay"]}</option>
                            <option value="Agadir Centre" ${state.selectedRegion === 'Agadir Centre' ? 'selected' : ''}>${t.regions["Agadir Centre"]}</option>
                            <option value="Imi Ouaddar" ${state.selectedRegion === 'Imi Ouaddar' ? 'selected' : ''}>${t.regions["Imi Ouaddar"]}</option>
                        </select>
                    </div>
                    <button onclick="renderApp()" class="bg-slate-900 text-white rounded-xl py-3.5 hover:bg-slate-800 transition font-bold shadow-lg shadow-slate-900/20 transform hover:-translate-y-0.5">${t.searchBtn}</button>
                </div>
            </div>
            <div class="max-w-7xl mx-auto px-4 mt-16">
                ${cardsHTML}
            </div>
        </div>
    `;
}

function getDetailHTML() {
    const job = state.selectedJob || internships[0];
    const t = translations[state.lang];
    const mapQuery = encodeURIComponent(job.hotel + ' Agadir Morocco');
    
    // Check if current user is the hotel owner of this offer
    const isOwner = state.userType === 'employer' && state.user && state.user.name === job.hotel;
    
    // Build action buttons based on user type
    let actionButtons = '';
    if (isOwner) {
        // Show edit and delete buttons for hotel owners
        actionButtons = `
            <div class="flex gap-3 mb-6">
                <button onclick="openEditOffer(${job.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20 transition transform hover:-translate-y-1 flex items-center justify-center" title="${t.edit || 'Edit'}">
                    <i data-lucide="edit" class="w-5 h-5"></i>
                </button>
                <button onclick="deleteOffer(${job.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-red-600/20 transition transform hover:-translate-y-1 flex items-center justify-center" title="${t.delete || 'Delete'}">
                    <i data-lucide="trash" class="w-5 h-5"></i>
                </button>
            </div>
        `;
    } else {
        // Show apply button for trainees
        actionButtons = `<button onclick="navigateTo('apply')" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-xl shadow-slate-900/20 transition transform hover:-translate-y-1 text-lg mb-6">${t.applyNow}</button>`;
    }
    
    return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <button onclick="navigateTo('listings')" class="flex items-center text-gray-500 hover:text-slate-900 mb-6 transition font-medium group">
                <div class="bg-white border border-gray-200 p-2 rounded-full shadow-sm group-hover:shadow-md mx-2 transition">
                    <i data-lucide="chevron-left" class="w-4 h-4 rtl:rotate-180"></i>
                </div>
                ${t.listings}
            </button>
            <div class="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div class="h-64 md:h-[400px] relative">
                    <img src="${job.image}" alt="${job.hotel}" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-8 text-white">
                        <div class="flex items-center gap-2 mb-4">
                            <span class="bg-yellow-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-yellow-500/20">${job.type[state.lang]}</span>
                        </div>
                        <h1 class="text-3xl md:text-5xl font-bold mb-4 font-serif leading-tight">${job.title[state.lang]}</h1>
                        <div class="flex flex-col md:flex-row md:items-center gap-6 text-sm md:text-base text-gray-300 font-light">
                            <span class="flex items-center"><i data-lucide="building" class="w-5 h-5 mx-2 text-yellow-500"></i> <a href="#" data-hotel="${escapeHtml(job.hotel)}" onclick="openHotelProfile(this.dataset.hotel); return false;" class="underline text-white/90 hover:text-yellow-300">${escapeHtml(job.hotel)}</a></span>
                            <a href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" rel="noopener noreferrer" class="flex items-center hover:text-white transition cursor-pointer group bg-white/5 px-4 py-1.5 rounded-full w-fit backdrop-blur-md hover:bg-white/10 border border-white/10 hover:border-yellow-500/50">
                                <i data-lucide="map-pin" class="w-5 h-5 mx-2 text-yellow-500 group-hover:animate-bounce"></i>
                                <span class="underline decoration-dotted decoration-yellow-500/50 underline-offset-4 decoration-2">${t.regions[job.location]}</span>
                                <span class="text-xs bg-yellow-500 text-slate-900 px-2 py-0.5 rounded-full mx-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">${t.mapLink} ↗</span>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="p-8 md:p-12">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div class="md:col-span-2 space-y-10">
                            <div>
                                <h3 class="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <i data-lucide="file-text" class="w-5 h-5 text-yellow-500"></i> ${t.details}
                                </h3>
                                <p class="text-gray-600 leading-relaxed text-lg font-light">${job.description[state.lang]}</p>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <i data-lucide="check-circle" class="w-5 h-5 text-yellow-500"></i> ${t.requirements}
                                </h3>
                                <ul class="space-y-4">
                                    ${t.reqList.map(req => `<li class="flex items-start text-gray-700 bg-gray-50 p-4 rounded-xl"><div class="bg-green-100 p-1 rounded-full mx-3 mt-0.5"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-600"></i></div><span class="font-medium">${req}</span></li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        <div class="md:col-span-1">
                            <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50 sticky top-24">
                                <h3 class="font-bold text-xl mb-6 text-slate-900 font-serif">${t.summary}</h3>
                                <div class="space-y-6 mb-8">
                                    <div class="flex justify-between items-center pb-4 border-b border-gray-50">
                                        <span class="text-gray-400 text-sm font-medium">${t.durationLabel}</span>
                                        <span class="font-bold text-slate-800 flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4 text-blue-500"></i> ${job.duration[state.lang]}</span>
                                    </div>
                                    <div class="flex justify-between items-center pb-4 border-b border-gray-50">
                                        <span class="text-gray-400 text-sm font-medium">${t.typeLabel}</span>
                                        <span class="font-bold text-slate-800">${job.type[state.lang]}</span>
                                    </div>
                                    <div class="flex justify-between items-center pb-4 border-b border-gray-50">
                                        <span class="text-gray-400 text-sm font-medium">${t.offerStartDate || 'Start Date'}</span>
                                        <span class="font-bold text-slate-800 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4 text-green-500"></i> ${job.start_date || 'TBA'}</span>
                                    </div>
                                </div>
                                ${actionButtons}
                                <div class="mt-6 pt-6 border-t border-gray-50 text-center"><p class="text-xs text-gray-400">Certified by OFPPT & CMC Agadir</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Open hotel profile page
function openHotelProfile(hotelName) {
    state.selectedHotel = hotelName;
    state.currentPage = 'hotelProfile';
    renderApp();
    // Load ratings for this hotel after rendering
    try { loadHotelRatings(hotelName); } catch(e){/* noop */}
}

// Render hotel profile (info, offers, posts)
function getHotelProfileHTML() {
    const t = translations[state.lang];
    const hotelName = state.selectedHotel || 'Hotel';
    const offers = (internships || []).filter(j => j.hotel === hotelName);
    const posts = (state.userPosts || []).filter(p => p.author_name === hotelName);
    const avgRating = offers.length ? (offers.reduce((s,o) => s + (o.rating||0), 0) / offers.length).toFixed(1) : '—';
    const location = offers.length ? offers[0].location : '';

    const offersHTML = offers.length ? offers.map(o => `
        <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <div class="flex items-start gap-4">
                <img src="${o.image}" class="w-20 h-20 object-cover rounded-lg" />
                <div class="flex-1">
                    <h4 class="font-bold text-lg">${escapeHtml(o.title[state.lang])}</h4>
                    <div class="text-sm text-gray-500">${escapeHtml(o.type[state.lang])} • ${escapeHtml(o.duration[state.lang])}</div>
                    <div class="mt-2"><button onclick="openDetail(${o.id})" class="text-yellow-500 font-bold">${t.details} →</button></div>
                </div>
            </div>
        </div>
    `).join('') : `<div class="p-6 text-gray-500">${t.noApps || 'No offers'}</div>`;

    const postsHTML = posts.length ? posts.map(p => `
        <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold">${(p.author_name||'H').charAt(0)}</div>
                <div class="flex-1">
                    <div class="text-sm text-gray-800">${escapeHtml(p.content || '')}</div>
                    ${p.image_path ? `<img src="${p.image_path}" class="w-full rounded-lg mt-2" />` : ''}
                    <div class="text-xs text-gray-400 mt-2">${p.created_at || ''}</div>
                </div>
            </div>
        </div>
    `).join('') : `<div class="p-6 text-gray-500">${t.noApps || 'No posts'}</div>`;

    return `
        <div class="max-w-6xl mx-auto px-4 py-8">
            <div class="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-gray-100">
                <div class="flex items-center gap-6">
                    <div class="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-3xl font-bold">${escapeHtml(hotelName.charAt(0) || 'H')}</div>
                    <div>
                        <h2 class="text-2xl font-bold">${escapeHtml(hotelName)}</h2>
                        <div class="text-sm text-gray-500">${escapeHtml(location)}</div>
                        <div class="mt-2 flex items-center gap-3">
                            <div id="hotel-rating-stars" class="flex gap-1" aria-label="Rate this hotel"></div>
                            <div id="hotel-rating-avg" class="text-sm text-gray-500">${avgRating} ⭐</div>
                            <div id="hotel-rating-count" class="text-xs text-gray-400">${offers.length} ${offers.length===1? 'rating':'ratings'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2">
                    <h3 class="font-bold mb-4">${t.latestOffers}</h3>
                    ${offersHTML}
                </div>
                <div>
                    <h3 class="font-bold mb-4">Posts</h3>
                    ${postsHTML}
                </div>
            </div>
        </div>
    `;
}

// Open trainee (user) profile
function openTraineeProfile(userId) {
    state.selectedUserId = userId;
    // Use navigateTo so the URL hash is updated (preserves page on refresh)
    navigateTo('traineeProfile');
    // Load posts for this user (renderApp will be called when data arrives)
    loadTraineePosts(userId);
}

function loadTraineePosts(userId) {
    // Fetch full user profile with picture and bio AND follow info
    const p1 = fetch(`api/get_user_profile.php?user_id=${userId}`).then(r => r.json());
    const p2 = fetch(`api/get_follow_info.php?user_id=${userId}`).then(r => r.json()).catch(()=>({success:false}));
    Promise.all([p1, p2]).then(([j, f]) => {
        if (j && j.success) {
            state.selectedUserProfile = j.user;
            state.selectedUserPosts = j.posts;
        }
        if (f && f.success) {
            state.selectedUserFollowInfo = { followers: f.followers||0, following: f.following||0, i_follow: !!f.i_follow };
        } else {
            state.selectedUserFollowInfo = { followers: 0, following: 0, i_follow: false };
        }
        renderApp();
    }).catch(err => {
        console.error('Failed to load user profile', err);
    });
}

function getTraineeProfileHTML() {
    const uid = state.selectedUserId;
    const t = translations[state.lang];
    const user = state.selectedUserProfile || {id:null, name: 'User', email: '', bio: '', profile_pic: null};
    const posts = state.selectedUserPosts || [];
    const followInfo = state.selectedUserFollowInfo || { followers: 0, following: 0, i_follow: false };
    const isOwnerProfile = state.user && user && state.user.id === user.id;
    const postsHTML = posts.map(p => {
        const img = p.image_path ? `<img src="${p.image_path}" class="w-full rounded-xl mt-4 max-h-96 object-cover" />` : '';
        return `
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition" onclick="openTraineeProfile(${p.user_id})">${(user.name||'U').charAt(0)}</div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <p class="font-bold text-slate-900 cursor-pointer hover:text-yellow-600 transition" onclick="openTraineeProfile(${p.user_id})">${escapeHtml(user.name || 'User')}</p>
                                <p class="text-xs text-gray-400">${p.created_at || ''}</p>
                            </div>
                        </div>
                        <p class="text-slate-900 mb-3">${escapeHtml(p.content || '')}</p>
                        ${img}
                        <div class="mt-4 flex items-center gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                            <button onclick="toggleLike(${p.id})" ${pendingLikes.has(p.id) ? 'disabled' : ''} class="flex items-center gap-2 px-3 py-1 rounded-lg ${p.liked_by_me ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100'} transition ${pendingLikes.has(p.id) ? 'opacity-50 pointer-events-none' : ''}">
                                ❤ ${p.likes_count || 0}
                            </button>
                            <button onclick="toggleComments(${p.id})" class="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-100 transition">
                                💬 Comments
                            </button>
                        </div>
                        <div id="comments-${p.id}" class="mt-4" style="display:none">
                            <div id="comments-list-${p.id}" class="mb-3"></div>
                            <textarea id="comment-input-${p.id}" placeholder="Write a comment..." class="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-100 outline-none resize-none" rows="2"></textarea>
                            <button onclick="submitComment(${p.id})" class="mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold rounded-lg transition text-sm">Post</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `<div class="p-6 text-gray-500">No posts</div>`;

    return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="bg-white rounded-3xl p-8 shadow border border-gray-100 mb-6">
                ${user.profile_pic ? `<img src="${user.profile_pic}" class="w-24 h-24 rounded-full mb-4 object-cover" />` : `<div class="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mb-4 flex items-center justify-center text-white text-2xl font-bold">${(user.name || 'U').charAt(0).toUpperCase()}</div>`}
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-bold">${escapeHtml(user.name)}</h2>
                        <div class="text-sm text-gray-500">${escapeHtml(user.email || '')}</div>
                        ${user.bio ? `<div class="text-gray-700 mt-3 text-sm">${escapeHtml(user.bio)}</div>` : ''}
                        <div class="mt-3 text-sm text-gray-600"> <strong>${followInfo.followers}</strong> followers • <strong>${followInfo.following}</strong> following</div>
                    </div>
                    <div class="flex items-center gap-2">
                        ${state.user && !isOwnerProfile ? `
                            ${followInfo.i_follow ? `<button onclick="unfollowUser(${user.id})" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Unfollow</button>` : `<button onclick="followUser(${user.id})" class="px-4 py-2 bg-yellow-500 text-slate-900 font-bold rounded-lg hover:bg-yellow-600">Follow</button>`}
                        ` : ``}
                    </div>
                </div>
            </div>
            <h3 class="font-bold mb-4">Posts</h3>
            ${postsHTML}
        </div>
    `;
}

// Comments handling
function toggleComments(postId) {
    if (!state.user) {
        notificationSystem.warning(translations[state.lang].login || 'Please login to comment');
        return;
    }
    const el = document.getElementById(`comments-${postId}`);
    if (!el) return;
    if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'block';
        fetchComments(postId);
    } else {
        el.style.display = 'none';
    }
}

function fetchComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    list.innerHTML = 'Loading...';
    fetch(`api/get_comments.php?post_id=${postId}`).then(r=>r.json()).then(j=>{
        if (!j.success) { list.innerHTML = '<div class="text-red-500">Error loading comments</div>'; return; }
        const comments = j.data || [];
        if (!comments.length) { list.innerHTML = '<div class="text-gray-500 p-2">No comments yet.</div>'; return; }
        const html = comments.map(c=>{
            const time = (c.updated_at ? new Date(c.updated_at) : new Date(c.created_at));
            const timeStr = time.toLocaleString();
            const editedFlag = c.updated_at ? ' <span class="text-xs text-gray-400">(edited)</span>' : '';
            const canEdit = !!c.can_edit;
            return `
                <div id="comment-${c.id}" class="border-b border-gray-100 py-2">
                    <div class="flex items-start justify-between">
                        <div>
                            <div class="text-sm font-medium">${escapeHtml(c.author_name)}</div>
                            <div id="comment-content-${c.id}" class="text-sm text-gray-700 mt-1">${escapeHtml(c.content)}</div>
                            <div class="text-xs text-gray-400 mt-1">${timeStr}${editedFlag}</div>
                        </div>
                        ${canEdit ? `
                        <div class="ml-4 text-right">
                            <button onclick="startEditComment(${c.id})" class="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                            <button onclick="deleteComment(${c.id})" class="text-xs text-red-600 hover:underline">Delete</button>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        list.innerHTML = html;
    }).catch(err=>{ console.error(err); list.innerHTML = '<div class="text-red-500">Error</div>'; });
}

// Edit/Delete helpers
function startEditComment(commentId) {
    const contentEl = document.getElementById(`comment-content-${commentId}`);
    if (!contentEl) return;
    const original = contentEl.textContent || contentEl.innerText || '';
    // store original in DOM so we don't inject it into an onclick which can break when containing quotes/newlines
    contentEl.dataset.original = original;
    // Build elements via DOM to avoid issues with inline onclick and special characters
    contentEl.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.id = `comment-edit-input-${commentId}`;
    ta.className = 'w-full border rounded p-2';
    ta.value = original;
    contentEl.appendChild(ta);

    const ctrl = document.createElement('div');
    ctrl.className = 'mt-2 text-right';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded text-sm mr-2';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', function (e) { e.stopPropagation(); saveEditComment(commentId); });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-3 py-1 bg-gray-200 rounded text-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', function (e) { e.stopPropagation(); cancelEditComment(commentId); });

    ctrl.appendChild(saveBtn);
    ctrl.appendChild(cancelBtn);
    contentEl.appendChild(ctrl);
}

function cancelEditComment(commentId) {
    const contentEl = document.getElementById(`comment-content-${commentId}`);
    if (!contentEl) return;
    const original = contentEl.dataset.original || '';
    contentEl.textContent = original;
    delete contentEl.dataset.original;
}

function saveEditComment(commentId) {
    const ta = document.getElementById(`comment-edit-input-${commentId}`);
    if (!ta) return;
    const v = ta.value.trim();
    if (!v) { notificationSystem.warning('Write a comment'); return; }

    // find save button to disable while saving
    let saveBtn = null;
    try { saveBtn = ta.parentElement.querySelector('button'); } catch(e) { saveBtn = null; }
    if (saveBtn) { saveBtn.disabled = true; saveBtn.classList && saveBtn.classList.add('opacity-50'); }

    const fd = new FormData(); fd.append('comment_id', commentId); fd.append('content', v);
    const loadingId = notificationSystem.loading('Saving comment...', {category: 'editing'});

    fetch('api/edit_comment.php', { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(async r=>{
            const text = await r.text();
            let j = null;
            try { j = JSON.parse(text); } catch(e) { j = null; }
            if (!r.ok || !j || !j.success) {
                console.error('Edit comment failed', r.status, text);
                notificationSystem.remove(loadingId);
                const message = j && j.error ? j.error : `Save failed (${r.status})`;
                notificationSystem.error(message);
                // also show raw response for debugging (shortened)
                const snippet = text ? (text.length > 1000 ? text.slice(0,1000) + '...' : text) : '';
                if (snippet) notificationSystem.show(snippet, 'error', { duration: 8000 });
                if (saveBtn) { saveBtn.disabled = false; saveBtn.classList && saveBtn.classList.remove('opacity-50'); }
                return;
            }
            notificationSystem.remove(loadingId);
            const c = j.comment;
            const contentEl = document.getElementById(`comment-content-${commentId}`);
            if (contentEl) {
                contentEl.innerHTML = escapeHtml(c.content) + (c.updated_at ? ` <div class="text-xs text-gray-400">${new Date(c.updated_at).toLocaleString()} (edited)</div>` : '');
                // update stored original so cancel won't restore old text
                contentEl.dataset.original = c.content;
            }
            notificationSystem.success('Comment updated');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.classList && saveBtn.classList.remove('opacity-50'); }
        })
        .catch(err=>{
            console.error('Error updating comment', err);
            notificationSystem.remove(loadingId);
            notificationSystem.error('Error updating comment');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.classList && saveBtn.classList.remove('opacity-50'); }
        });
}

// expose for legacy inline handlers if any remain
try { window.saveEditComment = saveEditComment; window.cancelEditComment = cancelEditComment; } catch(e) {}

function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;
    const fd = new FormData(); fd.append('comment_id', commentId);
    fetch('api/delete_comment.php', { method: 'POST', body: fd, credentials: 'same-origin' }).then(r=>r.json()).then(j=>{
        if (!j.success) { notificationSystem.error(j.error || 'Failed to delete comment'); return; }
        const el = document.getElementById(`comment-${commentId}`);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        notificationSystem.success('Comment deleted');
    }).catch(err=>{ console.error(err); notificationSystem.error('Error deleting comment'); });
}

function submitComment(postId) {
    if (!state.user) {
        notificationSystem.warning(translations[state.lang].login || 'Please login to comment');
        return;
    }
    const ta = document.getElementById(`comment-input-${postId}`);
    if (!ta) return;
    const v = ta.value.trim();
    if (!v) {
        notificationSystem.warning('Write a comment');
        return;
    }
    const fd = new FormData(); fd.append('post_id', postId); fd.append('content', v);
    fetch('api/create_comment.php', { method: 'POST', body: fd, credentials: 'same-origin' }).then(r=>r.json()).then(j=>{
        if (!j.success) { 
            notificationSystem.error(j.error || 'Failed to add comment');
            return;
        }
        ta.value = '';
        // if server returned the created comment, prepend it locally for snappy UX
        if (j.comment) {
            const list = document.getElementById(`comments-list-${postId}`);
            if (list) {
                const c = j.comment;
                c.can_edit = true; // current user is the author
                const time = new Date(c.created_at);
                const timeStr = time.toLocaleString();
                const node = document.createElement('div');
                node.className = 'border-b border-gray-100 py-2';
                node.id = `comment-${c.id}`;
                node.innerHTML = `
                    <div class="flex items-start justify-between">
                        <div>
                            <div class="text-sm font-medium">${escapeHtml(c.author_name)}</div>
                            <div id="comment-content-${c.id}" class="text-sm text-gray-700 mt-1">${escapeHtml(c.content)}</div>
                            <div class="text-xs text-gray-400 mt-1">${timeStr}</div>
                        </div>
                        <div class="ml-4 text-right">
                            <button onclick="startEditComment(${c.id})" class="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                            <button onclick="deleteComment(${c.id})" class="text-xs text-red-600 hover:underline">Delete</button>
                        </div>
                    </div>
                `;
                // insert at top
                if (list.firstChild) list.insertBefore(node, list.firstChild);
                else list.appendChild(node);
            }
        }
        notificationSystem.success('Comment added!');
        // ensure latest from server
        fetchComments(postId);
    }).catch(err=>{ console.error(err); notificationSystem.error('Error adding comment'); });
}

// Search UI
function openSearch(q) {
    state.searchQuery = q || '';
    state.currentPage = 'search';
    renderApp();
    if (q) doSearch(q);
}

function doSearch(q, type='all') {
    const el = document.getElementById('search-results');
    if (!el) return;
    el.innerHTML = 'Searching...';
    fetch(`api/search.php?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`).then(r=>r.json()).then(j=>{
        if (!j.success) { el.innerHTML = '<div class="text-red-500">Search error</div>'; return; }
        const parts = [];
        if (j.results.posts && j.results.posts.length) {
            const postsHTML = j.results.posts.map(p=>{
                const img = p.image_path ? `<img src="${p.image_path}" class="w-full rounded-xl mt-4 max-h-96 object-cover" />` : '';
                return `
                    <div class="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition" onclick="openTraineeProfile(${p.user_id})">${(p.author_name||'U').charAt(0)}</div>
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-2">
                                    <div>
                                        <p class="font-bold text-slate-900 cursor-pointer hover:text-yellow-600 transition" onclick="openTraineeProfile(${p.user_id})">${escapeHtml(p.author_name || 'User')}</p>
                                        <p class="text-xs text-gray-400">${p.created_at || ''}</p>
                                    </div>
                                </div>
                                <p class="text-slate-900 mb-3">${escapeHtml(p.content || '')}</p>
                                ${img}
                                <div class="mt-4 flex items-center gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                                    <button onclick="toggleLike(${p.id})" ${pendingLikes.has(p.id) ? 'disabled' : ''} class="flex items-center gap-2 px-3 py-1 rounded-lg ${p.liked_by_me ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100'} transition ${pendingLikes.has(p.id) ? 'opacity-50 pointer-events-none' : ''}">
                                        ❤ ${p.likes_count || 0}
                                    </button>
                                    <button onclick="toggleComments(${p.id})" class="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-100 transition">
                                        💬 Comments
                                    </button>
                                </div>
                                <div id="comments-${p.id}" class="mt-4" style="display:none">
                                    <div id="comments-list-${p.id}" class="mb-3"></div>
                                    <textarea id="comment-input-${p.id}" placeholder="Write a comment..." class="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-100 outline-none resize-none" rows="2"></textarea>
                                    <button onclick="submitComment(${p.id})" class="mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold rounded-lg transition text-sm">Post</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            parts.push('<h4 class="font-bold mt-4 mb-4 text-xl">Posts</h4>' + postsHTML);
        }
        if (j.results.hotels && j.results.hotels.length) {
            parts.push('<h4 class="font-bold mt-4">Hotels</h4>' + j.results.hotels.map(h=>`<div class="p-3 border rounded mb-2"><div class="font-medium"><a href="#" onclick="openHotelProfile(\'${escapeHtml(h).replace(/'/g, "\\'")}\'); return false;">${escapeHtml(h)}</a></div></div>`).join(''));
        }
        if (j.results.offers && j.results.offers.length) {
            parts.push('<h4 class="font-bold mt-4">Offers</h4>' + j.results.offers.map(o=>`<div class="p-3 border rounded mb-2"><div class="font-medium">${escapeHtml((o.title && o.title[state.lang]) || o.title_en || o.title || '')}</div><div class="text-sm text-gray-500">${escapeHtml(o.location||'')}</div><div class="mt-2"><button onclick="openDetail(${o.id})" class="text-yellow-500 font-bold">Open</button></div></div>`).join(''));
        }
        if (j.results.users && j.results.users.length) {
            parts.push('<h4 class="font-bold mt-4 mb-3">Users</h4>' + j.results.users.map(u=>`<div class="p-4 border rounded mb-3 bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="openTraineeProfile(${u.id})"><div class="flex items-start gap-3"><div>${u.profile_pic ? `<img src="${u.profile_pic}" class="w-12 h-12 rounded-full object-cover" />` : `<div class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">${(u.name || 'U').charAt(0).toUpperCase()}</div>`}</div><div class="flex-1"><div class="font-medium">${escapeHtml(u.name)}</div><div class="text-sm text-gray-500">${escapeHtml(u.email||'')}</div>${u.bio ? `<div class="text-sm text-gray-600 mt-1">${escapeHtml(u.bio)}</div>` : ''}</div></div></div>`).join(''));
        }
        el.innerHTML = parts.length ? parts.join('') : '<div class="text-gray-500 p-4">No results</div>';
    }).catch(err=>{ console.error(err); el.innerHTML = '<div class="text-red-500">Error</div>'; });
}

function getSearchHTML() {
    const q = state.searchQuery || '';
    return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
                <input id="search-input" value="${escapeHtml(q)}" class="w-full p-3 border rounded" placeholder="Search posts, offers, users..." />
                <div class="mt-3 flex gap-2">
                    <button onclick="doSearch(document.getElementById('search-input').value, 'all')" class="px-4 py-2 bg-slate-900 text-white rounded">Search All</button>
                    <button onclick="doSearch(document.getElementById('search-input').value, 'posts')" class="px-4 py-2 border rounded">Posts</button>
                    <button onclick="doSearch(document.getElementById('search-input').value, 'offers')" class="px-4 py-2 border rounded">Offers</button>
                    <button onclick="doSearch(document.getElementById('search-input').value, 'users')" class="px-4 py-2 border rounded">Users</button>
                </div>
            </div>
            <div id="search-results"></div>
        </div>
    `;
}


function getApplyHTML() {
    const job = state.selectedJob || internships[0];
    const t = translations[state.lang];
    return `
        <div class="max-w-3xl mx-auto px-4 py-12">
            <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                <div class="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-16 -mt-16"></div>
                    <div class="relative z-10">
                        <h2 class="text-3xl font-bold font-serif mb-2">${t.applyNow}</h2>
                        <p class="text-yellow-500 text-sm font-medium">${(job.title && job.title[state.lang]) || job.title_en || job.title || ''} - ${job.hotel}</p>
                    </div>
                    <div class="relative z-10 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg"><i data-lucide="briefcase" class="w-8 h-8 text-yellow-500"></i></div>
                </div>
                <div class="p-10">
                    <form class="space-y-8" onsubmit="event.preventDefault(); submitApplication();">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.fullName}</label><input type="text" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white font-medium text-slate-900" placeholder="Ahmed Etudiant" /></div>
                            <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.phone}</label><input type="tel" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white font-medium text-slate-900" placeholder="0600000000" /></div>
                        </div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label><input type="email" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white font-medium text-slate-900" placeholder="email@cmc-agadir.ma" /></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.institution}</label><select class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none bg-gray-50 focus:bg-white transition cursor-pointer font-medium text-slate-900 appearance-none"><option>CMC Agadir (Cité des Métiers)</option><option>ISTA (Institut Spécialisé)</option><option>ITA (Institut de Technologie)</option><option>Autre</option></select></div>
                        <div onclick="document.getElementById('file-input').click()" class="border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer bg-gray-50 flex flex-col items-center justify-center group hover:border-yellow-500 hover:bg-yellow-50/50">
                            <div class="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition duration-300"><i data-lucide="upload" class="w-8 h-8 text-yellow-500"></i></div>
                            <p class="text-slate-900 font-bold text-lg">${t.uploadCV}</p>
                            <p class="text-sm text-gray-500 mt-2 font-medium">${t.pdfOrDocx}</p>
                        </div>
                        <input type="file" id="file-input" name="resume" class="hidden" accept=".pdf,.doc,.docx" onchange="document.getElementById('selected-resume-name').textContent = this.files && this.files[0] ? this.files[0].name : ''" />
                        <div id="selected-resume-name" class="text-xs text-gray-500 mt-2"></div>
                        <div class="flex gap-4 pt-6 border-t border-gray-100">
                            <button type="button" onclick="navigateTo('detail')" class="w-1/3 py-4 border border-gray-200 rounded-xl font-bold text-gray-500 hover:text-slate-900 hover:bg-gray-50 transition">${t.cancel}</button>
                            <button type="submit" class="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-xl shadow-slate-900/20 transition transform hover:-translate-y-1 text-lg">${t.submitApplication}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function getSuccessHTML() {
    const t = translations[state.lang];
    return `
        <div class="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
            <div class="bg-green-50 p-10 rounded-full mb-8 shadow-lg"><i data-lucide="check-circle" class="w-24 h-24 text-green-500 animate-bounce"></i></div>
            <h2 class="text-5xl font-bold text-slate-900 mb-6 font-serif">Success!</h2>
            <p class="text-gray-500 max-w-lg text-xl mb-10 leading-relaxed">Your application has been submitted successfully to the HR department. Good luck!</p>
            <button onclick="navigateTo('home')" class="bg-slate-900 text-white px-12 py-4 rounded-full font-bold hover:bg-slate-800 transition shadow-2xl transform hover:-translate-y-1 text-lg">${t.home}</button>
        </div>
    `;
}

function getLoginHTML() {
    const t = translations[state.lang];
    return `
        <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div class="relative max-w-5xl w-full">
                	<div class="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                <div class="md:w-1/2 p-10 md:p-16 flex flex-col justify-center">
                    <div class="flex items-center mb-12 cursor-pointer group w-fit" onclick="navigateTo('home')">
                         <div class="relative w-10 h-10 flex items-center justify-center">
                            <div class="absolute inset-0 rounded-full blur-md bg-yellow-500/10"></div>
                            <div class="relative w-full h-full rounded-xl flex items-center justify-center border shadow-lg bg-white border-slate-200">
                                <i data-lucide="award" class="w-5 h-5 text-yellow-500"></i>
                            </div>
                        </div>
                        <div class="flex flex-col mx-2">
                            <span class="font-serif font-bold text-xl leading-none tracking-wide text-slate-900">Stage<span class="text-yellow-500">Connect</span></span>
                        </div>
                    </div>
                    <h2 class="text-4xl font-bold text-slate-900 mb-3 font-serif">${t.welcomeBack}</h2>
                    <p class="text-gray-500 mb-10 text-lg leading-relaxed">${t.loginDesc}</p>
                    <form class="space-y-6" onsubmit="event.preventDefault();">
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.email}</label><input type="email" id="login-email" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white text-slate-900 font-medium" placeholder="name@example.com" /></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.password}</label><input type="password" id="login-password" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white text-slate-900 font-medium" placeholder="••••••••" /></div>
                        <div class="flex gap-4 pt-4">
                            <button type="button" onclick="performLogin('trainee')" class="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition shadow-xl shadow-slate-900/20 transform hover:-translate-y-0.5 text-base flex items-center justify-center gap-2"><i data-lucide="user" class="w-4 h-4"></i> ${t.loginAsTrainee}</button>
                            <button type="button" onclick="performLogin('employer')" class="w-1/2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-4 rounded-xl transition shadow-xl shadow-yellow-500/20 transform hover:-translate-y-0.5 text-base flex items-center justify-center gap-2"><i data-lucide="building" class="w-4 h-4"></i> ${t.loginAsEmployer}</button>
                        </div>
                        <div class="pt-4 text-sm text-gray-500">
                            ${t.noAccount} <a href="#" onclick="navigateTo('signup'); return false;" class="text-yellow-500 font-semibold">${t.createAccount}</a>
                        </div>
                    </form>
                </div>
                <div class="md:w-1/2 bg-slate-900 text-white p-12 flex flex-col justify-center relative overflow-hidden">
                    <div class="absolute inset-0"><img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=1000" class="w-full h-full object-cover opacity-20" /><div class="absolute inset-0 bg-slate-900/40 mix-blend-multiply"></div></div>
                    <div class="relative z-10"><h3 class="text-4xl font-bold mb-6 font-serif leading-tight">Your Gateway to<br/><span class="text-yellow-500">Luxury Hospitality</span></h3></div>
                </div>
            </div>
        </div>
    `;
}

function getSignupHTML() {
    const t = translations[state.lang];
    return `
        <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div class="relative max-w-5xl w-full">
                	<div class="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                <div class="md:w-1/2 p-10 md:p-16 flex flex-col justify-center">
                    <div class="flex items-center mb-12 cursor-pointer group w-fit" onclick="navigateTo('home')">
                         <div class="relative w-10 h-10 flex items-center justify-center">
                            <div class="absolute inset-0 rounded-full blur-md bg-yellow-500/10"></div>
                            <div class="relative w-full h-full rounded-xl flex items-center justify-center border shadow-lg bg-white border-slate-200">
                                <i data-lucide="award" class="w-5 h-5 text-yellow-500"></i>
                            </div>
                        </div>
                        <div class="flex flex-col mx-2">
                            <span class="font-serif font-bold text-xl leading-none tracking-wide text-slate-900">Stage<span class="text-yellow-500">Connect</span></span>
                        </div>
                    </div>
                    <h2 class="text-4xl font-bold text-slate-900 mb-3 font-serif">${t.createAccount}</h2>
                    <p class="text-gray-500 mb-10 text-lg leading-relaxed">${t.loginDesc}</p>
                    <form class="space-y-6" onsubmit="event.preventDefault();">
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.fullName}</label><input type="text" id="signup-name" class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white text-slate-900 font-medium" placeholder="${t.fullName}" /></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.email}</label><input type="email" id="signup-email" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white text-slate-900 font-medium" placeholder="name@example.com" /></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.password}</label><input type="password" id="signup-password" required class="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition bg-gray-50 focus:bg-white text-slate-900 font-medium" placeholder="••••••••" /></div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">${t.loginAsTrainee} / ${t.loginAsEmployer}</label>
                            <select id="signup-type" class="w-full px-5 py-4 border border-gray-200 rounded-xl bg-gray-50">
                                <option value="trainee">${t.loginAsTrainee}</option>
                                <option value="employer">${t.loginAsEmployer}</option>
                            </select>
                        </div>
                        <div class="flex gap-4 pt-4">
                            <button type="button" onclick="performSignup()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition shadow-xl">${t.createAccount}</button>
                        </div>
                        <div class="pt-4 text-sm text-gray-500">${t.alreadyAccount} <a href="#" onclick="navigateTo('login'); return false;" class="text-yellow-500 font-semibold">${t.login}</a></div>
                    </form>
                </div>
                <div class="md:w-1/2 bg-slate-900 text-white p-12 flex flex-col justify-center relative overflow-hidden">
                    <div class="absolute inset-0"><img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=1000" class="w-full h-full object-cover opacity-20" /><div class="absolute inset-0 bg-slate-900/40 mix-blend-multiply"></div></div>
                    <div class="relative z-10"><h3 class="text-4xl font-bold mb-6 font-serif leading-tight">${t.heroHighlight}</h3></div>
                </div>
            </div>
        </div>
    `;
}

function getProfileHTML() {
    const t = translations[state.lang];
    const user = state.user;
    
    // This should never be reached without login due to checkPageAccess
    // but as a safety check:
    if (!user) {
        return '';
    }
    
    const apps = state.traineeApplications || [];
    let appsHTML = '';
    if (apps.length === 0) {
        appsHTML = `<div class="p-8 text-center text-gray-500">${t.noApps}</div>`;
    } else {
        const rows = apps.map(app => `
            <tr class="bg-white hover:bg-gray-50 border-b border-gray-100 transition">
                <td class="px-6 py-4 font-bold text-slate-900">${app.hotel}</td>
                <td class="px-6 py-4 text-gray-600">${app.role[state.lang] || app.role.en}</td>
                <td class="px-6 py-4 text-gray-500 text-sm">${app.date}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${app.status === 'approved' ? 'bg-green-100 text-green-700' : app.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${app.status === 'approved' ? t.approved : app.status === 'rejected' ? t.rejected : t.pending}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="deleteApplication(${app.id})" class="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">${t.delete || 'Delete'}</button>
                    </div>
                </td>
            </tr>
        `).join('');
        appsHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left rtl:text-right">
                    <thead class="text-xs text-gray-400 uppercase bg-gray-50/30">
                        <tr>
                            <th class="px-6 py-4 font-semibold">${t.colHotel}</th>
                            <th class="px-6 py-4 font-semibold">${t.colRole}</th>
                            <th class="px-6 py-4 font-semibold">${t.applicationDate}</th>
                            <th class="px-6 py-4 font-semibold">${t.status}</th>
                            <th class="px-6 py-4 font-semibold">${t.actions || 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
    // Posts area
    const posts = state.userPosts || [];
    const postsHTML = posts.map(p => {
        const isOwner = state.user && state.user.id === p.user_id;
        const img = p.image_path ? `<img src="${p.image_path}" class="w-full rounded-xl mt-3" />` : '';
        return `
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold">${(p.author_name||'U').charAt(0)}</div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <div class="text-sm font-medium text-slate-900"><a href="#" onclick="openTraineeProfile(${p.user_id}); return false;">${escapeHtml(p.author_name || 'User')}</a></div>
                            <div class="text-xs text-gray-400">${p.created_at || ''}</div>
                        </div>
                        <div id="view-${p.id}"><p class="text-sm text-gray-800 mt-2">${escapeHtml(p.content || '')}</p>${img}</div>
                        <div id="edit-${p.id}" style="display:none">
                            <textarea id="post-edit-${p.id}" class="w-full p-3 border rounded-md">${escapeHtml(p.content || '')}</textarea>
                            <div class="flex gap-2 mt-2">
                                <button onclick="editPost(${p.id})" class="px-3 py-2 bg-green-600 text-white rounded">Save</button>
                                <button onclick="document.getElementById('edit-${p.id}').style.display='none'; document.getElementById('view-${p.id}').style.display='block';" class="px-3 py-2 rounded border">Cancel</button>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center gap-3 text-sm text-gray-500">
                            <button onclick="toggleLike(${p.id})" ${pendingLikes.has(p.id) ? 'disabled' : ''} class="px-2 py-1 rounded ${p.liked_by_me ? 'bg-yellow-50 text-yellow-600' : 'hover:bg-gray-50'} ${pendingLikes.has(p.id) ? 'opacity-50 pointer-events-none' : ''}">❤ ${p.likes_count || 0}</button>
                            <button onclick="toggleComments(${p.id});" class="px-2 py-1 rounded">💬 Comments</button>
                            ${isOwner ? `<button onclick="document.getElementById('view-${p.id}').style.display='none'; document.getElementById('edit-${p.id}').style.display='block';" class="px-2 py-1 rounded">Edit</button>` : ''}
                            ${isOwner ? `<button onclick="deletePost(${p.id})" class="px-2 py-1 rounded text-red-600">Delete</button>` : ''}
                        </div>
                        <div id="comments-${p.id}" class="mt-3" style="display:none">
                            <div id="comments-list-${p.id}"></div>
                            <div class="mt-2">
                                <textarea id="comment-input-${p.id}" class="w-full p-2 border rounded-md" placeholder="Write a comment..."></textarea>
                                <div class="mt-2 text-right"><button onclick="submitComment(${p.id})" class="px-3 py-2 bg-slate-900 text-white rounded">Post</button></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `<div class="text-gray-500 p-6">No posts yet.</div>`;

    return `
        <div class="max-w-6xl mx-auto px-4 py-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="md:col-span-1">
                    <div class="bg-white rounded-3xl shadow-lg p-8 text-center border border-gray-100 relative overflow-hidden">
                        <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-900 to-slate-800"></div>
                        <div class="relative z-10">
                            <div class="w-24 h-24 bg-white p-1 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg"><div class="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-3xl font-bold text-slate-500 font-serif">${user.name.charAt(0)}</div></div>
                                <h2 id="profile-name" class="text-xl font-bold text-slate-900 font-serif mb-1">${user.name}</h2>
                                <p id="profile-email" class="text-sm text-gray-500 mb-6 font-medium">${user.email}</p>
                                <div class="space-y-3 text-start">
                                    <button onclick="openEditProfile()" class="w-full flex items-center gap-3 p-3.5 rounded-xl bg-yellow-500 text-slate-900 font-medium"><i data-lucide="edit" class="w-5 h-5"></i> Edit Profile</button>
                                    <button onclick="performLogout()" class="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-red-50 text-red-600 transition mt-2 border border-transparent hover:border-red-100 font-medium"><i data-lucide="log-out" class="w-5 h-5"></i> ${t.logout}</button>
                                </div>
                                <div id="profile-edit-form" style="display:none" class="mt-4 text-left">
                                    <label class="text-xs text-gray-500">${t.fullName}</label>
                                    <input id="edit-name" type="text" class="w-full px-3 py-2 border rounded mb-2" value="${user.name}" />
                                    <label class="text-xs text-gray-500">${t.email}</label>
                                    <input id="edit-email" type="email" class="w-full px-3 py-2 border rounded mb-2" value="${user.email}" />
                                    <label class="text-xs text-gray-500">Bio</label>
                                    <textarea id="edit-bio" class="w-full px-3 py-2 border rounded mb-2">${user.bio || ''}</textarea>
                                    <label class="text-xs text-gray-500">Profile Picture</label>
                                    <input id="edit-pic" type="file" accept="image/*" class="w-full mb-3" />
                                    <div class="flex gap-2">
                                        <button onclick="submitEditProfile()" class="px-3 py-2 bg-green-600 text-white rounded">Save</button>
                                        <button onclick="closeEditProfile()" class="px-3 py-2 rounded border">Cancel</button>
                                    </div>
                                    <div id="edit-profile-msg" class="text-sm text-red-600 mt-2"></div>
                                </div>
                        </div>
                    </div>
                </div>
                <div class="md:col-span-3">
                    <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-100"><h3 class="font-bold text-xl text-slate-900 font-serif">${t.myApplications}</h3></div>
                        ${appsHTML}
                    </div>

                    <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden p-6 mb-6">
                        <h3 class="font-bold text-lg mb-4">Create Post</h3>
                        <textarea id="new-post-content" class="w-full border p-3 rounded-md mb-3" placeholder="What's on your mind?"></textarea>
                        <input id="new-post-image" type="file" accept="image/*" class="mb-3" />
                        <div><button onclick="createPost()" class="px-4 py-2 bg-slate-900 text-white rounded">Post</button></div>
                    </div>

                    <div>
                        <h3 class="font-bold text-lg mb-4">Posts</h3>
                        ${postsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Simple escape to prevent inserting raw HTML from content
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Social Media Feed
function getSocialFeedHTML() {
    const t = translations[state.lang];
    const posts = state.userPosts || [];
    
    // Create post composer
    const composerHTML = `
        <div class="max-w-2xl mx-auto mb-8">
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div class="flex gap-4">
                    <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">${(state.user.name || 'U').charAt(0)}</div>
                    <div class="flex-1">
                        <textarea id="new-post-content" placeholder="${t.writePost}" class="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 outline-none resize-none" rows="3"></textarea>
                        <div class="mt-4 flex gap-2 justify-end">
                            <button onclick="document.getElementById('social-post-image').click()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                                🖼 ${t.image || 'Image'}
                            </button>
                            <input type="file" id="social-post-image" class="hidden" accept="image/*" />
                            <button onclick="createSocialPost()" class="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold rounded-lg transition">
                                ${t.posts || 'Post'}
                            </button>
                        </div>
                        <div id="social-post-image-name" class="text-xs text-gray-500 mt-2"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Posts feed
    const postsHTML = posts.map(p => {
        const isOwner = state.user && state.user.id === p.user_id;
        const img = p.image_path ? `<img src="${p.image_path}" class="w-full rounded-xl mt-4 max-h-96 object-cover" />` : '';
        return `
            <div class="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 cursor-pointer hover:bg-slate-200 transition" onclick="openTraineeProfile(${p.user_id})">${(p.author_name||'U').charAt(0)}</div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <div>
                                <p class="font-bold text-slate-900 cursor-pointer hover:text-yellow-600 transition" onclick="openTraineeProfile(${p.user_id})">${escapeHtml(p.author_name || 'User')}</p>
                                <p class="text-xs text-gray-400">${p.created_at || ''}</p>
                            </div>
                            ${isOwner ? `
                                <div class="flex gap-1">
                                    <button onclick="editPost(${p.id})" class="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">Edit</button>
                                    <button onclick="deletePost(${p.id})" class="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded">Delete</button>
                                </div>
                            ` : ''}
                        </div>
                        <p class="text-slate-900 mb-3">${escapeHtml(p.content || '')}</p>
                        ${img}
                        <div class="mt-4 flex items-center gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                            <button onclick="toggleLike(${p.id})" ${pendingLikes.has(p.id) ? 'disabled' : ''} class="flex items-center gap-2 px-3 py-1 rounded-lg ${p.liked_by_me ? 'bg-red-50 text-red-600' : 'hover:bg-gray-100'} transition ${pendingLikes.has(p.id) ? 'opacity-50 pointer-events-none' : ''}">
                                ❤ ${p.likes_count || 0}
                            </button>
                            <button onclick="toggleComments(${p.id})" class="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-100 transition">
                                💬 Comments
                            </button>
                        </div>
                        <div id="comments-${p.id}" class="mt-4" style="display:none">
                            <div id="comments-list-${p.id}" class="mb-3"></div>
                            <textarea id="comment-input-${p.id}" placeholder="Write a comment..." class="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-100 outline-none resize-none" rows="2"></textarea>
                            <button onclick="submitComment(${p.id})" class="mt-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold rounded-lg transition text-sm">Post</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || `<div class="text-center text-gray-500 py-12">${t.noPostsYet}</div>`;
    
    return `
        <div class="bg-gray-50 min-h-screen py-8">
            <div class="max-w-2xl mx-auto px-4">
                <h2 class="text-3xl font-bold text-slate-900 mb-8 font-serif">${t.feed}</h2>
                ${composerHTML}
                ${postsHTML}
            </div>
        </div>
    `;
}

function getEmployerDashboardHTML() {
    const t = translations[state.lang];
    const user = state.user || { name: 'Hotel' };
    // Group applications by internship (announcement)
    const groups = {};
    (employerApplications || []).forEach(app => {
        const key = app.internship_id || 'no-internship';
        if (!groups[key]) groups[key] = { internship_id: app.internship_id, title: app.position || 'General', apps: [] };
        groups[key].apps.push(app);
    });

    // Build HTML sections per announcement
    let announcementsHTML = Object.keys(groups).map(k => {
        const g = groups[k];
        const heading = g.title || 'Announcement';
        const rows = g.apps.map(app => `
            <tr class="bg-white hover:bg-gray-50 border-b border-gray-100 transition">
                <td class="px-6 py-4">
                    <input type="checkbox" class="app-checkbox" data-app-id="${app.id}" ${state.selectedApplicationIds.has(app.id) ? 'checked' : ''} onchange="toggleAppSelect(${app.id})" />
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold font-serif">${app.avatar}</div>
                        <span class="font-bold text-slate-900">${app.name}</span>
                        <div class="text-xs text-gray-400 ml-3">${app.email}</div>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-600">${heading}</td>
                <td class="px-6 py-4 text-gray-500 text-sm">${app.date}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${app.status === 'approved' ? 'bg-green-100 text-green-700' : app.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${app.status === 'approved' ? t.approved : app.status === 'rejected' ? t.rejected : t.pending}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="viewCV(${app.id})" class="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition" title="${t.viewCV}"><i data-lucide="file-text" class="w-4 h-4"></i></button>
                        <button onclick="updateApplicationStatus(${app.id}, 'approved')" class="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-100 transition" title="${t.accept}"><i data-lucide="check" class="w-4 h-4"></i></button>
                        <button onclick="updateApplicationStatus(${app.id}, 'rejected')" class="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition" title="${t.reject}"><i data-lucide="x" class="w-4 h-4"></i></button>
                        <button onclick="deleteApplication(${app.id})" class="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition" title="${t.delete || 'Delete'}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="mb-6">
                <div class="px-6 py-4 bg-gray-50 border-b border-gray-100 font-semibold flex justify-between items-center">
                    <div>${heading} <span class="text-sm text-gray-400">(${g.apps.length} ${t.receivedApps})</span></div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left rtl:text-right">
                        <thead class="text-xs text-gray-400 uppercase bg-gray-50">
                            <tr>
                                <th class="px-6 py-4 font-semibold"><input type="checkbox" class="select-all-checkbox" ${g.apps.length > 0 && g.apps.every(a => state.selectedApplicationIds.has(a.id)) ? 'checked' : ''} onchange="toggleSelectAll(this)" /></th>
                                <th class="px-6 py-4 font-semibold">${t.applicant}</th>
                                <th class="px-6 py-4 font-semibold">${t.position}</th>
                                <th class="px-6 py-4 font-semibold">${t.applicationDate}</th>
                                <th class="px-6 py-4 font-semibold">${t.status}</th>
                                <th class="px-6 py-4 font-semibold">${t.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
    return `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="md:col-span-1">
                    <div class="bg-white rounded-3xl shadow-lg p-8 text-center border border-gray-100 sticky top-24">
                        <div class="w-24 h-24 bg-yellow-50 p-1 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm">
                            <i data-lucide="building" class="w-10 h-10 text-yellow-600"></i>
                        </div>
                        <h2 class="text-xl font-bold text-slate-900 font-serif mb-1">${user.name}</h2>
                        <p class="text-sm text-gray-500 mb-6 font-medium">Hotel Manager</p>
                        <div class="space-y-3 text-start">
                            <button onclick="goToDashboard()" class="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-900 text-white font-medium shadow-md shadow-slate-900/10">
                                <i data-lucide="layout-dashboard" class="w-5 h-5"></i> ${t.dashboard}
                            </button>
                            <button onclick="createOffer()" class="w-full flex items-center gap-3 p-3.5 rounded-xl bg-green-600 text-white font-medium shadow-md mt-3 hover:bg-green-700">
                                <i data-lucide="plus" class="w-5 h-5"></i> ${t.createOffer || 'Create Offer'}
                            </button>
                            <button onclick="deleteAllOffers()" class="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-red-50 text-red-600 transition mt-2 border border-transparent hover:border-red-100 font-medium">
                                <i data-lucide="trash-2" class="w-5 h-5"></i> Delete All Offers
                            </button>
                            <button onclick="performLogout()" class="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-red-50 text-red-600 transition mt-4 border border-transparent hover:border-red-100 font-medium">
                                <i data-lucide="log-out" class="w-5 h-5"></i> ${t.logout}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="md:col-span-3">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div class="p-4 bg-purple-50 rounded-2xl text-purple-600"><i data-lucide="users" class="w-8 h-8"></i></div>
                            <div><p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">${t.receivedApps}</p><h3 class="text-3xl font-bold text-slate-900">${employerApplications.length}</h3></div>
                        </div>
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div class="p-4 bg-yellow-50 rounded-2xl text-yellow-600"><i data-lucide="clock" class="w-8 h-8"></i></div>
                            <div><p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">${t.pending}</p><h3 class="text-3xl font-bold text-slate-900">${employerApplications.filter(a => a.status === 'pending').length}</h3></div>
                        </div>
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                            <div class="p-4 bg-green-50 rounded-2xl text-green-600"><i data-lucide="check-circle" class="w-8 h-8"></i></div>
                            <div><p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">${t.approved}</p><h3 class="text-3xl font-bold text-slate-900">${employerApplications.filter(a => a.status === 'approved').length}</h3></div>
                        </div>
                    </div>
                    <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden p-6">
                        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                            <h3 class="font-bold text-xl text-slate-900 font-serif">${t.receivedApps}</h3>
                            <div class="flex items-center gap-3">
                                ${state.selectedApplicationIds.size > 0 ? `
                                    <button onclick="bulkDeleteApplications()" class="text-xs px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center gap-1 font-medium">
                                        <i data-lucide="trash-2" class="w-3 h-3"></i> Delete ${state.selectedApplicationIds.size} Selected
                                    </button>
                                ` : ''}
                                <button onclick="refreshDashboardNow()" class="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Refresh</button>
                                <div class="flex items-center gap-2">
                                    <div class="animate-pulse w-2 h-2 rounded-full bg-green-500"></div>
                                    <span class="text-xs text-gray-500">Live</span>
                                </div>
                            </div>
                        </div>
                        <div class="p-6">
                            ${announcementsHTML || `<div class="text-gray-500">${t.noApps}</div>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Logic & Event Handlers ---

function navigateTo(page) {
    // Debug: log navigations to help trace unexpected redirects
    try {
        if (typeof console !== 'undefined') {
            if (page === 'employer' || page === 'profile' || page === 'traineeProfile') {
                console.log('[navigateTo] ->', page, 'hash=', window.location.hash, 'time=', new Date().toISOString());
                try { throw new Error('navigateTo stack'); } catch(e) { console.log(e.stack); }
            }
        }
    } catch (e) {}
    // Admin pages require an admin session. If not present, redirect to login first.
    if (page === 'admin') {
        if (!state.user || !state.user.is_admin) {
            // remember desired page and send to login
            state.postLoginRedirect = 'admin';
            alert('Admin access requires login. Please sign in with an admin account.');
            state.currentPage = 'login';
            renderApp();
            window.scrollTo(0,0);
            return;
        }
    }

    state.currentPage = page;
    // Update URL hash so refresh preserves page and parameters
    try {
        let param = '';
        if (page === 'detail' && state.selectedJob && state.selectedJob.id) param = '/' + encodeURIComponent(state.selectedJob.id);
        else if (page === 'hotelProfile' && state.selectedHotel) param = '/' + encodeURIComponent(state.selectedHotel);
        else if (page === 'traineeProfile' && state.selectedUserId) param = '/' + encodeURIComponent(state.selectedUserId);
        else if (page === 'search' && state.searchQuery) param = '/' + encodeURIComponent(state.searchQuery);
        const newHash = encodeURIComponent(page) + param;
        if (window.location.hash !== '#' + newHash) window.location.hash = newHash;
    } catch (e) { /* ignore */ }
    renderApp();
    window.scrollTo(0, 0);
}

function openDetail(jobId) {
    state.selectedJob = internships.find(j => j.id === jobId) || internships[0];
    navigateTo('detail');
}

function goToDashboard() {
    // Only allow employers and admins to access dashboard
    if (!state.user) {
        alert('You must be logged in');
        navigateTo('login');
        return;
    }
    
    if (state.userType !== 'employer' && !state.user.is_admin) {
        alert('You do not have permission to access the employer dashboard');
        navigateTo('home');
        return;
    }
    
    if (state.user.is_admin) {
        navigateTo('admin');
    } else if (state.userType === 'employer') {
        navigateTo('employer');
    }
}

function goToUserProfile() {
    // Route to the appropriate profile page based on user type
    if (!state.user) {
        navigateTo('login');
        return;
    }
    
    if (state.userType === 'employer') {
        navigateTo('employer');
    } else {
        navigateTo('profile');
    }
}

function changeLang(lang) {
    if (!lang || !['ar','fr','en'].includes(lang)) return;
    state.lang = lang;
    try { localStorage.setItem('sc_lang', lang); } catch (e) {}
    renderApp();
    // Ensure select dropdowns are updated after render
    setTimeout(() => {
        const selects = document.querySelectorAll('select[onchange*="changeLang"]');
        selects.forEach(sel => { sel.value = lang; });
    }, 10);
}

function updateSearch(term) {
    state.searchTerm = term;
    renderApp();
}

function updateRegion(region) {
    state.selectedRegion = region;
    renderApp();
}

async function performLogin(type = 'trainee', suppliedEmail = null, suppliedPassword = null) {
    // Do NOT set userType here - we'll validate against the user's actual type from DB
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = suppliedEmail !== null ? suppliedEmail : (emailInput && emailInput.value ? emailInput.value : '');
    const password = suppliedPassword !== null ? suppliedPassword : (passwordInput && passwordInput.value ? passwordInput.value : '');

    // Client-side validation to avoid sending empty credentials
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }

    try {
        const resp = await fetch('api/login.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });
        const j = await resp.json();
        if (resp.ok && j && j.success) {
            // Verify user type matches what they're trying to access
            const userType = j.user.type || 'trainee';
            if (userType !== type) {
                alert(`You are a ${userType === 'employer' ? 'hotel' : 'trainee'} user. Please login to the correct space.`);
                return;
            }
            
            state.user = j.user;
            state.userType = userType;
            
            // If we had a requested redirect (e.g., admin), and user is allowed, go there.
            if (state.postLoginRedirect) {
                const redirect = state.postLoginRedirect;
                state.postLoginRedirect = null;
                if (redirect === 'admin' && state.user && state.user.is_admin) {
                    navigateTo('admin');
                    return;
                }
            }
            
            // Redirect to appropriate dashboard based on user type
            if (userType === 'employer') {
                navigateTo('employer');
            } else {
                navigateTo('profile');
            }
        } else {
            alert('Login failed: ' + (j.error || 'Invalid credentials'));
        }
    } catch (err) {
        console.error('Login error', err);
        alert('Login error. Please try again later.');
    }
}

async function performLogout() {
    try {
        await fetch('api/logout.php', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {
        console.warn('Logout request failed', e);
    }
    state.user = null;
    state.userType = 'trainee';
    // stop background polling when logged out
    try { stopAutoUpdate(); } catch(e){}
    navigateTo('home');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) menu.classList.toggle('hidden');
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function removeNotification(index) {
    if (state.notifications && state.notifications[index]) {
        state.notifications.splice(index, 1);
        renderApp();
    }
}

function clearAllNotifications() {
    state.notifications = [];
    renderApp();
}


function openEditProfile() {
    const form = document.getElementById('profile-edit-form');
    if (!form) return;
    form.style.display = 'block';
}

function closeEditProfile() {
    const form = document.getElementById('profile-edit-form');
    if (!form) return;
    form.style.display = 'none';
    const msg = document.getElementById('edit-profile-msg'); if (msg) msg.textContent = '';
}

async function submitEditProfile() {
    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const pic = document.getElementById('edit-pic');
    const msg = document.getElementById('edit-profile-msg');
    if (msg) msg.textContent = '';

    const form = new FormData();
    form.append('name', name);
    form.append('email', email);
    form.append('bio', bio);
    if (pic && pic.files && pic.files[0]) form.append('profile_pic', pic.files[0]);

    try {
        const resp = await fetch('api/edit_profile.php', { method: 'POST', credentials: 'same-origin', body: form });
        const j = await resp.json();
        if (j && j.success) {
            // update local state.user from server return
            if (j.user) state.user = j.user;
            closeEditProfile();
            renderApp();
        } else {
            if (msg) msg.textContent = j.error || 'Update failed';
            else alert('Update failed: ' + (j.error || 'Unknown'));
        }
    } catch (e) {
        console.error('Profile update failed', e);
        if (msg) msg.textContent = 'Update failed';
    }
}

function submitApplication() {
    const t = translations[state.lang];
    const job = state.selectedJob || internships[0];
    // Collect form fields from DOM (first matching inputs in the apply form)
    const form = document.querySelector('#main-content form');
    if (!form) {
        navigateTo('success');
        return;
    }
    const name = form.querySelector('input[type="text"]') ? form.querySelector('input[type="text"]').value.trim() : '';
    const phone = form.querySelector('input[type="tel"]') ? form.querySelector('input[type="tel"]').value.trim() : '';
    const email = form.querySelector('input[type="email"]') ? form.querySelector('input[type="email"]').value.trim() : '';
    const school = form.querySelector('select') ? form.querySelector('select').value : '';
    const resumeInput = form.querySelector('input[type="file"]');
    const hasResume = resumeInput && resumeInput.files && resumeInput.files[0];

    // Validation
    if (!name) {
        notificationSystem.required(t.fullName);
        return;
    }
    if (!phone) {
        notificationSystem.required(t.phone);
        return;
    }
    if (!email) {
        notificationSystem.required(t.email);
        return;
    }
    if (!school) {
        notificationSystem.required(t.institution);
        return;
    }
    if (!hasResume) {
        notificationSystem.required('CV/Resume');
        return;
    }

    // Build FormData to include resume file if provided
    const fd = new FormData();
    fd.append('internship_id', job.id);
    fd.append('name', name);
    fd.append('email', email);
    fd.append('phone', phone);
    fd.append('school', school);
    if (hasResume) {
        fd.append('resume', resumeInput.files[0]);
    }

    fetch('api/submit_application.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd
    }).then(r => r.json()).then(j => {
        if (j && j.success) {
            const date = new Date().toISOString().split('T')[0];
            const newApp = { id: j.id || Date.now(), hotel: job.hotel, role: job.title, date: date, status: 'pending', image: job.image, resume_path: j.resume_path || null };
            if (!state.traineeApplications) state.traineeApplications = [];
            state.traineeApplications.unshift(newApp);
            // Also refresh applications for employer dashboard to see new applications immediately
            fetchApplicationsOnly().then(() => {
                notificationSystem.success(t.applicationStatusChanged);
                navigateTo('success');
            });
        } else {
            notificationSystem.error(t.fillAllFields || 'Submission failed');
        }
    }).catch(err => {
        console.error('Submit failed', err);
        notificationSystem.error('Network error while submitting');
    });
}

function updateApplicationStatus(appId, newStatus) {
    // Send update to server
    fetch('api/update_status.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId, status: newStatus })
    }).then(r => r.json()).then(j => {
        if (j && j.success) {
            const appIndex = employerApplications.findIndex(a => a.id === appId);
            if (appIndex !== -1) {
                employerApplications[appIndex].status = newStatus;
            }
            // also update traineeApplications if present
            if (state.traineeApplications) {
                const tIdx = state.traineeApplications.findIndex(a => a.id == appId);
                if (tIdx !== -1) state.traineeApplications[tIdx].status = newStatus;
            }
            renderApp();
        } else {
            alert('Could not update status: ' + (j.error || 'Unknown error'));
        }
    }).catch(err => {
        console.error('Status update failed', err);
        alert('Status update failed');
    });
}

function deleteApplication(appId) {
    if (!confirm('Delete this application?')) return;
    fetch('api/delete_application.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId })
    }).then(r => r.json()).then(j => {
        if (j && j.success) {
            const eIdx = employerApplications.findIndex(a => a.id === appId);
            if (eIdx !== -1) employerApplications.splice(eIdx, 1);
            if (state.traineeApplications) {
                const tIdx = state.traineeApplications.findIndex(a => a.id == appId);
                if (tIdx !== -1) state.traineeApplications.splice(tIdx, 1);
            }
            state.selectedApplicationIds.delete(appId);
            renderApp();
        } else {
            alert('Could not delete application: ' + (j.error || 'Unknown'));
        }
    }).catch(err => {
        console.error('deleteApplication failed', err);
        alert('Network error while deleting application');
    });
}

function toggleAppSelect(appId) {
    if (state.selectedApplicationIds.has(appId)) {
        state.selectedApplicationIds.delete(appId);
    } else {
        state.selectedApplicationIds.add(appId);
    }
    renderApp();
}

function toggleSelectAll(checkbox) {
    const allCheckboxes = document.querySelectorAll('.app-checkbox');
    if (checkbox.checked) {
        allCheckboxes.forEach(cb => {
            const appId = parseInt(cb.getAttribute('data-app-id'));
            if (appId) state.selectedApplicationIds.add(appId);
        });
    } else {
        allCheckboxes.forEach(cb => {
            const appId = parseInt(cb.getAttribute('data-app-id'));
            if (appId) state.selectedApplicationIds.delete(appId);
        });
    }
    renderApp();
}

function bulkDeleteApplications() {
    if (state.selectedApplicationIds.size === 0) {
        alert('Please select applications to delete.');
        return;
    }
    if (!confirm(`Delete ${state.selectedApplicationIds.size} application(s)? This action cannot be undone.`)) return;
    
    fetch('api/bulk_delete_applications.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(state.selectedApplicationIds) })
    }).then(r => r.json()).then(j => {
        if (j && j.success) {
            const deletedIds = new Set(j.deleted_ids || Array.from(state.selectedApplicationIds));
            employerApplications = employerApplications.filter(a => !deletedIds.has(a.id));
            if (state.traineeApplications) {
                state.traineeApplications = state.traineeApplications.filter(a => !deletedIds.has(a.id));
            }
            state.selectedApplicationIds.clear();
            renderApp();
        } else {
            alert('Bulk delete failed: ' + (j.error || 'Unknown error'));
        }
    }).catch(err => {
        console.error('bulkDeleteApplications failed', err);
        alert('Network error during bulk delete');
    });
}

function viewCV(appId) {
    const app = employerApplications.find(a => a.id === appId);
    if (!app) return;
    const t = translations[state.lang];
    const modalContent = document.getElementById('cv-modal-content');
    const modal = document.getElementById('cv-modal');
    const body = document.body;
    if (!modalContent || !modal) return;
    modalContent.innerHTML = `
        <div class="flex justify-between items-center p-6 border-b border-gray-100">
            <div>
                <h3 class="text-2xl font-bold text-slate-900">${app.name}</h3>
                <p class="text-gray-500 text-sm">${app.email} • ${app.phone}</p>
            </div>
            <button onclick="closeCVModal()" class="text-gray-400 hover:text-red-500 transition"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="p-8 space-y-6 flex-grow bg-gray-50">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h4 class="font-bold text-slate-900 mb-2 flex items-center gap-2"><i data-lucide="graduation-cap" class="w-4 h-4 text-blue-500"></i> ${t.education}</h4>
                    <p class="text-gray-600">${app.school}</p>
                    <p class="text-sm text-gray-400">Hospitality Management</p>
                </div>
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <h4 class="font-bold text-slate-900 mb-2 flex items-center gap-2"><i data-lucide="award" class="w-4 h-4 text-yellow-500"></i> ${t.skills}</h4>
                    <div class="flex flex-wrap gap-2">
                        ${app.skills.map(s => `<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
                <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-inner">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="bg-red-50 p-3 rounded-full"><i data-lucide="file-text" class="w-8 h-8 text-red-500"></i></div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg mb-1">${t.cvPreview}</h4>
                            <p class="text-gray-400 text-sm">${app.resume_path ? app.resume_path.split('/').pop() : ('CV_' + (app.name||'applicant').replace(/\s+/g,'_') + '.pdf')}</p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        ${app.resume_path ? `
                            ${/\.pdf$/i.test(app.resume_path) ? `<button onclick="toggleResumePreview(${app.id});" class="inline-flex items-center bg-white border border-gray-200 text-slate-900 px-4 py-2 rounded-lg hover:bg-gray-50"><i data-lucide="eye" class="w-4 h-4 mr-2"></i> Preview</button>` : ''}
                            <a href="${app.resume_path}" target="_blank" class="inline-flex items-center bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600"><i data-lucide="external-link" class="w-4 h-4 mr-2"></i> Open</a>
                            <a href="${app.resume_path}" download class="inline-flex items-center bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800"><i data-lucide="download" class="w-4 h-4 mr-2"></i> ${t.downloadCV}</a>
                        ` : `<button class="bg-slate-400 text-white px-6 py-2 rounded-lg" disabled>No CV</button>`}
                    </div>
                    ${app.resume_path && /\.pdf$/i.test(app.resume_path) ? `
                        <div id="resume-preview-${app.id}" class="mt-4" style="display:none">
                            <iframe id="resume-iframe-${app.id}" src="" class="w-full h-80 border rounded"></iframe>
                        </div>
                    ` : ''}
                </div>
        </div>
        <div class="p-4 border-t border-gray-100 flex justify-end gap-2 bg-white rounded-b-2xl">
            <button onclick="updateApplicationStatus(${app.id}, 'rejected'); closeCVModal()" class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-100">${t.reject}</button>
            <button onclick="updateApplicationStatus(${app.id}, 'approved'); closeCVModal()" class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition font-medium shadow-md">${t.accept}</button>
        </div>
    `;
    modal.classList.remove('opacity-0', 'pointer-events-none');
    body.classList.add('modal-active');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeCVModal() {
    const modal = document.getElementById('cv-modal');
    const body = document.body;
    if (!modal) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    body.classList.remove('modal-active');
}

function toggleResumePreview(appId) {
    const container = document.getElementById(`resume-preview-${appId}`);
    const iframe = document.getElementById(`resume-iframe-${appId}`);
    const app = employerApplications.find(a => a.id === appId);
    if (!container || !iframe || !app || !app.resume_path) return;
    if (container.style.display === 'none' || container.style.display === '') {
        iframe.src = app.resume_path;
        container.style.display = 'block';
    } else {
        iframe.src = '';
        container.style.display = 'none';
    }
}

document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.keyCode == 27) {
        closeCVModal();
    }
};

// If the embedding HTML set an initial page, use it.
if (window.__initialPage) state.currentPage = window.__initialPage;
// If URL hash is present, use it to set initial page (format: #page or #page/param)
function parseHashToState() {
    try {
        const h = window.location.hash || '';
        if (!h) return;
        const s = h.replace(/^#/, '');
        if (!s) return;
        const parts = s.split('/');
        const page = decodeURIComponent(parts[0] || '') || null;
        const param = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
        if (page) {
            state.currentPage = page;
            if (page === 'detail' && param) {
                const id = parseInt(param);
                if (!isNaN(id)) state.selectedJob = (internships || []).find(j => j.id === id) || state.selectedJob;
            }
            if (page === 'hotelProfile' && param) state.selectedHotel = param;
            if (page === 'traineeProfile' && param) state.selectedUserId = parseInt(param) || state.selectedUserId;
            if (page === 'search' && param) state.searchQuery = param;
        }
    } catch (e) { console.warn('hash parse error', e); }
}
// parse initial hash
parseHashToState();

// Keep state in sync when hash changes (back/forward or manual change)
window.onhashchange = function() {
    parseHashToState();
    // If we changed selectedJob or selectedHotel, ensure any necessary data is loaded
    renderApp();
};

// Fetch data from server (if API available) and then initialize app
async function fetchDataFromServer() {
    try {
        // Fetch internships
        const resp = await fetch('api/get_internships.php', { credentials: 'same-origin' });
        if (resp.ok) {
            const json = await resp.json();
            if (json.success && Array.isArray(json.data)) {
                internships = json.data;
            }
        }

        // Fetch applications and map for employer and trainee views
        const appsResp = await fetch('api/get_applications.php', { credentials: 'same-origin' });
        if (appsResp.ok) {
            const j = await appsResp.json();
            if (j.success && Array.isArray(j.data)) {
                const apps = j.data;
                // Build a quick map of internships by id
                const map = {};
                (internships || []).forEach(it => { map[it.id] = it; });

                // Map applications into two arrays: employerApplications and traineeApplications
                employerApplications = apps.map(a => ({
                    id: parseInt(a.id),
                    internship_id: a.internship_id ? parseInt(a.internship_id) : null,
                    name: a.applicant_name || a.email || 'Applicant',
                    position: (map[a.internship_id] && (map[a.internship_id].title && (map[a.internship_id].title[state.lang] || map[a.internship_id].title.en || ''))) || '',
                    date: a.date_applied || a.date || '',
                    status: a.status || 'pending',
                    avatar: (a.applicant_name && a.applicant_name.charAt(0)) || 'A',
                    email: a.email || '',
                    phone: a.phone || '',
                    school: a.school || '',
                    resume_path: a.resume_path || null,
                    skills: []
                }));

                // Trainee applications: show applications grouped for trainee profile
                state.traineeApplications = apps.map(a => ({
                    id: parseInt(a.id),
                    hotel: (map[a.internship_id] && map[a.internship_id].hotel) || '',
                    role: (map[a.internship_id] && map[a.internship_id].title) || { ar: '', fr: '', en: '' },
                    date: a.date_applied || a.date || '',
                    status: a.status || 'pending',
                    image: (map[a.internship_id] && map[a.internship_id].image) || ''
                }));
            }
        }
    } catch (e) {
        // If API is not present or fails, keep the in-file demo data.
        console.warn('Could not load backend data:', e);
    }
}

// Fetch posts for current user or all
async function fetchPosts() {
    try {
        // Always fetch the global feed of posts. Individual user profiles use `get_user_profile.php` to fetch that user's posts.
        const resp = await fetch('api/get_posts.php', { credentials: 'same-origin' });
        if (!resp.ok) return;
        const j = await resp.json();
        if (j && j.success) {
            state.userPosts = j.data;
        }
    } catch (e) {
        console.warn('Could not fetch posts', e);
    }
}

async function createPost() {
    const textarea = document.getElementById('new-post-content');
    const fileInput = document.getElementById('new-post-image');
    if (!textarea) return;
    const content = textarea.value.trim();
    const form = new FormData();
    form.append('content', content);
    if (fileInput && fileInput.files && fileInput.files[0]) form.append('image', fileInput.files[0]);

    try {
        const resp = await fetch('api/create_post.php', { method: 'POST', body: form, credentials: 'same-origin' });
        const j = await resp.json();
        if (j && j.success) {
            textarea.value = '';
            if (fileInput) fileInput.value = '';
            await fetchPosts();
            renderApp();
        } else {
            alert('Could not create post: ' + (j.error || 'Unknown'));
        }
    } catch (e) {
        console.error('Create post failed', e);
        alert('Failed to create post');
    }
}

async function createSocialPost() {
    const textarea = document.getElementById('new-post-content');
    const fileInput = document.getElementById('social-post-image');
    const t = translations[state.lang];
    
    if (!textarea) return;
    const content = textarea.value.trim();
    
    if (!content) {
        notificationSystem.warning(t.writePost || 'Write something first');
        return;
    }
    
    const form = new FormData();
    form.append('content', content);
    if (fileInput && fileInput.files && fileInput.files[0]) form.append('image', fileInput.files[0]);

    try {
        const resp = await fetch('api/create_post.php', { method: 'POST', body: form, credentials: 'same-origin' });
        const j = await resp.json();
        if (j && j.success) {
            notificationSystem.success(t.posts || 'Post created successfully!');
            textarea.value = '';
            if (fileInput) fileInput.value = '';
            document.getElementById('social-post-image-name').textContent = '';
            await fetchPosts();
            renderApp();
        } else {
            notificationSystem.error('Could not create post: ' + (j.error || 'Unknown'));
        }
    } catch (e) {
        console.error('Create post failed', e);
        notificationSystem.error('Failed to create post');
    }
}

async function editPost(postId) {
    const input = document.getElementById('post-edit-' + postId);
    if (!input) return;
    const content = input.value;
    try {
        const resp = await fetch('api/edit_post.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId, content: content }) });
        const j = await resp.json();
        if (j && j.success) {
            await fetchPosts(); renderApp();
        } else alert('Edit failed: ' + (j.error||'Unknown'));
    } catch (e) { console.error(e); alert('Edit failed'); }
}

async function deletePost(postId) {
    if (!confirm('Delete this post?')) return;
    try {
        const resp = await fetch('api/delete_post.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: postId }) });
        const j = await resp.json();
        if (j && j.success) { await fetchPosts(); renderApp(); } else alert('Delete failed');
    } catch (e) { console.error(e); alert('Delete failed'); }
}

async function toggleLike(postId) {
    if (!state.user) {
        notificationSystem.warning(translations[state.lang].login || 'Please login to like posts');
        return;
    }
    if (pendingLikes.has(postId)) return; // already in progress
    pendingLikes.add(postId);

    // helper to apply updates to any posts arrays we have in state
    const applyToLocal = (fn) => {
        if (Array.isArray(state.userPosts)) {
            const p = state.userPosts.find(x => x.id === postId);
            if (p) fn(p);
        }
        if (Array.isArray(state.selectedUserPosts)) {
            const p = state.selectedUserPosts.find(x => x.id === postId);
            if (p) fn(p);
        }
    };

    // optimistic update: flip local like state
    const prevs = [];
    applyToLocal(p => {
        prevs.push({ p, liked_by_me: p.liked_by_me, likes_count: p.likes_count });
        const liked = !!p.liked_by_me;
        p.liked_by_me = !liked;
        p.likes_count = (p.likes_count || 0) + (liked ? -1 : 1);
    });
    renderApp();

    try {
        const resp = await fetch('api/toggle_like.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: postId }) });
        let j = null;
        try { j = await resp.json(); } catch(e) { j = null; }

        if (!resp.ok) {
            // handle unauthorized specifically
            if (resp.status === 401) {
                // revert optimistic changes
                prevs.forEach(item => { item.p.liked_by_me = item.liked_by_me; item.p.likes_count = item.likes_count; });
                notificationSystem.warning(translations[state.lang].login || 'Please login to like posts');
                // try to refresh session info
                await checkSession();
            } else {
                prevs.forEach(item => { item.p.liked_by_me = item.liked_by_me; item.p.likes_count = item.likes_count; });
                const msg = j && j.error ? j.error : `Request failed (${resp.status})`;
                notificationSystem.error(msg);
            }
        } else if (j && j.success) {
            // sync server count and action if provided
            applyToLocal(p => {
                if (typeof j.count !== 'undefined') p.likes_count = j.count;
                if (typeof j.action !== 'undefined') p.liked_by_me = (j.action === 'liked');
            });
            // refresh posts in background to keep everything consistent
            await fetchPosts().catch(()=>{});
            // if viewing a profile, also refresh that profile's posts so they stay in sync
            if (state.currentPage === 'traineeProfile' && state.selectedUserId) {
                await loadTraineePosts(state.selectedUserId).catch(()=>{});
            }
            // show success with an "Undo" action to revert the like
            notificationSystem.success(translations[state.lang].liked || 'Updated', 4000, () => toggleLike(postId), 'Undo');
        } else {
            // revert optimistic changes
            prevs.forEach(item => { item.p.liked_by_me = item.liked_by_me; item.p.likes_count = item.likes_count; });
            const msg = j && j.error ? j.error : (translations[state.lang].likeFailed || 'Failed to like post');
            notificationSystem.error(msg);
        }
    } catch (e) {
        // revert optimistic changes
        prevs.forEach(item => { item.p.liked_by_me = item.liked_by_me; item.p.likes_count = item.likes_count; });
        console.error('Like failed', e);
        notificationSystem.error(translations[state.lang].likeError || 'Error liking post');
    } finally {
        pendingLikes.delete(postId);
        renderApp();
    }
}

async function fetchFollowInfo(userId) {
    try {
        const resp = await fetch(`api/get_follow_info.php?user_id=${userId}`);
        if (!resp.ok) return null;
        const j = await resp.json();
        return j && j.success ? j : null;
    } catch (e) { console.error('fetchFollowInfo failed', e); return null; }
}

async function followUser(userId) {
    if (!state.user) { notificationSystem.warning(translations[state.lang].login || 'Please login to follow users'); return; }
    try {
        const resp = await fetch('api/follow.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        const j = await resp.json();
        if (j && j.success) {
            notificationSystem.success('Followed');
            // refresh follow info
            const f = await fetchFollowInfo(userId);
            state.selectedUserFollowInfo = f ? { followers: f.followers||0, following: f.following||0, i_follow: !!f.i_follow } : { followers:0, following:0, i_follow:true };
            renderApp();
        } else {
            notificationSystem.error(j.error || 'Failed to follow');
        }
    } catch (e) { console.error('follow failed', e); notificationSystem.error('Error following user'); }
}

async function unfollowUser(userId) {
    if (!state.user) { notificationSystem.warning(translations[state.lang].login || 'Please login to unfollow users'); return; }
    try {
        const resp = await fetch('api/unfollow.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        const j = await resp.json();
        if (j && j.success) {
            notificationSystem.success('Unfollowed');
            const f = await fetchFollowInfo(userId);
            state.selectedUserFollowInfo = f ? { followers: f.followers||0, following: f.following||0, i_follow: !!f.i_follow } : { followers:0, following:0, i_follow:false };
            renderApp();
        } else {
            notificationSystem.error(j.error || 'Failed to unfollow');
        }
    } catch (e) { console.error('unfollow failed', e); notificationSystem.error('Error unfollowing user'); }
}

// --- Admin UI Helpers ---
async function fetchAdminUsers() {
    try {
        const resp = await fetch('api/admin_get_users.php', { credentials: 'same-origin' });
        if (!resp.ok) {
            alert('Failed to fetch users (unauthorized?)');
            return [];
        }
        const j = await resp.json();
        return (j && j.success && Array.isArray(j.data)) ? j.data : [];
    } catch (e) { console.error('admin fetch users failed', e); return []; }
}

async function adminDeleteUser(userId) {
    if (!confirm('Delete this user and all related data?')) return;
    try {
        const resp = await fetch('api/admin_delete_user.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId }) });
        const j = await resp.json();
        if (j && j.success) { alert('User deleted'); renderApp(); } else alert('Delete failed: ' + (j.error||'Unknown'));
    } catch (e) { console.error(e); alert('Delete failed'); }
}

async function adminResetPassword(userId) {
    // Prompt admin to enter a new password for the user (allows setting a specific password)
    const pw = prompt('Enter the new password for this user (leave empty to cancel):', '');
    if (pw === null || pw === '') return; // cancelled or empty
    try {
        const resp = await fetch('api/admin_edit_user.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, password: pw }) });
        const j = await resp.json();
        if (j && j.success) {
            alert('Password updated successfully.');
        } else {
            alert('Update failed: ' + (j && j.error ? j.error : 'Unknown'));
        }
    } catch (e) { console.error('reset failed', e); alert('Reset failed'); }
}

async function openAdminEdit(userId) {
    // find user in latest fetched list
    const users = await fetchAdminUsers();
    const u = users.find(x => parseInt(x.id) === parseInt(userId));
    if (!u) { alert('User not found'); return; }
    const name = prompt('Name:', u.name);
    if (name === null) return;
    const email = prompt('Email:', u.email);
    if (email === null) return;
    const isAdmin = confirm('Grant admin rights to this user? (OK = yes)');
    const pw = prompt('Set new password (leave empty to keep unchanged):', '');
    try {
        const resp = await fetch('api/admin_edit_user.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, name: name, email: email, is_admin: isAdmin ? 1 : 0, password: pw }) });
        const j = await resp.json();
        if (j && j.success) { alert('User updated'); renderApp(); } else alert('Update failed: ' + (j.error||'Unknown'));
    } catch (e) { console.error('update failed', e); alert('Update failed'); }
}

function getAdminHTML() {
    const t = translations[state.lang];
    return `
        <div class="min-h-[70vh] bg-slate-900 text-white py-12">
            <div class="max-w-6xl mx-auto p-6">
                <h2 class="text-2xl font-bold mb-6">Admin Dashboard</h2>
                
                <!-- Tabs -->
                <div class="flex gap-4 mb-6 border-b border-slate-700">
                    <button onclick="switchAdminTab('users')" id="admin-tab-users" class="px-4 py-2 border-b-2 border-yellow-500 text-yellow-500 font-semibold">Users</button>
                    <button onclick="switchAdminTab('offers')" id="admin-tab-offers" class="px-4 py-2 border-b-2 border-transparent text-slate-400 hover:text-white">Internship Offers</button>
                </div>

                <!-- Users Tab -->
                <div id="admin-tab-users-content">
                    <div id="admin-users-list">Loading users...</div>
                </div>

                <!-- Offers Tab -->
                <div id="admin-tab-offers-content" style="display: none;">
                    <div id="admin-offers-list">Loading offers...</div>
                </div>
            </div>
        </div>
    `;
}

// Render admin list after main render
const _oldRenderApp = renderApp;
renderApp = async function() {
    _oldRenderApp();
    if (state.currentPage === 'admin') {
        const el = document.getElementById('admin-users-list');
        if (el) {
            const users = await fetchAdminUsers();
            if (!users || users.length === 0) { el.innerHTML = '<p>No users found or unauthorized.</p>'; return; }
            el.innerHTML = `
                <div class="overflow-x-auto bg-slate-800 rounded-xl shadow p-4 border border-slate-700">
                    <table class="w-full text-sm table-auto">
                        <thead><tr class="text-left text-slate-300"><th class="px-3 py-2">ID</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Email</th><th class="px-3 py-2">Type</th><th class="px-3 py-2">Admin</th><th class="px-3 py-2">Created</th><th class="px-3 py-2">Updated</th><th class="px-3 py-2">Actions</th></tr></thead>
                        <tbody>
                        ${users.map(u => `
                            <tr class="border-t border-slate-700"><td class="py-2 px-3 text-slate-200">${u.id}</td><td class="py-2 px-3 text-slate-200">${escapeHtml(u.name||'')}</td><td class="py-2 px-3 text-slate-200">${escapeHtml(u.email||'')}</td><td class="py-2 px-3 text-slate-200">${escapeHtml(u.type||'')}</td><td class="py-2 px-3 text-slate-200">${u.is_admin ? 'Yes' : 'No'}</td><td class="py-2 px-3 text-slate-200">${u.created_at||''}</td><td class="py-2 px-3 text-slate-200">${u.updated_at||''}</td>
                            <td class="py-2 px-3">
                                <button onclick="openAdminEdit(${u.id})" class="px-3 py-1 mr-2 bg-yellow-500 text-slate-900 rounded">Edit</button>
                                <button onclick="adminResetPassword(${u.id})" class="px-3 py-1 mr-2 bg-blue-500 text-slate-900 rounded">Reset PW</button>
                                <button onclick="adminDeleteUser(${u.id})" class="px-3 py-1 bg-red-500 text-slate-900 rounded">Delete</button>
                            </td></tr>
                        `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Render offers tab if active
        const offersEl = document.getElementById('admin-offers-list');
        if (offersEl) {
            const offers = internships || [];
            if (offers.length === 0) {
                offersEl.innerHTML = '<p class="text-slate-400">No internship offers found.</p>';
                return;
            }
            const offerRows = offers.map(o => `
                <tr class="border-t border-slate-700">
                    <td class="py-2 px-3"><input type="checkbox" class="offer-checkbox" data-offer-id="${o.id}" ${state.selectedOfferIds && state.selectedOfferIds.has(o.id) ? 'checked' : ''} onchange="toggleOfferSelect(${o.id})" /></td>
                    <td class="py-2 px-3 text-slate-200">${o.id}</td>
                    <td class="py-2 px-3 text-slate-200">${escapeHtml(o.hotel || '')}</td>
                    <td class="py-2 px-3 text-slate-200">${escapeHtml(o.title && (o.title[state.lang] || o.title.en) || o.title || '')}</td>
                    <td class="py-2 px-3 text-slate-200">${escapeHtml(o.description && (o.description[state.lang] || o.description.en) || o.description || '').substring(0, 50)}...</td>
                    <td class="py-2 px-3 text-slate-200">${o.region || 'N/A'}</td>
                    <td class="py-2 px-3">
                        <button onclick="adminDeleteOffer(${o.id})" class="px-3 py-1 bg-red-500 text-slate-900 rounded hover:bg-red-600">Delete</button>
                    </td>
                </tr>
            `).join('');
            offersEl.innerHTML = `
                <div class="overflow-x-auto bg-slate-800 rounded-xl shadow p-4 border border-slate-700">
                    ${state.selectedOfferIds && state.selectedOfferIds.size > 0 ? `
                        <div class="mb-4">
                            <button onclick="bulkDeleteOffers()" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium">Delete ${state.selectedOfferIds.size} Selected Offers</button>
                        </div>
                    ` : ''}
                    <table class="w-full text-sm table-auto">
                        <thead><tr class="text-left text-slate-300"><th class="px-3 py-2"><input type="checkbox" ${internships && internships.length > 0 && internships.every(o => state.selectedOfferIds && state.selectedOfferIds.has(o.id)) ? 'checked' : ''} onchange="toggleSelectAllOffers(this)" /></th><th class="px-3 py-2">ID</th><th class="px-3 py-2">Hotel</th><th class="px-3 py-2">Title</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Region</th><th class="px-3 py-2">Action</th></tr></thead>
                        <tbody>
                            ${offerRows}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
};

function switchAdminTab(tab) {
    try { console.log('[admin] switchAdminTab', tab); } catch(e){}
    document.getElementById('admin-tab-users-content').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('admin-tab-offers-content').style.display = tab === 'offers' ? 'block' : 'none';
    
    document.getElementById('admin-tab-users').classList.toggle('border-yellow-500', tab === 'users');
    document.getElementById('admin-tab-users').classList.toggle('text-yellow-500', tab === 'users');
    document.getElementById('admin-tab-users').classList.toggle('border-transparent', tab !== 'users');
    document.getElementById('admin-tab-users').classList.toggle('text-slate-400', tab !== 'users');
    
    document.getElementById('admin-tab-offers').classList.toggle('border-yellow-500', tab === 'offers');
    document.getElementById('admin-tab-offers').classList.toggle('text-yellow-500', tab === 'offers');
    document.getElementById('admin-tab-offers').classList.toggle('border-transparent', tab !== 'offers');
    document.getElementById('admin-tab-offers').classList.toggle('text-slate-400', tab !== 'offers');
    try { console.log('[admin] tab classes toggled'); } catch(e){}
    renderApp();
}

// Check current session user from server
async function checkSession() {
    try {
        const resp = await fetch('api/whoami.php', { credentials: 'same-origin' });
        if (!resp.ok) return;
        const j = await resp.json();
        if (j && j.success && j.user) {
            state.user = j.user;
            state.userType = j.user.type || state.userType;
        }
    } catch (e) {
        console.warn('whoami failed', e);
    }
}

// Admin offer management
function toggleOfferSelect(offerId) {
    if (state.selectedOfferIds.has(offerId)) {
        state.selectedOfferIds.delete(offerId);
    } else {
        state.selectedOfferIds.add(offerId);
    }
    renderApp();
}

function toggleSelectAllOffers(checkbox) {
    const allCheckboxes = document.querySelectorAll('.offer-checkbox');
    if (checkbox.checked) {
        allCheckboxes.forEach(cb => {
            const offerId = parseInt(cb.getAttribute('data-offer-id'));
            if (offerId) state.selectedOfferIds.add(offerId);
        });
    } else {
        allCheckboxes.forEach(cb => {
            const offerId = parseInt(cb.getAttribute('data-offer-id'));
            if (offerId) state.selectedOfferIds.delete(offerId);
        });
    }
    renderApp();
}

function adminDeleteOffer(offerId) {
    if (!confirm('Delete this offer? Associated applications will be removed.')) return;
    fetch('api/delete_internship.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: offerId })
    }).then(r => r.json()).then(j => {
        if (j.success) {
            state.selectedOfferIds.delete(offerId);
            fetchDataFromServer().then(() => renderApp());
        } else {
            alert('Error: ' + (j.error || 'Delete failed'));
        }
    }).catch(e => {
        console.error('adminDeleteOffer error', e);
        alert('Network error');
    });
}

function bulkDeleteOffers() {
    if (state.selectedOfferIds.size === 0) {
        alert('Please select offers to delete.');
        return;
    }
    if (!confirm(`Delete ${state.selectedOfferIds.size} internship offer(s)? Associated applications will also be deleted. This action cannot be undone.`)) return;
    
    fetch('api/bulk_delete_internships.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(state.selectedOfferIds) })
    }).then(r => r.json()).then(j => {
        if (j.success) {
            state.selectedOfferIds.clear();
            fetchDataFromServer().then(() => renderApp());
        } else {
            alert('Error: ' + (j.error || 'Bulk delete failed'));
        }
    }).catch(e => {
        console.error('bulkDeleteOffers error', e);
        alert('Network error');
    });
}

// Signup helper
async function performSignup() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const typeSelect = document.getElementById('signup-type');
    const name = nameInput && nameInput.value ? nameInput.value : '';
    const email = emailInput && emailInput.value ? emailInput.value : '';
    const password = passwordInput && passwordInput.value ? passwordInput.value : '';
    const type = typeSelect && typeSelect.value ? typeSelect.value : 'trainee';

    try {
        const resp = await fetch('api/signup.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, email: email, password: password, type: type })
        });
        const j = await resp.json();
        if (resp.ok && j && j.success) {
            // Auto-login after signup using the provided email/password
            await performLogin(type, email, password);
        } else {
            alert('Signup failed: ' + (j.error || 'Could not create account'));
        }
    } catch (e) {
        console.error('Signup error', e);
        alert('Signup failed. Try again later.');
    }
}

// Initialize: load data, check session, then fetch posts and render
fetchDataFromServer()
    .then(() => checkSession())
    .then(async () => {
        // If the initial page was admin but the session is not an admin, redirect to login first
        if (state.currentPage === 'admin' && (!state.user || !state.user.is_admin)) {
            state.postLoginRedirect = 'admin';
            state.currentPage = 'login';
        }
        // If we had a requested redirect (e.g., admin), go there; otherwise preserve current page (don't force redirect on refresh)
        if (state.postLoginRedirect) { state.currentPage = state.postLoginRedirect; state.postLoginRedirect = null; }
        // Re-parse hash now that data (internships) has been loaded so selectedJob lookups can succeed
        try { parseHashToState(); } catch(e){}
        // If the initial hash points to a trainee profile, load that user's profile/posts so refresh shows data
        try {
            if (state.currentPage === 'traineeProfile' && state.selectedUserId) {
                await loadTraineePosts(state.selectedUserId);
            }
        } catch(e) { console.warn('preload trainee profile failed', e); }
        await fetchPosts();
    })
    .then(() => {
        renderApp();
        // start auto-update polling after initial render
        try { startAutoUpdate(); } catch(e){/* noop */}
    })
    .catch(() => renderApp());

// Auto-update: polling mechanism to refresh posts/internships/applications and update UI when changed
let __autoUpdateTimer = null;
let __lastPostsSnapshot = null;
let __lastInternshipsSnapshot = null;
let __lastApplicationsSnapshot = null;
let __lastApplicationCount = 0;

async function fetchApplicationsOnly() {
    // Fetch only applications (used in polling, not init)
    try {
        const appsResp = await fetch('api/get_applications.php', { credentials: 'same-origin' });
        if (appsResp.ok) {
            const j = await appsResp.json();
            if (j.success && Array.isArray(j.data)) {
                const apps = j.data;
                const map = {};
                (internships || []).forEach(it => { map[it.id] = it; });
                
                // Update applications based on user type
                if (state.userType === 'employer') {
                    // Employer: update employerApplications
                    employerApplications = apps.map(a => ({
                        id: parseInt(a.id),
                        internship_id: a.internship_id ? parseInt(a.internship_id) : null,
                        name: a.applicant_name || a.email || 'Applicant',
                        position: (map[a.internship_id] && (map[a.internship_id].title && (map[a.internship_id].title[state.lang] || map[a.internship_id].title.en || ''))) || '',
                        date: a.date_applied || a.date || '',
                        status: a.status || 'pending',
                        avatar: (a.applicant_name && a.applicant_name.charAt(0)) || 'A',
                        email: a.email || '',
                        phone: a.phone || '',
                        school: a.school || '',
                        resume_path: a.resume_path || null,
                        skills: []
                    }));
                } else if (state.userType === 'trainee') {
                    // Trainee: update traineeApplications with only their applications
                    state.traineeApplications = apps.map(a => ({
                        id: parseInt(a.id),
                        hotel: (map[a.internship_id] && map[a.internship_id].hotel) || '',
                        role: (map[a.internship_id] && map[a.internship_id].title) || { ar: '', fr: '', en: '' },
                        date: a.date_applied || a.date || '',
                        status: a.status || 'pending',
                        image: (map[a.internship_id] && map[a.internship_id].image) || ''
                    }));
                }
            }
        }
    } catch (e) {
        console.warn('fetchApplicationsOnly error', e);
    }
}

function startAutoUpdate(intervalMs = 8000) {
    stopAutoUpdate();
    // Take initial snapshots
    __lastPostsSnapshot = JSON.stringify(state.userPosts || []);
    __lastInternshipsSnapshot = JSON.stringify(internships || []);
    __lastApplicationsSnapshot = JSON.stringify(employerApplications || []);
    __lastApplicationCount = employerApplications.length;
    __autoUpdateTimer = setInterval(async () => {
        try {
            await fetchPosts();
            await fetchDataFromServer();
            await fetchApplicationsOnly();
            const postsSnap = JSON.stringify(state.userPosts || []);
            const internSnap = JSON.stringify(internships || []);
            const appsSnap = JSON.stringify(employerApplications || []);
            
            // Check for new applications (for hotel admins)
            if (state.userType === 'employer' && employerApplications.length > __lastApplicationCount) {
                const newAppCount = employerApplications.length - __lastApplicationCount;
                const t = translations[state.lang];
                const newApplicants = employerApplications.slice(0, newAppCount).map(a => a.name).join(', ');
                notificationSystem.info(`${newApplicants} applied to your job offer!`);
                __lastApplicationCount = employerApplications.length;
            }
            
            if (postsSnap !== __lastPostsSnapshot || internSnap !== __lastInternshipsSnapshot || appsSnap !== __lastApplicationsSnapshot) {
                __lastPostsSnapshot = postsSnap;
                __lastInternshipsSnapshot = internSnap;
                __lastApplicationsSnapshot = appsSnap;
                renderApp();
            }
            // If viewing a hotel profile, refresh its ratings live
            if (state.currentPage === 'hotelProfile' && state.selectedHotel) {
                try { loadHotelRatings(state.selectedHotel); } catch(e){}
            }
        } catch (e) {
            console.warn('Auto-update polling error', e);
        }
    }, intervalMs);
    // start notifications polling alongside other auto-updates
    try { startNotificationsPolling(intervalMs); } catch (e) { console.warn('startNotificationsPolling failed', e); }
}

// --- Notification client helpers ---
async function fetchServerNotifications(page=1, limit=30) {
    try {
        const resp = await fetch(`api/notifications.php?page=${page}&limit=${limit}`, { credentials: 'same-origin' });
        if (!resp.ok) return null;
        const j = await resp.json();
        return j;
    } catch (e) { console.error('fetchServerNotifications failed', e); return null; }
}

async function markNotificationRead(notificationId) {
    try {
        const resp = await fetch('api/notifications/read.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ notification_id: notificationId }) });
        if (!resp.ok) return false;
        const j = await resp.json();
        return j && j.success;
    } catch (e) { console.error('markNotificationRead failed', e); return false; }
}

async function markAllNotificationsRead() {
    try {
        const resp = await fetch('api/notifications/mark_all_read.php', { method: 'POST', credentials: 'same-origin' });
        if (!resp.ok) return false;
        const j = await resp.json();
        return j && j.success;
    } catch (e) { console.error('markAllNotificationsRead failed', e); return false; }
}

async function updateNotificationPreference(eventType, channels) {
    try {
        const body = Object.assign({ event_type: eventType }, channels);
        const resp = await fetch('api/notification_preferences.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
        const j = await resp.json();
        return j && j.success;
    } catch (e) { console.error('updateNotificationPreference failed', e); return false; }
}

// Realtime subscription via Redis pubsub -> socket server (if available)
try {
    if (typeof io !== 'undefined' && window.__USER_ID) {
        const notifSocket = io(window.__REALTIME_URL || '/', { query: { userId: window.__USER_ID } });
        notifSocket.on('notification', (n) => {
            try {
                // Update UI: increment counter and show quick toast
                const el = document.getElementById('notifCount');
                if (el) el.textContent = Number(el.textContent || 0) + 1;
                // add to history
                notificationSystem.show(n.title || 'Notification', 'info', { action: n.data && n.data.actionDescriptor ? n.data.actionDescriptor : null, actionLabel: 'Open' });
            } catch (e) { console.error('notif handler error', e); }
        });
    }
} catch(e){ /* ignore */ }

function stopAutoUpdate() {
    if (__autoUpdateTimer) {
        clearInterval(__autoUpdateTimer);
        __autoUpdateTimer = null;
    }
    __lastPostsSnapshot = null;
    __lastInternshipsSnapshot = null;
    __lastApplicationsSnapshot = null;
    __lastApplicationCount = 0;
}

async function refreshDashboardNow() {
    // Manual refresh for employer dashboard - fetches latest applications and CVs immediately
    try {
        await fetchApplicationsOnly();
        renderApp();
    } catch (e) {
        console.error('Manual refresh failed', e);
    }
}

