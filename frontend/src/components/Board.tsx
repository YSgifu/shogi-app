import type {
    Board as BoardType,
    Move,
    Player,
    Settings,
} from "@/types/shogi";
import type { Square } from "@/lib/moves";
import { pieceNames, promotedPieceNames } from "@/lib/piece";

type BoardProps = {
    message: string | null;
    displayBoard: BoardType;
    myPlayer: Player | null;

    selectedSquare: Square | null;
    movableSquares: Square[];
    dropSquares: Square[];
    attackSquares: Square[];
    attackPieces: number[];

    replayMode: boolean;

    previewMove: Move | null;
    canPromotePreview: boolean;
    showCheckmateDialog: boolean;
    showUndoDialog: boolean;

    handleSquareClick: (rowIndex: number, colIndex: number) => void;
    confirmPreview: (promote: boolean) => void;
    cancelPreview: () => void;
    lastMove: Move | null;
    settings: Settings;
};

export default function ShogiBoard({
    message,
    displayBoard,
    myPlayer,
    selectedSquare,
    movableSquares,
    dropSquares,
    attackSquares,
    attackPieces,
    replayMode,
    previewMove,
    canPromotePreview,
    showCheckmateDialog,
    showUndoDialog,
    handleSquareClick,
    confirmPreview,
    cancelPreview,
    lastMove,
    settings,
}: BoardProps) {
    return (
        <div className={`board board-${settings.boardBackground}`}>
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

            {/* 盤面 */}
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

                    const isAttack = attackSquares.some(
                        (square) =>
                            square.row === actualRow &&
                            square.col === actualCol
                    );

                    const isAttackPiece =
                        piece !== null &&
                        attackPieces.includes(piece.id);

                    const shouldRotatePiece =
                        myPlayer === null
                            ? piece?.player === "gote"
                            : piece?.player !== myPlayer;

                    const isLastMove =
                        lastMove !== null &&
                        (
                            (
                                lastMove.from !== null &&
                                lastMove.from.row === actualRow &&
                                lastMove.from.col === actualCol
                            ) ||
                            (
                                lastMove.to.row === actualRow &&
                                lastMove.to.col === actualCol
                            )
                        );

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
                                    ${
                                        isMovable || isDrop
                                            ? "movable"
                                            : ""
                                    }
                                    ${isAttack ? "attack" : ""}
                                    ${
                                        isSelected
                                            ? "selected-square-overlay"
                                            : ""
                                    }
                                    ${
                                        isLastMove
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
                                        ${
                                            shouldRotatePiece
                                                ? "rotate-piece"
                                                : "my-piece"
                                        }
                                        ${isSelected ? "selected" : ""}
                                        ${
                                            isAttackPiece
                                                ? "attack-piece"
                                                : ""
                                        }
                                        ${piece.type.toLowerCase()}
                                        ${
                                            piece.promoted
                                                ? "promoted"
                                                : ""
                                        }
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

            {/* 仮移動の確定・キャンセル */}
            {!replayMode &&
                previewMove &&
                !showCheckmateDialog &&
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
                                left: `${
                                    ((previewDisplayCol + 0.5) / 9) *
                                    100
                                }%`,
                                top: `${
                                    ((previewDisplayRow + 0.5) / 9) *
                                    100
                                }%`,
                            }}
                        >
                            {canPromotePreview && (
                                <>
                                    <button
                                        disabled={showUndoDialog}
                                        onClick={() =>
                                            confirmPreview(true)
                                        }
                                    >
                                        成る
                                    </button>

                                    <button
                                        disabled={showUndoDialog}
                                        onClick={() =>
                                            confirmPreview(false)
                                        }
                                    >
                                        成らない
                                    </button>
                                </>
                            )}

                            {!canPromotePreview && (
                                <button
                                    disabled={showUndoDialog}
                                    onClick={() =>
                                        confirmPreview(false)
                                    }
                                >
                                    確定
                                </button>
                            )}

                            <button
                                disabled={showUndoDialog}
                                onClick={cancelPreview}
                            >
                                キャンセル
                            </button>
                        </div>
                    );
                })()}
        </div>
    );
}
