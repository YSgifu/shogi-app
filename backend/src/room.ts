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

        this.clients.push({
            socket: server,
            player,
        });

        server.send(
            JSON.stringify({
                type: "player-assigned",
                player,
            })
        );

        server.addEventListener("message", (event) => {
            const move: Move = JSON.parse(event.data);

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

            const message = JSON.stringify({
                type: "move",
                move,
                turn: this.turn,
            });

            for (const client of this.clients) {
                if (client.socket.readyState === WebSocket.OPEN) {
                    client.socket.send(message);
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