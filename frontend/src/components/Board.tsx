"use client";

import { useEffect, useState } from "react";
import type { Board, Hands, Player, CapturedPieceType} from "@/types/shogi";
import { pieceNames, promotedPieceNames, createPiece } from "@/lib/piece";
import { getMovableSquares, canPromote, canDropPiece, getAttackSquares } from "@/lib/moves";
import { isInCheck, isLegalMove, isCheckmate } from "@/lib/check";


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

            // 現在の状態を保存
            setPreviousBoard(currentBoard);
            setPreviousHands(hands);

            // 盤面をコピー
            const newBoard = currentBoard.map((row) => [...row]);

            // 持ち駒をコピー
            const newHands = {
                sente: { ...hands.sente },
                gote: { ...hands.gote },
            };

            // 持ち駒から駒を生成
            const newPiece = createPiece(
                selectedHandPiece.type,
                selectedHandPiece.player
            );

            // 盤上に配置
            newBoard[rowIndex][colIndex] = newPiece;

            // 持ち駒を1枚減らす
            newHands[selectedHandPiece.player][selectedHandPiece.type] -= 1;

            // 仮移動後の相手
            const opponent =
                selectedHandPiece.player === "sente"
                    ? "gote"
                    : "sente";

            // 王手・詰み判定
            if (isCheckmate(newBoard, opponent, newHands)) {
                setCheckmatePlayer(selectedHandPiece.player);
                setShowCheckmateDialog(true);
            } else if (isInCheck(newBoard, opponent)) {
                setMessage("王手です");
            }

            // 仮移動状態を反映
            setCurrentBoard(newBoard);
            setHands(newHands);

            setSelectedHandPiece(null);

            setSelectedSquare({
                row: rowIndex,
                col: colIndex,
            });

            setMovableSquares([]);

            setCanPromotePreview(false);

            setIsPreviewing(true);

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

            setIsPreviewing(false);
            setSelectedSquare(null);
            setMovableSquares([]);

            switchPlayer();

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

            setPreviousBoard(currentBoard);
            setPreviousHands(hands);

            const newBoard = currentBoard.map((row) => [...row]);

            const newHands = {
                sente: { ...hands.sente },
                gote: { ...hands.gote },
            };

            const movingPiece =
                newBoard[selectedSquare.row][selectedSquare.col];

            if (!movingPiece) return;

            const canPromoteMove = canPromote(
                movingPiece,
                selectedSquare.row,
                rowIndex
            );

            setCanPromotePreview(canPromoteMove);

            const capturedPiece =
                newBoard[rowIndex][colIndex];


            // 相手の駒を取った場合
            if (capturedPiece && movingPiece && capturedPiece.type !== "OU") {
                const capturedType = capturedPiece.type;

                newHands[movingPiece.player][capturedType] += 1;

                setAttackPieces((prev) =>
                    prev.filter((id) => id !== capturedPiece.id)
                );
            }

            setHands(newHands);

            newBoard[rowIndex][colIndex] = movingPiece;
            newBoard[selectedSquare.row][selectedSquare.col] = null;

            const opponent =
                movingPiece.player === "sente"
                    ? "gote"
                    : "sente";

            if (isCheckmate(newBoard, opponent, newHands)) {
                setCheckmatePlayer(movingPiece.player);
                setShowCheckmateDialog(true);
            } else if (isInCheck(newBoard, opponent)) {
                setMessage("王手です");
            }

            setCurrentBoard(newBoard);

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

    // ===== 手番 =====

    function switchPlayer() {
        setCurrentPlayer((prev) =>
            prev === "sente" ? "gote" : "sente"
        );
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

                    <div className="hand gote-hand">
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
                                                className={`square-overlay ${isMovable || isDrop ? "movable" : ""} ${isAttack ? "attack" : ""}`}
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
                                                        if (!selectedSquare) return;

                                                        const newBoard = currentBoard.map((row) => [...row]);

                                                        const promotedPiece =
                                                            newBoard[selectedSquare.row][selectedSquare.col];

                                                        if (!promotedPiece) return;

                                                        promotedPiece.promoted = true;

                                                        setCurrentBoard(newBoard);
                                                        setSelectedSquare(null);
                                                        setMovableSquares([]);
                                                        setIsPreviewing(false);
                                                        setCanPromotePreview(false);
                                                        switchPlayer();
                                                    }}
                                                >
                                                    成る
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setIsPreviewing(false);
                                                        setSelectedSquare(null);
                                                        setMovableSquares([]);
                                                        switchPlayer();
                                                    }}
                                                >
                                                    成らない
                                                </button>
                                            </>
                                        )}

                                        {!canPromotePreview && (
                                            <button
                                                onClick={() => {
                                                    setIsPreviewing(false);
                                                    setSelectedSquare(null);
                                                    setMovableSquares([]);
                                                    switchPlayer();
                                                }}
                                            >
                                                確定
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                setCurrentBoard(previousBoard);
                                                setSelectedSquare(null);
                                                setMovableSquares([]);
                                                setIsPreviewing(false);
                                                setHands(previousHands);
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
                                                setIsPreviewing(false); // ← これを追加
                                                setShowCheckmateDialog(false);
                                                setCheckmatePlayer(null);
                                            }}
                                        >
                                            確定
                                        </button>

                                        <button
                                            onClick={() => {
                                                setCurrentBoard(previousBoard);
                                                setHands(previousHands);

                                                setSelectedSquare(null);
                                                setMovableSquares([]);
                                                setIsPreviewing(false);

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
                            {winner === "sente"
                                ? "先手の勝ち！"
                                : "後手の勝ち！"}
                        </div>
                    )}
                    <div

                        className={`current-player ${
                            currentPlayer === "sente"
                                ? "sente-turn"
                                : "gote-turn"
                        }`}
                    >
                        {currentPlayer === "sente" ? "先手の番" : "後手の番"}
                    </div>

                    <div className="hand sente-hand">
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

            </div>

            {/* 盤面外 */}

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
                        効き表示
                    </button>
                </div>
                <button>
                    全体効き表示
                </button>
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