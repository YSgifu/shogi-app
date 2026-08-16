"use client";

import { useEffect, useState } from "react";
import type { Board, Hands, Player, CapturedPieceType, Move_before, PieceType } from "@/types/shogi";
import { pieceNames, promotedPieceNames, createPiece } from "@/lib/piece";
import { getMovableSquares, canPromote, canDropPiece, getAttackSquares } from "@/lib/moves";
import { isInCheck, isLegalMove, isCheckmate } from "@/lib/check";
import { formatMove, } from "@/lib/notation";


type BoardProps = {
    board: Board;
};

export default function Board({ board }: BoardProps) {

    // ===== 盤面・持ち駒 =====

    const [currentBoard, setCurrentBoard] = useState(board);
    const [previousBoard, setPreviousBoard] = useState(board);
    const [hands, setHands] = useState<Hands>({
        sente: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
        gote: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
    });
    const [previousHands, setPreviousHands] = useState<Hands>(hands);
    const [moveHistory, setMoveHistory] = useState<Move_before[]>([]);
    const [previewCapturedPieceType, setPreviewCapturedPieceType] = useState<PieceType | null>(null);

    // ===== 選択状態 =====

    const [selectedSquare, setSelectedSquare] = useState<{row: number; col: number;} | null>(null);
    const [movableSquares, setMovableSquares] = useState< { row: number; col: number }[]>([]);
    const [selectedHandPiece, setSelectedHandPiece] = useState<{type: CapturedPieceType; player: Player;} | null>(null);

    // ===== 仮移動 =====

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [canPromotePreview, setCanPromotePreview] = useState(false);

    // ===== 効き表示 =====

    const [isAttackMode, setIsAttackMode] = useState(false);
    const [attackPieces, setAttackPieces] = useState<number[]>([]);

    // ===== 対局状態 =====

    const [currentPlayer, setCurrentPlayer] = useState<Player>("sente");
    const [winner, setWinner] = useState<Player | null>(null);

    // ===== メッセージ =====

    const [message, setMessage] = useState<string | null>(null);
    const [showWinAnimation, setShowWinAnimation] = useState(false);

    const [checkmatePlayer, setCheckmatePlayer] = useState<Player | null>(null);
    const [showCheckmateDialog, setShowCheckmateDialog] = useState(false);
    const [lastMove, setLastMove] = useState<{
        from: { row: number; col: number } | null;
        to: { row: number; col: number };
    } | null>(null);
    const [previewMove, setPreviewMove] = useState<{
        from: { row: number; col: number } | null;
        to: { row: number; col: number };
    } | null>(null);

    // ================================================================================
    
    const attackSquares = attackPieces.flatMap((pieceId) => {
        const position = currentBoard
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
            currentBoard,
            position.row,
            position.col
        );
    });

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
    
    

    // ================================================================================

    // ===== クリック処理 =====

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement;

            if (
                !target.closest(".board") &&
                !target.closest(".hand")
            ) {
                if (isPreviewing) return;

                setSelectedSquare(null);
                setMovableSquares([]);
                setSelectedHandPiece(null);
            }
        }

        document.addEventListener("click", handleOutsideClick);

        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [isPreviewing]);

    // ===== メッセージ =====

    useEffect(() => {
        if (!message) return;

        const timer = setTimeout(() => {
            setMessage(null);
        }, 1500);

        return () => {
            clearTimeout(timer);
        };
    }, [message]);

    useEffect(() => {
        if (!showWinAnimation) return;

        const timer = setTimeout(() => {
            setShowWinAnimation(false);
        }, 2000);

        return () => {
            clearTimeout(timer);
        };
    }, [showWinAnimation]);
    
    // ========================================================================================

    // ===== 盤面クリック =====
    function handleSquareClick(rowIndex: number, colIndex: number) {
        // ===== 対局終了 =====

        if (winner) return;

        // ===== クリックしたマスの情報 =====

        const piece = currentBoard[rowIndex][colIndex];
        const isMovable = movableSquares.some(
            (square) =>
                square.row === rowIndex &&
                square.col === colIndex
        );


        // ===== 効き表示モード =====


        if (isAttackMode) {
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

        // ===== 持ち駒選択中 =====

        if (selectedHandPiece) {
            // 自分の駒をクリックしたら、
            // 持ち駒選択を解除して通常の駒選択へ移る
            if (piece && piece.player === selectedHandPiece.player) {
                setSelectedHandPiece(null);

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

                return;
            }

            // 持ち駒を打てる場所か確認
            if (
                !canDropPiece(
                    currentBoard,
                    selectedHandPiece.type,
                    selectedHandPiece.player,
                    rowIndex,
                    colIndex
                )
            ) {
                setMessage("その場所には打てません");
                return;
            }

            // 持ち駒を打つ
            const move: Move_before = {
                player: selectedHandPiece.player,
                from: null,
                to: {
                    row: rowIndex,
                    col: colIndex,
                },
                pieceType: selectedHandPiece.type,
                promoted: false,
                capturedPieceType: null,
            };

            setPreviousBoard(currentBoard);
            setPreviousHands(hands);

            const result = applyMove(
                currentBoard,
                hands,
                move
            );

            // 仮移動後の相手
            const opponent = getOpponent(selectedHandPiece.player);

            // 王手・詰み判定
            if (isCheckmate(result.board, opponent, result.hands)) {
                setCheckmatePlayer(selectedHandPiece.player);
                setShowCheckmateDialog(true);
            } else if (isInCheck(result.board, opponent)) {
                setMessage("王手です");
            }

            setPreviewCapturedPieceType(null);

            // 仮移動状態を反映
            startPreview(
                result.board,
                result.hands,
                move,
                {
                    row: rowIndex,
                    col: colIndex,
                }
            );

            setSelectedHandPiece(null);

            return;
        }


        // ===== 仮移動中：仮移動した駒を再クリック =====
        if (
            isPreviewing &&
            selectedSquare?.row === rowIndex &&
            selectedSquare?.col === colIndex
        ) {
            // 成る・成らないの選択中は確定しない
            if (canPromotePreview) {
                return;
            }

            confirmMove(false);
            return;
        }

        // ===== 仮移動中：その他のマス =====

        if (isPreviewing) return;


        // ===== 移動可能マスをクリック：仮移動 =====

        if (isMovable && selectedSquare) {
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

            const movingPiece =
                currentBoard[selectedSquare.row][selectedSquare.col];

            if (!movingPiece) return;

            const capturedPiece =
                currentBoard[rowIndex][colIndex];

            const canPromoteMove = canPromote(
                movingPiece,
                selectedSquare.row,
                rowIndex
            );

            const move: Move_before = {
                player: movingPiece.player,
                from: selectedSquare,
                to: {
                    row: rowIndex,
                    col: colIndex,
                },
                pieceType: movingPiece.type,
                promoted: canPromoteMove
                    ? false
                    : movingPiece.promoted,
                capturedPieceType:
                    capturedPiece?.type ?? null,
            };

            setPreviousBoard(currentBoard);
            setPreviousHands(hands);

            const result = applyMove(
                currentBoard,
                hands,
                move
            );

            setCanPromotePreview(canPromoteMove);
            setPreviewMove(move);

            const opponent = getOpponent(movingPiece.player);

            if (isCheckmate(result.board, opponent, result.hands)) {
                setCheckmatePlayer(movingPiece.player);
                setShowCheckmateDialog(true);
            } else if (isInCheck(result.board, opponent)) {
                setMessage("王手です");
            }

            setCurrentBoard(result.board);
            setHands(result.hands);

            setSelectedSquare({
                row: rowIndex,
                col: colIndex,
            });

            setMovableSquares([]);
            setIsPreviewing(true);

            return;
        }

        // ===== 通常の駒選択 =====

        if (!piece) return;

        // 相手の駒は選択できない

        if (piece.player !== currentPlayer) return;

        // 選択中の駒をもう一度クリックしたら選択解除
        if (
            selectedSquare?.row === rowIndex &&
            selectedSquare?.col === colIndex
        ) {
            setSelectedSquare(null);
            setMovableSquares([]);
            return;
        }

        setSelectedSquare({
            row: rowIndex,
            col: colIndex,
        });

        setMovableSquares(
            getMovableSquares(currentBoard, rowIndex, colIndex)
        );
    }

    // ====================================================================================

    // ===== 持ち駒選択 =====

    function handleHandPieceClick(
        type: CapturedPieceType,
        player: Player
    ) {
        if (winner) return;

        // 自分の手番ではない持ち駒は選択できない
        if (player !== currentPlayer) return;

        // 仮移動中なら元の状態に戻す
        if (isPreviewing) {
            setCurrentBoard(previousBoard);
            setHands(previousHands);
            setIsPreviewing(false);
        }

        // 盤上の駒の選択を解除
        setSelectedSquare(null);
        setMovableSquares([]);

        // 持ち駒を選択
        setSelectedHandPiece({
            type,
            player,
        });
    }

    // ====================================================================================

    // ===== 手番 =====

    function switchPlayer() {
        setCurrentPlayer((prev) =>
            prev === "sente" ? "gote" : "sente"
        );
    }

    function resetGame() {
        const resetBoard = board.map((row) =>
            row.map((piece) =>
                piece ? { ...piece } : null
            )
        );

        setCurrentBoard(resetBoard);
        setPreviousBoard(
            resetBoard.map((row) => [...row])
        );

        setHands({
            sente: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
            gote: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
        });

        setPreviousHands({
            sente: {FU: 0,KY: 0,KE: 0,GI: 0,KI: 0,KA: 0,HI: 0,},
            gote: {FU: 0,KY: 0,KE: 0,GI: 0,KI: 0,KA: 0,HI: 0,},
        });

        setSelectedSquare(null);
        setMovableSquares([]);
        setSelectedHandPiece(null);

        setIsPreviewing(false);
        setCanPromotePreview(false);

        setIsAttackMode(false);
        setAttackPieces([]);

        setCurrentPlayer("sente");
        setWinner(null);

        setMessage(null);
        setShowWinAnimation(false);

        setCheckmatePlayer(null);
        setShowCheckmateDialog(false);
        setLastMove(null);
    }

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

    function clearAttackPieces() {
        setAttackPieces([]);
    }

    const confirmMove = (promote: boolean = false) => {
        if (!previewMove) return;

        const move: Move_before = {
            player: currentPlayer,
            from: previewMove.from,
            to: previewMove.to,
            pieceType:
                currentBoard[previewMove.to.row][previewMove.to.col]!.type,
            promoted: promote,
            capturedPieceType: previewCapturedPieceType,
        };

        // 成る場合だけ、仮移動後の駒を成らせる
        if (promote && selectedSquare) {
            const newBoard = currentBoard.map((row) =>
                row.map((piece) =>
                    piece ? { ...piece } : null
                )
            );

            const promotedPiece =
                newBoard[selectedSquare.row][selectedSquare.col];

            if (promotedPiece) {
                promotedPiece.promoted = true;
                setCurrentBoard(newBoard);
            }
        }

        // 直前の一手を確定
        setLastMove(previewMove);
        
        addMoveToHistory(move);

        // 仮移動状態を解除
        setIsPreviewing(false);
        setSelectedSquare(null);
        setMovableSquares([]);
        setCanPromotePreview(false);

        // 手番交代
        switchPlayer();
    };

    function getOpponent(player: Player): Player {
        return player === "sente" ? "gote" : "sente";
    }

    const cancelPreview = () => {
        setCurrentBoard(previousBoard);
        setHands(previousHands);

        setSelectedSquare(null);
        setMovableSquares([]);
        setIsPreviewing(false);
        setCanPromotePreview(false);
        setPreviewMove(null);
    };

    const startPreview = (
        newBoard: Board,
        newHands: Hands,
        move: Move_before,
        selectedPosition: { row: number; col: number },
        canPromoteMove: boolean = false
    ) => {
        setPreviousBoard(currentBoard);
        setPreviousHands(hands);

        setCurrentBoard(newBoard);
        setHands(newHands);

        setSelectedSquare(selectedPosition);
        setPreviewMove(move);
        setMovableSquares([]);

        setCanPromotePreview(canPromoteMove);
        setIsPreviewing(true);
    };

    const addMoveToHistory = (move: Move_before) => {
        setMoveHistory((prev) => [
            ...prev,
            move,
        ]);
    };

    function applyMove(
        board: Board,
        hands: Hands,
        move: Move_before
    ) {
        const newBoard = board.map((row) =>
            row.map((piece) =>
                piece ? { ...piece } : null
            )
        );

        const newHands = {
            sente: { ...hands.sente },
            gote: { ...hands.gote },
        };

        // 持ち駒を打つ
        if (move.from === null) {
            const newPiece = createPiece(
                move.pieceType,
                move.player
            );

            newPiece.promoted = move.promoted;

            newBoard[move.to.row][move.to.col] = newPiece;

            newHands[move.player][move.pieceType as CapturedPieceType] -= 1;

            return {
                board: newBoard,
                hands: newHands,
            };
        }

        // 盤上の駒を取得
        const movingPiece =
            newBoard[move.from.row][move.from.col];

        if (!movingPiece) {
            return {
                board,
                hands,
            };
        }

        // 駒を取った場合
        const capturedType = move.capturedPieceType;

        if (capturedType && capturedType !== "OU") {
            newHands[move.player][capturedType as CapturedPieceType] += 1;
        }

        // 成り
        movingPiece.promoted = move.promoted;

        // 駒を移動
        newBoard[move.to.row][move.to.col] = movingPiece;
        newBoard[move.from.row][move.from.col] = null;

        return {
            board: newBoard,
            hands: newHands,
        };
    }

    function rebuildPosition(history: Move_before[]) {
        let rebuiltBoard = board.map((row) =>
            row.map((piece) =>
                piece ? { ...piece } : null
            )
        );

        let rebuiltHands: Hands = {
            sente: {
                FU: 0,
                KY: 0,
                KE: 0,
                GI: 0,
                KI: 0,
                KA: 0,
                HI: 0,
            },
            gote: {
                FU: 0,
                KY: 0,
                KE: 0,
                GI: 0,
                KI: 0,
                KA: 0,
                HI: 0,
            },
        };

        for (const move of history) {
            const result = applyMove(
                rebuiltBoard,
                rebuiltHands,
                move
            );

            rebuiltBoard = result.board;
            rebuiltHands = result.hands;
        }

        return {
            board: rebuiltBoard,
            hands: rebuiltHands,
        };
    }

    function undoMove(count: number = 1) {
        if (moveHistory.length === 0) return;

        const newHistory = moveHistory.slice(
            0,
            Math.max(0, moveHistory.length - count)
        );

        const result = rebuildPosition(newHistory);

        setMoveHistory(newHistory);
        setCurrentBoard(result.board);
        setHands(result.hands);

        setCurrentPlayer(
            newHistory.length % 2 === 0
                ? "sente"
                : "gote"
        );

        setLastMove(
            newHistory.length > 0
                ? {
                    from: newHistory[newHistory.length - 1].from,
                    to: newHistory[newHistory.length - 1].to,
                }
                : null
        );

        setSelectedSquare(null);
        setMovableSquares([]);
        setSelectedHandPiece(null);
        setPreviewMove(null);
        setIsPreviewing(false);
        setCanPromotePreview(false);
    }


    // =====================================================================================

    return (
        <div
            className={`shogi-app ${
                currentPlayer === "sente"
                    ? "sente-theme"
                    : "gote-theme"
            }`}
        >

            <div className="game-area">

                <div className="game-layout">

                    <div className="hand top-hand">
                        <div className="hand-pieces">
                            {Object.entries(hands.gote).map(([type, count]) =>
                                count > 0 ? (
                                    <div
                                        key={type}
                                        className={`hand-piece gote ${
                                            selectedHandPiece?.type === type &&
                                            selectedHandPiece?.player === "gote"
                                                ? "selected"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            handleHandPieceClick(
                                                type as CapturedPieceType,
                                                "gote"
                                            )
                                        }
                                    >
                                        <div className="piece gote">
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

                    {!winner && (
                        <div
                            className={`current-player ${
                                currentPlayer === "sente"
                                    ? "sente-turn"
                                    : "gote-turn"
                            }`}
                        >
                            {currentPlayer === "sente" ? "先手の番" : "後手の番"}
                        </div>
                    )}


                    {/* 盤面 */}
                    <div className="board-container">

                        <div className="board">
                            {/* ダイアログ */}
                            {message && (
                                <div className="board-message">
                                    {message}
                                </div>
                            )}


                            {/* ===== 盤面の9×9マスを生成 ===== */}
                            {currentBoard.flatMap((row, rowIndex) =>
                                row.map((piece, colIndex) => {
                                    // ===== 選択中のマスか判定 =====
                                    const isSelected =
                                        selectedSquare?.row === rowIndex &&
                                        selectedSquare?.col === colIndex;

                                    // ===== 移動可能なマスか判定 =====
                                    const isMovable = movableSquares.some(
                                        (square) =>
                                            square.row === rowIndex &&
                                            square.col === colIndex
                                    );

                                    
                                    const isDrop = dropSquares.some(
                                        (square) =>
                                            square.row === rowIndex &&
                                            square.col === colIndex
                                    );

                                    // ===== 攻撃対象として選択されているマスか判定 =====
                                    const isAttack = attackSquares.some(
                                        (square) =>
                                            square.row === rowIndex &&
                                            square.col === colIndex
                                    );

                                    // ===== 効きを表示している駒か判定 =====
                                    const isAttackPiece =
                                        piece !== null && attackPieces.includes(piece.id);

                                    return (
                                        <div
                                            key={`${rowIndex}-${colIndex}`}
                                            className={`square ${
                                                rowIndex < 3 || rowIndex >= 6
                                                    ? "promotion-zone"
                                                    : ""
                                            }`}
                                            onClick={() => {
                                                handleSquareClick(rowIndex, colIndex);
                                            }}
                                        >
                                            <div
                                                className={`square-overlay 
                                                    ${isMovable || isDrop ? "movable" : ""} 
                                                    ${isAttack ? "attack" : ""}
                                                    ${isSelected ? "selected-square-overlay" : ""}
                                                    ${
                                                        (lastMove?.from?.row === rowIndex &&
                                                            lastMove?.from?.col === colIndex) ||
                                                        (lastMove?.to?.row === rowIndex &&
                                                            lastMove?.to?.col === colIndex)
                                                            ? "last-move"
                                                            : ""
                                                    }
                                                `}
                                            />

                                            {piece && (
                                                <div
                                                    className={`
                                                        piece 
                                                        ${piece.player} 
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

                            {isPreviewing && selectedSquare && !showCheckmateDialog && (
                                    <div
                                        className={`preview-message ${
                                            selectedSquare.col >= 7
                                                ? "preview-left"
                                                : "preview-right"
                                        } ${
                                            selectedSquare.row >= 7
                                                ? "preview-above"
                                                : selectedSquare.row <= 1
                                                    ? "preview-below"
                                                    : ""
                                        }`}
                                        style={{
                                            left: `${((selectedSquare.col + 0.5) / 9) * 100}%`,
                                            top: `${((selectedSquare.row + 0.5) / 9) * 100}%`,
                                        }}
                                    >

                                        {canPromotePreview && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        confirmMove(true);
                                                    }}
                                                >
                                                    成る
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        confirmMove(false);
                                                    }}
                                                >
                                                    成らない
                                                </button>
                                            </>
                                        )}

                                        {!canPromotePreview && (
                                            <button
                                                onClick={() => {
                                                    confirmMove();
                                                }}
                                            >
                                                確定
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                cancelPreview();
                                            }}
                                        >
                                            キャンセル
                                        </button>
                                    </div>
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
                                                if (!checkmatePlayer) return;

                                                setWinner(checkmatePlayer);
                                                setShowWinAnimation(true);
                                                setIsPreviewing(false);
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

                    {winner && !showWinAnimation && (
                        <div className="winner-message">
                            <div>
                                {winner === "sente"
                                    ? "先手の勝ち！"
                                    : "後手の勝ち！"}
                            </div>

                            <button onClick={resetGame}>
                                もう一度対局
                            </button>
                        </div>
                    )}

                    <div className="hand bottom-hand">
                        <div className="hand-pieces">
                            {Object.entries(hands.sente).map(([type, count]) =>
                                count > 0 ? (
                                    <div
                                        key={type}
                                        className={`hand-piece sente ${
                                            selectedHandPiece?.type === type &&
                                            selectedHandPiece?.player === "sente"
                                                ? "selected"
                                                : ""
                                        }`}
                                        onClick={() =>
                                            handleHandPieceClick(
                                                type as CapturedPieceType,
                                                "sente"
                                            )
                                        }
                                    >
                                        <div className="piece sente">
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
                            onClick={() => setIsAttackMode(false)}
                        >
                            通常モード
                        </button>

                        <button
                            className={isAttackMode ? "active" : ""}
                            onClick={() => setIsAttackMode(true)}
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
                                className="attack-all-sente"
                                onClick={() => showAllAttackPieces("sente")}
                            >
                                先手
                            </button>

                            <button
                                className="attack-all-gote"
                                onClick={() => showAllAttackPieces("gote")}
                            >
                                後手
                            </button>

                            <button
                                className="attack-clear"
                                onClick={clearAttackPieces}
                            >
                                消す
                            </button>
                        </div>
                    </div>

                    <div className="game-controls">
                        <button onClick={() => undoMove(1)}>
                            一手戻す
                        </button>
                    </div>

                </div>

            </div>

            {/* 盤面外 */}

            <div className="move-history">
                <h4>棋譜</h4>

                <div className="move-history-list">
                    {moveHistory.map((move, index) => (
                        <span key={index}>
                            {index + 1}. {formatMove(move)}
                        </span>
                    ))}
                </div>
            </div>

            {process.env.NODE_ENV === "development" && (
                <button
                    onClick={() => {
                        setWinner("sente");
                        setShowWinAnimation(true);
                    }}
                >
                    勝利演出をテスト
                </button>
            )}
            
        </div>
    );
}