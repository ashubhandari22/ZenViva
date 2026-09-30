/*
 * script.js
 * Frontend logic for AI Interview Coach:
 * - Role skill suggestions & automatic preset synchronization
 * - Web Speech API (Live Speech Recognition & Text-to-Speech)
 * - Real-time Interview Timer & Progress Tracking
 * - Controlled Adaptive Follow-up exploration (no infinite loops)
 * - History management & PDF report trigger
 */

// Skill suggestions based on selected role
const roleSkillsMap = {
    "Data Scientist": "Python, SQL, Pandas, NumPy, Scikit-learn, Machine Learning, Deep Learning, Statistics",
    "Data Analyst": "SQL, Excel, Tableau, Power BI, Python, Pandas, Data Visualization, ETL",
    "Python Developer": "Python, Django, Flask, FastAPI, PostgreSQL, REST APIs, Git, Docker, Unit Testing",
    "Software Developer": "Data Structures, Algorithms, System Design, Java, Python, OOP, CI/CD, Git",
    "AI/ML Engineer": "Python, PyTorch, TensorFlow, LLMs, NLP, MLOps, Vector Databases, HuggingFace",
    "Web Developer": "JavaScript, TypeScript, React, HTML5, CSS3, Node.js, Next.js, TailwindCSS"
};

function onRoleChange() {
    const roleSelect = document.getElementById('role');
    const customRoleGroup = document.getElementById('custom-role-group');
    const customRoleInput = document.getElementById('custom_role');
    const skillsInput = document.getElementById('skills');
    
    if (!roleSelect) return;
    
    const selected = roleSelect.value;
    
    if (selected === 'Custom Role') {
        if (customRoleGroup) customRoleGroup.style.display = 'block';
        if (customRoleInput) customRoleInput.setAttribute('required', 'required');
    } else {
        if (customRoleGroup) customRoleGroup.style.display = 'none';
        if (customRoleInput) {
            customRoleInput.removeAttribute('required');
            customRoleInput.value = '';
        }
        
        // Auto-fill suggested skills if empty or if currently holding another role default
        if (skillsInput && roleSkillsMap[selected]) {
            const currentVal = skillsInput.value.trim();
            const allDefaults = Object.values(roleSkillsMap);
            if (!currentVal || allDefaults.includes(currentVal)) {
                skillsInput.value = roleSkillsMap[selected];
            }
        }
    }
}

function setPresetSkills(preset) {
    const skillsInput = document.getElementById('skills');
    if (skillsInput) {
        skillsInput.value = preset;
    }
}

// Global interview state
let questions = [];
let currentQuestionIndex = 0;
let interviewResults = [];
let totalQuestionsCount = typeof numQuestions !== 'undefined' ? numQuestions : 5;
let timerInterval = null;
let secondsElapsed = 0;

// Speech Recognition & Synthesis State
let recognition = null;
let isRecording = false;
let isSpeaking = false;
let finalTranscript = '';

// Initialize Web Speech Recognition if available
function setupSpeechRecognition() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let interim = '';
                const answerInput = document.getElementById('user-answer');
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcriptPiece = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += (finalTranscript && !finalTranscript.endsWith(' ') ? ' ' : '') + transcriptPiece.trim();
                    } else {
                        interim += transcriptPiece;
                    }
                }
                if (answerInput) {
                    const currentPrefix = answerInput.dataset.baseText || '';
                    const combined = [currentPrefix, finalTranscript, interim].filter(Boolean).join(' ');
                    answerInput.value = combined;
                    updateWordCount();
                }
            };

            recognition.onerror = (event) => {
                console.warn('Speech recognition error:', event.error);
                if (event.error !== 'no-speech') {
                    stopRecording();
                }
            };

            recognition.onend = () => {
                if (isRecording) {
                    try { recognition.start(); } catch (e) { stopRecording(); }
                }
            };
        }
    } catch (e) {
        console.warn('Speech recognition could not be initialized:', e);
        recognition = null;
    }
}

