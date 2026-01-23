class ChessGame {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.user = null;
        this.currentGameId = null;
        this.playerColor = 'white';
        this.gameTime = 600; // 10 минут в секундах
        this.whiteTime = 600;
        this.blackTime = 600;
        this.timerInterval = null;
        this.moveCount = 1;
        
        this.init();
    }

    init() {
        // Инициализация доски
        this.board = Chessboard('board', {
            draggable: true,
            position: 'start',
            onDragStart: this.onDragStart.bind(this),
            onDrop: this.onDrop.bind(this),
            onSnapEnd: this.onSnapEnd.bind(this),
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });

        // Проверка авторизации
        auth.onAuthStateChanged(user => {
            if (user) {
                this.user = user;
                this.updateUI(true);
                this.loadUserData();
            } else {
                this.user = null;
                this.updateUI(false);
                $('#loginModal').modal('show');
            }
        });

        // Обработчики событий
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Кнопки авторизации
        $('#signInBtn').click(() => this.signIn());
        $('#signUpBtn').click(() => this.signUp());
        $('#logoutBtn').click(() => this.signOut());

        // Управление игрой
        $('#newGameBtn').click(() => this.createNewGame());
        $('#startGameBtn').click(() => this.startGame());
        $('#offerDrawBtn').click(() => this.offerDraw());
        $('#resignBtn').click(() => this.resignGame());

        // Чат
        $('#sendMessageBtn').click(() => this.sendMessage());
        $('#chatInput').keypress(e => {
            if (e.which === 13) this.sendMessage();
        });

        // Навигация
        $('#createGameBtn').click(() => {
            $('html, body').animate({
                scrollTop: $('.card-header.bg-success').offset().top
            }, 500);
        });

        // Модальные окна
        $('#playBtn').click(() => $('#loginModal').modal('show'));
    }

    onDragStart(source, piece) {
        // Нельзя двигать фигуры, если:
        // 1. Игра окончена
        // 2. Не твой ход
        // 3. Не твои фигуры
        if (this.game.game_over()) return false;
        
        if ((this.playerColor === 'white' && piece.search(/^b/) !== -1) ||
            (this.playerColor === 'black' && piece.search(/^w/) !== -1)) {
            return false;
        }
        
        if ((this.playerColor === 'white' && this.game.turn() === 'b') ||
            (this.playerColor === 'black' && this.game.turn() === 'w')) {
            return false;
        }
        
        return true;
    }

    onDrop(source, target) {
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q' // Всегда превращаем в ферзя для простоты
        });

        if (move === null) return 'snapback';

        // Отправляем ход в Firebase
        if (this.currentGameId) {
            database.ref(`games/${this.currentGameId}/moves`).push({
                from: source,
                to: target,
                player: this.user.uid,
                timestamp: Date.now()
            });

            // Обновляем таймер
            this.switchTimer();
        }

        // Обновляем историю ходов
        this.updateMovesList();

        // Проверка на конец игры
        if (this.game.game_over()) {
            this.handleGameEnd();
        }
    }

    onSnapEnd() {
        this.board.position(this.game.fen());
    }

    createNewGame() {
        if (!this.user) {
            $('#loginModal').modal('show');
            return;
        }

        this.gameTime = parseInt($('#gameTime').val());
        this.whiteTime = this.gameTime;
        this.blackTime = this.gameTime;
        
        const increment = parseInt($('#incrementTime').val());
        const color = $('#playerColor').val();
        this.playerColor = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;

        // Создаем новую игру в Firebase
        const gameRef = database.ref('games').push({
            creator: this.user.uid,
            creatorName: this.user.displayName || this.user.email.split('@')[0],
            whitePlayer: color === 'white' ? this.user.uid : null,
            blackPlayer: color === 'black' ? this.user.uid : null,
            timeControl: this.gameTime,
            increment: increment,
            status: 'waiting',
            createdAt: Date.now(),
            fen: 'start'
        });

        this.currentGameId = gameRef.key;
        
        // Обновляем UI
        $('#gameStatus').text('Ожидание соперника').removeClass('bg-danger bg-success').addClass('bg-warning');
        this.updatePlayerInfo();
        this.resetGame();

        // Добавляем в список активных игр
        this.addToActiveGames();
    }

    startGame() {
        if (!this.currentGameId) return;

        database.ref(`games/${this.currentGameId}`).update({
            status: 'active',
            startedAt: Date.now()
        });

        $('#gameStatus').text('Игра идет').removeClass('bg-warning').addClass('bg-success');
        this.startTimer();
    }

    resetGame() {
        this.game = new Chess();
        this.board.position('start');
        this.moveCount = 1;
        $('#movesContainer').html('<div class="text-center text-muted">Ходы появятся здесь</div>');
        $('#whiteTime').text(this.formatTime(this.whiteTime));
        $('#blackTime').text(this.formatTime(this.blackTime));
    }

    updateMovesList() {
        const moves = this.game.history();
        const container = $('#movesContainer');
        
        let html = '';
        for (let i = 0; i < moves.length; i += 2) {
            const whiteMove = moves[i];
            const blackMove = moves[i + 1] || '';
            
            html += `
                <div class="move-item">
                    <span class="move-number">${Math.floor(i/2) + 1}.</span>
                    <span class="move-white">${whiteMove}</span>
                    <span class="move-black">${blackMove}</span>
                </div>
            `;
        }
        
        container.html(html);
        container.scrollTop(container[0].scrollHeight);
    }

    updatePlayerInfo() {
        const whitePlayer = $('#whitePlayer .player-name');
        const blackPlayer = $('#blackPlayer .player-name');

        if (this.playerColor === 'white') {
            whitePlayer.text(`Вы (${this.user.displayName || this.user.email.split('@')[0]})`);
            blackPlayer.text('Ожидание соперника...');
        } else {
            whitePlayer.text('Ожидание соперника...');
            blackPlayer.text(`Вы (${this.user.displayName || this.user.email.split('@')[0]})`);
        }
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            if (this.game.turn() === 'w') {
                this.whiteTime--;
                if (this.whiteTime <= 0) {
                    this.handleTimeOut('white');
                }
            } else {
                this.blackTime--;
                if (this.blackTime <= 0) {
                    this.handleTimeOut('black');
                }
            }

            $('#whiteTime').text(this.formatTime(this.whiteTime));
            $('#blackTime').text(this.formatTime(this.blackTime));
        }, 1000);
    }

    switchTimer() {
        // При переключении хода добавляем инкремент
        const increment = parseInt($('#incrementTime').val()) || 0;
        
        if (this.game.turn() === 'w') {
            this.whiteTime += increment;
        } else {
            this.blackTime += increment;
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    handleTimeOut(color) {
        clearInterval(this.timerInterval);
        const winner = color === 'white' ? 'Чёрные' : 'Белые';
        this.showNotification(`Время вышло! Победа ${winner}`, 'warning');
        this.endGame(winner === 'Белые' ? 'white' : 'black');
    }

    handleGameEnd() {
        clearInterval(this.timerInterval);
        
        if (this.game.in_checkmate()) {
            const winner = this.game.turn() === 'w' ? 'Чёрные' : 'Белые';
            this.showNotification(`Мат! Победа ${winner}`, 'success');
            this.endGame(winner === 'Белые' ? 'white' : 'black');
        } else if (this.game.in_draw()) {
            this.showNotification('Ничья!', 'info');
            this.endGame('draw');
        }
    }

    endGame(winner) {
        $('#gameStatus').text('Игра завершена').removeClass('bg-success').addClass('bg-danger');
        
        if (this.currentGameId) {
            database.ref(`games/${this.currentGameId}`).update({
                status: 'finished',
                winner: winner,
                finishedAt: Date.now()
            });
        }
    }

    offerDraw() {
        if (this.currentGameId) {
            this.showNotification('Ничья предложена', 'info');
            // Здесь можно добавить логику подтверждения ничьи
        }
    }

    resignGame() {
        if (confirm('Вы уверены, что хотите сдаться?')) {
            const winner = this.playerColor === 'white' ? 'Чёрные' : 'Белые';
            this.showNotification(`Вы сдались. Победа ${winner}`, 'danger');
            this.endGame(winner === 'Белые' ? 'white' : 'black');
        }
    }

    sendMessage() {
        const input = $('#chatInput');
        const message = input.val().trim();
        
        if (!message || !this.currentGameId) return;
        
        database.ref(`games/${this.currentGameId}/messages`).push({
            text: message,
            sender: this.user.uid,
            senderName: this.user.displayName || this.user.email.split('@')[0],
            timestamp: Date.now()
        });
        
        input.val('');
    }

    addToActiveGames() {
        const gamesList = $('#activeGames');
        const gameItem = `
            <div class="list-group-item game-item">
                <div>
                    <div class="game-opponent">Игра #${this.currentGameId.substring(0, 8)}</div>
                    <small class="text-muted">Ожидание соперника</small>
                </div>
                <button class="btn btn-sm btn-outline-primary join-btn" data-game="${this.currentGameId}">
                    Присоединиться
                </button>
            </div>
        `;
        
        gamesList.prepend(gameItem);
        
        // Обработчик для кнопки присоединения
        $(`.join-btn[data-game="${this.currentGameId}"]`).click((e) => {
            const gameId = $(e.target).data('game');
            this.joinGame(gameId);
        });
    }

    joinGame(gameId) {
        // Реализация присоединения к игре
        this.showNotification('Функция присоединения в разработке', 'info');
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const alert = $(`
            <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        $('body').append(alert);
        
        // Автоматически скрываем через 5 секунд
        setTimeout(() => alert.alert('close'), 5000);
    }

    updateUI(isLoggedIn) {
        if (isLoggedIn) {
            $('.navbar-brand').append(` <small class="text-muted">(${this.user.email.split('@')[0]})</small>`);
            $('#loginModal').modal('hide');
        } else {
            $('.navbar-brand').text('ChessHub');
            $('#loginModal').modal('show');
        }
    }

    async signIn() {
        const email = $('#loginEmail').val();
        const password = $('#loginPassword').val();
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.showNotification('Вход выполнен успешно!', 'success');
        } catch (error) {
            this.showNotification(`Ошибка входа: ${error.message}`, 'danger');
        }
    }

    async signUp() {
        const email = $('#loginEmail').val();
        const password = $('#loginPassword').val();
        
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            this.showNotification('Регистрация успешна!', 'success');
        } catch (error) {
            this.showNotification(`Ошибка регистрации: ${error.message}`, 'danger');
        }
    }

    async signOut() {
        try {
            await auth.signOut();
            this.showNotification('Вы вышли из системы', 'info');
        } catch (error) {
            this.showNotification(`Ошибка выхода: ${error.message}`, 'danger');
        }
    }

    loadUserData() {
        if (!this.user) return;
        
        // Загружаем статистику пользователя
        database.ref(`users/${this.user.uid}`).once('value').then(snapshot => {
            const data = snapshot.val();
            if (!data) {
                // Создаем запись для нового пользователя
                database.ref(`users/${this.user.uid}`).set({
                    email: this.user.email,
                    gamesPlayed: 0,
                    gamesWon: 0,
                    rating: 1500,
                    createdAt: Date.now()
                });
            }
        });
    }
}

// Инициализация приложения
$(document).ready(() => {
    window.chessApp = new ChessGame();
});
