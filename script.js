// Основной файл приложения - Chess Arena
class ChessArena {
    constructor() {
        this.game = null;
        this.board = null;
        this.config = {
            soundEnabled: true,
            animationEnabled: true,
            theme: 'dark',
            playerName: 'Гость',
            playerRating: 1500,
            gameMode: null
        };
        
        this.state = {
            isPlaying: false,
            currentTurn: 'white',
            whiteTime: 600,
            blackTime: 600,
            moveHistory: [],
            capturedPieces: { white: [], black: [] },
            isCheck: false,
            isCheckmate: false
        };
        
        this.init();
    }

    async init() {
        // Загрузка экрана
        this.showLoading();
        
        // Инициализация Firebase
        await this.initFirebase();
        
        // Настройка доски
        this.setupBoard();
        
        // Настройка обработчиков событий
        this.setupEventListeners();
        
        // Загрузка конфигурации
        this.loadConfig();
        
        // Скрытие экрана загрузки
        setTimeout(() => {
            this.hideLoading();
            this.showMainApp();
            this.playSound('start');
            this.showNotification('Добро пожаловать в Chess Arena!', 'success');
        }, 2000);
    }

    showLoading() {
        // Анимация прогресс-бара
        const progressBar = document.querySelector('.progress-fill');
        let width = 0;
        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
                return;
            }
            width += Math.random() * 10;
            if (width > 100) width = 100;
            progressBar.style.width = width + '%';
        }, 100);
    }

    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    showMainApp() {
        document.getElementById('mainContainer').style.display = 'block';
        this.setupParticles();
    }

    setupParticles() {
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: "#4d7fff" },
                shape: { type: "circle" },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: "#9d4edd",
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: "none",
                    random: true,
                    straight: false,
                    out_mode: "out",
                    bounce: false
                }
            },
            interactivity: {
                detect_on: "canvas",
                events: {
                    onhover: { enable: true, mode: "repulse" },
                    onclick: { enable: true, mode: "push" }
                }
            }
        });
    }

    async initFirebase() {
        try {
            // Firebase уже инициализирован в firebase.js
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.config.playerName = user.displayName || user.email.split('@')[0];
                    this.config.playerEmail = user.email;
                    this.updateUserUI();
                    this.showNotification(`Добро пожаловать, ${this.config.playerName}!`, 'success');
                } else {
                    // Показать модалку логина
                    setTimeout(() => {
                        this.showLoginModal();
                    }, 1000);
                }
            });
            
            // Проверка соединения с Firebase
            const connectedRef = firebase.database().ref(".info/connected");
            connectedRef.on("value", (snap) => {
                const connectionStatus = document.getElementById('connectionStatus') || this.createConnectionStatus();
                const connectionDot = connectionStatus.querySelector('.connection-dot');
                
                if (snap.val() === true) {
                    connectionStatus.innerHTML = '<span class="connection-dot connected"></span> Онлайн';
                    connectionStatus.style.border = '1px solid var(--accent-green)';
                } else {
                    connectionStatus.innerHTML = '<span class="connection-dot"></span> Оффлайн';
                    connectionStatus.style.border = '1px solid var(--accent-red)';
                }
            });
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.showNotification('Ошибка подключения к серверу', 'error');
        }
    }

    createConnectionStatus() {
        const status = document.createElement('div');
        status.className = 'connection-status';
        status.id = 'connectionStatus';
        status.innerHTML = '<span class="connection-dot"></span> Подключение...';
        document.body.appendChild(status);
        return status;
    }

    setupBoard() {
        // Инициализация шахматной доски
        this.game = new Chess();
        
        const config = {
            draggable: true,
            position: 'start',
            onDragStart: this.onDragStart.bind(this),
            onDrop: this.onDrop.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            onMouseoutSquare: this.onMouseoutSquare.bind(this),
            onMouseoverSquare: this.onMouseoverSquare.bind(this),
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            showNotation: true,
            orientation: 'white'
        };
        
        this.board = Chessboard2('board', config);
        
        // Установка кастомных стилей для доски
        this.customizeBoard();
    }

    customizeBoard() {
        // Добавление кастомных классов к доске
        const boardElement = document.getElementById('board');
        boardElement.classList.add('custom-board');
        
        // Стилизация клеток
        const squares = boardElement.querySelectorAll('.square-55d63');
        squares.forEach((square, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            
            // Добавление координат
            if ((row === 7 && col === 0) || (row === 0 && col === 7)) {
                const coord = document.createElement('div');
                coord.className = 'board-coordinate';
                coord.textContent = row === 7 ? 'a' : 'A';
                coord.style.position = 'absolute';
                coord.style.bottom = '2px';
                coord.style.left = '2px';
                coord.style.fontSize = '10px';
                coord.style.color = 'var(--text-muted)';
                square.appendChild(coord);
            }
        });
    }

    onDragStart(source, piece, position, orientation) {
        // Проверка возможности хода
        if (this.game.game_over()) return false;
        if (this.config.gameMode === 'ai' && this.game.turn() !== this.config.playerColor) return false;
        
        const pieceColor = piece.charAt(0);
        const turnColor = this.game.turn() === 'w' ? 'white' : 'black';
        
        if (pieceColor !== turnColor.charAt(0)) return false;
        
        // Подсветка возможных ходов
        this.highlightMoves(source);
        return true;
    }

    highlightMoves(source) {
        const moves = this.game.moves({ square: source, verbose: true });
        moves.forEach(move => {
            const square = document.querySelector(`.square-${this.getSquareNotation(move.to)}`);
            if (square) {
                square.classList.add('possible-move');
                
                // Добавление точки для пустых клеток
                if (!this.game.get(move.to)) {
                    const dot = document.createElement('div');
                    dot.className = 'move-dot';
                    dot.style.cssText = `
                        position: absolute;
                        width: 12px;
                        height: 12px;
                        background: rgba(77, 127, 255, 0.7);
                        border-radius: 50%;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        z-index: 10;
                    `;
                    square.appendChild(dot);
                }
            }
        });
    }

    clearHighlights() {
        document.querySelectorAll('.possible-move').forEach(el => {
            el.classList.remove('possible-move');
            const dot = el.querySelector('.move-dot');
            if (dot) dot.remove();
        });
    }

    onMouseoverSquare(square, piece) {
        if (piece && this.game.turn() === piece.charAt(0)) {
            this.highlightMoves(square);
        }
    }

    onMouseoutSquare(square, piece) {
        this.clearHighlights();
    }

    onDrop(source, target) {
        this.clearHighlights();
        
        // Проверка на превращение пешки
        let promotion = null;
        const piece = this.game.get(source);
        if (piece && piece.type === 'p') {
            const row = target.charAt(1);
            if ((piece.color === 'w' && row === '8') || (piece.color === 'b' && row === '1')) {
                promotion = 'q'; // Всегда превращаем в ферзя для простоты
            }
        }
        
        const move = this.game.move({
            from: source,
            to: target,
            promotion: promotion
        });
        
        if (move === null) return 'snapback';
        
        // Воспроизведение звука
        this.playMoveSound(move);
        
        // Обновление истории ходов
        this.addMoveToHistory(move);
        
        // Обновление таймера
        this.switchTimer();
        
        // Проверка на шах/мат
        this.checkGameState();
        
        // Если игра с AI - ход AI
        if (this.config.gameMode === 'ai' && !this.game.game_over()) {
            setTimeout(() => this.makeAIMove(), 500);
        }
        
        // Если онлайн игра - отправка хода
        if (this.config.gameMode === 'online' && this.currentGameId) {
            this.sendMoveToServer(move);
        }
        
        return true;
    }

    onSnapEnd() {
        this.board.position(this.game.fen());
    }

    playMoveSound(move) {
        if (!this.config.soundEnabled) return;
        
        let sound = 'move';
        if (move.captured) sound = 'capture';
        if (move.san.includes('+')) sound = 'check';
        if (move.flags.includes('k') || move.flags.includes('q')) sound = 'castle';
        
        this.playSound(sound);
    }

    playSound(type) {
        if (!this.config.soundEnabled) return;
        
        const audio = new Audio();
        audio.src = `sounds/${type}.ogg`;
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio error:', e));
    }

    addMoveToHistory(move) {
        const moveNumber = Math.ceil(this.state.moveHistory.length / 2) + 1;
        const isWhiteMove = this.state.moveHistory.length % 2 === 0;
        
        const moveElement = document.createElement('div');
        moveElement.className = `move-row ${isWhiteMove ? 'current' : ''}`;
        
        if (isWhiteMove) {
            moveElement.innerHTML = `
                <span class="move-number">${moveNumber}.</span>
                <span class="move-white">${move.san}</span>
                <span class="move-black"></span>
            `;
        } else {
            const lastRow = document.querySelector('.move-row:last-child');
            if (lastRow) {
                lastRow.querySelector('.move-black').textContent = move.san;
                lastRow.classList.remove('current');
            }
        }
        
        document.getElementById('movesContainer').appendChild(moveElement);
        document.getElementById('movesContainer').scrollTop = document.getElementById('movesContainer').scrollHeight;
        
        this.state.moveHistory.push(move);
        
        // Обновление счетчиков ходов
        if (move.color === 'w') {
            document.getElementById('whiteMoves').textContent = 
                parseInt(document.getElementById('whiteMoves').textContent) + 1;
        } else {
            document.getElementById('blackMoves').textContent = 
                parseInt(document.getElementById('blackMoves').textContent) + 1;
        }
    }

    switchTimer() {
        if (this.game.turn() === 'w') {
            // Переключение на белых
            this.state.currentTurn = 'white';
            document.querySelector('.white-timer').classList.add('active');
            document.querySelector('.black-timer').classList.remove('active');
        } else {
            // Переключение на черных
            this.state.currentTurn = 'black';
            document.querySelector('.black-timer').classList.add('active');
            document.querySelector('.white-timer').classList.remove('active');
        }
    }

    checkGameState() {
        if (this.game.in_check()) {
            this.state.isCheck = true;
            this.showNotification('ШАХ!', 'warning');
            document.querySelector('.status-indicator').style.background = 'var(--accent-red)';
            document.querySelector('.status-text').textContent = 'ШАХ!';
        } else {
            this.state.isCheck = false;
        }
        
        if (this.game.in_checkmate()) {
            this.state.isCheckmate = true;
            const winner = this.game.turn() === 'w' ? 'Чёрные' : 'Белые';
            this.showNotification(`МАТ! Победа ${winner}!`, 'success');
            this.endGame(winner.toLowerCase());
        } else if (this.game.in_draw()) {
            this.showNotification('НИЧЬЯ!', 'info');
            this.endGame('draw');
        } else if (this.game.in_stalemate()) {
            this.showNotification('ПАТ!', 'info');
            this.endGame('draw');
        }
    }

    endGame(result) {
        this.state.isPlaying = false;
        clearInterval(this.timerInterval);
        
        let statusText = 'Игра завершена';
        let statusColor = 'var(--accent-blue)';
        
        if (result === 'white') {
            statusText = 'Победа белых!';
            statusColor = 'var(--accent-green)';
        } else if (result === 'black') {
            statusText = 'Победа чёрных!';
            statusColor = 'var(--accent-red)';
        } else if (result === 'draw') {
            statusText = 'Ничья!';
            statusColor = 'var(--accent-yellow)';
        }
        
        document.querySelector('.status-indicator').style.background = statusColor;
        document.querySelector('.status-text').textContent = statusText;
        
        // Показать кнопку новой игры
        document.getElementById('boardOverlay').style.display = 'flex';
        document.querySelector('.overlay-content').innerHTML = `
            <h3>${statusText}</h3>
            <p>${this.getGameSummary()}</p>
            <button class="mode-btn ai-mode" onclick="chessArena.newGame()">
                <i class="fas fa-redo"></i>
                <span>Новая игра</span>
            </button>
        `;
        
        // Сохранение статистики
        this.saveGameStats(result);
    }

    getGameSummary() {
        const moves = this.state.moveHistory.length;
        const duration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        return `${moves} ходов за ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    saveGameStats(result) {
        // Сохранение статистики в localStorage
        const stats = JSON.parse(localStorage.getItem('chessStats') || '{"wins": 0, "losses": 0, "draws": 0, "total": 0}');
        
        if (result === this.config.playerColor) {
            stats.wins++;
        } else if (result === 'draw') {
            stats.draws++;
        } else {
            stats.losses++;
        }
        
        stats.total++;
        localStorage.setItem('chessStats', JSON.stringify(stats));
        
        // Обновление UI
        this.updateStatsUI(stats);
    }

    updateStatsUI(stats) {
        document.getElementById('winsCount').textContent = stats.wins;
        document.getElementById('lossesCount').textContent = stats.losses;
        document.getElementById('drawsCount').textContent = stats.draws;
        document.getElementById('totalGames').textContent = stats.total;
    }

    async makeAIMove() {
        if (this.game.game_over() || this.game.turn() === (this.config.playerColor === 'white' ? 'w' : 'b')) {
            return;
        }
        
        // Показать индикатор хода AI
        document.querySelector('.status-text').textContent = 'AI думает...';
        
        // Задержка для реалистичности
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        // Получение лучшего хода от AI (упрощённая версия)
        const moves = this.game.moves();
        if (moves.length === 0) return;
        
        // Выбор случайного хода (можно заменить на Stockfish)
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        this.game.move(randomMove);
        
        // Обновление доски
        this.board.position(this.game.fen());
        
        // Обновление истории
        const move = this.game.history({ verbose: true }).pop();
        this.addMoveToHistory(move);
        
        // Обновление таймера
        this.switchTimer();
        
        // Проверка состояния игры
        this.checkGameState();
        
        document.querySelector('.status-text').textContent = 'Ваш ход';
    }

    setupEventListeners() {
        // Кнопка новой игры
        document.getElementById('newGameBtn').addEventListener('click', () => this.showGameModes());
        
        // Кнопки режимов игры
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.startGame(mode);
            });
        });
        
        // Кнопка отмены хода
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        
        // Кнопка подсказки
        document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
        
        // Кнопка ничьи
        document.getElementById('drawBtn').addEventListener('click', () => this.offerDraw());
        
        // Кнопка сдачи
        document.getElementById('resignBtn').addEventListener('click', () => this.resign());
        
        // Переключение темы
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Переключение звука
        document.getElementById('soundToggle').addEventListener('click', () => this.toggleSound());
        
        // Отправка сообщения в чат
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        
        // Переключение табов
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });
        
        // Кнопка игры как гость
        document.getElementById('playAsGuest').addEventListener('click', () => this.playAsGuest());
    }

    showGameModes() {
        document.getElementById('boardOverlay').style.display = 'flex';
        document.querySelector('.overlay-content').innerHTML = `
            <h3>Выберите режим игры</h3>
            <div class="mode-buttons">
                <button class="mode-btn ai-mode" data-mode="ai">
                    <i class="fas fa-robot"></i>
                    <span>Играть с AI</span>
                    <small>Уровень: Сложный</small>
                </button>
                <button class="mode-btn online-mode" data-mode="online">
                    <i class="fas fa-globe"></i>
                    <span>Играть онлайн</span>
                    <small>С реальными игроками</small>
                </button>
                <button class="mode-btn local-mode" data-mode="local">
                    <i class="fas fa-users"></i>
                    <span>Локальная игра</span>
                    <small>Два игрока</small>
                </button>
            </div>
        `;
        
        // Повторная привязка событий
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.startGame(mode);
            });
        });
    }

    startGame(mode) {
        this.config.gameMode = mode;
        this.state.isPlaying = true;
        
        // Скрытие оверлея
        document.getElementById('boardOverlay').style.display = 'none';
        
        // Сброс игры
        this.game = new Chess();
        this.board.position('start');
        this.state.moveHistory = [];
        document.getElementById('movesContainer').innerHTML = `
            <div class="empty-history">
                <i class="fas fa-chess-board"></i>
                <p>Ходы появятся здесь</p>
            </div>
        `;
        
        // Сброс таймеров
        this.state.whiteTime = 600;
        this.state.blackTime = 600;
        document.getElementById('whiteTimer').querySelector('span').textContent = '10:00';
        document.getElementById('blackTimer').querySelector('span').textContent = '10:00';
        
        // Установка цвета игрока
        if (mode === 'ai') {
            this.config.playerColor = Math.random() > 0.5 ? 'white' : 'black';
            document.getElementById('blackPlayerInfo').querySelector('.player-name').textContent = 'AI Бот';
        } else if (mode === 'online') {
            this.config.playerColor = 'white';
            document.getElementById('blackPlayerInfo').querySelector('.player-name').textContent = 'Ожидание...';
        } else {
            this.config.playerColor = 'white';
            document.getElementById('blackPlayerInfo').querySelector('.player-name').textContent = 'Игрок 2';
        }
        
        // Обновление UI
        document.querySelector('.status-indicator').style.background = 'var(--accent-green)';
        document.querySelector('.status-text').textContent = 'Игра началась!';
        
        // Запуск таймера
        this.startTimer();
        
        // Запись времени начала
        this.gameStartTime = Date.now();
        
        // Если AI играет белыми
        if (mode === 'ai' && this.config.playerColor === 'black') {
            setTimeout(() => this.makeAIMove(), 1000);
        }
        
        this.showNotification(`Игра началась! Режим: ${this.getModeName(mode)}`, 'success');
    }

    getModeName(mode) {
        const names = {
            'ai': 'Игра с AI',
            'online': 'Онлайн игра',
            'local': 'Локальная игра'
        };
        return names[mode] || mode;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (this.state.currentTurn === 'white') {
                this.state.whiteTime--;
                document.getElementById('whiteTimer').querySelector('span').textContent = 
                    this.formatTime(this.state.whiteTime);
                
                if (this.state.whiteTime <= 0) {
                    this.timeOut('white');
                }
            } else {
                this.state.blackTime--;
                document.getElementById('blackTimer').querySelector('span').textContent = 
                    this.formatTime(this.state.blackTime);
                
                if (this.state.blackTime <= 0) {
                    this.timeOut('black');
                }
            }
        }, 1000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    timeOut(color) {
        clearInterval(this.timerInterval);
        const winner = color === 'white' ? 'чёрных' : 'белых';
        this.showNotification(`Время вышло! Победа ${winner}!`, 'warning');
        this.endGame(color === 'white' ? 'black' : 'white');
    }

    undoMove() {
        if (this.state.moveHistory.length === 0) return;
        
        this.game.undo();
        this.state.moveHistory.pop();
        this.board.position(this.game.fen());
        
        // Обновление истории
        this.updateMoveHistoryUI();
        
        this.showNotification('Ход отменён', 'info');
    }

    updateMoveHistoryUI() {
        const container = document.getElementById('movesContainer');
        container.innerHTML = '';
        
        this.state.moveHistory.forEach((move, index) => {
            const moveNumber = Math.floor(index / 2) + 1;
            const isWhiteMove = index % 2 === 0;
            
            if (isWhiteMove) {
                const moveElement = document.createElement('div');
                moveElement.className = 'move-row';
                moveElement.innerHTML = `
                    <span class="move-number">${moveNumber}.</span>
                    <span class="move-white">${move.san}</span>
                    <span class="move-black"></span>
                `;
                container.appendChild(moveElement);
            } else {
                const lastRow = container.lastElementChild;
                if (lastRow) {
                    lastRow.querySelector('.move-black').textContent = move.san;
                }
            }
        });
    }

    showHint() {
        const moves = this.game.moves();
        if (moves.length === 0) return;
        
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        this.showNotification(`Подсказка: ${randomMove}`, 'info');
    }

    offerDraw() {
        if (!this.state.isPlaying) return;
        
        if (confirm('Предложить ничью?')) {
            this.showNotification('Ничья предложена', 'info');
            // В онлайн-режиме здесь будет отправка запроса сопернику
        }
    }

    resign() {
        if (!this.state.isPlaying) return;
        
        if (confirm('Вы уверены, что хотите сдаться?')) {
            const winner = this.config.playerColor === 'white' ? 'чёрных' : 'белых';
            this.showNotification(`Вы сдались. Победа ${winner}!`, 'error');
            this.endGame(this.config.playerColor === 'white' ? 'black' : 'white');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.config.theme = newTheme;
        localStorage.setItem('chessTheme', newTheme);
        
        const icon = document.querySelector('#themeToggle i');
        icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        
        this.showNotification(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`, 'success');
    }

    toggleSound() {
        this.config.soundEnabled = !this.config.soundEnabled;
        localStorage.setItem('chessSound', this.config.soundEnabled);
        
        const icon = document.querySelector('#soundToggle i');
        icon.className = this.config.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        
        this.showNotification(`Звук ${this.config.soundEnabled ? 'включён' : 'выключен'}`, 'info');
    }

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Добавление сообщения в чат
        this.addChatMessage(this.config.playerName, message, true);
        
        // Очистка поля ввода
        input.value = '';
        
        // В онлайн-режиме отправка сообщения на сервер
        if (this.config.gameMode === 'online' && this.currentGameId) {
            // Отправка через Firebase
        }
    }

    addChatMessage(sender, text, isOwn = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${isOwn ? 'message-own' : ''}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-avatar">${sender.charAt(0).toUpperCase()}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${sender}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${this.escapeHtml(text)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    switchTab(tabId) {
        // Удаление активного класса со всех табов
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Добавление активного класса выбранному табу
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`${tabId}Tab`).classList.add('active');
    }

    showLoginModal() {
        const modal = document.getElementById('loginModal');
        modal.classList.add('active');
        
        // Обработчики для модалки
        document.querySelector('.close-modal').addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const authType = e.currentTarget.dataset.auth;
                this.switchAuthTab(authType);
            });
        });
        
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    switchAuthTab(authType) {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.auth === authType);
        });
        
        const form = document.getElementById('loginForm');
        const submitBtn = form.querySelector('.btn-auth');
        
        if (authType === 'login') {
            submitBtn.textContent = 'Войти';
        } else {
            submitBtn.textContent = 'Зарегистрироваться';
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const isLogin = document.querySelector('.auth-tab.active').dataset.auth === 'login';
        
        try {
            if (isLogin) {
                await firebase.auth().signInWithEmailAndPassword(email, password);
                this.showNotification('Вход выполнен успешно!', 'success');
            } else {
                await firebase.auth().createUserWithEmailAndPassword(email, password);
                this.showNotification('Регистрация успешна!', 'success');
            }
            
            document.getElementById('loginModal').classList.remove('active');
        } catch (error) {
            this.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    playAsGuest() {
        this.config.playerName = 'Гость_' + Math.floor(Math.random() * 1000);
        this.updateUserUI();
        document.getElementById('loginModal').classList.remove('active');
        this.showNotification(`Добро пожаловать, ${this.config.playerName}!`, 'success');
    }

    updateUserUI() {
        document.getElementById('username').textContent = this.config.playerName;
        document.getElementById('userRating').textContent = this.config.playerRating;
        document.getElementById('userAvatar').textContent = this.config.playerName.charAt(0).toUpperCase();
    }

    showNotification(message, type = 'info') {
        // Создание элемента уведомления
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = type === 'error' ? 'fas fa-exclamation-circle' :
                    type === 'success' ? 'fas fa-check-circle' :
                    type === 'warning' ? 'fas fa-exclamation-triangle' :
                    'fas fa-info-circle';
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Удаление уведомления через 5 секунд
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    loadConfig() {
        // Загрузка конфигурации из localStorage
        const theme = localStorage.getItem('chessTheme') || 'dark';
        const sound = localStorage.getItem('chessSound') !== 'false';
        const stats = JSON.parse(localStorage.getItem('chessStats') || '{"wins": 0, "losses": 0, "draws": 0, "total": 0}');
        
        this.config.theme = theme;
        this.config.soundEnabled = sound;
        
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelector('#themeToggle i').className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        document.querySelector('#soundToggle i').className = sound ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        
        this.updateStatsUI(stats);
    }

    getSquareNotation(square) {
        // Конвертация координат в формат chessboard.js
        const file = square.charCodeAt(0) - 97;
        const rank = 8 - parseInt(square.charAt(1));
        return rank * 8 + file;
    }

    newGame() {
        this.showGameModes();
    }
}

// Инициализация приложения
let chessArena;
window.addEventListener('DOMContentLoaded', () => {
    chessArena = new ChessArena();
    window.chessArena = chessArena;
});