function toggleRecording() {
    if (!recognition) {
        alert('Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
        return;
    }

    // Cancel active TTS before recording to prevent feedback loop
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        const ttsBtn = document.getElementById('tts-btn');
        const ttsLabel = document.getElementById('tts-label');
        if (ttsBtn) ttsBtn.classList.remove('active');
        if (ttsLabel) ttsLabel.innerText = 'Listen to Question';
    }

    const micBtn = document.getElementById('mic-btn');
    const micLabel = document.getElementById('mic-label');
    const answerInput = document.getElementById('user-answer');

    if (!isRecording) {
        try {
            if (answerInput) {
                answerInput.dataset.baseText = answerInput.value.trim();
            }
            finalTranscript = '';
            recognition.start();
            isRecording = true;
            if (micBtn) micBtn.classList.add('recording');
            if (micLabel) micLabel.innerText = 'Listening... (Click to stop)';
        } catch (e) {
            console.error('Error starting recognition:', e);
        }
    } else {
        stopRecording();
    }
}

function stopRecording() {
    isRecording = false;
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }
    const micBtn = document.getElementById('mic-btn');
    const micLabel = document.getElementById('mic-label');
    if (micBtn) micBtn.classList.remove('recording');
    if (micLabel) micLabel.innerText = 'Speak Answer (Mic)';

    const answerInput = document.getElementById('user-answer');
    if (answerInput && answerInput.dataset.baseText) {
        delete answerInput.dataset.baseText;
        updateWordCount();
    }
}

function toggleQuestionTTS() {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech is not supported in this browser.');
        return;
    }

    const ttsBtn = document.getElementById('tts-btn');
    const ttsLabel = document.getElementById('tts-label');

    if (isSpeaking) {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        if (ttsBtn) ttsBtn.classList.remove('active');
        if (ttsLabel) ttsLabel.innerText = 'Listen to Question';
        return;
    }

    const questionElem = document.getElementById('current-question');
    if (!questionElem) return;

    const textToRead = questionElem.innerText.trim();
    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
        isSpeaking = true;
        if (ttsBtn) ttsBtn.classList.add('active');
        if (ttsLabel) ttsLabel.innerText = 'Stop Reading';
    };

    utterance.onend = () => {
        isSpeaking = false;
        if (ttsBtn) ttsBtn.classList.remove('active');
        if (ttsLabel) ttsLabel.innerText = 'Listen to Question';
    };

    utterance.onerror = () => {
        isSpeaking = false;
        if (ttsBtn) ttsBtn.classList.remove('active');
        if (ttsLabel) ttsLabel.innerText = 'Listen to Question';
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function updateWordCount() {
    const answerInput = document.getElementById('user-answer');
    const wordCountDisplay = document.getElementById('word-count');
    if (!answerInput || !wordCountDisplay) return;

    const text = answerInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wordCountDisplay.innerText = `${words} words • ${text.length} chars`;
}

function startTimer() {
    secondsElapsed = 0;
    const timerElem = document.getElementById('timer-display');
    if (!timerElem) return;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        timerElem.innerText = `${mins}:${secs}`;
    }, 1000);
}

