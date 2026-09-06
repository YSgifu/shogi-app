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
    focusedPieceSquare: { row: number; col: number } | null;
    setFocusedPieceSquare: (
        square: { row: number; col: number } | null
    ) => void;
    focusedAttackSquares: Square[];
    attackingPieceIds: number[];
    targetPieceSquare: { row: number; col: number } | null;
    setTargetPieceSquare: (
        square: { row: number; col: number } | null
    ) => void;
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
    focusedPieceSquare,
    setFocusedPieceSquare,
    focusedAttackSquares,
    attackingPieceIds,
    targetPieceSquare,
    setTargetPieceSquare,
}: BoardProps) {

    const focusedDisplaySquares = focusedAttackSquares.map(
        (square) => ({
            row:
                myPlayer === "gote"
                    ? 8 - square.row
                    : square.row,
            col:
                myPlayer === "gote"
                    ? 8 - square.col
                    : square.col,
        })
    );

    const focusedDisplaySet = new Set(
        focusedDisplaySquares.map(
            (square) => `${square.row},${square.col}`
        )
    );

    const hasFocusedAttack = (row: number, col: number) =>
        focusedDisplaySet.has(`${row},${col}`);

    const focusedAttackPath = (() => {
        const edges = new Map<
            string,
            { x1: number; y1: number; x2: number; y2: number }
        >();

        const addEdge = (
            x1: number,
            y1: number,
            x2: number,
            y2: number
        ) => {
            const key1 = `${x1},${y1}-${x2},${y2}`;
            const key2 = `${x2},${y2}-${x1},${y1}`;

            if (edges.has(key2)) {
                edges.delete(key2);
            } else {
                edges.set(key1, { x1, y1, x2, y2 });
            }
        };

        focusedDisplaySquares.forEach(({ row, col }) => {
            if (!hasFocusedAttack(row - 1, col)) {
                addEdge(col, row, col + 1, row);
            }

            if (!hasFocusedAttack(row + 1, col)) {
                addEdge(col, row + 1, col + 1, row + 1);
            }

            if (!hasFocusedAttack(row, col - 1)) {
                addEdge(col, row, col, row + 1);
            }

            if (!hasFocusedAttack(row, col + 1)) {
                addEdge(col + 1, row, col + 1, row + 1);
            }
        });

        return [...edges.values()]
            .map(
                (edge) =>
                    `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`
            )
            .join(" ");
    })();


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
                    
                    const isAttackTarget = focusedAttackSquares.some(
                        (square) =>
                            square.row === actualRow &&
                            square.col === actualCol
                    );

                    const isAttackingPiece =
                        piece !== null &&
                        attackingPieceIds.includes(piece.id);
                    

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
                                    ${settings.showLastMove && isLastMove ? "last-move" : ""}
                                    ${isAttackTarget ? "attack-target" : ""}
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
                                        ${isAttackingPiece ? "attacking-piece" : ""}
                                    `}
                                    onMouseEnter={() => {
                                        if (
                                            settings.showOpponentAttack &&
                                            myPlayer !== null &&
                                            piece.player !== myPlayer
                                        ) {
                                            setFocusedPieceSquare({
                                                row: actualRow,
                                                col: actualCol,
                                            });
                                        }

                                        if (
                                            settings.showAttackedByOpponent &&
                                            myPlayer !== null &&
                                            piece.player === myPlayer
                                        ) {
                                            setTargetPieceSquare({
                                                row: actualRow,
                                                col: actualCol,
                                            });
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        setFocusedPieceSquare(null);
                                        setTargetPieceSquare(null);
                                    }}
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

            <svg
                className="attacking-piece-arrows"
                viewBox="0 0 9 9"
                preserveAspectRatio="none"
            >
                {targetPieceSquare &&
                    attackingPieceIds.map((pieceId) => {
                        const position = displayBoard
                            .flatMap((row, rowIndex) =>
                                row.map((piece, colIndex) => ({
                                    piece,
                                    row: rowIndex,
                                    col: colIndex,
                                }))
                            )
                            .find(({ piece }) => piece?.id === pieceId);

                        if (!position) return null;

                        const targetRow =
                            myPlayer === "gote"
                                ? 8 - targetPieceSquare.row
                                : targetPieceSquare.row;

                        const targetCol =
                            myPlayer === "gote"
                                ? 8 - targetPieceSquare.col
                                : targetPieceSquare.col;

                        const startX = position.col + 0.5;
                        const startY = position.row + 0.5;

                        const endX = targetCol + 0.5;
                        const endY = targetRow + 0.5;

                        const dx = endX - startX;
                        const dy = endY - startY;
                        const length = Math.sqrt(dx * dx + dy * dy);

                        const midX = (startX + endX) / 2;
                        const midY = (startY + endY) / 2;

                        const offset = Math.min(length * 0.3, 1.8);

                        const controlX =
                            midX - (dy / length) * offset;

                        const controlY =
                            midY + (dx / length) * offset;

                        const arrowT = 0.95;

                        // 矢印の位置
                        const arrowX =
                            (1 - arrowT) * (1 - arrowT) * startX +
                            2 * (1 - arrowT) * arrowT * controlX +
                            arrowT * arrowT * endX;

                        const arrowY =
                            (1 - arrowT) * (1 - arrowT) * startY +
                            2 * (1 - arrowT) * arrowT * controlY +
                            arrowT * arrowT * endY;

                        // 矢印位置での曲線の進行方向
                        const tangentX =
                            2 *
                            ((1 - arrowT) * (controlX - startX) +
                                arrowT * (endX - controlX));

                        const tangentY =
                            2 *
                            ((1 - arrowT) * (controlY - startY) +
                                arrowT * (endY - controlY));

                        const angle =
                            Math.atan2(tangentY, tangentX) *
                            (180 / Math.PI);
                        
                        const gradientId = `attackLineGradient-${pieceId}`;

                        // 軌道線も矢印の位置までで終了
                        const pathD = `
                            M ${startX} ${startY}
                            Q ${controlX} ${controlY}
                            ${arrowX} ${arrowY}
                        `;

                        return (
                            <g key={pieceId}>
                                <defs>
                                    <linearGradient
                                        id={gradientId}
                                        gradientUnits="userSpaceOnUse"
                                        x1={startX}
                                        y1={startY}
                                        x2={arrowX}
                                        y2={arrowY}
                                    >
                                    <stop
                                        offset="0%"
                                        stopColor="rgba(220, 90, 90, 0.65)"
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="rgba(220, 90, 90, 0.30)"
                                    />
                                    </linearGradient>
                                </defs>

                                <path
                                    d={pathD}
                                    className="attack-flow-trail"
                                    style={{
                                        stroke: `url(#${gradientId})`,
                                    }}
                                />

                                <path
                                    d="
                                        M 0 0
                                        L -0.16 -0.07
                                        M 0 0
                                        L -0.16 0.07
                                    "
                                    className="attack-arrow-head"
                                    style={{
                                        stroke: `url(#${gradientId})`,
                                    }}
                                    transform={`
                                        translate(${arrowX} ${arrowY})
                                        rotate(${angle})
                                    `}
                                />
                            </g>
                        );
                    })}
            </svg>

            <svg
                className="attack-target-outline"
                viewBox="0 0 9 9"
                preserveAspectRatio="none"
            >
                <path d={focusedAttackPath} />
            </svg>

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
