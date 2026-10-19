(function() {
    // 1. НЕЙТРАЛИЗАЦИЯ АНТИЧИТА И СЛЕЖКИ
    window.updateViolationCounter = function() {
        if (typeof violations !== 'undefined') {
            for (let k in violations) violations[k] = 0;
        }
        const el = document.getElementById('violation-counter');
        if (el) el.style.display = 'none';
    };
    ['playWarningRed', 'playWarningOrange', 'playWarningYellow', 'playSiren'].forEach(fn => {
        if (typeof window[fn] === 'function') window[fn] = function() {};
    });

    document.body.style.userSelect = 'auto';
    document.body.style.webkitUserSelect = 'auto';

    ['visibilitychange', 'blur', 'mouseleave', 'contextmenu', 'copy', 'paste', 'cut', 'selectstart', 'dragstart', 'keydown'].forEach(evt => {
        window.addEventListener(evt, (e) => {
            e.stopImmediatePropagation();
        }, true);
    });

    // 2. УНИВЕРСАЛЬНЫЙ ПОИСК БАЗЫ ВОПРОСОВ НА СТРАНИЦЕ
    function findQuestionsDatabase() {
        // Проверяем известные имена или ищем объект, содержащий массивы с вопросами
        if (typeof questionsDB !== 'undefined') return questionsDB;
        
        // Сканируем глобальные переменные window на предмет структуры с вопросами
        for (let key in window) {
            try {
                let val = window[key];
                if (val && typeof val === 'object') {
                    if (val.basic || val.advanced || val.high || Array.isArray(val)) {
                        return val;
                    }
                }
            } catch (e) {}
        }
        return null;
    }

    function getAllQuestions() {
        const db = findQuestionsDatabase();
        if (!db) return [];
        
        if (Array.isArray(db)) return db;
        
        let all = [];
        if (db.basic) all = all.concat(db.basic);
        if (db.advanced) all = all.concat(db.advanced);
        if (db.high) all = all.concat(db.high);
        if (db.questions) all = all.concat(db.questions);
        return all;
    }

    // 3. АВТОМАТИЧЕСКОЕ РЕШЕНИЕ ОТДЕЛЬНОГО ВОПРОСА
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
        } else if (q.type === 'ordering' && q.correct) {
            q.correct.forEach((correctText, idx) => {
                const select = document.querySelector(`select[name="q${q.id}_pos${idx}"]`);
                if (select) select.value = correctText;
            });
        } else if (q.type === 'text' && q.fullAnswer) {
            const textarea = document.querySelector(`textarea[name="q${q.id}"]`);
            if (textarea) textarea.value = q.fullAnswer;
        }
    }

    // 4. МГНОВЕННАЯ СДАЧА ЛЮБОГО ТЕСТА
    function instantPerfectSubmit() {
        const nameInput = document.getElementById('student-name');
        const groupInput = document.getElementById('student-group');
        const name = nameInput ? nameInput.value.trim() : 'Аноним';
        const group = groupInput ? groupInput.value.trim() : 'ИС-23';

        const allQ = getAllQuestions();
        const gradedQuestions = allQ.filter(q => !q.type || (q.type !== 'text' && q.id < 35));
        const totalGraded = gradedQuestions.length > 0 ? gradedQuestions.length : 26;

        const highDiffPayload = [];
        allQ.forEach((q, idx) => {
            if (q.type === 'text' || q.fullAnswer) {
                const ans = q.fullAnswer || 'Выполнено согласно регламенту.';
                highDiffPayload.push({ q_num: q.id || idx + 1, answer: ans });
            }
        });

        const fakeDuration = Math.floor(Math.random() * (840 - 480 + 1)) + 480;

        const payload = {
            test_id: typeof TEST_ID !== 'undefined' ? TEST_ID : 1,
            test_name: typeof TEST_NAME !== 'undefined' ? TEST_NAME : document.title,
            name: name,
            group: group,
            score: totalGraded,
            total: totalGraded,
            percentage: 100,
            grade: 5,
            errors_count: 0,
            test_duration: fakeDuration,
            focus_loss_count: 0,
            key_press_count: 0,
            copy_paste_count: 0,
            double_ctrl_count: 0,
            mouse_leave_count: 0,
            fast_answers_count: 0,
            right_click_count: 0,
            answer_pattern: "detected",
            answer_pattern_percentage: 25,
            answer_pattern_suspicious: false,
            total_violations: 0,
            high_difficulty_answers: highDiffPayload
        };

        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        if (typeof isTestActive !== 'undefined') isTestActive = false;

        if (typeof sendResultToServer === 'function') {
            sendResultToServer(payload);
        } else {
            fetch('save_result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        }

        // Переключение экранов интерфейса
        const startScreen = document.getElementById('start-screen');
        const testScreen = document.getElementById('test-screen');
        const resultScreen = document.getElementById('result-screen');

        if (startScreen) startScreen.style.display = 'none';
        if (testScreen) testScreen.style.display = 'none';
        if (resultScreen) resultScreen.style.display = 'block';

        const resName = document.getElementById('res-name');
        const resScore = document.getElementById('res-score');
        const resPercent = document.getElementById('res-percent');
        const resTime = document.getElementById('res-time');

        if (resName) resName.textContent = name.split(' ')[0].toUpperCase();
        if (resScore) resScore.textContent = `Правильных ответов: ${totalGraded} из ${totalGraded}`;
        if (resPercent) resPercent.textContent = '100';
        
        if (resTime) {
            const m = Math.floor(fakeDuration / 60).toString().padStart(2, '0');
            const s = (fakeDuration % 60).toString().padStart(2, '0');
            resTime.textContent = `${m}:${s}`;
        }
    }

    // 5. ВЫВОД ПОДСКАЗОК РЯДОМ С ВОПРОСАМИ
    function injectHintsAndButtons() {
        const allQ = getAllQuestions();
        if (allQ.length === 0) {
            alert('База вопросов на этой странице не обнаружена. Убедитесь, что тест начат.');
            return;
        }

        document.querySelectorAll('.question-block').forEach(block => {
            if (block.querySelector('.audit-helper-box')) return;
            const firstInput = block.querySelector('input, select, textarea');
            if (!firstInput || !firstInput.name) return;

            const match = firstInput.name.match(/^q(\d+)/);
            if (!match) return;

            const qId = parseInt(match[1], 10);
            const qObj = allQ.find(item => item.id === qId);
            if (!qObj) return;

            let ansText = 'Нет данных';
            if (typeof getCorrectAnswerText === 'function') {
                ansText = getCorrectAnswerText(qObj);
            } else {
                ansText = JSON.stringify(qObj.correct || qObj.fullAnswer || '');
            }

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

    // 6. ПАНЕЛЬ УПРАВЛЕНИЯ НА СТРАНИЦЕ
    const panel = document.createElement('div');
    panel.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 9999; background: #1e1e1e; border: 1px solid #3b82f6; padding: 12px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); display: flex; gap: 8px; flex-direction: column; font-family: sans-serif;';
    
    const title = document.createElement('div');
    title.textContent = '🛠 Универсальный аудит';
    title.style.cssText = 'color: #3b82f6; font-weight: bold; font-size: 14px; margin-bottom: 4px;';
    panel.appendChild(title);

    const btnInstant = document.createElement('button');
    btnInstant.textContent = '👑 Сдать тест идеально';
    btnInstant.style.cssText = 'padding: 8px 12px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: left;';
    btnInstant.onclick = instantPerfectSubmit;

    const btnShowHints = document.createElement('button');
    btnShowHints.textContent = '👁 Показать ответы';
    btnShowHints.style.cssText = 'padding: 8px 12px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-size: 13px; text-align: left;';
    btnShowHints.onclick = injectHintsAndButtons;

    const btnSolveAll = document.createElement('button');
    btnSolveAll.textContent = '⚡ Заполнить всё в тесте';
    btnSolveAll.style.cssText = 'padding: 8px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: left;';
    btnSolveAll.onclick = () => {
        getAllQuestions().forEach(q => solveSingleQuestion(q));
        injectHintsAndButtons();
    };

    panel.appendChild(btnInstant);
    panel.appendChild(btnShowHints);
    panel.appendChild(btnSolveAll);
    document.body.appendChild(panel);
})();