// Setup Drag & Drop File Upload
function setupFileDropzone() {
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('resume');
    const defaultContent = document.getElementById('dropzone-content-default');
    const selectedContent = document.getElementById('dropzone-content-selected');
    const fileNameEl = document.getElementById('selected-file-name');
    const fileSizeEl = document.getElementById('selected-file-size');
    const fileIconEl = document.getElementById('file-type-icon');
    const removeBtn = document.getElementById('btn-remove-file');

    if (!dropzone || !fileInput) return;

    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileIcon(filename) {
        const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
        if (ext === '.pdf') return '📕';
        if (ext === '.docx') return '📘';
        if (ext === '.txt') return '📄';
        return '📎';
    }

    function handleFile(file) {
        if (!file) return;

        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            alert(`Selected file format (${ext}) is not supported. Please upload a PDF, DOCX, or TXT file.`);
            fileInput.value = '';
            showDefault();
            return;
        }

        if (file.size > maxSizeBytes) {
            alert(`File size exceeds 10MB limit (${formatBytes(file.size)}). Please choose a smaller file.`);
            fileInput.value = '';
            showDefault();
            return;
        }

        // Update selected state display
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
        if (fileIconEl) fileIconEl.textContent = getFileIcon(file.name);

        if (defaultContent) defaultContent.style.display = 'none';
        if (selectedContent) selectedContent.style.display = 'block';
    }

    function showDefault() {
        if (defaultContent) defaultContent.style.display = 'flex';
        if (selectedContent) selectedContent.style.display = 'none';
    }

    // Input change event (when chosen via browse dialog)
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFile(fileInput.files[0]);
        } else {
            showDefault();
        }
    });

    // Remove file button
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.value = '';
            showDefault();
        });
    }

    // Drag and drop event handlers
    let dragCounter = 0;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    dropzone.addEventListener('dragenter', () => {
        dragCounter++;
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragover', () => {
        if (!dropzone.classList.contains('drag-over')) {
            dropzone.classList.add('drag-over');
        }
    });

    dropzone.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropzone.classList.remove('drag-over');
        }
    });

    dropzone.addEventListener('drop', (e) => {
        dragCounter = 0;
        dropzone.classList.remove('drag-over');

        const dtFiles = e.dataTransfer.files;
        if (dtFiles && dtFiles.length > 0) {
            try {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(dtFiles[0]);
                fileInput.files = dataTransfer.files;
            } catch (err) {
                console.warn('DataTransfer not fully supported:', err);
            }
            handleFile(dtFiles[0]);
        }
    });

    // Keyboard accessibility for dropzone container
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Setup role change listener on homepage
    const roleSelect = document.getElementById('role');
    if (roleSelect) {
        roleSelect.addEventListener('change', onRoleChange);
        onRoleChange();
    }

    // Setup Drag & Drop File Upload
    setupFileDropzone();


    // Initialize Web Speech Recognition
    setupSpeechRecognition();

    const questionArea = document.getElementById('question-area');
    if (questionArea) {
        const loadingState = document.getElementById('loading-state');
        const loadingText = document.getElementById('loading-text');

        // Answer textarea input handler for word counting
        const answerInput = document.getElementById('user-answer');
        if (answerInput) {
            answerInput.addEventListener('input', updateWordCount);
        }

        // 1. Fetch questions from the AI
        if (loadingText) loadingText.innerText = "🤖 Generating tailored interview questions...";
        
        fetch('/api/generate_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            loadingState.style.display = 'none';
            if (data.error) {
                alert("Error: " + data.error);
                window.location.href = '/';
                return;
            }
            questions = data.questions || [];
            if (questions.length > 0) {
                totalQuestionsCount = questions.length;
                displayQuestion(0);
                questionArea.style.display = 'block';
                startTimer();
            } else {
                alert("No questions could be generated. Returning to setup.");
                window.location.href = '/';
            }
        })
        .catch(err => {
            loadingState.style.display = 'none';
            alert("Network error while generating questions. Please ensure the server is running.");
            console.error(err);
        });

        // 2. Handle Submit Answer
        const submitBtn = document.getElementById('submit-answer-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const answer = answerInput ? answerInput.value.trim() : '';
                if (!answer) {
                    alert('Please type or dictate an answer before submitting.');
                    return;
                }

                stopRecording();
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                isSpeaking = false;

                const currentQuestion = questions[currentQuestionIndex];

                // Show loading state
                questionArea.style.display = 'none';
                if (loadingText) loadingText.innerText = "🤖 AI Coach is analyzing your response...";
                loadingState.style.display = 'block';

                fetch('/api/evaluate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: currentQuestion.question,
                        answer: answer,
                        topic: currentQuestion.topic,
                        difficulty: currentQuestion.difficulty
                    })
                })
                .then(response => response.json())
                .then(evaluation => {
                    loadingState.style.display = 'none';

                    // Save result in local session array
                    interviewResults.push({
                        question: currentQuestion,
                        answer: answer,
                        evaluation: evaluation
                    });

                    // Controlled Adaptive Follow-up insertion:
                    // Only insert if not already answering a follow-up, and at most 1 follow-up across the interview session
                    const existingFollowups = questions.filter(q => q.is_followup).length;
                    if (evaluation.follow_up_question && 
                        evaluation.follow_up_question.trim() !== "" && 
                        !currentQuestion.is_followup && 
                        existingFollowups < 1) {
                        
                        questions.splice(currentQuestionIndex + 1, 0, {
                            question: evaluation.follow_up_question.trim(),
                            type: currentQuestion.type || "technical",
                            topic: "Adaptive Follow-up (" + (currentQuestion.topic || "Core") + ")",
                            difficulty: currentQuestion.difficulty || "Medium",
                            is_followup: true
                        });
                        totalQuestionsCount = questions.length;
                    }

                    showFeedback(evaluation);
                })
                .catch(err => {
                    loadingState.style.display = 'none';
                    questionArea.style.display = 'block';
                    alert("Error evaluating answer. Please try again.");
                    console.error(err);
                });
            });
        }

        // 3. Handle Next Question
        const nextBtn = document.getElementById('next-question-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                stopRecording();
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                isSpeaking = false;

                currentQuestionIndex++;
                if (currentQuestionIndex < questions.length) {
                    document.getElementById('feedback-area').style.display = 'none';
                    if (answerInput) {
                        answerInput.value = '';
                        updateWordCount();
                    }
                    displayQuestion(currentQuestionIndex);
                    questionArea.style.display = 'block';
                    // Scroll smoothly to top of question
                    questionArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    // Interview completed! Save to database.
                    clearInterval(timerInterval);
                    document.getElementById('feedback-area').style.display = 'none';
                    questionArea.style.display = 'none';
                    if (loadingText) loadingText.innerText = "💾 Compiling your performance report...";
                    loadingState.style.display = 'block';

                    fetch('/api/save_interview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ results: interviewResults })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.interview_id) {
                            window.location.href = `/result/${data.interview_id}`;
                        } else {
                            alert("Error saving interview results.");
                            window.location.href = '/dashboard';
                        }
                    })
                    .catch(err => {
                        console.error("Save error:", err);
                        window.location.href = '/dashboard';
                    });
                }
            });
        }
    }
});

