import { Hono } from "hono";
export { Room } from "./room";
import { cors } from "hono/cors";

type Env = {
    Bindings: {
        ROOM: DurableObjectNamespace;
    };
};

const app = new Hono<Env>();

app.use(
    "*",
    cors({
        origin: [
            "http://localhost:3000",
            "https://frontend.asahi-dev.workers.dev",
        ],
    })
);

// ルーム作成
app.post("/api/rooms", (c) => {
    const roomId = Math.floor(
        100000 + Math.random() * 900000
    ).toString();

    return c.json({ roomId });
});

// WebSocket接続
app.get("/api/rooms/:roomId/ws", async (c) => {
    const roomId = c.req.param("roomId");

    const id = c.env.ROOM.idFromName(roomId);
    const room = c.env.ROOM.get(id);

    return room.fetch(c.req.raw);
});

export default app;