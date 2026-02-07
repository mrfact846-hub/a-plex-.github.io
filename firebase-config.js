// Firebase Configuration for NeoChat AI
// Hybrid Architecture: Firestore + Realtime Database
// - Firestore: User profiles, settings (structured data)
// - Realtime Database: Chat messages (real-time sync)

const firebaseConfig = {
    apiKey: "AIzaSyDKzS_3WKzcTx3HMhLkLfP3yRChEPqsqlU",
    authDomain: "web-ai-2df7d.firebaseapp.com",
    databaseURL: "https://web-ai-2df7d-default-rtdb.firebaseio.com",
    projectId: "web-ai-2df7d",
    storageBucket: "web-ai-2df7d.firebasestorage.app",
    messagingSenderId: "368450883479",
    appId: "1:368450883479:web:7fae043c16aa0f97313ed2",
    measurementId: "G-CQK98SNDLR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Services
const analytics = firebase.analytics();
const auth = firebase.auth();
const firestore = firebase.firestore(); // For user profiles, settings
const realtimeDB = firebase.database(); // For chat messages

// Make Firebase available globally
window.firebaseApp = firebase;
window.firebaseAuth = auth;
window.firestore = firestore;
window.realtimeDB = realtimeDB;
window.firebaseAnalytics = analytics;

console.log('🔥 Firebase initialized successfully!');
console.log('📦 Firestore: User profiles & settings');
console.log('⚡ Realtime Database: Chat messages');

// Auth State Check - Redirect to welcome if not logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('👤 User logged in:', user.displayName || user.email);
        window.currentUser = user;

        // Update sidebar user info
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        const userAvatarEl = document.getElementById('user-avatar');

        if (userNameEl) userNameEl.textContent = user.displayName || 'User';
        if (userEmailEl) userEmailEl.textContent = user.email;
        if (userAvatarEl) userAvatarEl.textContent = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

        // Save user profile to Firestore
        window.saveUserProfile(user);

        // Initialize databases on first login
        window.initializeDatabases(user);

        // Check Email Verification
        if (!user.emailVerified) {
            const banner = document.getElementById('verification-banner');
            if (banner) banner.classList.remove('hidden');
        } else {
            const banner = document.getElementById('verification-banner');
            if (banner) banner.classList.add('hidden');
        }

        // Log analytics event
        analytics.logEvent('login', { method: 'email' });
    } else {
        // User is NOT signed in - redirect to welcome page
        console.log('⚠️ No user logged in, redirecting to welcome...');

        // Only redirect if we're on index.html (not already on welcome.html)
        if (!window.location.pathname.includes('welcome.html')) {
            window.location.href = 'welcome.html';
        }
    }
});

// Log page view to Analytics
analytics.logEvent('page_view', {
    page_title: 'NeoChat AI',
    page_location: window.location.href
});

