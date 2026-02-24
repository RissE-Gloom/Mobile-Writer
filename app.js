import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const STATE = {
        currentUser: '1', // Default to 'Author'
        users: {
            '1': { name: 'Автор', colorClass: 'user-edit-1' },
            '2': { name: 'Коллега', colorClass: 'user-edit-2' }
        },
        comments: [], // Will load in initApp based on session
        history: []   // Will load in initApp based on session
    };

    // --- DOM Elements ---
    const editor = document.getElementById('editor');
    const toolbar = document.getElementById('toolbar');
    const addCommentBtn = document.getElementById('addCommentBtn');
    const commentOverlay = document.getElementById('commentOverlay');
    const commentsList = document.getElementById('commentsList');
    const newCommentInputArea = document.getElementById('newCommentInputArea');
    const newCommentText = document.getElementById('newCommentText');
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    const closeCommentsBtn = document.getElementById('closeCommentsBtn');
    const userSwitcherBtn = document.getElementById('userSwitcherBtn');
    const userModal = document.getElementById('userModal');
    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const historyList = document.getElementById('historyList');
    const expirationBadge = document.getElementById('expirationBadge');
    const docTitleInput = document.getElementById('docTitleInput');
    const appContainer = document.getElementById('appContainer');
    const landingPage = document.getElementById('landingPage');
    const startSessionBtn = document.getElementById('startSessionBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Burger Menu Elements
    const sideMenu = document.getElementById('sideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const burgerBtn = document.getElementById('burgerBtn');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const shareBtn = document.getElementById('shareBtn');

    let currentSelectionRange = null;
    let activeCommentId = null; // Currently viewed thread

    // --- Initialization ---
    // Moved to initApp()

    // --- Toolbar Formatting ---
    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tool-btn');
        if (!btn) return;

        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;

        if (cmd === 'formatBlock') {
            const currentTag = document.queryCommandValue('formatBlock');
            // If the current block is already this heading, toggle back to 'p'
            if (currentTag && currentTag.toLowerCase() === val.toLowerCase()) {
                document.execCommand('formatBlock', false, 'p');
            } else {
                document.execCommand('formatBlock', false, val);
            }
        } else {
            document.execCommand(cmd, false, val);
        }

        editor.focus();
        highlightUserChanges(); // Mark changes as made by current user
    });

    // --- Tracking Changes (Multi-user Sim) ---
    editor.addEventListener('input', () => {
        highlightUserChanges();
        saveContent();
        checkSelection(); // Hide floating btn on edit
    });

    // Save snapshot on significant pause
    let inputTimeout;
    editor.addEventListener('keyup', () => {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
            saveSnapshot();
        }, 2000);
        checkSelection();
    });

    editor.addEventListener('mouseup', checkSelection);
    editor.addEventListener('touchend', checkSelection); // Mobile support

    function highlightUserChanges() {
        // In a real app, this would be complex operational transformation.
        // Here we just simulate that the "current block" belongs to the user or 
        // if we just typed, we assume the cursor is in a text node.

        // This is a simplified "tagging" of edits. 
        // Real-time collaborative editing usually requires CRDTs/Yjs.
        // For this demo: We rely on the "user-edit-X" classes being saved in HTML.
        // When typing, we don't aggressively wrap every char to avoid breaking cursor.
        // We will just leave it standard contenteditable for now, but
        // IF we switch users, we might wrap new text.

        // Sim: Just save content. The 'class' separation is for the user switcher demo.
    }

    // --- Selection & Floating Button ---
    function checkSelection() {
        const selection = window.getSelection();

        if (!selection.rangeCount || selection.isCollapsed) {
            addCommentBtn.classList.add('hidden');
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Check if selection is inside editor
        if (!editor.contains(range.commonAncestorContainer)) {
            addCommentBtn.classList.add('hidden');
            return;
        }

        // Show button
        if (rect.width > 0) {
            addCommentBtn.classList.remove('hidden');
            // Position above selection
            addCommentBtn.style.top = `${rect.top + window.scrollY - 50}px`;
            addCommentBtn.style.left = `${rect.left + (rect.width / 2)}px`;
            currentSelectionRange = range.cloneRange();
        }
    }

    addCommentBtn.addEventListener('click', () => {
        openCommentSheet(true); // Open in "New" mode
        addCommentBtn.classList.add('hidden');
    });

    // --- Burger Menu Logic ---
    function toggleMenu(show) {
        if (show) {
            sideMenu.classList.remove('hidden');
            menuOverlay.classList.add('active');
        } else {
            sideMenu.classList.add('hidden');
            menuOverlay.classList.remove('active');
        }
    }

    if (burgerBtn) {
        burgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(true);
        });
    }

    if (closeMenuBtn) {
        closeMenuBtn.addEventListener('click', () => {
            toggleMenu(false);
        });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            toggleMenu(false);
        });
    }

    if (sideMenu) {
        // Close menu when clicking on any action button inside it
        sideMenu.querySelectorAll('.menu-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleMenu(false);
            });
        });
    }

    // --- Comments Logic ---

    // 1. Storage & Rendering
    function openCommentSheet(isNew = false, commentId = null) {
        commentOverlay.classList.remove('hidden');
        renderCommentsList();

        if (isNew) {
            newCommentInputArea.classList.remove('hidden');
            activeCommentId = null; // New loose comment
            newCommentText.value = '';
            newCommentText.focus();
        } else if (commentId) {
            newCommentInputArea.classList.add('hidden'); // Hide main "New" area, use inline reply
            activeCommentId = commentId;
            // Scroll to specific comment
            const el = document.getElementById(`comment-card-${commentId}`);
            if (el) el.scrollIntoView();
        } else {
            newCommentInputArea.classList.add('hidden');
        }
    }

    function closeCommentSheet() {
        commentOverlay.classList.add('hidden');
        // Clear active highlights
        document.querySelectorAll('.comment-highlight.active').forEach(el => el.classList.remove('active'));
    }

    closeCommentsBtn.addEventListener('click', closeCommentSheet);

    // Close on click outside
    commentOverlay.addEventListener('click', (e) => {
        if (e.target === commentOverlay) closeCommentSheet();
    });

    // Submit New Comment
    submitCommentBtn.addEventListener('click', () => {
        const text = newCommentText.value.trim();
        if (!text) return;

        createComment(text);
        newCommentText.value = '';
        // closeCommentSheet(); // Keep open per user request
        renderCommentsList(); // Update list to show the new comment immediately
    });

    function createComment(text) {
        if (!currentSelectionRange) return;

        const selectedText = currentSelectionRange.toString(); // Capture text before dom manip
        const commentId = 'c-' + Date.now();
        const span = document.createElement('span');
        span.className = 'comment-highlight';
        span.dataset.commentId = commentId;
        span.textContent = selectedText;

        // Replace selected text with span
        currentSelectionRange.deleteContents();
        currentSelectionRange.insertNode(span);

        // Add click listener (needs to be re-bound on load usually, doing event delegation instead)

        const newComment = {
            id: commentId,
            userId: STATE.currentUser,
            text: text,
            context: selectedText,
            timestamp: Date.now(),
            replies: []
        };

        STATE.comments.push(newComment);

        // FIX: Save BOTH comments and content immediately to avoid race condition with onSnapshot.
        // If we only save comments, the snapshot listener might trigger with old content (missing the span),
        // overwriting our local DOM change.
        clearTimeout(saveTimeout); // Cancel pending text saves
        const html = editor.innerHTML;

        const docRef = doc(db, "documents", SESSION_ID);
        updateDoc(docRef, {
            comments: STATE.comments,
            content: html
        }).catch(err => console.error("Error saving comment & content:", err));
    }

    // Event Delegation for clicking on highlighted comments in editor
    editor.addEventListener('click', (e) => {
        if (e.target.classList.contains('comment-highlight')) {
            const id = e.target.dataset.commentId;
            // Highlight visual
            document.querySelectorAll('.comment-highlight.active').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');

            openCommentSheet(false, id);
        }
    });

    function renderCommentsList() {
        commentsList.innerHTML = '';
        if (STATE.comments.length === 0) {
            commentsList.innerHTML = '<p style="text-align:center; color:#999;">Нет комментариев</p>';
            return;
        }

        STATE.comments.forEach(c => {
            const user = STATE.users[c.userId];
            const contextHtml = c.context ? `<div class="comment-context">"${c.context}"</div>` : '';

            const div = document.createElement('div');
            div.className = 'comment-thread';
            div.id = `comment-card-${c.id}`;
            div.innerHTML = `
                <div class="comment-meta">
                    <strong>${user.name}</strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button class="delete-btn" title="Удалить ветку" data-delete-thread="${c.id}">🗑</button>
                    </div>
                </div>
                ${contextHtml}
                <div class="comment-body">${c.text}</div>
                <div class="replies-container" id="replies-${c.id}">
                    ${c.replies.map((r, idx) => renderReply(r, c.id, idx)).join('')}
                </div>
                <div class="reply-input-wrapper">
                    <input type="text" placeholder="Ответить..." class="reply-input" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:13px;" data-parent-id="${c.id}">
                    <button class="send-reply-icon-btn" data-parent-id="${c.id}">➤</button>
                </div>
            `;
            commentsList.appendChild(div);
        });

        // Attach event listeners for reply inputs (Enter key)
        document.querySelectorAll('.reply-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    addReply(input.dataset.parentId, input.value, input);
                }
            });
        });

        // Attach event listeners for reply buttons (Click)
        document.querySelectorAll('.send-reply-icon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const parentId = btn.dataset.parentId;
                const input = document.querySelector(`input.reply-input[data-parent-id="${parentId}"]`);
                if (input) addReply(parentId, input.value, input);
            });
        });

        // Attach delete thread listeners
        document.querySelectorAll('button[data-delete-thread]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Удалить всю ветку комментариев?')) {
                    deleteThread(btn.dataset.deleteThread);
                }
            });
        });

        // Attach delete reply listeners
        document.querySelectorAll('button[data-delete-reply]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const [threadId, replyIdx] = btn.dataset.deleteReply.split(':');
                if (confirm('Удалить комментарий?')) {
                    deleteReply(threadId, parseInt(replyIdx));
                }
            });
        });
    }

    function renderReply(reply, threadId, index) {
        const user = STATE.users[reply.userId];
        return `
            <div class="reply-item">
                <div class="comment-meta">
                    <strong>${user.name}</strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button class="delete-btn" style="font-size:14px; padding:2px;" title="Удалить" data-delete-reply="${threadId}:${index}">×</button>
                    </div>
                </div>
                <div>${reply.text}</div>
            </div>
        `;
    }

    function deleteThread(id) {
        // 1. Remove visual highlight in editor (unwrap text)
        // Note: The span might not exist if we rolled back history or just loaded partial content, but usually it should be there.
        const span = document.querySelector(`.comment-highlight[data-comment-id="${id}"]`);
        if (span) {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            saveContent(); // Update HTML storage
        }

        // 2. Remove from state
        STATE.comments = STATE.comments.filter(c => c.id !== id);

        // FIX: Save content immediately
        clearTimeout(saveTimeout);
        const docRef = doc(db, "documents", SESSION_ID);
        updateDoc(docRef, {
            comments: STATE.comments,
            content: editor.innerHTML
        }).catch(err => console.error("Error deleting thread:", err));

        // 3. Re-render
        renderCommentsList();
    }

    function deleteReply(threadId, replyIdx) {
        const comment = STATE.comments.find(c => c.id === threadId);
        if (comment) {
            comment.replies.splice(replyIdx, 1);
            saveComments();
            renderCommentsList();
        }
    }

    function addReply(parentId, text, inputElement) {
        if (!text.trim()) return;
        const comment = STATE.comments.find(c => c.id === parentId);
        if (comment) {
            comment.replies.push({
                userId: STATE.currentUser,
                text: text,
                timestamp: Date.now()
            });
            saveComments();
            // Re-render only replies or list? re-render list is safer to keep state sync but might lose focus. 
            // Better: append manually or just re-render and fix focus.
            // For simple implementation: Re-render and restore focus if possible, or just re-render.
            renderCommentsList();
            // Don't close overlay!
        }
    }


    // --- Export to TXT ---
    downloadBtn.addEventListener('click', () => {
        // User requested "only text" and "text format", so we use innerText.
        // We add \uFEFF (Byte Order Mark) to ensure Windows opens it as UTF-8.
        const textContent = editor.innerText;
        const blob = new Blob(['\uFEFF' + textContent], { type: 'text/plain;charset=utf-8' });

        const url = URL.createObjectURL(blob);
        const fileDownload = document.createElement("a");
        fileDownload.href = url;
        fileDownload.download = (docTitleInput.value || 'document') + '.txt';
        document.body.appendChild(fileDownload);
        fileDownload.click();
        document.body.removeChild(fileDownload);
        URL.revokeObjectURL(url);
    });

    // --- Share Link ---
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Ссылка скопирована в буфер обмена! Отправьте её коллеге.');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                alert('Не удалось скопировать ссылку. Скопируйте её из адресной строки.');
            });
        });
    }

    // --- User Switching ---
    userSwitcherBtn.addEventListener('click', () => {
        userModal.classList.remove('hidden');
    });

    document.querySelectorAll('.user-option').forEach(opt => {
        opt.addEventListener('click', () => {
            STATE.currentUser = opt.dataset.userId;
            updateUserUI();
            userModal.classList.add('hidden');
        });
    });

    document.querySelector('.close-modal-btn').addEventListener('click', () => {
        userModal.classList.add('hidden');
    });

    function updateUserUI() {
        const user = STATE.users[STATE.currentUser];
        if (!user) return;

        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name === 'Автор' ? 'Felix' : 'Aneka'}`;
        
        // Update main side menu avatar
        const avatarImg = document.getElementById('currentUserAvatar');
        if (avatarImg) avatarImg.src = avatarUrl;

        const userIdEl = document.getElementById('currentUserId');
        if (userIdEl) userIdEl.textContent = user.name === 'Автор' ? 'ID: 1' : 'ID: 2';
        
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) userNameEl.textContent = user.name;

        // Highlight active user in modal
        document.querySelectorAll('.user-option').forEach(el => el.classList.remove('active'));
        const activeOpt = document.querySelector(`.user-option[data-user-id="${STATE.currentUser}"]`);
        if (activeOpt) activeOpt.classList.add('active');
    }

    // --- Session Management ---
    const urlParams = new URLSearchParams(window.location.search);
    let SESSION_ID = urlParams.get('session');

    if (SESSION_ID) {
        // Active Session
        initApp();
    } else {
        // Landing Screen
        landingPage.classList.remove('hidden');
    }

    if (startSessionBtn) {
        startSessionBtn.addEventListener('click', () => {
            // Generate ID
            const newSessionId = Math.random().toString(36).substring(2, 10); // simple random string
            // Redirect to same page with param
            const url = new URL(window.location);
            url.searchParams.set('session', newSessionId);
            window.location.href = url.toString();
        });
    }

    function initApp() {
        landingPage.classList.add('hidden');
        appContainer.classList.remove('hidden');

        // Initial Loading State
        // Initial Loading State
        editor.innerHTML = ''; // No inline style to prevent gray text persistence
        editor.contentEditable = true; // FORCE ENABLE IMMEDIATELY 

        const docRef = doc(db, "documents", SESSION_ID);

        // Real-time Listener
        onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // Only update editor if we are not currently typing to avoid cursor jumps
                // In a robust app, we'd use CRDTs. Here: simple check.
                if (document.activeElement !== editor) {
                    editor.innerHTML = data.content || '';
                }

                // Load Title
                if (data.title && document.activeElement !== docTitleInput) {
                    docTitleInput.value = data.title;
                }

                STATE.comments = data.comments || [];
                STATE.history = data.history || [];

                // Expiration Check
                checkExpiration(data.createdAt);

                // Auto-Role Logic:
                // If I have no saved role and this doc exists, I am a Colleague ('2').
                if (!localStorage.getItem(`role_${SESSION_ID}`)) {
                    setMyRole('2');
                }

                renderCommentsList();

                // ContentEditable is managed by checkExpiration now
            } else {
                // Doc doesn't exist yet, create it empty
                const now = new Date().toISOString();
                setDoc(docRef, {
                    title: 'Новый документ',
                    content: '',
                    comments: [],
                    history: [],
                    createdAt: now
                });
                editor.innerHTML = '<p>Новый документ. Начните печатать...</p>';
                editor.contentEditable = true;
                docTitleInput.value = 'Новый документ';

                // I am the Creator
                setMyRole('1');

                checkExpiration(now);
            }
        });
    }

    // Better: Debounced Title Save
    let titleTimeout;
    docTitleInput.addEventListener('input', () => {
        clearTimeout(titleTimeout);
        titleTimeout = setTimeout(() => {
            const docRef = doc(db, "documents", SESSION_ID);
            updateDoc(docRef, { title: docTitleInput.value }).catch(err => console.error("Error saving title:", err));
        }, 1000);
    });

    // --- Role Management ---
    function setMyRole(roleId) {
        STATE.currentUser = roleId;
        localStorage.setItem(`role_${SESSION_ID}`, roleId);
        updateUserUI();
    }

    function determineRole() {
        // 1. check previously saved role
        const saved = localStorage.getItem(`role_${SESSION_ID}`);
        if (saved && STATE.users[saved]) {
            STATE.currentUser = saved;
        } else {
            // If no saved role, wait for initApp. 
            // If doc exists, we will default to '2' (Colleague).
            // If doc created, we default to '1' (Creator).
            // Current default in STATE is '1', we should change it to wait or '2'.
            // Let's set default to '2' (Guest) initially? 
            // Actually, keep default '1' for safety, but override in onSnapshot.
        }
        updateUserUI();
    }

    // Call on load
    determineRole();

    // --- Expiration & Decay Logic ---
    function checkExpiration(createdAtIso) {
        // SAFE DEFAULT: Always allow editing first
        editor.contentEditable = true;
        editor.classList.remove('decay-mode');

        if (!createdAtIso) return;

        const created = new Date(createdAtIso);
        // Safety check for invalid dates
        if (isNaN(created.getTime())) return;

        const now = new Date();
        const diffMs = now - created;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        const LIFE_DAYS = 7;
        const DECAY_DAYS = 1;
        const daysLeft = LIFE_DAYS - diffDays;

        expirationBadge.className = 'expiration-badge'; // reset

        if (diffDays < LIFE_DAYS) {
            // Alive
            if (daysLeft < 1) {
                expirationBadge.textContent = '< 24ч';
                expirationBadge.classList.add('critical');
            } else {
                expirationBadge.textContent = `${Math.ceil(daysLeft)} дн.`;
                if (daysLeft < 3) expirationBadge.classList.add('warn');
            }
            // Editor is already enabled above
        } else if (diffDays < LIFE_DAYS + DECAY_DAYS) {
            // Day 8
            expirationBadge.textContent = "⚠";
            expirationBadge.classList.add('decay');
            editor.contentEditable = false;
            editor.classList.add('decay-mode');
            processDecay(created, now, LIFE_DAYS);
        } else {
            // Dead
            expirationBadge.textContent = "УНИЧТОЖЕНО";
            expirationBadge.classList.add('decay');
            editor.innerHTML = "";
            editor.contentEditable = false;
            document.body.style.backgroundColor = "#000";
        }
    }

    function processDecay(createdAt, now, lifeDays) {
        const startDecay = new Date(createdAt.getTime() + lifeDays * 24 * 60 * 60 * 1000);
        const decayDurationMs = 24 * 60 * 60 * 1000;
        const passedInDecay = now - startDecay;

        let progress = passedInDecay / decayDurationMs;
        if (progress > 1) progress = 1;
        if (progress < 0) progress = 0;

        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = editor.innerHTML;
        const allNodes = Array.from(contentDiv.childNodes);
        const totalNodes = allNodes.length;

        if (totalNodes === 0) return;

        const nodesToKeep = Math.floor(totalNodes * (1 - progress));

        if (nodesToKeep < totalNodes) {
            for (let i = totalNodes - 1; i >= nodesToKeep; i--) {
                contentDiv.removeChild(allNodes[i]);
            }

            const newHtml = contentDiv.innerHTML;

            if (!window.lastDecayUpdate || (Date.now() - window.lastDecayUpdate > 5000)) {
                if (editor.innerHTML !== newHtml) {
                    editor.innerHTML = newHtml;
                    window.lastDecayUpdate = Date.now();
                    const docRef = doc(db, "documents", SESSION_ID);
                    updateDoc(docRef, { content: newHtml }).catch(() => { });
                }
            }
        }
    }

    // --- Persistence & History ---

    // Debounce Save to prevent too many writes
    let saveTimeout;
    function saveContent() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const html = editor.innerHTML;
            // Write to Firestore
            const docRef = doc(db, "documents", SESSION_ID);
            updateDoc(docRef, {
                content: html
            }).catch(err => console.error("Error saving content:", err));
        }, 500);
    }

    // No longer needed, handled by onSnapshot
    function loadContent() { }

    function saveSnapshot() {
        const snapshot = {
            id: Date.now(),
            html: editor.innerHTML,
            time: new Date().toISOString(),
            author: STATE.users[STATE.currentUser].name
        };

        // Limit history to 20 items
        if (STATE.history.length > 20) STATE.history.shift();

        STATE.history.push(snapshot);

        const docRef = doc(db, "documents", SESSION_ID);
        updateDoc(docRef, {
            history: STATE.history
        }).catch(err => console.error("Error saving history:", err));
    }

    function saveComments() {
        const docRef = doc(db, "documents", SESSION_ID);
        updateDoc(docRef, {
            comments: STATE.comments
        }).catch(err => console.error("Error saving comments:", err));
    }

    // History UI
    let currentHistoryId = null;

    historyBtn.addEventListener('click', () => {
        historyModal.classList.remove('hidden');
        renderHistoryList();
    });

    document.querySelector('#historyModal .close-modal-btn').addEventListener('click', () => {
        historyModal.classList.add('hidden');
    });

    function renderHistoryList() {
        // Redraw structure for split view (list top, preview bottom, or side-by-side? Mobile -> List top, preview bottom)
        historyModal.innerHTML = `
            <div class="modal-content full-height">
                <div class="modal-header">
                    <h3 style="margin:0;">История изменений</h3>
                    <button class="close-modal-btn" style="font-size:24px; background:none; border:none; cursor:pointer;" onclick="document.getElementById('historyModal').classList.add('hidden')">✕</button>
                </div>
                <div class="history-container">
                    <div id="historyList" class="history-list">
                        ${STATE.history.length === 0 ? '<p style="padding:16px; color:#999; text-align:center;">История изменений пуста</p>' : ''}
                    </div>
                    <div id="historyPreview" class="history-preview" style="white-space: pre-wrap; word-wrap: break-word;">
                        <p style="color:#999; text-align:center; margin-top:20px;">Выберите версию для просмотра изменений</p>
                    </div>
                    <div class="restore-bar">
                         <button id="restoreCurrentBtn" class="primary-btn" disabled>Восстановить эту версию</button>
                    </div>
                </div>
            </div>
        `;

        const listContainer = document.getElementById('historyList');
        const previewContainer = document.getElementById('historyPreview');
        const restoreBtn = document.getElementById('restoreCurrentBtn');

        // Restore listener
        restoreBtn.addEventListener('click', () => {
            if (currentHistoryId) {
                restoreSnapshot(currentHistoryId);
                historyModal.classList.add('hidden');
            }
        });

        // Loop history
        [...STATE.history].reverse().forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <div class="history-time">${new Date(item.time).toLocaleTimeString()}</div>
                <div style="font-size:12px; color:gray;">${item.author}</div>
            `;

            div.addEventListener('click', () => {
                // Highlight
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');

                currentHistoryId = item.id;
                restoreBtn.disabled = false;

                // Improved Diff Logic (Tag-Aware)
                const currentIdx = STATE.history.findIndex(x => x.id === item.id);
                const prevItem = (currentIdx > 0) ? STATE.history[currentIdx - 1] : null;

                const diffHtml = computeDiff(prevItem ? prevItem.html : '', item.html);
                previewContainer.innerHTML = diffHtml;

                // Ensure styles allow wrapping
                previewContainer.style.whiteSpace = 'pre-wrap';
                previewContainer.style.wordWrap = 'break-word';

                // --- Auto-scroll to first change ---
                setTimeout(() => {
                    const firstChange = previewContainer.querySelector('.diff-added, .diff-removed');
                    if (firstChange) {
                        firstChange.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 50);
            });

            listContainer.appendChild(div);
        });
    }

    // A very basic text diff function
    // Improved Diff using Longest Common Subsequence (LCS)
    function computeDiff(oldHtml, newHtml) {
        // Tokenize by HTML Tags, Whitespace, and Words
        // Capture group () in split keeps the separator
        const tokenize = (str) => str.split(/(<[^>]+>|\s+|[^<>\s]+)/).filter(w => w !== "");

        const oldTokens = tokenize(oldHtml);
        const newTokens = tokenize(newHtml);

        const matrix = [];
        for (let i = 0; i <= oldTokens.length; i++) {
            matrix[i] = new Array(newTokens.length + 1).fill(0);
        }

        // Fill LCS matrix
        for (let i = 1; i <= oldTokens.length; i++) {
            for (let j = 1; j <= newTokens.length; j++) {
                if (oldTokens[i - 1] === newTokens[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1] + 1;
                } else {
                    matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
                }
            }
        }

        // Backtrack
        let output = [];
        let i = oldTokens.length;
        let j = newTokens.length;

        function isTag(token) {
            return token.startsWith('<') && token.endsWith('>');
        }

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
                // Match: just add the token
                output.unshift(oldTokens[i - 1]);
                i--;
                j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                // Added
                const token = newTokens[j - 1];
                if (isTag(token)) {
                    output.unshift(token); // Don't highlight tags as added
                } else if (token.trim() === "") {
                    output.unshift(token); // Don't highlight spaces
                } else {
                    output.unshift(`<span class="diff-added">${token}</span>`);
                }
                j--;
            } else {
                // Removed
                const token = oldTokens[i - 1];
                if (isTag(token)) {
                    // Don't show removed tags in view to keep structure clean
                    // but we might need placeholders for some
                } else if (token.trim() === "") {
                    // ignore removed whitespace
                } else {
                    output.unshift(`<span class="diff-removed">${token}</span>`);
                }
                i--;
            }
        }

        return output.join("");
    }

    function restoreSnapshot(historyId) {
        const item = STATE.history.find(x => x.id === historyId);
        if (item) {
            editor.innerHTML = item.html;
            saveContent();
            // Optional: notify user
        }
    }

    // --- Helpers ---
    // (None yet extra)

});
