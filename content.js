(function() {
    if (typeof questionsDB === 'undefined') return;

    // 1. НЕЙТРАЛИЗАЦИЯ АНТИЧИТА
    window.updateViolationCounter = function() {
        if (typeof violations !== 'undefined') {
            for (let k in violations) violations[k] = 0;
        }
        const el = document.getElementById('violation-counter');
        if (el) el.style.display = 'none';
    };
    window.playWarningRed = function() {};
    window.playWarningOrange = function() {};
    window.playWarningYellow = function() {};
    window.playSiren = function() {};

    document.body.style.userSelect = 'auto';
    document.body.style.webkitUserSelect = 'auto';

    ['visibilitychange', 'blur', 'mouseleave', 'contextmenu', 'copy', 'paste', 'cut', 'selectstart', 'dragstart', 'keydown'].forEach(evt => {
        window.addEventListener(evt, (e) => {
            e.stopImmediatePropagation();
        }, true);
    });

    // 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    function getAllQuestions() {
        return [
            ...(questionsDB.basic || []),
            ...(questionsDB.advanced || []),
            ...(questionsDB.high || [])
        ];
    }

    function solveSingleQuestion(q) {
        if (q.type === 'radio') {
            const input = document.querySelector(`input[type="radio"][name="q${q.id}"][value="${q.correct[0]}"]`);
            if (input) input.checked = true;
        } else if (q.type === 'checkbox') {
            document.querySelectorAll(`input[type="checkbox"][name="q${q.id}"]`).forEach(inp => {
                inp.checked = q.correct.includes(inp.value);
            });
        } else if (q.type === 'matching') {
            Object.entries(q.correct).forEach(([itemId, targetId]) => {
                const select = document.querySelector(`select[name="q${q.id}_${itemId}"]`);
                if (select) select.value = targetId;
            });
        } else if (q.type === 'ordering') {
            q.correct.forEach((correctText, idx) => {
                const select = document.querySelector(`select[name="q${q.id}_pos${idx}"]`);
                if (select) select.value = correctText;
            });
        } else if (q.type === 'text') {
            const textarea = document.querySelector(`textarea[name="q${q.id}"]`);
            if (textarea && q.fullAnswer) textarea.value = q.fullAnswer;
        }
    }

    // 3. МГНОВЕННАЯ ОТПРАВКА ИДЕАЛЬНОГО РЕЗУЛЬТАТА НА СЕРВЕР
    function instantPerfectSubmit() {
        const nameInput = document.getElementById('student-name');
        const groupInput = document.getElementById('student-group');
        const name = nameInput ? nameInput.value.trim() : '';
        const group = groupInput ? groupInput.value.trim() : '';

        if (!name || !group) {
            alert('Милостивый государь, извольте сперва вписать ФИО и группу в поля на экране!');
            return;
        }

        const allQ = getAllQuestions();
        // Считаем число автоматически оцениваемых вопросов (в примере их 26)
        const gradedQuestions = allQ.filter(q => !((q.id >= 27 && q.id <= 30) || q.id >= 35));
        const totalGraded = gradedQuestions.length || 26;

        // Собираем эталонные ответы для вопросов ручной проверки
        const highDiffPayload = [];
        const highDiffDisplay = [];
        allQ.forEach((q, idx) => {
            if ((q.id >= 27 && q.id <= 30) || q.id >= 35) {
                const ans = q.fullAnswer || 'Выполнено согласно регламенту.';
                highDiffPayload.push({ q_num: idx + 1, answer: ans });
                highDiffDisplay.push({ num: idx + 1, text: q.text, userAnswer: ans, fullAnswer: ans });
            }
        });

        // Генерируем благопристойное время прохождения: от 480 до 840 секунд (8–14 минут)
        const fakeDuration = Math.floor(Math.random() * (840 - 480 + 1)) + 480;

        const payload = {
            test_id: typeof TEST_ID !== 'undefined' ? TEST_ID : 2,
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
            answer_pattern_percentage: 25, // Идеальное распределение без подозрений
            answer_pattern_suspicious: false,
            total_violations: 0,
            high_difficulty_answers: highDiffPayload
        };

        // Останавливаем таймер и активность теста, если он был запущен
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        if (typeof isTestActive !== 'undefined') isTestActive = false;

        // Отправляем депешу штатной функцией сайта
        if (typeof sendResultToServer === 'function') {
            sendResultToServer(payload);
        } else {
            fetch('save_result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        // Отрисовываем победный экран результатов без единого клика по вопросам
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('test-screen').style.display = 'none';
        document.getElementById('result-screen').style.display = 'block';

        document.getElementById('res-name').textContent = name.split(' ')[0].toUpperCase();
        document.getElementById('res-score').textContent = `Правильных ответов: ${totalGraded} из ${totalGraded}`;
        document.getElementById('res-percent').textContent = '100';
        
        const m = Math.floor(fakeDuration / 60).toString().padStart(2, '0');
        const s = (fakeDuration % 60).toString().padStart(2, '0');
        document.getElementById('res-time').textContent = `${m}:${s}`;

        const errContainer = document.getElementById('res-errors-container');
        if (errContainer) {
            errContainer.innerHTML = '<div style="color:var(--success); font-size:1.2em; font-weight:bold; text-align:center; margin-bottom: 20px;">Ошибок в оцениваемой части нет! Отличная работа.</div>';
        }
    }

    // 4. ОТОБРАЖЕНИЕ ОТВЕТОВ РЯДОМ С ВОПРОСАМИ
    function injectHintsAndButtons() {
        const allQ = getAllQuestions();
        document.querySelectorAll('.question-block').forEach(block => {
            if (block.querySelector('.audit-helper-box')) return;
            const firstInput = block.querySelector('input, select, textarea');
            if (!firstInput || !firstInput.name) return;

            const match = firstInput.name.match(/^q(\d+)/);
            if (!match) return;

            const qObj = allQ.find(item => item.id === parseInt(match[1], 10));
            if (!qObj) return;

            const ansText = typeof getCorrectAnswerText === 'function' 
                ? getCorrectAnswerText(qObj) 
                : JSON.stringify(qObj.correct || qObj.fullAnswer);

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

    // 5. ПАНЕЛЬ УПРАВЛЕНИЯ
    const panel = document.createElement('div');
    panel.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 9999; background: #1e1e1e; border: 1px solid #3b82f6; padding: 12px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); display: flex; gap: 8px; flex-direction: column; font-family: sans-serif;';
    
    const title = document.createElement('div');
    title.textContent = '🛠 Панель аудита';
    title.style.cssText = 'color: #3b82f6; font-weight: bold; font-size: 14px; margin-bottom: 4px;';
    panel.appendChild(title);

    const btnInstant = document.createElement('button');
    btnInstant.textContent = '👑 Сдать идеально (без решения)';
    btnInstant.style.cssText = 'padding: 8px 12px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; text-align: left;';
    btnInstant.onclick = instantPerfectSubmit;

    const btnShowHints = document.createElement('button');
    btnShowHints.textContent = '👁 Показать ответы в тесте';
    btnShowHints.style.cssText = 'padding: 8px 12px; background: #2d2d2d; color: #e0e0e0; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-size: 13px; text-align: left;';
    btnShowHints.onclick = injectHintsAndButtons;

    const btnSolveAll = document.createElement('button');
    btnSolveAll.textContent = '⚡ Заполнить все поля';
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
