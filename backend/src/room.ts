type Player = "sente" | "gote";
type Move = {
    type: "move";
    player: Player;
    from: {
        row: number;
        col: number;
    } | null;
    to: {
        row: number;
        col: number;
    };
    promote: boolean;
    piece?: string;
    capturedPieceType?: string;
};

export class Room {
    private players: Record<Player, WebSocket | null> = {
        sente: null,
        gote: null,
    };

    private playerChooser: Player | null = null;

    private turn: Player = "sente";

    private selectedPlayer: Player | null = null;

    private moves: Move[] = [];

    private undoRequester: Player | null = null;

    async fetch(request: Request): Promise<Response> {

        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("WebSocket connection required", {
                status: 426,
            });
        }

        if (
            this.players.sente !== null &&
            this.players.gote !== null
        ) {
            return new Response("Room is full", {
                status: 403,
            });
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        const player: Player =
            this.players.sente === null
                ? "sente"
                : "gote";

        server.accept();

        this.players[player] = server;

        const isFirstPlayer =
            this.playerChooser === null;

        if (this.playerChooser === null) {
            this.playerChooser = player;
        }

        server.send(
            JSON.stringify({
                type: "player-position",
                isFirstPlayer,
            })
        );

        if (this.selectedPlayer !== null) {
            server.send(
                JSON.stringify({
                    type: "player-assigned",
                    player,
                })
            );

            // ===== 現在の対局状態を再接続者へ送信 =====
            server.send(
                JSON.stringify({
                    type: "game-state",
                    moves: this.moves,
                    turn: this.turn,
                })
            );
        }

        // ===== 相手へ復帰を通知 =====
        const opponent: Player =
            player === "sente"
                ? "gote"
                : "sente";

        const opponentSocket = this.players[opponent];

        if (opponentSocket?.readyState === WebSocket.OPEN) {
            opponentSocket.send(
                JSON.stringify({
                    type: "opponent-reconnected",
                })
            );
        }

        if (
            this.players.sente !== null &&
            this.players.gote !== null
        ) {
            for (const socket of Object.values(this.players)) {
                socket?.send(
                    JSON.stringify({
                        type: "opponent-joined",
                    })
                );
            }
        }


        server.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "player-choice") {
                // ===== 手番選択権を持つプレイヤーか確認 =====
                if (this.playerChooser === null) {
                    return;
                }

                if (this.players[this.playerChooser] !== server) {
                    return;
                }

                // ===== 選択した手番を保存 =====
                const selectedPlayer = message.player as Player;
                this.selectedPlayer = selectedPlayer;

                // ===== 2人揃っていなければ選択できない =====
                if (
                    this.players.sente === null ||
                    this.players.gote === null
                ) {
                    return;
                }

                // ===== 手番選択したプレイヤー =====
                const chooserPlayer = this.playerChooser;

                // ===== 相手の現在のプレイヤー =====
                const opponentPlayer: Player =
                    chooserPlayer === "sente"
                        ? "gote"
                        : "sente";

                // ===== 現在のSocketを取得 =====
                const chooserSocket = this.players[chooserPlayer];
                const opponentSocket = this.players[opponentPlayer];

                if (!chooserSocket || !opponentSocket) {
                    return;
                }

                // ===== 手番を入れ替える場合 =====
                if (chooserPlayer !== this.selectedPlayer) {
                    this.players[chooserPlayer] = opponentSocket;
                    this.players[opponentPlayer] = chooserSocket;
                }

                // ===== 先後を両者へ通知 =====
                chooserSocket.send(
                    JSON.stringify({
                        type: "player-assigned",
                        player: selectedPlayer,
                    })
                );

                opponentSocket.send(
                    JSON.stringify({
                        type: "player-assigned",
                        player:
                            selectedPlayer === "sente"
                                ? "gote"
                                : "sente",
                    })
                );

                // ===== 手番選択権を解除 =====
                this.playerChooser = null;

                return;
            }

            // ===== 待った要求 =====
            if (message.type === "undo-request") {
                if (this.undoRequester !== null) {
                    return;
                }

                // ===== このSocketのプレイヤーを特定 =====
                const player = (
                    Object.entries(this.players) as [Player, WebSocket | null][]
                ).find(
                    ([, socket]) => socket === server
                )?.[0];

                if (!player) return;

                // ===== まだ一手も指されていない =====
                if (this.moves.length === 0) {
                    server.send(
                        JSON.stringify({
                            type: "undo-error",
                            reason: "まだ対局が始まっていません",
                        })
                    );

                    return;
                }

                // ===== 自分の手番中 =====
                if (
                    this.moves[this.moves.length - 1].player !== player
                ) {
                    server.send(
                        JSON.stringify({
                            type: "undo-error",
                            reason: "自分の手番中には待ったを要求できません",
                        })
                    );

                    return;
                }

                // ===== 待った要求を保存 =====
                this.undoRequester = player;

                // ===== 相手を特定 =====
                const opponent: Player =
                    player === "sente"
                        ? "gote"
                        : "sente";

                const opponentSocket =
                    this.players[opponent];

                // ===== 相手へ通知 =====
                if (opponentSocket?.readyState === WebSocket.OPEN) {
                    opponentSocket.send(
                        JSON.stringify({
                            type: "undo-request",
                            player,
                        })
                    );
                }

                return;
            }