function displayQuestion(index) {
    const q = questions[index];
    const questionTextElem = document.getElementById('current-question');
    const topicBadge = document.getElementById('question-topic');
    const difficultyBadge = document.getElementById('question-difficulty');
    const typeBadge = document.getElementById('question-type');

    if (questionTextElem) questionTextElem.innerText = q.question;
    if (topicBadge) topicBadge.innerText = q.topic || 'General';
    if (difficultyBadge) difficultyBadge.innerText = (q.difficulty || 'Medium').toUpperCase();
    if (typeBadge) typeBadge.innerText = (q.type || 'Technical').toUpperCase();

    // Check for Adaptive Follow-up badge
    let followupBadge = document.getElementById('followup-badge');
    if (q.is_followup) {
        if (!followupBadge && topicBadge && topicBadge.parentElement) {
            followupBadge = document.createElement('span');
            followupBadge.id = 'followup-badge';
            followupBadge.className = 'badge badge-followup';
            followupBadge.innerText = '⚡ ADAPTIVE DRILL-DOWN';
            topicBadge.parentElement.appendChild(followupBadge);
        }
    } else if (followupBadge) {
        followupBadge.remove();
    }

    // Update progress bar
    const progressPercent = Math.min(100, Math.round(((index + 1) / totalQuestionsCount) * 100));
    const progressFill = document.getElementById('progress-fill');
    const questionCounter = document.getElementById('question-counter');

    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (questionCounter) {
        const label = q.is_followup 
            ? `Question ${index + 1} of ${totalQuestionsCount} (Adaptive)` 
            : `Question ${index + 1} of ${totalQuestionsCount}`;
        questionCounter.innerText = label;
    }
}

