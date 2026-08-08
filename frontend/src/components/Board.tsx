"use client";

import { useEffect, useState } from "react";
import type { Board, Hands } from "@/types/shogi";
import { pieceNames, promotedPieceNames } from "@/lib/piece";
import { getMovableSquares, canPromote } from "@/lib/moves";


type BoardProps = {
    board: Board;
};

export default function Board({ board }: BoardProps) {
    const [currentBoard, setCurrentBoard] = useState(board);
    const [previousBoard, setPreviousBoard] = useState(board);
    const [hands, setHands] = useState<Hands>({
        sente: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
        gote: {FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0,},
    });
    const [previousHands, setPreviousHands] = useState<Hands>(hands);

    const [selectedSquare, setSelectedSquare] = useState<{row: number; col: number;} | null>(null);
    const [movableSquares, setMovableSquares] = useState< { row: number; col: number }[]>([]);

    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isAttackMode, setIsAttackMode] = useState(false);
    const [canPromotePreview, setCanPromotePreview] = useState(false);

    const [attackPieces, setAttackPieces] = useState<number[]>([]);
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

        return getMovableSquares(
            currentBoard,
            position.row,
            position.col
        );
    });

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement;

            if (!target.closest(".board")) {
                if (isPreviewing) return;

                setSelectedSquare(null);
                setMovableSquares([]);
            }
        }

        document.addEventListener("click", handleOutsideClick);

        return () => {
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [isPreviewing]);
    

    // クリック時の操作
    function handleSquareClick(rowIndex: number, colIndex: number) {
        const piece = currentBoard[rowIndex][colIndex];
        const isMovable = movableSquares.some(
        (square) =>
            square.row === rowIndex &&
            square.col === colIndex
        );


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


        // 仮移動中かつ仮移動した駒をクリック？
        if (
            isPreviewing &&
            selectedSquare?.row === rowIndex &&
            selectedSquare?.col === colIndex
        ) {
            setIsPreviewing(false);
            setSelectedSquare(null);
            setMovableSquares([]);

            return;
        }

        // 仮移動中？(上の仮移動中のコマは拾えるのでそれ以外)
        if (isPreviewing) return;


        // 移動可能マスクリック、仮移動
        if (isMovable && selectedSquare) {
            setPreviousBoard(currentBoard);
            setPreviousHands(hands);

            const newBoard = currentBoard.map((row) => [...row]);

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

                setHands((prev) => ({
                    ...prev,
                    [movingPiece.player]: {
                        ...prev[movingPiece.player],
                        [capturedType]:
                            prev[movingPiece.player][capturedType] + 1,
                    },
                }));

                // 取られた駒が効き表示中なら削除
                setAttackPieces((prev) =>
                    prev.filter((id) => id !== capturedPiece.id)
                );
            }

            newBoard[rowIndex][colIndex] = movingPiece;
            newBoard[selectedSquare.row][selectedSquare.col] = null;

            setCurrentBoard(newBoard);

            setSelectedSquare({
                row: rowIndex,
                col: colIndex,
            });

            setMovableSquares([]);
            setIsPreviewing(true);

            return;
        }

        // クリック先に駒が無い
        if (!piece) return;

        setSelectedSquare({
            row: rowIndex,
            col: colIndex,
        });

        setMovableSquares(
            getMovableSquares(currentBoard, rowIndex, colIndex)
        );
    }

    // =====================================================================================

    return (
        <div className="shogi-app">
            <div className="board-area">

                <div className="hand gote-hand">
                    <div className="hand-pieces">
                        {Object.entries(hands.gote).map(([type, count]) =>
                            count > 0 ? (
                                <div key={type} className="hand-piece gote">
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

                <div className="board">
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
                                        className={`square-overlay ${isMovable ? "movable" : ""} ${isAttack ? "attack" : ""}`}
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

                    {isPreviewing && selectedSquare && (
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
                                            }}
                                        >
                                            成る
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsPreviewing(false);
                                                setSelectedSquare(null);
                                                setMovableSquares([]);
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

                <div className="hand sente-hand">
                    <div className="hand-pieces">
                        {Object.entries(hands.sente).map(([type, count]) =>
                            count > 0 ? (
                                <div key={type} className="hand-piece sente">
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

            {/* 盤面外 */}
            <button onClick={() => setIsAttackMode(!isAttackMode)}>
                {isAttackMode ? "通常モード" : "効き表示モード"}
            </button>
        </div>
    );
}