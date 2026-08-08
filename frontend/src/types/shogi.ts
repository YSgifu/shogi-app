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
    type: PieceType;
    player: Player;
    promoted: boolean;
};

export type Board = (Piece | null)[][];