function showFeedback(evaluation) {
    const feedbackArea = document.getElementById('feedback-area');
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) scoreDisplay.innerText = `${evaluation.score || 0}/10`;

    // Populate Evaluation Matrix
    const matrixBlock = document.getElementById('evaluation-matrix-block');
    const matrixGrid = document.getElementById('matrix-grid');
    if (matrixBlock && matrixGrid) {
        matrixGrid.innerHTML = '';
        const matrix = evaluation.evaluation_matrix;
        if (matrix && Object.keys(matrix).length > 0) {
            matrixBlock.style.display = 'block';
            for (const [key, dim] of Object.entries(matrix)) {
                const card = document.createElement('div');
                card.className = 'matrix-card';
                const scorePercent = Math.min(100, Math.max(0, Math.round((dim.score || 0) * 10)));
                
                card.innerHTML = `
                    <div class="matrix-card-header">
                        <span class="matrix-card-title">${dim.title || key}</span>
                        <span class="matrix-card-score">${dim.score || 0}/10 <span class="matrix-card-weight">(${dim.weight || ''})</span></span>
                    </div>
                    <div class="matrix-meter-track">
                        <div class="matrix-meter-fill" style="width: ${scorePercent}%;"></div>
                    </div>
                    <p class="matrix-card-assessment">${dim.assessment || ''}</p>
                `;
                matrixGrid.appendChild(card);
            }
        } else {
            matrixBlock.style.display = 'none';
        }
    }

    // Populate strengths list
    const strengthsList = document.getElementById('strengths-list');
    if (strengthsList) {
        strengthsList.innerHTML = '';
        let strengths = evaluation.strengths || [];
        if (typeof strengths === 'string') strengths = [strengths];
        if (strengths.length > 0) {
            strengths.forEach(s => {
                const li = document.createElement('li');
                li.innerText = s;
                strengthsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.innerText = 'Good attempt; direct answer to the prompt.';
            strengthsList.appendChild(li);
        }
    }

    // Populate areas for improvement
    const missingList = document.getElementById('missing-list');
    if (missingList) {
        missingList.innerHTML = '';
        let missing = evaluation.missing_points || [];
        if (typeof missing === 'string') missing = [missing];
        if (missing.length > 0) {
            missing.forEach(m => {
                const li = document.createElement('li');
                li.innerText = m;
                missingList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.innerText = 'None noted — comprehensive response!';
            missingList.appendChild(li);
        }
    }

    const feedbackText = document.getElementById('feedback-text');
    if (feedbackText) feedbackText.innerText = evaluation.feedback || 'Answer evaluated.';

    const improvementText = document.getElementById('improvement-text');
    if (improvementText) improvementText.innerText = evaluation.improvement || 'Continue practicing structured responses with quantitative impact.';

    const sampleAnswerText = document.getElementById('sample-answer-text');
    if (sampleAnswerText) sampleAnswerText.innerText = evaluation.sample_answer || 'N/A';

    // Show follow-up insight if available
    const followUpBlock = document.getElementById('follow-up-block');
    const followUpText = document.getElementById('follow-up-text');
    if (followUpBlock && followUpText) {
        if (evaluation.follow_up_question && evaluation.follow_up_question.trim()) {
            followUpText.innerText = evaluation.follow_up_question.trim();
            followUpBlock.style.display = 'block';
        } else {
            followUpBlock.style.display = 'none';
        }
    }

    // Update Next button label if on final question
    const nextBtn = document.getElementById('next-question-btn');
    if (nextBtn) {
        if (currentQuestionIndex + 1 >= questions.length) {
            nextBtn.innerText = "FINISH & VIEW RESULTS →";
        } else {
            nextBtn.innerText = "NEXT QUESTION →";
        }
    }

    if (feedbackArea) {
        feedbackArea.style.display = 'block';
        feedbackArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Copy sample answer helper
function copySampleAnswer() {
    const sampleAnswer = document.getElementById('sample-answer-text');
    if (!sampleAnswer) return;
    navigator.clipboard.writeText(sampleAnswer.innerText).then(() => {
        alert('Sample answer copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// Delete interview from dashboard
function deleteInterview(interviewId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to delete this interview record?')) {
        return;
    }

    fetch(`/api/delete_interview/${interviewId}`, {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.reload();
        } else {
            alert('Could not delete interview.');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Error deleting interview.');
    });
}

// Clear all interview history
function clearAllHistory() {
    if (!confirm('Are you sure you want to clear ALL interview history? This cannot be undone.')) {
        return;
    }

    fetch('/api/clear_history', {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.reload();
        } else {
            alert('Error clearing history.');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Error clearing history.');
    });
}
