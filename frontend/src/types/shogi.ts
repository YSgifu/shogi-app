export type PieceType =
    | "FU"
    | "KY"
    | "KE"
    | "GI"
    | "KI"
    | "KA"
    | "HI"
    | "OU";

export type Player = "sente" | "gote";

export type Piece = {
    id: number;
    type: PieceType;
    player: Player;
    promoted: boolean;
};

export type Board = (Piece | null)[][];

export type CapturedPieceType = Exclude<PieceType, "OU">;

export type CapturedPieces = {
    [key in CapturedPieceType]: number;
};

export type Hands = {
    sente: CapturedPieces;
    gote: CapturedPieces;
};