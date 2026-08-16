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
};

export class Room {
    private clients: {
        socket: WebSocket;
        player: Player;
    }[] = [];

    private turn: Player = "sente";

    private selectedPlayer: Player | null = null;

    async fetch(request: Request): Promise<Response> {
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


        server.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "player-choice") {
                // ===== 1人目の選択を保存 =====
                this.selectedPlayer = message.player;

                console.log(
                    "先後保存:",
                    this.selectedPlayer
                );

                // ===== 2人目がまだいない場合はここで終了 =====
                if (this.clients.length < 2) {
                    return;
                }

                // ===== 2人目は反対の手番 =====
                const opponentPlayer: Player =
                    this.selectedPlayer === "sente"
                        ? "gote"
                        : "sente";

                console.log(
                    "相手の手番:",
                    opponentPlayer
                );

                // ===== Room内部の先後を更新 =====
                this.clients[0].player = this.selectedPlayer!;
                this.clients[1].player = opponentPlayer;

                console.log(
                    "Room内の先後:",
                    this.clients.map((client) => client.player)
                );

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

            // ===== 既存のMove処理 =====
            const move = message as Move;

            const client = this.clients.find(
                (client) => client.socket === server
            );

            if (!client) return;

            if (move.player !== client.player) return;

            if (move.player !== this.turn) return;

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
        });

        server.addEventListener("close", () => {
            this.clients = this.clients.filter(
                (client) => client.socket !== server
            );
        });

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }
}