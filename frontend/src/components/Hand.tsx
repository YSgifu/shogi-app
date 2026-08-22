"use client";

import type {
    Hands,
    Player,
    CapturedPieceType,
} from "@/types/shogi";
import { pieceNames } from "@/lib/piece";

type HandProps = {
    player: Player;
    hands: Hands;
    selectedHandPiece: {
        type: CapturedPieceType;
        player: Player;
    } | null;
    onPieceClick: (
        type: CapturedPieceType,
        player: Player
    ) => void;
};

export default function Hand({
    player,
    hands,
    selectedHandPiece,
    onPieceClick,
}: HandProps) {
    return (
            <div className="hand-pieces">
                {Object.entries(hands[player]).map(([type, count]) =>
                    count > 0 ? (
                        <div
                            key={type}
                            className={`hand-piece ${player} ${
                                selectedHandPiece?.type === type &&
                                selectedHandPiece?.player === player
                                    ? "selected"
                                    : ""
                            }`}
                            onClick={() =>
                                onPieceClick(
                                    type as CapturedPieceType,
                                    player
                                )
                            }
                        >
                            <div
                                className={`piece ${player} ${type.toLowerCase()}`}
                            >
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
    );
}