// Logout function
window.logoutUser = function () {
    auth.signOut().then(() => {
        console.log('👋 User signed out');
        window.location.href = 'welcome.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
};

// Resend Verification Email
window.resendVerificationEmail = function () {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
        user.sendEmailVerification()
            .then(() => {
                alert(`Verification email resent to ${user.email} ✅\nPlease check your inbox/spam folder.`);
            })
            .catch((error) => {
                console.error('Error sending verification email:', error);
                alert('Error sending verification email: ' + error.message);
            });
    }
};

// ========================================
// HYBRID DATABASE ARCHITECTURE
// ========================================

/*
Database Structure:

FIRESTORE (Document-based):
users (collection)
  └─ {uid} (document)
      ├─ profile: {displayName, email, photoURL, createdAt, lastActive}
      ├─ settings: {theme, model, persona, deepResearch}
      └─ _initialized: true

REALTIME DATABASE (JSON tree):
users/
  └─ {uid}/
      └─ chats/
          └─ {chatId}/
              ├─ id
              ├─ title
              ├─ createdAt
              ├─ updatedAt
              └─ messages/
                  └─ {messageId}/
                      ├─ role
                      ├─ content
                      └─ timestamp
*/

// ========================================
// FIRESTORE OPERATIONS (User Data)
// ========================================

// Save User Profile to Firestore
window.saveUserProfile = async function (user) {
    if (!user) return;

    const userRef = firestore.collection('users').doc(user.uid);
    try {
        await userRef.set({
            profile: {
                displayName: user.displayName || 'User',
                email: user.email,
                photoURL: user.photoURL || null,
                createdAt: user.metadata?.creationTime || new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
        }, { merge: true });
        console.log('✅ User profile saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving user profile:', error);
    }
};

// Update Last Active Time
window.updateLastActive = async function () {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await firestore.collection('users').doc(user.uid).set({
            profile: {
                lastActive: new Date().toISOString()
            }
        }, { merge: true });
    } catch (error) {
        console.error('Error updating last active:', error);
    }
};

// Save User Settings to Firestore
window.saveUserSettings = async function (settings) {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = firestore.collection('users').doc(user.uid);
    try {
        await userRef.set({
            settings: {
                theme: settings.theme || 'dark',
                model: settings.model || 'llama-3.3-70b-versatile',
                persona: settings.persona || 'default',
                deepResearch: settings.deepResearch || false,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });
        console.log('⚙️ Settings saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }
};

// Load User Settings from Firestore
window.loadUserSettings = async function () {
    const user = auth.currentUser;
    if (!user) return null;

    const userRef = firestore.collection('users').doc(user.uid);
    try {
        const doc = await userRef.get();
        if (doc.exists && doc.data().settings) {
            console.log('⚙️ Settings loaded from Firestore');
            return doc.data().settings;
        } else {
            console.log('⚙️ No settings found, using defaults');
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        return null;
    }
};

// ========================================
// REALTIME DATABASE OPERATIONS (Chats)
// ========================================

// Save Chat to Realtime Database
window.saveChatToCloud = async function (chatId, chatData) {
    const user = auth.currentUser;
    if (!user) {
        console.warn('⚠️ No user logged in, cannot save chat');
        return;
    }

    const chatRef = realtimeDB.ref(`users/${user.uid}/chats/${chatId}`);
    try {
        await chatRef.set({
            id: chatData.id,
            title: chatData.title || 'New Chat',
            createdAt: chatData.createdAt || Date.now(),
            updatedAt: Date.now(),
            messages: chatData.messages || []
        });
        console.log(`💾 Chat "${chatData.title}" saved to Realtime DB`);
    } catch (error) {
        console.error('❌ Error saving chat:', error);
    }
};

// Load All Chats from Realtime Database
window.loadChatsFromCloud = async function () {
    const user = auth.currentUser;
    if (!user) {
        console.warn('⚠️ No user logged in, cannot load chats');
        return [];
    }

    const chatsRef = realtimeDB.ref(`users/${user.uid}/chats`);
    try {
        const snapshot = await chatsRef.once('value');
        if (snapshot.exists()) {
            const chatsObj = snapshot.val();
            const chatsArray = Object.values(chatsObj).sort((a, b) => b.updatedAt - a.updatedAt);
            console.log(`📥 Loaded ${chatsArray.length} chats from Realtime DB`);
            return chatsArray;
        } else {
            console.log('📭 No chats found in Realtime DB');
            return [];
        }
    } catch (error) {
        console.error('❌ Error loading chats:', error);
        return [];
    }
};

// Delete Chat from Realtime Database
window.deleteChatFromCloud = async function (chatId) {
    const user = auth.currentUser;
    if (!user) return;

    const chatRef = realtimeDB.ref(`users/${user.uid}/chats/${chatId}`);
    try {
        await chatRef.remove();
        console.log(`🗑️ Chat ${chatId} deleted from Realtime DB`);
    } catch (error) {
        console.error('❌ Error deleting chat:', error);
    }
};

// Listen to Chat Updates in Real-time
window.listenToChatUpdates = function (chatId, callback) {
    const user = auth.currentUser;
    if (!user) return null;

    const chatRef = realtimeDB.ref(`users/${user.uid}/chats/${chatId}`);
    chatRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });

    // Return unsubscribe function
    return () => chatRef.off('value');
};

// ========================================
// INITIALIZATION & UTILITIES
// ========================================

// Initialize Databases (Creates structure on first login)
window.initializeDatabases = async function (user) {
    if (!user) return;

    const userRef = firestore.collection('users').doc(user.uid);

    try {
        // Check if already initialized
        const userDoc = await userRef.get();
        if (userDoc.exists && userDoc.data()._initialized) {
            console.log('✅ Databases already initialized for this user');
            return;
        }

        console.log('🔧 Initializing databases...');

        // Create Firestore user document
        await userRef.set({
            profile: {
                displayName: user.displayName || 'User',
                email: user.email,
                photoURL: user.photoURL || null,
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            },
            settings: {
                theme: 'dark',
                model: 'llama-3.3-70b-versatile',
                persona: 'default',
                deepResearch: false,
                updatedAt: new Date().toISOString()
            },
            _initialized: true,
            _version: '2.0-hybrid'
        });

        // Create welcome chat in Realtime Database
        await realtimeDB.ref(`users/${user.uid}/chats/welcome-chat`).set({
            id: 'welcome-chat',
            title: 'Welcome to NeoChat AI! 👋',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                {
                    role: 'assistant',
                    content: 'Welcome to **NeoChat AI**! 🚀\n\nI\'m your AI assistant powered by advanced language models. I can help you with:\n\n- 📚 Research and answers\n- 💻 Code assistance\n- ✍️ Writing and creativity\n- 🧮 Math and logic\n- 🌐 Deep Research mode\n\nHow can I help you today?'
                }
            ]
        });

        console.log('✅ Databases initialized successfully!');
        console.log('📁 Database structure:');
        console.log('   📦 Firestore: users/{uid} (profile, settings)');
        console.log('   ⚡ Realtime DB: users/{uid}/chats/{chatId}');

        analytics.logEvent('databases_initialized', {
            user_id: user.uid,
            architecture: 'hybrid'
        });

    } catch (error) {
        console.error('❌ Error initializing databases:', error);
    }
};

// Sync Local Storage to Cloud (Migration Helper)
window.syncLocalToCloud = async function () {
    const user = auth.currentUser;
    if (!user) return;

    console.log('🔄 Syncing local data to cloud...');

    // Get local chat history
    const localHistory = localStorage.getItem('neochat_history');
    if (localHistory) {
        try {
            const chats = JSON.parse(localHistory);
            for (const chat of chats) {
                await window.saveChatToCloud(chat.id, chat);
            }
            console.log('✅ Local chats synced to Realtime DB');
        } catch (error) {
            console.error('❌ Error syncing chats:', error);
        }
    }
};

// Get User Stats
window.getUserStats = async function () {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const chatsSnapshot = await realtimeDB.ref(`users/${user.uid}/chats`).once('value');
        if (!chatsSnapshot.exists()) {
            return { totalChats: 0, totalMessages: 0 };
        }

        const chats = chatsSnapshot.val();
        const totalChats = Object.keys(chats).length;

        let totalMessages = 0;
        Object.values(chats).forEach(chat => {
            totalMessages += chat.messages?.length || 0;
        });

        return { totalChats, totalMessages };
    } catch (error) {
        console.error('Error getting stats:', error);
        return null;
    }
};

console.log('💾 Hybrid Firebase Database initialized');
console.log('   📦 Firestore: Profiles & Settings');
console.log('   ⚡ Realtime DB: Chat Messages');
