"use client";

import { useEffect, useRef, useState } from "react";
import type { Board, Hands, Player, CapturedPieceType, PieceType, Move } from "@/types/shogi";
import { pieceNames, promotedPieceNames, createPiece } from "@/lib/piece";
import { getMovableSquares, canPromote, canDropPiece, getAttackSquares, applyMove } from "@/lib/moves";
import { isInCheck, isLegalMove, isCheckmate } from "@/lib/check";


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

    const [checkmatePlayer, setCheckmatePlayer] =
    useState<Player | null>(null);

    const [showCheckmateDialog, setShowCheckmateDialog] =
        useState(false);

    const [showWinAnimation, setShowWinAnimation] =
        useState(false);
    

    const boardRef = useRef<Board>(currentBoard);
    const handsRef = useRef<Hands>(hands);
    const myPlayerRef = useRef<Player | null>(myPlayer);
    const moveSoundRef = useRef<HTMLAudioElement | null>(null);
    const [opponentJoined, setOpponentJoined] = useState(false);

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



    useEffect(() => {
        boardRef.current = currentBoard;
    }, [currentBoard]);

    useEffect(() => {
        handsRef.current = hands;
    }, [hands]);

    // useEffect(() => {
    //     console.log("hands state更新:", hands);
    // }, [hands]);

    useEffect(() => {
        myPlayerRef.current = myPlayer;
    }, [myPlayer]);

    useEffect(() => {
        moveSoundRef.current =
            new Audio("/sounds/japanese-chess-piece1.mp3");
    }, []);

    

    // ==================================================================================================

    // ===== WebSocket接続・サーバーからのMove受信処理、自分の盤面に反映 =====
    useEffect(() => {
        const wsUrl = "wss://backend.asahi-dev.workers.dev";

        // const wsUrl = "ws://127.0.0.1:8787"

        const socket = new WebSocket(
            `${wsUrl}/api/rooms/${roomId}/ws`
        );

        socketRef.current = socket;

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "player-position") {
                setIsFirstPlayer(message.isFirstPlayer);
                return;
            }

            if (message.type === "opponent-joined") {
                setOpponentJoined(true);
                return;
            }

            if (message.type === "player-assigned") {
                setMyPlayer(message.player);
                return;
            }

            if (message.type === "turn-update") {
                setTurn(message.turn);
                return;
            }

            if (message.type === "resign") {
                setWinner(message.player === "sente" ? "gote" : "sente");
                setShowWinAnimation(true);
                return;
            }

            if (message.type === "opponent-disconnected") {
                setMessage("相手との接続が切れました");
                return;
            }

            if (message.type === "move") {
                const result = applyMove(
                    boardRef.current,
                    handsRef.current,
                    message.move
                );

                const sound = moveSoundRef.current;
                if (sound) {
                    sound.currentTime = 0;
                    sound.play();
                }

                const currentMyPlayer = myPlayerRef.current;

                if (
                    currentMyPlayer &&
                    isCheckmate(
                        result.board,
                        currentMyPlayer,
                        result.hands
                    )
                ) {
                    // 相手の一手で自分が詰んだ
                    setWinner(message.move.player);
                    setShowWinAnimation(true);
                } else if (
                    currentMyPlayer &&
                    isInCheck(
                        result.board,
                        currentMyPlayer
                    )
                ) {
                    setMessage("王手！");
                }


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

        // console.log("先後選択:", message);

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

        // 🔊 駒音
        const sound = moveSoundRef.current;

        if (sound) {
            sound.currentTime = 0;
            sound.play();
        }

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
        if (winner) return;

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
        if (winner) return;

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

    // ===== 指定したプレイヤーの全駒の効きを表示 =====
    function showAllAttackPieces(player: Player) {
        const pieceIds = currentBoard
            .flatMap((row) => row)
            .filter(
                (piece): piece is NonNullable<typeof piece> =>
                    piece !== null && piece.player === player
            )
            .map((piece) => piece.id);

        setAttackPieces((prev) => [
            ...new Set([...prev, ...pieceIds]),
        ]);
    }

    // ===== 効き表示をすべて解除 =====
    function clearAttackPieces() {
        setAttackPieces([]);
    }

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

        // 成る / 成らないを反映したMoveを作る
        const move: Move = {
            ...previewMove,
            promote,
        };

        // 成り/不成を反映した盤面を作る
        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        const opponent =
            move.player === "sente"
                ? "gote"
                : "sente";

        // このMoveが詰みになるか判定
        if (
            isCheckmate(
                result.board,
                opponent,
                result.hands
            )
        ) {
            // 詰みになるMoveを保存
            setPreviewMove(move);

            // 詰みダイアログを表示
            setCheckmatePlayer(move.player);
            setShowCheckmateDialog(true);

            return;
        }

        // 詰みでなければ通常通り確定
        sendMove(
            move.from,
            move.to,
            move.promote,
            move.piece,
            move.capturedPieceType
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

    const resign = () => {
        if (winner) return;
        if (!myPlayer) return;

        socketRef.current?.send(
            JSON.stringify({
                type: "resign",
                player: myPlayer,
            })
        );

        setWinner(
            myPlayer === "sente"
                ? "gote"
                : "sente"
        );

        setShowWinAnimation(true);
    };

    // ==================================================================================================

    return (
        <div>
            <div
                className={`shogi-app`}
            >

                {myPlayer !== null && (
                    <div className="game-status">
                        <span>
                            自分：{myPlayer === "sente" ? "先手" : "後手"}
                        </span>

                        <span className="status-divider">｜</span>

                        <span>
                            現在のターン：{turn === "sente" ? "先手" : "後手"}
                        </span>

                        <span className="status-divider">｜</span>

                        <span className="turn-status">
                            {isMyTurn ? "あなたの手番です" : "相手の手番です"}
                        </span>
                    </div>
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
                                            <div className={`piece ${opponent} ${type.toLowerCase()}`}>
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

                            {/* 手番選択表示 */}
                            {myPlayer === null && (
                                !opponentJoined ? (
                                    <p className="waiting-message">
                                        相手の入室を待っています
                                    </p>
                                ) : isFirstPlayer ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            自分の手番を選択してください
                                        </div>

                                        <div className="player-select-buttons">
                                            <button
                                                className="player-button sente-button"
                                                onClick={() => selectPlayer("sente")}
                                            >
                                                先手
                                            </button>

                                            <button
                                                className="player-button gote-button"
                                                onClick={() => selectPlayer("gote")}
                                            >
                                                後手
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="waiting-message">
                                        相手の選択を待っています
                                    </p>
                                )
                            )}


                            <div className="board">
                                {/* メッセージ */}
                                {message && (
                                    <div
                                        className={`board-message ${
                                            message.length >= 12
                                                ? "long"
                                                : message.length >= 8
                                                    ? "medium"
                                                    : ""
                                        }`}
                                    >
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
                                            myPlayer === null
                                                ? piece?.player === "gote"
                                                : piece?.player !== myPlayer;

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
                                                            ${shouldRotatePiece ? "rotate-piece" : "my-piece"}
                                                            ${isSelected ? "selected" : ""}
                                                            ${isAttackPiece ? "attack-piece" : ""}
                                                            ${piece.type.toLowerCase()}
                                                            ${piece.promoted ? "promoted" : ""}
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

                                {previewBoard !== null && previewMove && !showCheckmateDialog && (
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

                            {showWinAnimation && winner && (
                                <div className="win-overlay">
                                    <div className="win-message">
                                        {winner === "sente"
                                            ? "先手の勝ち！"
                                            : "後手の勝ち！"}
                                    </div>
                                </div>
                            )}

                            {showCheckmateDialog && (
                                <div className="checkmate-overlay">
                                    <div className="checkmate-dialog">
                                        <div className="checkmate-title">
                                            詰み
                                        </div>

                                        <div className="checkmate-subtitle">
                                            この一手で勝負が決まります
                                        </div>

                                        <div className="checkmate-actions">
                                            <button
                                                onClick={() => {
                                                    if (!checkmatePlayer || !previewMove) return;

                                                    sendMove(
                                                        previewMove.from,
                                                        previewMove.to,
                                                        previewMove.promote,
                                                        previewMove.piece,
                                                        previewMove.capturedPieceType
                                                    );

                                                    setWinner(checkmatePlayer);
                                                    setShowWinAnimation(true);
                                                    setShowCheckmateDialog(false);
                                                    setCheckmatePlayer(null);
                                                }}
                                            >
                                                確定
                                            </button>

                                            <button
                                                onClick={() => {
                                                    cancelPreview();
                                                    setShowCheckmateDialog(false);
                                                    setCheckmatePlayer(null);
                                                }}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}


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
                                            <div className={`piece ${opponent} ${type.toLowerCase()}`}>
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

                        <div className="attack-controls">
                            <div className="attack-controls-title">
                                一括表示
                            </div>

                            <div className="attack-controls-buttons">
                                <button
                                    className="attack-all-my"
                                    onClick={() => {
                                        if (myPlayer) {
                                            showAllAttackPieces(myPlayer);
                                        }
                                    }}
                                >
                                    自分
                                </button>

                                <button
                                    className="attack-all-opponent"
                                    onClick={() => {
                                        if (myPlayer) {
                                            const opponent: Player =
                                                myPlayer === "sente" ? "gote" : "sente";

                                            showAllAttackPieces(opponent);
                                        }
                                    }}
                                >
                                    相手
                                </button>

                                <button
                                    className="attack-clear"
                                    onClick={clearAttackPieces}
                                >
                                    消す
                                </button>
                            </div>
                        </div>

                        <button className="resign-button" onClick={resign}>
                            投了
                        </button>

                    </div>

                </div>

            </div>


            
        </div>
    );
}