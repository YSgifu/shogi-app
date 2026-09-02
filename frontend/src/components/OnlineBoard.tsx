"use client";

import { useEffect, useRef, useState } from "react";
import type { Board, Hands, Player, CapturedPieceType, PieceType, Move, Settings } from "@/types/shogi";
import { getMovableSquares, canPromote, canDropPiece, getAttackSquares, applyMove, rebuildGameState } from "@/lib/moves";
import { isInCheck, isLegalMove, isCheckmate } from "@/lib/check";
import Hand from "@/components/Hand";
import ShogiBoard from "@/components/Board";


export default function OnlineBoard({
    board,
    roomId,
}: {
    board: Board;
    roomId: string;
}) {
    // ===========================================================================================================================

    // ==================================================================================================
    // WebSocket・同期用Ref
    // ==================================================================================================

    const socketRef = useRef<WebSocket | null>(null);

    // デフォルト設定
    const defaultSettings: Settings = {
        boardBackground: "default",
        muteSound: false,
    };

    // ==================================================================================================
    // 対局の基本状態
    // ==================================================================================================

    // 現在の盤面
    const [currentBoard, setCurrentBoard] = useState(board);
    // 持ち駒管理用
    const [hands, setHands] = useState<Hands>({
        sente: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
        gote: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
    });
    // このブラウザのプレイヤーの手番
    const [myPlayer, setMyPlayer] = useState<Player | null>(null);
    // 現在のターン
    const [turn, setTurn] = useState<Player>("sente");
    // 相手プレイヤー
    function getOpponent(player: Player): Player {
        return player === "sente" ? "gote" : "sente";
    }
    const opponent = myPlayer ? getOpponent(myPlayer) : null;
    // 自分の手番かどうか
    const isMyTurn = myPlayer !== null && myPlayer === turn;

    // ==================================================================================================
    // 盤上の選択・仮移動状態
    // ==================================================================================================
    // 駒移動選択中のマスの情報
    const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number;} | null>(null);
    // 移動可能範囲を表示しているマス
    const [movableSquares, setMovableSquares] = useState<{ row: number; col: number }[]>([]);

    // 仮移動後の盤面
    const [previewBoard, setPreviewBoard] = useState<Board | null>(null);
    // 仮移動モード中の持ち駒
    const [previewHands, setPreviewHands] = useState<Hands | null>(null);
    // 仮移動の時のmoveを保存する用
    const [previewMove, setPreviewMove] = useState<Move | null>(null);
    // 仮移動後に成れるかを保存する用
    const [canPromotePreview, setCanPromotePreview] = useState(false);

    // 選択した持ち駒用
    const [selectedHandPiece, setSelectedHandPiece] = useState<{ type: CapturedPieceType; player: Player;} | null>(null);

    // ==================================================================================================
    // 対局状態
    // ==================================================================================================
    // 勝者用
    const [winner, setWinner] = useState<Player | null>(null);
    // メッセージ表示用
    const [message, setMessage] = useState<string | null>(null);
    const [checkmatePlayer, setCheckmatePlayer] = useState<Player | null>(null);
    const [showCheckmateDialog, setShowCheckmateDialog] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<
        "connecting"
        | "waiting-opponent"
        | "connected"
        | "opponent-disconnected"
    >("connecting");
    const [showResignDialog, setShowResignDialog] = useState(false);
    const [showUndoConfirmDialog, setShowUndoConfirmDialog] = useState(false);

    // ==================================================================================================
    // 対戦相手・待った関連
    // ==================================================================================================
    
    // 仮の「自分が1人目か」を追加
    const [isFirstPlayer, setIsFirstPlayer] = useState(false);
    const [opponentJoined, setOpponentJoined] = useState(false);

    const [showUndoDialog, setShowUndoDialog] = useState(false);
    const [undoRequester, setUndoRequester] = useState<Player | null>(null);
    const [undoRequestPending, setUndoRequestPending] = useState(false);
    const [undoUsedThisTurn, setUndoUsedThisTurn] = useState(false);
    const [showUndoWaitingDialog, setShowUndoWaitingDialog] = useState(false);

    // ==================================================================================================
    // 利き表示関連
    // ==================================================================================================

    const [isAttackMode, setIsAttackMode] = useState(false);
    const [attackPieces, setAttackPieces] = useState<number[]>([]);

    // ==================================================================================================
    // 棋譜再生関連
    // ==================================================================================================
    
    const [replayMode, setReplayMode] = useState(false);
    const [replayMoveIndex, setReplayMoveIndex] = useState(0);
    const [replayMoves, setReplayMoves] = useState<Move[]>([]);

    // ==================================================================================================
    // 設定関連
    // ==================================================================================================

    const [settings, setSettings] =
        useState<Settings>(defaultSettings);

    const [showSettings, setShowSettings] =
        useState(false);

    // ==================================================================================================
    // 同期用Ref
    // ==================================================================================================

    const boardRef = useRef<Board>(currentBoard);
    const handsRef = useRef<Hands>(hands);
    const myPlayerRef = useRef<Player | null>(myPlayer);
    const moveSoundRef = useRef<HTMLAudioElement | null>(null);
    const settingsRef = useRef<Settings>(settings);

    // ==================================================================================================
    // 追加分
    // ==================================================================================================

    const isDialogOpen =
        connectionStatus !== "connected" ||
        myPlayer === null ||
        showUndoDialog ||
        showUndoWaitingDialog ||
        showResignDialog ||
        showUndoConfirmDialog;

    const [resignedPlayer, setResignedPlayer] = useState<Player | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const lastMove = moves.length > 0
        ? moves[moves.length - 1]
        : null;



    // ==================================================================================================
    // 表示用の派生データ
    // ==================================================================================================

    // 棋譜再生時点の盤面・持ち駒
    const replayResult = rebuildGameState(
        replayMoves.slice(0, replayMoveIndex)
    );

    // 現在操作対象となる盤面
    const boardForInteraction =
        replayMode
            ? replayResult.board
            : previewBoard ?? currentBoard;

    // 実際に表示する盤面
    const boardToDisplay =
        replayMode
            ? replayResult?.board ?? currentBoard
            : previewBoard ?? currentBoard;

    // プレイヤーの向きに合わせた表示用盤面
    const displayBoard =
        myPlayer === "gote"
            ? [...boardToDisplay]
                .reverse()
                .map((row) => [...row].reverse())
        : boardToDisplay;

    // 実際に表示する持ち駒
    const displayHands =
        replayMode
            ? replayResult.hands
            : previewHands ?? hands;

    // 持ち駒を打てるマス
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

    
    // 利き表示の対象となる盤面
    const attackBoard = boardForInteraction;

    // 利き表示中のマス
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
    // 対局終了処理
    // ==================================================================================================

    const finishGame = (winner: Player) => {
        setWinner(winner);

        // 待った関連をすべて解除
        setShowUndoDialog(false);
        setShowUndoWaitingDialog(false);
        setUndoRequestPending(false);
        setUndoRequester(null);
    };


    // ==================================================================================================
    // Refの同期・初期化
    // ==================================================================================================

    // 盤面Refを同期
    useEffect(() => {
        boardRef.current = currentBoard;
    }, [currentBoard]);

    // 持ち駒Refを同期
    useEffect(() => {
        handsRef.current = hands;
    }, [hands]);


    // プレイヤーRefを同期
    useEffect(() => {
        myPlayerRef.current = myPlayer;
    }, [myPlayer]);

    // 駒音を初期化
    useEffect(() => {
        moveSoundRef.current =
            new Audio("/sounds/japanese-chess-piece1.mp3");
    }, []);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);


    // ===========================================================================================================================

    // ==================================================================================================
    // WebSocket通信
    // ==================================================================================================

    // WebSocket接続・サーバーからのメッセージ受信
    useEffect(() => {
        const wsUrl = "wss://backend.asahi-dev.workers.dev";

        // const wsUrl = "ws://127.0.0.1:8787"


        const socket = new WebSocket(
            `${wsUrl}/api/rooms/${roomId}/ws`
        );

        socket.onopen = () => {
            setConnectionStatus("waiting-opponent");
        };

        socketRef.current = socket;

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === "player-position") {
                setIsFirstPlayer(message.isFirstPlayer);
                return;
            }

            if (message.type === "player-choice-available") {
                setIsFirstPlayer(true);
                return;
            }

            if (message.type === "opponent-joined") {
                setOpponentJoined(true);
                setConnectionStatus("connected");
                return;
            }

            if (message.type === "player-assigned") {
                setMyPlayer(message.player);
                return;
            }

            if (message.type === "game-state") {
                const result = rebuildGameState(message.moves);

                setMoves(message.moves);
                setCurrentBoard(result.board);
                setHands(result.hands);
                setTurn(message.turn);

                return;
            }

            if (message.type === "turn-update") {
                setTurn(message.turn);
                return;
            }

            if (message.type === "resign") {
                setResignedPlayer(message.player);

                finishGame(
                    message.player === "sente"
                        ? "gote"
                        : "sente"
                );
                return;
            }

            if (message.type === "opponent-disconnected") {
                setConnectionStatus("opponent-disconnected");
                return;
            }

            if (message.type === "opponent-reconnected") {
                setConnectionStatus("connected");
                return;
            }

            if (message.type === "undo-request") {
                setUndoRequester(message.player);
                setShowUndoDialog(true);
                return;
            }

            if (message.type === "undo-response") {
                setUndoRequestPending(false);
                setShowUndoWaitingDialog(false);

                if (!message.accepted) {
                    setMessage("待ったが\n拒否されました");
                }

                return;
            }

            if (message.type === "undo-error") {
                setUndoRequestPending(false);
                setMessage(message.reason);
                return;
            }

            if (message.type === "undo") {
                const result = rebuildGameState(message.moves);
                setMoves(message.moves);

                // 待った承認後のゲーム状態を復元
                setMessage("待ったが\n承認されました");
                setCurrentBoard(result.board);
                setHands(result.hands);

                // 操作状態をリセット
                setPreviewBoard(null);
                setPreviewMove(null);
                setPreviewHands(null);
                setSelectedSquare(null);
                setMovableSquares([]);
                setSelectedHandPiece(null);
                setCanPromotePreview(false);
                setAttackPieces([]);

                // ダイアログ・対局状態をリセット
                setShowUndoDialog(false);
                setUndoRequester(null);
                setShowCheckmateDialog(false);
                setCheckmatePlayer(null);
                setUndoRequestPending(false);
                setShowUndoWaitingDialog(false);

                // ===== ターンを更新 =====
                setTurn(message.turn);

                return;
            }

            if (message.type === "replay") {
                setReplayMoves(message.moves);
                setReplayMoveIndex(0);
                setReplayMode(true);

                return;
            }

            // 相手の動きを反映する
            if (message.type === "move") {

                const result = applyMove(
                    boardRef.current,
                    handsRef.current,
                    message.move
                );

                if (!settingsRef.current.muteSound) {
                    const sound = moveSoundRef.current;

                    if (sound) {
                        sound.currentTime = 0;
                        sound.play();
                    }
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
                    finishGame(message.move.player);
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
                setMoves((prev) => [...prev, message.move]);

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

        // Moveを作成
        const move: Move = {
            type: "move",
            player: myPlayer,
            from,
            to,
            promote,
            piece,
            capturedPieceType,
        };

        // Moveを適用
        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        const opponent = getOpponent(myPlayer);

        if (
            isCheckmate(
                result.board,
                opponent,
                result.hands
            )
        ) {
            finishGame(myPlayer);
        } else if (
            isInCheck(result.board, opponent)
        ) {
            setMessage("王手！");
        }

        // 盤面・持ち駒を更新
        setCurrentBoard(result.board);
        setHands(result.hands);

        // 駒音を再生
        if (!settingsRef.current.muteSound) {
            const sound = moveSoundRef.current;

            if (sound) {
                sound.currentTime = 0;
                sound.play();
            }
        }

        setMoves((prev) => [...prev, move]);

        // サーバーへMoveを送信
        socketRef.current?.send(JSON.stringify(move));

        // 待ったの使用状態をリセット
        setUndoUsedThisTurn(false);

        // 仮移動状態をリセット
        setPreviewBoard(null);
        setPreviewMove(null);
        setPreviewHands(null);
        setSelectedSquare(null);
        setMovableSquares([]);
    };

    // ===========================================================================================================================

    // ===== 盤上選択の共通処理 =====

    // 盤上の駒を選択する
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

    // 盤上の駒の選択を解除する
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
        const piece = currentBoard[rowIndex][colIndex];

        // 自分の別の駒をクリックした場合、選択を切り替える
        if (piece && piece.player === myPlayer) {
            // 選択中の駒をもう一度クリックした場合、選択を解除する
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

        // 移動可能マスか判定する
        const isMovable = movableSquares.some(
            (square) =>
                square.row === rowIndex &&
                square.col === colIndex
        );

        if (!isMovable) return;

        // 移動可能マスをクリックしたら仮移動する
        createPreviewMove(rowIndex, colIndex);
    }

    // 仮移動処理
    function createPreviewMove(rowIndex: number, colIndex: number) {
        if (!selectedSquare) return;

        // 移動元の駒を取得する
        const movingPiece =
            currentBoard[selectedSquare.row][selectedSquare.col];

        if (!movingPiece) return;

        // 移動が合法か判定する
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

        // 成れるか判定する
        const canPromoteMove = canPromote(
            movingPiece,
            selectedSquare.row,
            rowIndex
        );

        setCanPromotePreview(canPromoteMove);

        // 移動先の駒を取得する
        const capturedPiece =
            currentBoard[rowIndex][colIndex];

        const capturedPieceType =
            capturedPiece?.type === "OU"
                ? undefined
                : capturedPiece?.type;

        // 仮移動するMoveを作成する
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

        setPreviewMove(move);

        // Moveを適用して仮盤面・仮持ち駒を作成する
        const result = applyMove(
            currentBoard,
            hands,
            move
        );

        setPreviewBoard(result.board);
        setPreviewHands(result.hands);

        // 選択位置を仮移動後の位置に変更する
        setSelectedSquare({
            row: rowIndex,
            col: colIndex,
        });

        // 移動可能範囲の表示を解除する
        setMovableSquares([]);
    }

    // 盤面をクリックしたときの処理をまとめる
    function handleSquareClick(rowIndex: number, colIndex: number) {
        // 待ったダイアログ表示中は操作しない
        if (showUndoDialog) return;

        // 利き表示モード
        if (isAttackMode) {
            const piece = boardForInteraction[rowIndex][colIndex];

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

        // リプレイ中は通常操作しない
        if (replayMode) return;

        // 対局終了後は操作しない
        if (winner) return;

        // 仮移動中
        if (previewMove !== null) {
            // 成り選択中は盤面クリックでは確定しない
            if (canPromotePreview) {
                return;
            }

            // 仮移動先をもう一度クリックしたら確定する
            if (
                previewMove.to.row === rowIndex &&
                previewMove.to.col === colIndex
            ) {
                confirmPreview(previewMove.promote);
            }

            return;
        }


        // 持ち駒選択中
        if (selectedHandPiece) {
            handleHandPieceSquareClick(rowIndex, colIndex);
            return;
        }

        // 駒を選択していない場合
        if (!selectedSquare) {
            handleNormalClick(rowIndex, colIndex);
            return;
        }

        // 駒を選択している場合
        handleSelectedClick(rowIndex, colIndex);
    }

    // ===========================================================================================================================

    // 持ち駒クリック処理

    // ===== 持ち駒の選択・選択解除 =====
    function handleHandPieceClick(
        type: CapturedPieceType,
        player: Player
    ) {
        if (isAttackMode) return;
        if (previewMove !== null) return;
        if (winner) return;
        if (showUndoDialog) return;
        if (myPlayer !== turn) return;
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

    // ===== 選択中の持ち駒を盤面に打つ処理 =====
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
            setMessage("その場所には\n打てません");
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

    // ===== 盤面・持ち駒以外をクリックしたときの選択解除 =====
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

    // ===== 利き表示 =====

    // ===== 指定したプレイヤーの全駒の利きを表示 =====
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

    // ===== 利き表示をすべて解除 =====
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

    // 投了
    const resign = () => {
        if (winner) return;
        if (!myPlayer) return;

        socketRef.current?.send(
            JSON.stringify({
                type: "resign",
                player: myPlayer,
            })
        );

        setResignedPlayer(myPlayer);
        finishGame(
            myPlayer === "sente"
                ? "gote"
                : "sente"
        );
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
                            自分の手番：{myPlayer === "sente" ? "先手" : "後手"}
                        </span>

                        <span className="status-divider">｜</span>

                        <span>
                            現在の手番：{turn === "sente" ? "先手" : "後手"}
                        </span>

                        <span className="status-divider">｜</span>

                        <span className="turn-status">
                            {isMyTurn ? "あなたの手番です" : "相手の手番です"}
                        </span>

                        <span className="status-divider">｜</span>

                        <span className={`connection-status ${connectionStatus}`}>
                            <span className="connection-dot" />

                            {connectionStatus === "connecting" &&
                                "接続中..."}

                            {connectionStatus === "waiting-opponent" &&
                                "相手待ち"}

                            {connectionStatus === "connected" &&
                                "通信中"}

                            {connectionStatus === "opponent-disconnected" &&
                                "復帰待ち"}
                        </span>
                    </div>
                )}

                <div className="game-area">

                    <div className="game-layout">

                        <div 
                            className="hand top-hand"
                            onClick={() => {
                                setSelectedHandPiece(null);
                                setSelectedSquare(null);
                                setMovableSquares([]);
                            }}
                        >
                            {opponent && (
                                <Hand
                                    player={opponent}
                                    hands={displayHands}
                                    selectedHandPiece={selectedHandPiece}
                                    onPieceClick={handleHandPieceClick}
                                />
                            )}
                        </div>
                    

                        {/* 盤面 */}
                        <div className="board-container">

                            {/* ダイアログ */}
                            <div className="game-dialog">
                                {showResignDialog ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            投了しますか？
                                        </div>

                                        <div className="player-select-buttons">
                                            <button
                                                className="player-button sente-button"
                                                onClick={() => {
                                                    setShowResignDialog(false);
                                                    resign();
                                                }}
                                            >
                                                投了する
                                            </button>

                                            <button
                                                className="player-button gote-button"
                                                onClick={() => {
                                                    setShowResignDialog(false);
                                                }}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                ) : showUndoConfirmDialog ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            待ったを要求しますか？
                                        </div>

                                        <div className="player-select-buttons">
                                            <button
                                                className="player-button sente-button"
                                                onClick={() => {
                                                    setShowUndoConfirmDialog(false);

                                                    setUndoRequestPending(true);
                                                    setUndoUsedThisTurn(true);
                                                    setShowUndoWaitingDialog(true);

                                                    socketRef.current?.send(
                                                        JSON.stringify({
                                                            type: "undo-request",
                                                        })
                                                    );
                                                }}
                                            >
                                                要求する
                                            </button>

                                            <button
                                                className="player-button gote-button"
                                                onClick={() => {
                                                    setShowUndoConfirmDialog(false);
                                                }}
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                ) : winner !== null && !replayMode ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            {resignedPlayer !== null && (
                                                <div>
                                                    {resignedPlayer === myPlayer
                                                        ? "投了しました"
                                                        : "投了されました"}
                                                </div>
                                            )}

                                            <div>
                                                {winner === "sente"
                                                    ? "先手の勝ち！"
                                                    : "後手の勝ち！"}
                                            </div>
                                        </div>
                                    </div>
                                ) : connectionStatus === "opponent-disconnected" ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            相手との接続が切れました
                                        </div>

                                        <div className="player-select-title">
                                            復帰を待っています
                                        </div>
                                    </div>
                                ) : showUndoDialog ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            相手が待ったを求めています
                                        </div>

                                        <div className="player-select-buttons">
                                            <button
                                                className="player-button sente-button"
                                                onClick={() => {
                                                    socketRef.current?.send(
                                                        JSON.stringify({
                                                            type: "undo-response",
                                                            player: undoRequester,
                                                            accepted: true,
                                                        })
                                                    );

                                                    setShowUndoDialog(false);
                                                    setUndoRequester(null);
                                                }}
                                            >
                                                承認
                                            </button>

                                            <button
                                                className="player-button gote-button"
                                                onClick={() => {
                                                    socketRef.current?.send(
                                                        JSON.stringify({
                                                            type: "undo-response",
                                                            player: undoRequester,
                                                            accepted: false,
                                                        })
                                                    );

                                                    setShowUndoDialog(false);
                                                    setUndoRequester(null);
                                                }}
                                            >
                                                拒否
                                            </button>
                                        </div>
                                    </div>
                                ) : showUndoWaitingDialog ? (
                                    <div className="player-select">
                                        <div className="player-select-title">
                                            待ったの承認を待っています
                                        </div>
                                    </div>
                                ) : myPlayer === null ? (
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
                                ) : null}
                            </div>


                            <ShogiBoard
                                message={message}
                                displayBoard={displayBoard}
                                myPlayer={myPlayer}
                                selectedSquare={selectedSquare}
                                movableSquares={movableSquares}
                                dropSquares={dropSquares}
                                attackSquares={attackSquares}
                                attackPieces={attackPieces}
                                replayMode={replayMode}
                                previewMove={previewMove}
                                canPromotePreview={canPromotePreview}
                                showCheckmateDialog={showCheckmateDialog}
                                showUndoDialog={showUndoDialog}
                                handleSquareClick={handleSquareClick}
                                confirmPreview={confirmPreview}
                                cancelPreview={cancelPreview}
                                lastMove={lastMove}
                                settings={settings}
                            />

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
                                                disabled={showUndoDialog}
                                                onClick={() => {
                                                    if (!checkmatePlayer || !previewMove) return;

                                                    sendMove(
                                                        previewMove.from,
                                                        previewMove.to,
                                                        previewMove.promote,
                                                        previewMove.piece,
                                                        previewMove.capturedPieceType
                                                    );

                                                    setShowCheckmateDialog(false);
                                                    setCheckmatePlayer(null);
                                                }}
                                            >
                                                確定
                                            </button>

                                            <button
                                                disabled={showUndoDialog}
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

                        <div className=
                            "hand bottom-hand"
                            onClick={() => {
                                setSelectedHandPiece(null);
                                setSelectedSquare(null);
                                setMovableSquares([]);
                            }}
                        >
                            {myPlayer && (
                                <Hand
                                    player={myPlayer}
                                    hands={displayHands}
                                    selectedHandPiece={selectedHandPiece}
                                    onPieceClick={handleHandPieceClick}
                                />
                            )}
                        </div>
                    
                    </div>

                    <div className="board-controls">

                        <div className="board-controls-title">
                            ゲーム操作
                        </div>

                        <div className="mode-switch">
                            <div
                                className={`mode-switch-slider ${
                                    isAttackMode ? "attack" : "normal"
                                }`}
                            />

                            <button
                                className={!isAttackMode ? "active" : ""}
                                disabled={showUndoDialog}
                                onClick={() => {
                                    setIsAttackMode(false);
                                }}
                            >
                                通常モード
                            </button>

                            <button
                                className={isAttackMode ? "active" : ""}
                                disabled={showUndoDialog}
                                onClick={() => {
                                    setIsAttackMode(true);
                                }}
                            >
                                利き表示モード
                            </button>
                        </div>

                        <div className="attack-controls">
                            <div className="attack-controls-title">
                                利き一括表示
                            </div>

                            <div className="attack-controls-buttons">
                                <button
                                    className="attack-all-my"
                                    disabled={showUndoDialog}
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
                                    disabled={showUndoDialog}
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
                                    disabled={showUndoDialog}
                                    onClick={clearAttackPieces}
                                >
                                    消す
                                </button>
                            </div>
                        </div>

                        {/* 通常対局時だけ */}
                        {!replayMode && (
                            <div className="game-controls">
                                <button 
                                    className="resign-button" 
                                    onClick={() => setShowResignDialog(true)}
                                    disabled={
                                        isDialogOpen ||
                                        winner !== null
                                    }
                                >
                                    投了
                                </button>

                                <button
                                    disabled={
                                        isDialogOpen ||
                                        winner !== null ||
                                        isMyTurn ||
                                        undoRequestPending ||
                                        undoUsedThisTurn
                                    }
                                    onClick={() => {
                                        setShowUndoConfirmDialog(true);
                                    }}
                                >
                                    待った
                                </button>

                                <button
                                    disabled={winner === null || replayMode}
                                    onClick={() => {
                                        socketRef.current?.send(
                                            JSON.stringify({
                                                type: "replay-request",
                                            })
                                        );
                                    }}
                                >
                                    棋譜再生
                                </button>

                                <button
                                    onClick={() => setShowSettings((prev) => !prev)}
                                >
                                    ⚙ 設定
                                </button>

                            </div>
                        )}

                        {replayMode && (
                            <div className="game-controls replay-controls">
                                <button
                                    onClick={() => {
                                        setReplayMoveIndex(0);
                                    }}
                                >
                                    最初
                                </button>

                                <button
                                    onClick={() => {
                                        setReplayMoveIndex((prev) =>
                                            Math.max(0, prev - 1)
                                        );
                                    }}
                                >
                                    ←
                                </button>

                                <span>
                                    {replayMoveIndex} / {replayMoves.length}
                                </span>

                                <button
                                    onClick={() => {
                                        setReplayMoveIndex((prev) =>
                                            Math.min(
                                                replayMoves.length,
                                                prev + 1
                                            )
                                        );
                                    }}
                                >
                                    →
                                </button>

                                <button
                                    onClick={() => {
                                        setReplayMoveIndex(
                                            replayMoves.length
                                        );
                                    }}
                                >
                                    最後
                                </button>
                            </div>
                        )}

                    </div>

                </div>

                {/* ここに設定ダイアログ */}
                {showSettings && (
                    <div className="settings-overlay">
                        <div className="settings-dialog">
                            <h2>設定</h2>

                            <div className="settings-section">
                                <h3>将棋盤の背景</h3>

                                <label>
                                    <input
                                        type="radio"
                                        name="boardBackground"
                                        checked={settings.boardBackground === "default"}
                                        onChange={() =>
                                        setSettings({
                                            ...settings,
                                            boardBackground: "default",
                                        })
                                        }
                                    />
                                        標準
                                </label>

                                <label>
                                    <input
                                        type="radio"
                                        name="boardBackground"
                                        checked={settings.boardBackground === "ink"}
                                        onChange={() =>
                                        setSettings({
                                            ...settings,
                                            boardBackground: "ink",
                                        })
                                        }
                                    />
                                        水墨画
                                </label>
                            </div>
                            <div className="settings-section">
                                <h3>サウンド</h3>

                                <label>
                                    <input
                                    type="checkbox"
                                    checked={settings.muteSound}
                                    onChange={(e) =>
                                        setSettings((prev) => ({
                                            ...prev,
                                            muteSound: e.target.checked,
                                        }))
                                    }
                                    />
                                    打鍵音をミュート
                                </label>
                            </div>

                            <button onClick={() => setShowSettings(false)}>
                                閉じる
                            </button>
                        </div>
                    </div>
                )}

            </div>


            
        </div>
    );
}