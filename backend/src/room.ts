export class Room {
    private clients: {
        socket: WebSocket;
        player: "sente" | "gote";
    }[] = [];

    constructor(
        private state: DurableObjectState,
        private env: unknown
    ) {}

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("WebSocket connection required", {
                status: 426,
            });
        }

        const pair = new WebSocketPair();

        const client = pair[0];
        const server = pair[1];

        // プレイヤーを決める
        let player: "sente" | "gote";

        if (this.clients.length === 0) {
            player = "sente";
        } else if (this.clients.length === 1) {
            player = "gote";
        } else {
            server.close(1008, "Room is full");

            return new Response("Room is full", {
                status: 403,
            });
        }

        server.accept();

        this.clients.push({
            socket: server,
            player,
        });

        // 自分が先手か後手かを通知
        server.send(
            JSON.stringify({
                type: "player-assigned",
                player,
            })
        );

        server.addEventListener("message", (event) => {
            console.log("received:", event.data);

            for (const client of this.clients) {
                if (client.socket.readyState === WebSocket.OPEN) {
                    client.socket.send(event.data);
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