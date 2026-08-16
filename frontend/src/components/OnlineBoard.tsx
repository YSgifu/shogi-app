"use client";

import { useEffect, useRef, useState } from "react";
import type { Board, Hands, Player, CapturedPieceType, PieceType } from "@/types/shogi";
import { pieceNames, promotedPieceNames, createPiece } from "@/lib/piece";
import { getMovableSquares, canPromote, canDropPiece, getAttackSquares } from "@/lib/moves";
import { isInCheck, isLegalMove, isCheckmate } from "@/lib/check";

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
    piece?: PieceType;
    capturedPieceType?: CapturedPieceType;
};

export default function OnlineBoard({
    board,
    roomId,
}: {
    board: Board;
    roomId: string;
}) {
    const socketRef = useRef<WebSocket | null>(null);


    // ==================================================================================================


    // 現在の盤面
    const [currentBoard, setCurrentBoard] = useState(board);
    // このブラウザのプレイヤーの手番
    const [myPlayer, setMyPlayer] = useState<Player | null>(null);
    // 対戦相手の手番
    const opponent =
        myPlayer === null
            ? null
            : myPlayer === "sente"
                ? "gote"
                : "sente";
    // 現在のターン
    const [turn, setTurn] = useState<Player>("sente");
    // 持ち駒管理用
    const [hands, setHands] = useState<Hands>({
        sente: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
        gote: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
    });
    // 駒移動選択中のマスの情報？
    const [selectedSquare, setSelectedSquare] = useState<{row: number; col: number;} | null>(null);
    // 移動可能範囲を表示しているマス
    const [movableSquares, setMovableSquares] = useState<
        { row: number; col: number }[]
    >([]);
    // 仮移動後の盤面
    const [previewBoard, setPreviewBoard] = useState<Board | null>(null);
    // 仮移動後のプレイヤーに見せる盤面
    const displayBoard =
        myPlayer === "gote"
            ? [...(previewBoard ?? currentBoard)]
                .reverse()
                .map((row) => [...row].reverse())
            : previewBoard ?? currentBoard;
    // 仮移動モード中の持ち駒
    const [previewHands, setPreviewHands] =
        useState<Hands | null>(null);
    // 仮移動後のプレイヤーに見せる持ち駒
    const displayHands = previewHands ?? hands;
    // 仮移動の時のmoveを保存する用
    const [previewMove, setPreviewMove] = useState<Move | null>(null);
    // 仮移動後に成れるかを保存する用
    const [canPromotePreview, setCanPromotePreview] = useState(false);
    // メッセージ表示用
    const [message, setMessage] = useState<string | null>(null);
    // 選択した持ち駒用
    const [selectedHandPiece, setSelectedHandPiece] =
        useState<{
            type: CapturedPieceType;
            player: Player;
        } | null>(null);
    // 勝者用
    const [winner, setWinner] = useState<Player | null>(null);
    // 自分のターンか否か
    const isMyTurn = myPlayer !== null && myPlayer === turn;
    // 仮の「自分が1人目か」を追加
    const [isFirstPlayer, setIsFirstPlayer] = useState(false);
    const [isAttackMode, setIsAttackMode] = useState(false);
    const [attackPieces, setAttackPieces] = useState<number[]>([]);
    

    const boardRef = useRef<Board>(currentBoard);
    const handsRef = useRef<Hands>(hands);

    const dropSquares =
        selectedHandPiece
            ? currentBoard.flatMap((row, rowIndex) =>
                row
                    .map((piece, colIndex) => ({
                        row: rowIndex,
                        col: colIndex,
                    }))
                    .filter(({ row, col }) =>
                        canDropPiece(
                            currentBoard,
                            selectedHandPiece.type,
                            selectedHandPiece.player,
                            row,
                            col
                        )
                    )
            )
            : [];

    
    // 効き表示 
    const attackBoard = previewBoard ?? currentBoard;

    const attackSquares = attackPieces.flatMap((pieceId) => {
        const position = attackBoard
            .flatMap((row, rowIndex) =>
                row.map((piece, colIndex) => ({
                    piece,
                    row: rowIndex,
                    col: colIndex,
                }))
            )
            .find(({ piece }) => piece?.id === pieceId);

        if (!position) return [];

        return getAttackSquares(
            attackBoard,
            position.row,
            position.col
        );
    });


    // ==================================================================================================

    const applyMove = (board: Board, hands: Hands, move: Move): {
        board: Board;
        hands: Hands;
    } => {
        const nextBoard = board.map((row) =>
            row.map((piece) =>
                piece ? { ...piece } : null
            )
        );

        const nextHands: Hands = {
            sente: { ...hands.sente },
            gote: { ...hands.gote },
        };

        if (move.from) {
            const piece = nextBoard[move.from.row][move.from.col];

            nextBoard[move.from.row][move.from.col] = null;

            if (piece) {
                    // ===== 駒を取った場合 =====
                    if (
                        move.capturedPieceType 
                    ) {
                        nextHands[move.player][move.capturedPieceType] += 1;
                    }


                if (move.promote) {
                    piece.promoted = true;
                }

                nextBoard[move.to.row][move.to.col] = piece;
            }
        }

        // ===== 持ち駒を打つ =====
        if (move.piece) {
            nextBoard[move.to.row][move.to.col] = createPiece(move.piece, move.player);

            nextHands[move.player][
                move.piece as CapturedPieceType
            ] -= 1;
        }

        return {
            board: nextBoard,
            hands: nextHands,
        };
    };

    useEffect(() => {
        boardRef.current = currentBoard;
    }, [currentBoard]);

    useEffect(() => {
        handsRef.current = hands;
    }, [hands]);

    useEffect(() => {
        console.log("hands state更新:", hands);
    }, [hands]);

    // ==================================================================================================

    // ===== WebSocket接続・サーバーからのMove受信処理、自分の盤面に反映 =====
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

            if (message.type === "player-position") {
                setIsFirstPlayer(message.isFirstPlayer);
                return;
            }

            if (message.type === "player-assigned") {
                setMyPlayer(message.player);
                return;
            }

            if (message.type === "move") {
                console.log("Move受信前のhands:", handsRef.current);
                const result = applyMove(
                    boardRef.current,
                    handsRef.current,
                    message.move
                );

                console.log("Move適用後のhands:", result.hands);

                setCurrentBoard(result.board);
                setHands(result.hands);

                setTurn(message.turn);
            }
        };

        return () => socket.close();
    }, [roomId]);

    // ===== 先後を選択する処理 =====
    const selectPlayer = (player: Player) => {
        setMyPlayer(player);

        const message = {
            type: "player-choice",
            player,
        };

        console.log("先後選択:", message);

        socketRef.current?.send(JSON.stringify(message));
    };


    // ===== Moveをサーバーへ送信し、自分の盤面にも反映する処理 =====
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

        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        setCurrentBoard(result.board);
        setHands(result.hands);

        socketRef.current?.send(JSON.stringify(move));

        // ===== 仮移動状態を解除して通常モードへ戻る =====
        setPreviewBoard(null);
        setPreviewMove(null);
        setPreviewHands(null);
        setSelectedSquare(null);
        setMovableSquares([]);
    };

    // ==================================================================================================

    // 盤上の駒を選択する共通処理
    function selectSquare(rowIndex: number, colIndex: number) {
        setSelectedSquare({
            row: rowIndex,
            col: colIndex,
        });

        setMovableSquares(
            getMovableSquares(
                currentBoard,
                rowIndex,
                colIndex
            )
        );
    }

    // 盤上の駒の選択を解除する共通処理
    function clearSquareSelection() {
        setSelectedSquare(null);
        setMovableSquares([]);
    }
    
    // 通常状態のクリック時処理
    function handleNormalClick(rowIndex: number, colIndex: number) {
        const piece = currentBoard[rowIndex][colIndex];

        if (!piece) return;
        if (myPlayer !== turn) return;
        if (piece.player !== myPlayer) return;

        selectSquare(rowIndex, colIndex);
    }

    // 選択状態のクリック時処理
    function handleSelectedClick(rowIndex: number, colIndex: number) {
        // ===== クリックしたマスの駒を取得 =====
        const piece = currentBoard[rowIndex][colIndex];

        // ===== 自分の別の駒をクリックした場合、選択を切り替える =====
        if (piece && piece.player === myPlayer) {
            // 現在選択している駒をもう一度クリックした場合
            if (
                selectedSquare?.row === rowIndex &&
                selectedSquare?.col === colIndex
            ) {
                clearSquareSelection();
                return;
            }

            selectSquare(rowIndex, colIndex);

            return;
        }

        // 移動可能マス
        const isMovable = movableSquares.some(
            (square) =>
                square.row === rowIndex &&
                square.col === colIndex
        );

        // これを通過できるなら移動可能マスをクリックしたということ
        // 仮移動モードへ移行
        if (!isMovable) return;

        previewMode(rowIndex, colIndex);
    }

    // ===== 仮移動モード =====
    function previewMode(rowIndex: number, colIndex: number) {
        // ===================仮移動モードへの移行準備===================
        if (!selectedSquare) return;

        // ===== 移動元の駒を取得 =====
        const movingPiece =
            currentBoard[selectedSquare.row][selectedSquare.col];

        if (!movingPiece) return;

        // ===== 実際にその手が合法か判定 =====
        const isLegal = isLegalMove(
            currentBoard,
            selectedSquare.row,
            selectedSquare.col,
            rowIndex,
            colIndex
        );

        if (!isLegal) {
            setMessage("その手は指せません");
            return;
        }

        // ===== 成れるか判定 =====
        const canPromoteMove = canPromote(
            movingPiece,
            selectedSquare.row,
            rowIndex
        );

        setCanPromotePreview(canPromoteMove);

        // ===== 移動先の駒を取得 =====
        const capturedPiece =
            currentBoard[rowIndex][colIndex];

        const capturedPieceType =
            capturedPiece?.type === "OU"
                ? undefined
                : capturedPiece?.type;

        // ===== 仮移動するMoveを作成 =====
        const move: Move = {
            type: "move",
            player: movingPiece.player,
            from: selectedSquare,
            to: {
                row: rowIndex,
                col: colIndex,
            },
            promote: false,
            capturedPieceType,
        };

        // ===== 仮移動するMoveを保存 =====
        setPreviewMove(move);

        // ===== Moveを適用して仮盤面を作成 =====
        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        // ===== 仮盤面を設定 =====
        setPreviewBoard(result.board);

        // ===== 仮持ち駒を設定 =====
        setPreviewHands(result.hands);

        // ===== 選択位置を仮移動後の位置に変更 =====
        setSelectedSquare({
            row: rowIndex,
            col: colIndex,
        });

        // ===== 移動可能範囲の表示を解除 =====
        setMovableSquares([]);
    }

    // 合体！ 
    function handleSquareClick(rowIndex: number, colIndex: number) {
        // ===== 効き表示モード =====
        if (isAttackMode) {
            const piece = currentBoard[rowIndex][colIndex];

            if (!piece) return;

            const isAttackPiece = attackPieces.includes(piece.id);

            if (isAttackPiece) {
                setAttackPieces((prev) =>
                    prev.filter((id) => id !== piece.id)
                );
            } else {
                setAttackPieces((prev) => [
                    ...prev,
                    piece.id,
                ]);
            }

            return;
        }

        // ===== 仮移動中 =====
        if (previewMove !== null) {
            if (
                previewMove.to.row === rowIndex &&
                previewMove.to.col === colIndex
            ) {
                confirmPreview(previewMove.promote);
            }

            return;
        }


        // ===== 持ち駒選択中 =====
        if (selectedHandPiece) {
            handleHandPieceSquareClick(rowIndex, colIndex);
            return;
        }

        // 通常状態
        if (!selectedSquare) {
            handleNormalClick(rowIndex, colIndex);
            return;
        }

        // 選択状態
        handleSelectedClick(rowIndex, colIndex);
    }

    // ==================================================================================================

    // 持ち駒クリック処理

    // ===== 持ち駒選択 =====
    function handleHandPieceClick(
        type: CapturedPieceType,
        player: Player
    ) {
        // ===== 効き表示モード中は持ち駒を選択できない =====
        if (isAttackMode) return;
        
        // ===== 仮移動中は持ち駒を選択できない =====
        if (previewMove !== null) return;

        // ===== 勝敗が決まっていたら選択できない =====
        if (winner) return;

        // ===== 自分の手番ではない場合は選択できない =====
        if (myPlayer !== turn) return;

        // ===== 自分の手番ではない持ち駒は選択できない =====
        if (player !== myPlayer) return;

        // ===== 選択中の持ち駒をもう一度クリックしたら選択解除 =====
        if (
            selectedHandPiece?.type === type &&
            selectedHandPiece?.player === player
        ) {
            setSelectedHandPiece(null);
            return;
        }

        // ===== 盤上の駒の選択を解除 =====
        clearSquareSelection();

        // ===== 持ち駒を選択 =====
        setSelectedHandPiece({
            type,
            player,
        });
    }

    // ===== 持ち駒選択中の盤面クリック処理 =====
    function handleHandPieceSquareClick(
        rowIndex: number,
        colIndex: number
    ) {
        if (!selectedHandPiece) return;


        // ===== 自分の駒をクリックした場合 =====
        const piece = currentBoard[rowIndex][colIndex];
        if (piece && piece.player === selectedHandPiece.player) {
            setSelectedHandPiece(null);
            selectSquare(rowIndex, colIndex);

            return;
        }

        // ===== その場所に持ち駒を打てるか判定 =====
        const canDrop = canDropPiece(
            currentBoard,
            selectedHandPiece.type,
            selectedHandPiece.player,
            rowIndex,
            colIndex
        );

        if (!canDrop) {
            setMessage("その場所には打てません");
            return;
        }

        // ===== 持ち駒を打つMoveを作成 =====
        const move: Move = {
            type: "move",
            player: selectedHandPiece.player,
            from: null,
            to: {
                row: rowIndex,
                col: colIndex,
            },
            promote: false,
            piece: selectedHandPiece.type,
        };

        // ===== 持ち駒打ちの仮移動 =====
        const result = applyMove(
            currentBoard,
            hands,
            move
        );
        

        setPreviewMove(move);
        setPreviewBoard(result.board);
        setPreviewHands(result.hands);
        setCanPromotePreview(false);

        // ===== 持ち駒の選択を解除 =====
        setSelectedHandPiece(null);
    }

    // 盤面外クリック処理
    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement;

            if (
                !target.closest(".board") &&
                !target.closest(".hand")
            ) {
                if (previewBoard !== null) return;

                clearSquareSelection();
                setSelectedHandPiece(null);
            }
        }

        document.addEventListener("click", handleOutsideClick);

        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [previewBoard]);

    // ==================================================================================================

    // ==================== ダイアログボタン用関数群 ====================

    // ===== 仮移動をキャンセルする処理 =====
    function cancelPreview() {
        setPreviewBoard(null);
        setPreviewMove(null);
        setPreviewHands(null);
        setSelectedSquare(null);
        setMovableSquares([]);
        setCanPromotePreview(false);
    }

    // ===== 仮移動を確定 =====
    function confirmPreview(promote: boolean) {
        if (!previewMove) return;

        sendMove(
            previewMove.from,
            previewMove.to,
            promote,
            previewMove.piece,
            previewMove.capturedPieceType
        );
    }

    // ダイアログ自然消滅用
    useEffect(() => {
        if (!message) return;

        const timer = setTimeout(() => {
            setMessage(null);
        }, 1500);

        return () => {
            clearTimeout(timer);
        };
    }, [message]);

    // ==================================================================================================

    return (
        <div>
            <p>自分: {myPlayer ?? "未決定"}</p>
            <p>現在のターン: {turn}</p>

            <div
                className={`shogi-app ${
                    myPlayer === "sente"
                        ? "sente-theme"
                        : "gote-theme"
                }`}
            >

                {myPlayer === null && (
                    isFirstPlayer ? (
                        <div>
                            <button onClick={() => selectPlayer("sente")}>
                                先手
                            </button>

                            <button onClick={() => selectPlayer("gote")}>
                                後手
                            </button>
                        </div>
                    ) : (
                        <p>相手の選択を待っています</p>
                    )
                )}

                {myPlayer !== null && (
                    <p>
                        {isMyTurn ? "あなたの手番です" : "相手の手番です"}
                    </p>
                )}

                <div className="game-area">

                    <div className="game-layout">

                        <div className="hand top-hand">
                            <div className="hand-pieces">
                                {opponent && Object.entries(displayHands[opponent]).map(([type, count]) =>
                                    count > 0 ? (
                                        <div
                                            key={type}
                                            className={`hand-piece ${opponent} ${
                                                selectedHandPiece?.type === type &&
                                                selectedHandPiece?.player === opponent
                                                    ? "selected"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleHandPieceClick(
                                                    type as CapturedPieceType,
                                                    opponent
                                                )
                                            }
                                        >
                                            <div className={`piece ${opponent}`}>
                                                {pieceNames[type as keyof typeof pieceNames]}
                                            </div>

                                            {count > 1 && (
                                                <span className="hand-count">
                                                    {count}
                                                </span>
                                            )}
                                        </div>
                                    ) : null
                                )}
                            </div>
                        </div>
                    

                        {/* 盤面 */}
                        <div className="board-container">

                            <div className="board">
                                {/* ダイアログ */}
                                {message && (
                                    <div className="board-message">
                                        {message}
                                    </div>
                                )}

                                {displayBoard.flatMap((row, rowIndex) =>
                                    row.map((piece, colIndex) => {
                                        const actualRow =
                                            myPlayer === "gote"
                                                ? 8 - rowIndex
                                                : rowIndex;

                                        const actualCol =
                                            myPlayer === "gote"
                                                ? 8 - colIndex
                                                : colIndex;

                                        const isSelected =
                                            selectedSquare?.row === actualRow &&
                                            selectedSquare?.col === actualCol;

                                        const isMovable = movableSquares.some(
                                            (square) =>
                                                square.row === actualRow &&
                                                square.col === actualCol
                                        );

                                        const isDrop = dropSquares.some(
                                            (square) =>
                                                square.row === actualRow &&
                                                square.col === actualCol
                                        );

                                        // ===== 効きを表示している駒か判定 =====
                                        const isAttack = attackSquares.some(
                                            (square) =>
                                                square.row === actualRow &&
                                                square.col === actualCol
                                        );

                                        const isAttackPiece =
                                            piece !== null &&
                                            attackPieces.includes(piece.id);

                                        // ===== 自分から見て相手の駒なら180度回転 =====
                                        const shouldRotatePiece =
                                            piece !== null &&
                                            piece.player !== myPlayer;

                                        return (
                                            <div
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`square ${
                                                    actualRow < 3 || actualRow >= 6
                                                        ? "promotion-zone"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    handleSquareClick(
                                                        actualRow,
                                                        actualCol
                                                    )
                                                }
                                            >
                                                <div
                                                    className={`square-overlay
                                                        ${isMovable || isDrop ? "movable" : ""}
                                                        ${isAttack ? "attack" : ""}
                                                        ${isSelected ? "selected-square-overlay" : ""}
                                                    `}
                                                />

                                                {piece && (
                                                    <div
                                                        className={`
                                                            piece
                                                            ${piece.player}
                                                            ${shouldRotatePiece ? "rotate-piece" : ""}
                                                            ${isSelected ? "selected" : ""}
                                                            ${isAttackPiece ? "attack-piece" : ""}
                                                        `}
                                                    >
                                                        {piece.promoted
                                                            ? promotedPieceNames[piece.type]
                                                            : pieceNames[piece.type]}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}

                                {previewBoard !== null && previewMove && (
                                    (() => {
                                        const previewDisplayRow =
                                            myPlayer === "gote"
                                                ? 8 - previewMove.to.row
                                                : previewMove.to.row;

                                        const previewDisplayCol =
                                            myPlayer === "gote"
                                                ? 8 - previewMove.to.col
                                                : previewMove.to.col;

                                        return (
                                            <div
                                                className={`preview-message ${
                                                    previewDisplayCol >= 7
                                                        ? "preview-left"
                                                        : "preview-right"
                                                } ${
                                                    previewDisplayRow >= 7
                                                        ? "preview-above"
                                                        : previewDisplayRow <= 1
                                                            ? "preview-below"
                                                            : ""
                                                }`}
                                                style={{
                                                    left: `${((previewDisplayCol + 0.5) / 9) * 100}%`,
                                                    top: `${((previewDisplayRow + 0.5) / 9) * 100}%`,
                                                }}
                                            >
                                                {canPromotePreview && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                confirmPreview(true);
                                                            }}
                                                        >
                                                            成る
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                confirmPreview(false);
                                                            }}
                                                        >
                                                            成らない
                                                        </button>
                                                    </>
                                                )}

                                                {!canPromotePreview && (
                                                    <button
                                                        onClick={() => {
                                                            confirmPreview(false);
                                                        }}
                                                    >
                                                        確定
                                                    </button>
                                                )}

                                                <button onClick={cancelPreview}>
                                                    キャンセル
                                                </button>
                                            </div>
                                        );
                                    })()
                                )}

                            </div>
                        </div>



                        <div className="hand bottom-hand">
                            <div className="hand-pieces">
                                {myPlayer && Object.entries(displayHands[myPlayer]).map(([type, count]) =>
                                    count > 0 ? (
                                        <div
                                            key={type}
                                            className={`hand-piece ${myPlayer} ${
                                                selectedHandPiece?.type === type &&
                                                selectedHandPiece?.player === myPlayer
                                                    ? "selected"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleHandPieceClick(
                                                    type as CapturedPieceType,
                                                    myPlayer
                                                )
                                            }
                                        >
                                            <div className={`piece ${myPlayer}`}>
                                                {pieceNames[type as keyof typeof pieceNames]}
                                            </div>

                                            {count > 1 && (
                                                <span className="hand-count">
                                                    {count}
                                                </span>
                                            )}
                                        </div>
                                    ) : null
                                )}
                            </div>
                        </div>
                    
                    </div>

                    <div className="board-controls">
                        <div className="mode-switch">
                            <div
                                className={`mode-switch-slider ${
                                    isAttackMode ? "attack" : "normal"
                                }`}
                            />

                            <button
                                className={!isAttackMode ? "active" : ""}
                                onClick={() => {
                                    setIsAttackMode(false);
                                }}
                            >
                                通常モード
                            </button>

                            <button
                                className={isAttackMode ? "active" : ""}
                                onClick={() => {
                                    setIsAttackMode(true);
                                }}
                            >
                                効き表示モード
                            </button>
                        </div>
                    </div>

                </div>

            </div>


            
        </div>
    );
}