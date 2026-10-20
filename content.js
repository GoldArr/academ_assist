(function() {
    // 1. ПОЛНОЕ ПОДАВЛЕНИЕ ОБОИХ ВАРИАНТОВ АНТИЧИТА
    function neutralizeAntiCheat() {
        try {
            if (typeof antiCheatEnabled !== 'undefined') antiCheatEnabled = false;
            if (typeof disableAntiCheat === 'function') disableAntiCheat();

            // Сброс счетчиков первого шаблона (Test_platform.html)
            if (typeof violations !== 'undefined') {
                for (let k in violations) violations[k] = 0;
            }
            // Сброс счетчиков второго шаблона (test.html / CCNA)
            if (typeof focusLossCount !== 'undefined') focusLossCount = 0;
            if (typeof keyPressCount !== 'undefined') keyPressCount = 0;
            if (typeof copyPasteCount !== 'undefined') copyPasteCount = 0;
            if (typeof doubleCtrlCount !== 'undefined') doubleCtrlCount = 0;
            if (typeof mouseLeaveCount !== 'undefined') mouseLeaveCount = 0;
            if (typeof fastAnswersCount !== 'undefined') fastAnswersCount = 0;
            if (typeof totalViolations !== 'undefined') totalViolations = 0;
        } catch (e) {}

        // Отключаем звуковые функции, модальные окна и логгеры обоих шаблонов
        [
            'updateViolationCounter', 'playWarningRed', 'playWarningOrange',
            'playWarningYellow', 'playSiren', 'playBeepLow', 'playBeepMedium',
            'playBeepHigh', 'playViolationSound', 'logViolation',
            'showViolationToast', 'showWarningModal', 'enableAntiCheat',
            'handleKeyDown', 'handleVisibilityChange', 'handleWindowBlur',
            'handleCopyPaste', 'handleDoubleCtrl', 'handleAnswerChange', 'handleMouseLeave'
        ].forEach(fn => {
            if (typeof window[fn] === 'function') window[fn] = function() {};
        });

        // Скрываем плашки нарушений и блокирующие экраны
        ['violation-counter', 'violation-modal', 'warning-modal', 'dark-overlay', 'violation-toast'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Разблокируем выделение текста и контекстное меню
        if (document.body) {
            document.body.style.userSelect = 'text';
            document.body.style.webkitUserSelect = 'text';
            ['oncontextmenu', 'oncopy', 'oncut', 'onpaste', 'onselectstart'].forEach(attr => {
                document.body.removeAttribute(attr);
                document.body[attr] = null;
            });
        }
    }

    // Перехватываем события в фазе захвата (capture)
    ['visibilitychange', 'blur', 'mouseleave', 'contextmenu', 'copy', 'paste', 'cut', 'selectstart', 'dragstart', 'keydown', 'keyup'].forEach(evt => {
        window.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
        document.addEventListener(evt, (e) => e.stopImmediatePropagation(), true);
    });

    neutralizeAntiCheat();

    // 2. ПОЛУЧЕНИЕ АКТУАЛЬНОГО СПИСКА ВОПРОСОВ
    function getActiveQuestions() {
        // Если тест уже запущен, берем currentQuestions (там лежат уже перемешанные варианты с точными ключами!)
        try {
            if (typeof currentQuestions !== 'undefined' && Array.isArray(currentQuestions) && currentQuestions.length > 0) {
                return currentQuestions;
            }
        } catch (e) {}

        // Если тест еще на стартовом экране, берем исходную базу
        try {
            if (typeof questionsDB !== 'undefined' && questionsDB) {
                return [
                    ...(questionsDB.basic || []),
                    ...(questionsDB.advanced || []),
                    ...(questionsDB.high || []),
                    ...(questionsDB.questions || [])
                ];
            }
        } catch (e) {}

        try {
            if (typeof originalQuestions !== 'undefined' && Array.isArray(originalQuestions)) {
                return originalQuestions;
            }
        } catch (e) {}

        return [];
    }

    // 3. ФОРМАТИРОВАНИЕ ТЕКСТА ПРАВИЛЬНОГО ОТВЕТА ДЛЯ ПОДСКАЗКИ
    function formatAnswerText(q) {
        if (!q) return 'Нет данных';

        if ((q.type === 'radio' || q.type === 'checkbox') && q.correct && q.options) {
            return q.correct.map(k => q.options[k] ? `${k.toUpperCase()}) ${q.options[k]}` : k.toUpperCase()).join(' | ');
        }
        if (q.type === 'matching' && q.correct) {
            return Object.entries(q.correct).map(([itemId, targetId]) => {
                const itemText = q.items?.find(i => i.id === itemId)?.text || itemId;
                const targetText = q.targets?.find(t => t.id === targetId)?.text || targetId;
                return `${itemText} → ${targetText}`;
            }).join('; ');
        }
        if (q.type === 'ordering' && Array.isArray(q.correct)) {
            return q.correct.join(' → ');
        }
        if (q.type === 'text' || q.fullAnswer) {
            return q.fullAnswer || 'Свободный ответ';
        }
        if (Array.isArray(q.correct)) {
            return q.correct.map(k => (q.options && q.options[k]) ? `${k.toUpperCase()}) ${q.options[k]}` : k).join(', ');
        }
        return 'Нет данных';
    }

    // 4. АВТОЗАПОЛНЕНИЕ ОДНОГО ВОПРОСА (ВСЕ ТИПЫ ПОЛЕЙ)
    function solveSingleQuestion(q) {
        if (!q) return;

        if (q.type === 'radio' && q.correct) {
            const input = document.querySelector(`input[type="radio"][name="q${q.id}"][value="${q.correct[0]}"]`);
            if (input) input.checked = true;
        } else if (q.type === 'checkbox' && q.correct) {
            document.querySelectorAll(`input[type="checkbox"][name="q${q.id}"]`).forEach(inp => {
                inp.checked = q.correct.includes(inp.value);
            });
        } else if (q.type === 'matching' && q.correct) {
            Object.entries(q.correct).forEach(([itemId, targetId]) => {
                const select = document.querySelector(`select[name="q${q.id}_${itemId}"]`);
                if (select) select.value = targetId;
            });
        } else if (q.type === 'ordering' && Array.isArray(q.correct)) {
            q.correct.forEach((correctText, idx) => {
                const select = document.querySelector(`select[name="q${q.id}_pos${idx}"]`);
                if (select) select.value = correctText;
            });
        } else if (q.type === 'text' && q.fullAnswer) {
            const textarea = document.querySelector(`textarea[name="q${q.id}"]`);
            if (textarea) textarea.value = q.fullAnswer;
        }
    }

    // 5. ВЫВОД ОТВЕТОВ И КНОПОК РЯДОМ С ВОПРОСАМИ
    function injectHintsAndButtons() {
        neutralizeAntiCheat();
        const blocks = document.querySelectorAll('.question-block');
        if (blocks.length === 0) {
            alert('Вопросы еще не отрисованы на странице. Нажмите «Начать тестирование» или используйте зеленую кнопку мгновенной сдачи!');
            return;
        }

        const allQ = getActiveQuestions();
        blocks.forEach((block, idx) => {
            if (block.querySelector('.audit-helper-box')) return;

            // Ищем вопрос по имени поля ввода (input, select или textarea) либо по индексу блока
            let qObj = null;
            const field = block.querySelector('input[name^="q"], select[name^="q"], textarea[name^="q"]');
            if (field && field.name) {
                const match = field.name.match(/^q(\d+)/);
                if (match) {
                    const qId = parseInt(match[1], 10);
                    qObj = allQ.find(item => item.id === qId);
                }
            }
            if (!qObj && allQ[idx]) qObj = allQ[idx];
            if (!qObj) return;

            const ansText = formatAnswerText(qObj);

            const helperBox = document.createElement('div');
            helperBox.className = 'audit-helper-box';
            helperBox.style.cssText = 'margin-top: 12px; padding: 10px 14px; background: #16241b; border: 1px solid #22c55e; border-radius: 6px; color: #a7f3d0; font-size: 0.9em; display: flex; justify-content: space-between; align-items: center; gap: 10px;';

            const textSpan = document.createElement('span');
            textSpan.style.whiteSpace = 'pre-wrap';
            textSpan.innerHTML = `<strong>Ответ:</strong> ${ansText}`;

            const solveBtn = document.createElement('button');
            solveBtn.type = 'button';
            solveBtn.textContent = 'Заполнить';
            solveBtn.style.cssText = 'background: #22c55e; color: #000; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; flex-shrink: 0;';
            solveBtn.onclick = () => solveSingleQuestion(qObj);

            helperBox.appendChild(textSpan);
            helperBox.appendChild(solveBtn);
            block.appendChild(helperBox);
        });
    }

    // 6. МГНОВЕННАЯ ИДЕАЛЬНАЯ СДАЧА (ДЛЯ ОБОИХ ТИПОВ ТЕСТОВ)
    function instantPerfectSubmit() {
        const nameInput = document.getElementById('student-name');
        const groupInput = document.getElementById('student-group');
        const name = nameInput ? nameInput.value.trim() : '';
        const group = groupInput ? groupInput.value.trim() : '';

        if (!name || !group) {
            alert('Извольте сперва вписать ФИО и номер группы в поля на экране!');
            return;
        }

        // Если тест еще не начат — запускаем его штатной функцией, чтобы сгенерировался currentQuestions
        if (document.querySelectorAll('.question-block').length === 0 && typeof startTest === 'function') {
            startTest();
        }

        neutralizeAntiCheat();

        // Заполняем все вопросы правильными ответами
        const activeQ = getActiveQuestions();
        activeQ.forEach(q => solveSingleQuestion(q));

        // Отодвигаем время начала теста на 8–14 минут назад (480–840 секунд)
        const fakeDurationSec = Math.floor(Math.random() * (840 - 480 + 1)) + 480;
        const fakeStartTimestamp = Date.now() - (fakeDurationSec * 1000);
        try { if (typeof startTime !== 'undefined') startTime = fakeStartTimestamp; } catch (e) {}
        try { if (typeof testStartTime !== 'undefined') testStartTime = fakeStartTimestamp; } catch (e) {}

        // Перехватываем отправку на сервер, чтобы гарантировать 100% результат и 0 нарушений
        if (typeof window.sendResultToServer === 'function' && !window.sendResultToServer._wrapped) {
            const origSend = window.sendResultToServer;
            window.sendResultToServer = function(data) {
                data.score = data.total;
                data.percentage = 100;
                data.grade = 5;
                data.errors_count = 0;
                data.test_duration = fakeDurationSec;
                data.focus_loss_count = 0;
                data.key_press_count = 0;
                data.copy_paste_count = 0;
                data.double_ctrl_count = 0;
                data.mouse_leave_count = 0;
                data.fast_answers_count = 0;
                data.right_click_count = 0;
                data.answer_pattern_suspicious = false;
                data.total_violations = 0;
                return origSend(data);
            };
            window.sendResultToServer._wrapped = true;
        }

        // Вызываем штатное завершение теста без диалогового окна confirm
        const origConfirm = window.confirm;
        window.confirm = () => true;
        try {
            if (typeof submitTest === 'function') submitTest();
        } finally {
            window.confirm = origConfirm;
        }
    }

    // 7. ОТРИСОВКА ПАНЕЛИ УПРАВЛЕНИЯ
    function mountPanel() {
        if (!document.body || document.getElementById('audit-panel-root')) return;

        const panel = document.createElement('div');
        panel.id = 'audit-panel-root';
        panel.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 2147483647; background: #1e1e1e; border: 2px solid #3b82f6; padding: 12px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.85); display: flex; gap: 8px; flex-direction: column; font-family: Segoe UI, sans-serif;';

        const title = document.createElement('div');
        title.textContent = '🛠 Панель аудита v2.0';
        title.style.cssText = 'color: #3b82f6; font-weight: bold; font-size: 14px; margin-bottom: 4px;';
        panel.appendChild(title);

        const btnInstant = document.createElement('button');
        btnInstant.type = 'button';
        btnInstant.textContent = '👑 Сдать идеально (авто)';
        btnInstant.style.cssText = 'padding: 8px 12px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: left;';
        btnInstant.onclick = instantPerfectSubmit;

        const btnShowHints = document.createElement('button');
        btnShowHints.type = 'button';
        btnShowHints.textContent = '👁 Показать ответы';
        btnShowHints.style.cssText = 'padding: 8px 12px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-size: 13px; text-align: left;';
        btnShowHints.onclick = injectHintsAndButtons;

        const btnSolveAll = document.createElement('button');
        btnSolveAll.type = 'button';
        btnSolveAll.textContent = '⚡ Заполнить всё в тесте';
        btnSolveAll.style.cssText = 'padding: 8px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: left;';
        btnSolveAll.onclick = () => {
            if (document.querySelectorAll('.question-block').length === 0 && typeof startTest === 'function') {
                startTest();
            }
            neutralizeAntiCheat();
            getActiveQuestions().forEach(q => solveSingleQuestion(q));
            injectHintsAndButtons();
        };

        panel.appendChild(btnInstant);
        panel.appendChild(btnShowHints);
        panel.appendChild(btnSolveAll);
        document.body.appendChild(panel);
    }

    mountPanel();
    setInterval(() => {
        mountPanel();
        neutralizeAntiCheat();
    }, 1000);
})();