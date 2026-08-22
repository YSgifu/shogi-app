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
    private clients: {
        socket: WebSocket;
        player: Player;
    }[] = [];

    private turn: Player = "sente";

    private selectedPlayer: Player | null = null;

    private moves: Move[] = [];

    private undoRequester: Player | null = null;

    async fetch(request: Request): Promise<Response> {

        // ===== 切断済みのクライアントを削除 =====
        this.clients = this.clients.filter(
            (client) => client.socket.readyState === WebSocket.OPEN
        );

        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("WebSocket connection required", {
                status: 426,
            });
        }

        if (this.clients.length >= 2) {
            return new Response("Room is full", {
                status: 403,
            });
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        const player: Player =
            this.clients.length === 0
                ? "sente"
                : "gote";

        server.accept();

        const isFirstPlayer = this.clients.length === 0;

        this.clients.push({
            socket: server,
            player,
        });


        server.send(
            JSON.stringify({
                type: "player-position",
                isFirstPlayer,
            })
        );

        if (this.clients.length === 2) {

            for (const client of this.clients) {
                console.log("送信対象:", client.player);

                client.socket.send(
                    JSON.stringify({
                        type: "opponent-joined",
                    })
                );
            }
        }


        server.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "player-choice") {
                // ===== 1人目の選択を保存 =====
                this.selectedPlayer = message.player;


                // ===== 2人目がまだいない場合はここで終了 =====
                if (this.clients.length < 2) {
                    return;
                }

                // ===== 2人目は反対の手番 =====
                const opponentPlayer: Player =
                    this.selectedPlayer === "sente"
                        ? "gote"
                        : "sente";

                // ===== Room内部の先後を更新 =====
                this.clients[0].player = this.selectedPlayer!;
                this.clients[1].player = opponentPlayer;

                // ===== 先後を両者へ通知 =====
                const firstClient = this.clients[0];
                const secondClient = this.clients[1];

                firstClient.socket.send(
                    JSON.stringify({
                        type: "player-assigned",
                        player: this.selectedPlayer,
                    })
                );

                secondClient.socket.send(
                    JSON.stringify({
                        type: "player-assigned",
                        player: opponentPlayer,
                    })
                );

                return;
            }

            if (message.type === "undo-request") {
                if (this.undoRequester !== null) {
                    return;
                }
                const client = this.clients.find(
                    (client) => client.socket === server
                );

                if (!client) return;

                // ===== すでに待った要求中 =====
                if (this.undoRequester !== null) {
                    server.send(
                        JSON.stringify({
                            type: "undo-error",
                            reason: "すでに待ったを要求しています",
                        })
                    );

                    return;
                }

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
                    this.moves[this.moves.length - 1].player !== client.player
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
                this.undoRequester = client.player;

                // ===== 相手へ通知 =====
                for (const opponent of this.clients) {
                    if (
                        opponent.socket !== server &&
                        opponent.socket.readyState === WebSocket.OPEN
                    ) {
                        opponent.socket.send(
                            JSON.stringify({
                                type: "undo-request",
                                player: client.player,
                            })
                        );
                    }
                }

                return;
            }

            // ===== 待ったの承認・拒否 =====
            if (message.type === "undo-response") {
                const requester = this.clients.find(
                    (client) => client.player === message.player
                );

                if (!requester) return;

                // ===== 拒否 =====
                if (!message.accepted) {
                    requester.socket.send(
                        JSON.stringify({
                            type: "undo-response",
                            accepted: false,
                        })
                    );

                    // 待った要求を解除
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
                for (const client of this.clients) {
                    if (client.socket.readyState === WebSocket.OPEN) {
                        client.socket.send(
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
                const client = this.clients.find(
                    (client) => client.socket === server
                );

                if (!client) return;

                for (const opponent of this.clients) {
                    if (
                        opponent.socket !== server &&
                        opponent.socket.readyState === WebSocket.OPEN
                    ) {
                        opponent.socket.send(
                            JSON.stringify({
                                type: "resign",
                                player: client.player,
                            })
                        );
                    }
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

            const client = this.clients.find(
                (client) => client.socket === server
            );

            if (!client) return;

            if (move.player !== client.player) return;
            if (move.player !== this.turn) return;

            this.moves.push(move);

            this.turn =
                this.turn === "sente"
                    ? "gote"
                    : "sente";

            const moveMessage = JSON.stringify({
                type: "move",
                move,
                turn: this.turn,
            });

            for (const client of this.clients) {
                if (
                    client.socket !== server &&
                    client.socket.readyState === WebSocket.OPEN
                ) {
                    client.socket.send(moveMessage);
                }
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
            this.clients = this.clients.filter(
                (client) => client.socket !== server
            );

            // 残っている相手に切断を通知
            for (const client of this.clients) {
                if (client.socket.readyState === WebSocket.OPEN) {
                    client.socket.send(
                        JSON.stringify({
                            type: "opponent-disconnected",
                        })
                    );
                }
            }
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
}