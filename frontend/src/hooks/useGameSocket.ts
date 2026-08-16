import { useEffect, useRef } from "react";

import type {
    Board,
    CapturedPieceType,
    Hands,
    Move,
    PieceType,
    Player,
} from "@/types/shogi";

type ApplyMove = (
    board: Board,
    hands: Hands,
    move: Move
) => {
    board: Board;
    hands: Hands;
};

type UseGameSocketProps = {
    roomId: string;

    currentBoard: Board;
    hands: Hands;
    myPlayer: Player | null;

    setCurrentBoard: React.Dispatch<React.SetStateAction<Board>>;
    setHands: React.Dispatch<React.SetStateAction<Hands>>;
    setMyPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
    setTurn: React.Dispatch<React.SetStateAction<Player>>;
    setIsFirstPlayer: React.Dispatch<React.SetStateAction<boolean>>;

    applyMove: ApplyMove;
};

export function useGameSocket({
    roomId,
    currentBoard,
    hands,
    myPlayer,
    setCurrentBoard,
    setHands,
    setMyPlayer,
    setTurn,
    setIsFirstPlayer,
    applyMove,
}: UseGameSocketProps) {
    // ===== WebSocket =====
    const socketRef = useRef<WebSocket | null>(null);

    // ===== 最新の盤面・持ち駒を保持 =====
    const boardRef = useRef<Board>(currentBoard);
    const handsRef = useRef<Hands>(hands);

    useEffect(() => {
        boardRef.current = currentBoard;
    }, [currentBoard]);

    useEffect(() => {
        handsRef.current = hands;
    }, [hands]);

    // ===== WebSocket接続・受信処理 =====
    useEffect(() => {
        const socket = new WebSocket(
            `ws://127.0.0.1:8787/api/rooms/${roomId}/ws`
        );

        socketRef.current = socket;

        socket.onopen = () => {
            console.log("接続成功");
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // ===== 1人目かどうか =====
            if (message.type === "player-position") {
                setIsFirstPlayer(message.isFirstPlayer);
                return;
            }

            // ===== プレイヤー割り当て =====
            if (message.type === "player-assigned") {
                setMyPlayer(message.player);
                return;
            }

            // ===== Move受信 =====
            if (message.type === "move") {
                console.log(
                    "Move受信前のhands:",
                    handsRef.current
                );

                const result = applyMove(
                    boardRef.current,
                    handsRef.current,
                    message.move
                );

                console.log(
                    "Move適用後のhands:",
                    result.hands
                );

                setCurrentBoard(result.board);
                setHands(result.hands);
                setTurn(message.turn);
            }
        };

        return () => {
            socket.close();
            socketRef.current = null;
        };
    }, [
        roomId,
        applyMove,
        setCurrentBoard,
        setHands,
        setMyPlayer,
        setTurn,
        setIsFirstPlayer,
    ]);

    // ===== 先後を選択 =====
    const selectPlayer = (player: Player) => {
        setMyPlayer(player);

        const message = {
            type: "player-choice",
            player,
        };

        console.log("先後選択:", message);

        socketRef.current?.send(
            JSON.stringify(message)
        );
    };

    // ===== Moveをサーバーへ送信 =====
    const sendMove = (
        from: { row: number; col: number } | null,
        to: { row: number; col: number },
        promote: boolean,
        piece?: PieceType,
        capturedPieceType?: CapturedPieceType
    ) => {
        if (!myPlayer) return;

        const move: Move = {
            type: "move",
            player: myPlayer,
            from,
            to,
            promote,
            piece,
            capturedPieceType,
        };

        // ===== 自分の盤面にもMoveを反映 =====
        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        setCurrentBoard(result.board);
        setHands(result.hands);

        // ===== サーバーへ送信 =====
        socketRef.current?.send(
            JSON.stringify(move)
        );
    };

    return {
        selectPlayer,
        sendMove,
    };
}