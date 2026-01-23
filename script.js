// Основное приложение Chess Arena
class ChessArena {
    constructor() {
        this.game = null;
        this.board = null;
        this.timerInterval = null;
        this.gameStartTime = null;
        
        this.config = {
            soundEnabled: false,
            theme: 'dark',
            playerName: 'Гость',
            playerRating: 1500,
            gameMode: null,
            playerColor: 'white'
        };
        
        this.state = {
            isPlaying: false,
            currentTurn: 'white',
            whiteTime: 600,
            blackTime: 600,
            whiteMoves: 0,
            blackMoves: 0,
            moveHistory: []
        };
        
        this.init();
    }

    init() {
        console.log('♛ Chess Arena инициализация...');
        
        // Быстрая загрузка
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('mainContainer').style.display = 'block';
            this.setupBoard();
            this.setupEventListeners();
            this.loadConfig();
            this.showNotification('♛ Chess Arena готов к игре!', 'info');
        }, 1000);
    }

    setupBoard() {
        try {
            this.game = new Chess();
            
            const boardConfig = {
                draggable: true,
                position: 'start',
                onDragStart: this.onDragStart.bind(this),
                onDrop: this.onDrop.bind(this),
                onSnapEnd: this.onSnapEnd.bind(this),
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
            };
            
            this.board = Chessboard('board', boardConfig);
            console.log('✅ Шахматная доска готова!');
        } catch (error) {
            console.error('❌ Ошибка инициализации доски:', error);
            this.showNotification('Ошибка загрузки шахматной доски', 'error');
        }
    }

    onDragStart(source, piece) {
        if (!this.state.isPlaying) return false;
        if (this.game.game_over()) return false;
        
        // Определяем цвет фигуры
        const pieceColor = piece.charAt(0); // 'w' или 'b'
        const currentTurn = this.game.turn(); // 'w' или 'b'
        
        // Проверяем, может ли игрок ходить этой фигурой
        if (this.config.gameMode === 'ai') {
            // В режиме с AI игрок ходит только своим цветом
            const playerPieceColor = this.config.playerColor === 'white' ? 'w' : 'b';
            if (pieceColor !== playerPieceColor) return false;
            if (currentTurn !== playerPieceColor) return false;
        } else {
            // В локальном режиме - текущий ход
            if (pieceColor !== currentTurn) return false;
        }
        
        return true;
    }

    onDrop(source, target) {
        if (!this.state.isPlaying) return 'snapback';
        
        // Пытаемся сделать ход
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q'
        });
        
        // Если ход некорректный
        if (move === null) {
            console.log('❌ Некорректный ход');
            return 'snapback';
        }
        
        console.log(`✅ Ход: ${move.san}`);
        
        // Обновляем доску
        this.board.position(this.game.fen());
        
        // Добавляем ход в историю
        this.addMoveToHistory(move);
        
        // Обновляем счетчики
        if (move.color === 'w') {
            this.state.whiteMoves++;
            document.getElementById('whiteMoves').textContent = this.state.whiteMoves;
        } else {
            this.state.blackMoves++;
            document.getElementById('blackMoves').textContent = this.state.blackMoves;
        }
        
        // Проверяем состояние игры
        this.checkGameState();
        
        // Если игра с AI - ход компьютера
        if (this.config.gameMode === 'ai' && !this.game.game_over()) {
            setTimeout(() => this.makeAIMove(), 500);
        }
        
        return true;
    }

    onSnapEnd() {
        this.board.position(this.game.fen());
    }

    makeAIMove() {
        if (this.game.game_over()) return;
        
        // Простой AI - случайный ход
        const moves = this.game.moves();
        if (moves.length === 0) return;
        
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        const move = this.game.move(randomMove);
        
        // Обновляем доску
        this.board.position(this.game.fen());
        
        // Добавляем в историю
        this.addMoveToHistory(move);
        
        // Обновляем счетчики
        this.state.blackMoves++;
        document.getElementById('blackMoves').textContent = this.state.blackMoves;
        
        // Проверяем состояние
        this.checkGameState();
    }

    addMoveToHistory(move) {
        const container = document.getElementById('movesContainer');
        
        // Убираем сообщение о пустой истории
        if (container.querySelector('.empty-history')) {
            container.innerHTML = '';
        }
        
        // Определяем номер хода
        const moveNumber = Math.floor(this.state.moveHistory.length / 2) + 1;
        const isWhiteMove = this.state.moveHistory.length % 2 === 0;
        
        if (isWhiteMove) {
            // Создаем новый ряд для хода белых
            const row = document.createElement('div');
            row.className = 'move-row';
            row.innerHTML = `
                <span class="move-number">${moveNumber}.</span>
                <span class="move-white">${move.san}</span>
                <span class="move-black"></span>
            `;
            container.appendChild(row);
        } else {
            // Добавляем ход черных к последнему ряду
            const lastRow = container.lastElementChild;
            if (lastRow) {
                lastRow.querySelector('.move-black').textContent = move.san;
            }
        }
        
        // Сохраняем ход
        this.state.moveHistory.push(move);
        
        // Скроллим вниз
        container.scrollTop = container.scrollHeight;
    }

    checkGameState() {
        if (this.game.in_checkmate()) {
            const winner = this.game.turn() === 'w' ? 'Чёрные' : 'Белые';
            this.showNotification(`🎉 МАТ! Победа ${winner}!`, 'success');
            this.endGame(winner === 'Белые' ? 'white' : 'black');
        } else if (this.game.in_draw()) {
            this.showNotification('🤝 Ничья!', 'info');
            this.endGame('draw');
        } else if (this.game.in_check()) {
            this.showNotification('⚡ ШАХ!', 'warning');
            document.querySelector('.status-text').textContent = 'ШАХ!';
            document.querySelector('.status-indicator').style.background = 'var(--accent-red)';
        } else {
            const turn = this.game.turn() === 'w' ? 'белых' : 'черных';
            document.querySelector('.status-text').textContent = `Ход ${turn}`;
            document.querySelector('.status-indicator').style.background = 'var(--accent-green)';
        }
    }

    startGame(mode) {
        console.log(`🚀 Начинаем игру: ${mode}`);
        
        this.config.gameMode = mode;
        this.state.isPlaying = true;
        
        // Скрываем оверлей
        document.getElementById('boardOverlay').style.display = 'none';
        
        // Сбрасываем игру
        this.game = new Chess();
        this.board.position('start');
        
        // Сбрасываем состояние
        this.state.moveHistory = [];
        this.state.whiteMoves = 0;
        this.state.blackMoves = 0;
        this.state.whiteTime = 600;
        this.state.blackTime = 600;
        
        // Обновляем UI
        document.getElementById('whiteMoves').textContent = '0';
        document.getElementById('blackMoves').textContent = '0';
        document.getElementById('whiteTimer').textContent = '10:00';
        document.getElementById('blackTimer').textContent = '10:00';
        document.getElementById('movesContainer').innerHTML = `
            <div class="empty-history">
                <i class="fas fa-chess-board"></i>
                <p>Ходы появятся здесь</p>
            </div>
        `;
        
        // Настраиваем имена игроков
        if (mode === 'ai') {
            this.config.playerColor = Math.random() > 0.5 ? 'white' : 'black';
            document.getElementById('whitePlayerName').textContent = 
                this.config.playerColor === 'white' ? 'Вы' : 'AI Бот';
            document.getElementById('blackPlayerName').textContent = 
                this.config.playerColor === 'black' ? 'Вы' : 'AI Бот';
            
            // Если AI ходит первым
            if (this.config.playerColor === 'black') {
                setTimeout(() => this.makeAIMove(), 1000);
            }
        } else if (mode === 'local') {
            document.getElementById('whitePlayerName').textContent = 'Игрок 1';
            document.getElementById('blackPlayerName').textContent = 'Игрок 2';
        }
        
        // Запускаем таймер
        this.startTimer();
        
        // Обновляем статус
        document.querySelector('.status-text').textContent = 'Игра началась!';
        document.querySelector('.status-indicator').style.background = 'var(--accent-green)';
        
        this.showNotification(`Игра началась! Режим: ${this.getModeName(mode)}`, 'success');
    }

    getModeName(mode) {
        const names = {
            'ai': 'Игра с AI',
            'local': 'Локальная игра',
            'online': 'Онлайн игра'
        };
        return names[mode] || mode;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            if (this.game.turn() === 'w') {
                this.state.whiteTime--;
            } else {
                this.state.blackTime--;
            }
            
            // Обновляем таймеры
            document.getElementById('whiteTimer').textContent = this.formatTime(this.state.whiteTime);
            document.getElementById('blackTimer').textContent = this.formatTime(this.state.blackTime);
            
            // Проверяем время
            if (this.state.whiteTime <= 0) {
                this.timeOut('white');
            } else if (this.state.blackTime <= 0) {
                this.timeOut('black');
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
        this.showNotification(`⏰ Время вышло! Победа ${winner}!`, 'warning');
        this.endGame(color === 'white' ? 'black' : 'white');
    }

    endGame(result) {
        this.state.isPlaying = false;
        clearInterval(this.timerInterval);
        
        let message = '';
        if (result === 'white') {
            message = '🎉 Победа белых!';
        } else if (result === 'black') {
            message = '🎉 Победа чёрных!';
        } else {
            message = '🤝 Ничья!';
        }
        
        document.querySelector('.status-text').textContent = message;
        document.querySelector('.status-indicator').style.background = 'var(--accent-yellow)';
        
        // Показываем кнопку новой игры
        setTimeout(() => {
            this.showGameModes();
        }, 2000);
    }

    showGameModes() {
        const overlay = document.getElementById('boardOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="overlay-content">
                <h3>🎮 Выберите режим игры</h3>
                <div class="mode-buttons">
                    <button class="mode-btn ai-mode" id="playAI">
                        <i class="fas fa-robot"></i>
                        <span>Играть с AI</span>
                        <small>Уровень: Сложный</small>
                    </button>
                    <button class="mode-btn local-mode" id="playLocal">
                        <i class="fas fa-users"></i>
                        <span>Локальная игра</span>
                        <small>Два игрока</small>
                    </button>
                    <button class="mode-btn online-mode" id="playOnline">
                        <i class="fas fa-globe"></i>
                        <span>Играть онлайн</span>
                        <small>С реальными игроками</small>
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем обработчики
        document.getElementById('playAI').addEventListener('click', () => this.startGame('ai'));
        document.getElementById('playLocal').addEventListener('click', () => this.startGame('local'));
        document.getElementById('playOnline').addEventListener('click', () => this.startGame('online'));
    }

    setupEventListeners() {
        // Кнопки режимов игры (уже в showGameModes)
        
        // Кнопка новой игры
        document.getElementById('newGameBtn').addEventListener('click', () => this.showGameModes());
        
        // Кнопка отмены хода
        document.getElementById('undoBtn').addEventListener('click', () => this.undoMove());
        
        // Кнопка подсказки
        document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
        
        // Кнопка ничьи
        document.getElementById('drawBtn').addEventListener('click', () => this.offerDraw());
        
        // Кнопка сдачи
        document.getElementById('resignBtn').addEventListener('click', () => this.resign());
        
        // Кнопка очистки истории
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        
        // Переключение темы
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Переключение звука
        document.getElementById('soundToggle').addEventListener('click', () => this.toggleSound());
        
        // Отправка сообщения в чат
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
    }

    undoMove() {
        if (this.state.moveHistory.length === 0 || !this.state.isPlaying) {
            this.showNotification('Нет ходов для отмены', 'info');
            return;
        }
        
        // Отменяем последний ход
        this.game.undo();
        this.state.moveHistory.pop();
        
        // Если игра с AI, отменяем два хода
        if (this.config.gameMode === 'ai' && this.state.moveHistory.length > 0) {
            this.game.undo();
            this.state.moveHistory.pop();
        }
        
        // Обновляем доску
        this.board.position(this.game.fen());
        
        // Обновляем историю
        this.updateMoveHistory();
        
        this.showNotification('Ход отменён', 'info');
    }

    updateMoveHistory() {
        const container = document.getElementById('movesContainer');
        container.innerHTML = '';
        
        this.state.moveHistory.forEach((move, index) => {
            const moveNumber = Math.floor(index / 2) + 1;
            const isWhiteMove = index % 2 === 0;
            
            if (isWhiteMove) {
                const row = document.createElement('div');
                row.className = 'move-row';
                row.innerHTML = `
                    <span class="move-number">${moveNumber}.</span>
                    <span class="move-white">${move.san}</span>
                    <span class="move-black"></span>
                `;
                container.appendChild(row);
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
        if (moves.length === 0) {
            this.showNotification('Нет возможных ходов', 'info');
            return;
        }
        
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        this.showNotification(`💡 Подсказка: ${randomMove}`, 'info');
    }

    offerDraw() {
        if (!this.state.isPlaying) return;
        
        if (confirm('Предложить ничью?')) {
            this.showNotification('🤝 Ничья предложена', 'info');
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

    clearHistory() {
        document.getElementById('movesContainer').innerHTML = `
            <div class="empty-history">
                <i class="fas fa-chess-board"></i>
                <p>Ходы появятся здесь</p>
            </div>
        `;
        this.showNotification('История очищена', 'info');
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
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
        
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageElement.innerHTML = `
            <span class="message-time">${time}</span>
            <span class="message-text"><strong>Вы:</strong> ${message}</span>
        `;
        
        messagesContainer.appendChild(messageElement);
        input.value = '';
        
        // Скроллим вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    loadConfig() {
        const theme = localStorage.getItem('chessTheme') || 'dark';
        const sound = localStorage.getItem('chessSound') !== 'false';
        
        this.config.theme = theme;
        this.config.soundEnabled = sound;
        
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelector('#themeToggle i').className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        document.querySelector('#soundToggle i').className = sound ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
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
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// Запуск приложения
window.addEventListener('DOMContentLoaded', () => {
    window.chessArena = new ChessArena();
});
