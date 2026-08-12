import { Hono } from "hono";
export { Room } from "./room";

type Env = {
    Bindings: {
        ROOM: DurableObjectNamespace;
    };
};

const app = new Hono<Env>();

// ルーム作成
app.post("/api/rooms", (c) => {
    const roomId = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

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