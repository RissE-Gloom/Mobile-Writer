document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const STATE = {
        currentUser: '1', // Default user
        users: {
            '1': { name: 'Я', colorClass: 'user-edit-1' },
            '2': { name: 'Коллега', colorClass: 'user-edit-2' },
            '3': { name: 'Босс', colorClass: 'user-edit-3' }
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

        document.execCommand(cmd, false, val);
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
        saveComments();
        saveContent(); // Save HTML because we added the span
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
        saveComments();

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
    const downloadBtn = document.getElementById('downloadBtn');
    const docTitleInput = document.getElementById('docTitleInput');

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
    document.getElementById('shareBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Ссылка скопирована в буфер обмена! Отправьте её коллеге.');
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            alert('Не удалось скопировать ссылку. Скопируйте её из адресной строки.');
        });
    });

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
        document.getElementById('currentUserId').textContent = STATE.currentUser;
        document.getElementById('currentUserAvatar').src = document.querySelector(`.user-option[data-user-id="${STATE.currentUser}"] img`).src;

        // Highlight active user in modal
        document.querySelectorAll('.user-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`.user-option[data-user-id="${STATE.currentUser}"]`).classList.add('active');
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

    startSessionBtn.addEventListener('click', () => {
        // Generate ID
        const newSessionId = Math.random().toString(36).substring(2, 10); // simple random string
        // Redirect to same page with param
        const url = new URL(window.location);
        url.searchParams.set('session', newSessionId);
        window.location.href = url.toString();
    });

    function initApp() {
        landingPage.classList.add('hidden');
        appContainer.classList.remove('hidden');

        // Load data specific to this session
        loadContent();

        // Load comments logic needs an update to pull from session storage too
        // We need to re-initialize comments from correct storage key
        const savedComments = JSON.parse(localStorage.getItem(`doc_comments_${SESSION_ID}`)) || [];
        STATE.comments = savedComments; // Override default

        const savedHistory = JSON.parse(localStorage.getItem(`doc_history_${SESSION_ID}`)) || [];
        STATE.history = savedHistory;

        saveSnapshot(); // Initial snapshot
    }

    // --- Persistence & History ---
    function saveContent() {
        const html = editor.innerHTML;
        localStorage.setItem(`doc_content_${SESSION_ID}`, html);
    }

    function loadContent() {
        const html = localStorage.getItem(`doc_content_${SESSION_ID}`);
        if (html) {
            editor.innerHTML = html;
        }
    }

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
        localStorage.setItem(`doc_history_${SESSION_ID}`, JSON.stringify(STATE.history));
    }

    // Also need to update saveComments
    function saveComments() {
        localStorage.setItem(`doc_comments_${SESSION_ID}`, JSON.stringify(STATE.comments));
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
                    <div id="historyList" class="history-list"></div>
                    <div id="historyPreview" class="history-preview">
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

                // Diff Logic
                // Find previous version (chronologically before this one)
                const currentIdx = STATE.history.findIndex(x => x.id === item.id);
                const prevItem = (currentIdx > 0) ? STATE.history[currentIdx - 1] : null;

                const diffHtml = computeDiff(prevItem ? prevItem.html : '', item.html);
                previewContainer.innerHTML = diffHtml;

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
        const oldText = stripTags(oldHtml);
        const newText = stripTags(newHtml);

        const oldWords = oldText.split(/\s+/).filter(w => w.length > 0);
        const newWords = newText.split(/\s+/).filter(w => w.length > 0);

        const matrix = [];
        for (let i = 0; i <= oldWords.length; i++) {
            matrix[i] = new Array(newWords.length + 1).fill(0);
        }

        // Fill LCS matrix
        for (let i = 1; i <= oldWords.length; i++) {
            for (let j = 1; j <= newWords.length; j++) {
                if (oldWords[i - 1] === newWords[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1] + 1;
                } else {
                    matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
                }
            }
        }

        // Backtrack to find diff
        let output = [];
        let i = oldWords.length;
        let j = newWords.length;

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
                output.unshift(oldWords[i - 1]);
                i--;
                j--;
            } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
                // Insertion (present in new, not old)
                output.unshift(`<span class="diff-added" data-original="Добавлено">${newWords[j - 1]}</span>`);
                j--;
            } else {
                // Deletion (present in old, not new)
                // We show deletions? Or just modifications? 
                // User requirement: "highlight changed place".
                // If I delete a word, it should probably be shown as removed or just show the new state?
                // Standard diff shows deletions. Let's show strikethrough for removed.
                output.unshift(`<span class="diff-removed" style="text-decoration:line-through; color:#999; background:#ffeebb;">${oldWords[i - 1]}</span>`);
                i--;
            }
        }

        return output.join(' ');
    }

    function stripTags(html) {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    function restoreSnapshot(id) {
        const snapshot = STATE.history.find(s => s.id === id);
        if (snapshot) {
            editor.innerHTML = snapshot.html;
            saveContent();
            alert('Версия восстановлена!');
        }
    }

    // Initial UI setup
    updateUserUI();
});