            // ===== 待ったの承認・拒否 =====
            if (message.type === "undo-response") {
                const requesterPlayer = message.player as Player;
                const requesterSocket =
                    this.players[requesterPlayer];

                if (!requesterSocket) return;

                // ===== 拒否 =====
                if (!message.accepted) {
                    requesterSocket.send(
                        JSON.stringify({
                            type: "undo-response",
                            accepted: false,
                        })
                    );

                    this.undoRequester = null;

                    return;
                }

                // ===== 承認 =====
                if (this.moves.length === 0) return;

                // 最後のMoveを削除
                const undoneMove = this.moves.pop();

                // ターンを元に戻す
                if (undoneMove) {
                    this.turn = undoneMove.player;
                }

                // 待った要求を解除
                this.undoRequester = null;

                // 両者へ通知
                for (const socket of Object.values(this.players)) {
                    if (socket?.readyState === WebSocket.OPEN) {
                        socket.send(
                            JSON.stringify({
                                type: "undo",
                                accepted: true,
                                moves: this.moves,
                                turn: this.turn,
                            })
                        );
                    }
                }

                return;
            }

            // ===== 投了処理 =====
            if (message.type === "resign") {
                const player = (
                    Object.entries(this.players) as [Player, WebSocket | null][]
                ).find(
                    ([, socket]) => socket === server
                )?.[0];

                if (!player) return;

                const opponent: Player =
                    player === "sente"
                        ? "gote"
                        : "sente";

                const opponentSocket =
                    this.players[opponent];

                if (opponentSocket?.readyState === WebSocket.OPEN) {
                    opponentSocket.send(
                        JSON.stringify({
                            type: "resign",
                            player,
                        })
                    );
                }

                return;
            }

            // ===== 棋譜再生要求 =====
            if (message.type === "replay-request") {
                server.send(
                    JSON.stringify({
                        type: "replay",
                        moves: this.moves,
                    })
                );

                return;
            }

            // ===== 既存のMove処理 =====
            const move = message as Move;

            const player = (
                Object.entries(this.players) as [Player, WebSocket | null][]
            ).find(
                ([, socket]) => socket === server
            )?.[0];

            if (!player) return;

            // ===== 自分のPlayerと一致しているか確認 =====
            if (move.player !== player) return;

            // ===== 現在の手番と一致しているか確認 =====
            if (move.player !== this.turn) return;

            // ===== Moveを保存 =====
            this.moves.push(move);

            // ===== ターンを変更 =====
            this.turn =
                this.turn === "sente"
                    ? "gote"
                    : "sente";

            const moveMessage = JSON.stringify({
                type: "move",
                move,
                turn: this.turn,
            });

            // ===== 相手へMoveを通知 =====
            const opponent: Player =
                player === "sente"
                    ? "gote"
                    : "sente";

            const opponentSocket =
                this.players[opponent];

            if (opponentSocket?.readyState === WebSocket.OPEN) {
                opponentSocket.send(moveMessage);
            }

            // ===== 自分にはターン変更だけ通知 =====
            server.send(
                JSON.stringify({
                    type: "turn-update",
                    turn: this.turn,
                })
            );
        });

        server.addEventListener("close", () => {
            // ===== 切断したプレイヤーを特定 =====
            const player = (
                Object.entries(this.players) as [Player, WebSocket | null][]
            ).find(
                ([, socket]) => socket === server
            )?.[0];

            if (!player) return;

            // ===== 現在登録されているSocketか確認 =====
            if (this.players[player] !== server) {
                return;
            }

            // ===== プレイヤーのSocketを解放 =====
            this.players[player] = null;

            // ===== 手番選択権を持っていた場合、相手へ移す =====
            if (this.playerChooser === player) {
                const opponent: Player =
                    player === "sente"
                        ? "gote"
                        : "sente";

                this.playerChooser =
                    this.players[opponent] !== null
                        ? opponent
                        : null;

                if (this.players[opponent]) {
                    this.players[opponent]?.send(
                        JSON.stringify({
                            type: "player-choice-available",
                        })
                    );
                }
            }

            // ===== 相手が残っている場合は切断を通知 =====
            const opponent: Player =
                player === "sente"
                    ? "gote"
                    : "sente";

            const opponentSocket = this.players[opponent];

            if (opponentSocket?.readyState === WebSocket.OPEN) {
                opponentSocket.send(
                    JSON.stringify({
                        type: "opponent-disconnected",
                    })
                );
            }

            // ===== 両者とも退出したらRoomをリセット =====
            if (
                this.players.sente === null &&
                this.players.gote === null
            ) {
                this.playerChooser = null;
                this.selectedPlayer = null;
                this.turn = "sente";
                this.moves = [];
                this.undoRequester = null;
            }
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
}